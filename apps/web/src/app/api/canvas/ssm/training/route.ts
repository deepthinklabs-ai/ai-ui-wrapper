/**
 * POST /api/canvas/ssm/training
 *
 * Handles conversational training for SSM nodes.
 * Multi-turn conversation to gather monitoring requirements.
 *
 * Architecture:
 * - Maintains conversation state across messages
 * - Extracts key information from user responses
 * - Determines when to summarize and finalize
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  SSMTrainingRequest,
  SSMTrainingResponse,
  SSMTrainingPhase,
  SSMExtractedInfo,
  SSMTrainingMessage,
} from '@/app/canvas/features/ssm-agent/types/training';
import {
  buildSystemPrompt,
  buildConversationHistory,
  generateMessageId,
  generateSessionId,
} from '@/app/canvas/features/ssm-agent/lib/trainingPrompts';
import { getProviderKey } from '@/lib/secretManager/getKey';

// ============================================================================
// IN-MEMORY SESSION STORE (Replace with Redis/DB in production)
// ============================================================================

interface SessionStore {
  [sessionId: string]: {
    nodeId: string;
    canvasId: string;
    userId: string;
    phase: SSMTrainingPhase;
    messages: SSMTrainingMessage[];
    extractedInfo: SSMExtractedInfo;
    startedAt: string;
    lastActivityAt: string; // Updates on each message for inactivity-based expiry
  };
}

// Global store accessible from finalize route
declare global {
  // eslint-disable-next-line no-var
  var ssmTrainingSessions: SessionStore | undefined;
}

function getSessionStore(): SessionStore {
  if (!global.ssmTrainingSessions) {
    global.ssmTrainingSessions = {};
  }
  return global.ssmTrainingSessions;
}

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours from session start

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  const sessions = getSessionStore();
  for (const [id, session] of Object.entries(sessions)) {
    // Check session start time - 3 hour max duration
    const sessionStart = new Date(session.startedAt).getTime();
    if (now - sessionStart > SESSION_TTL_MS) {
      delete sessions[id];
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SSMTrainingResponse>> {
  try {
    const body: SSMTrainingRequest = await request.json();
    const { sessionId, nodeId, canvasId, userId, message, provider } = body;

    // Validate required fields
    if (!nodeId || !canvasId || !userId || !message) {
      return NextResponse.json({
        success: false,
        sessionId: '',
        message: { id: '', role: 'system', content: '', timestamp: '' },
        phase: 'greeting',
        extractedInfo: {},
        isComplete: false,
        error: 'Missing required fields',
      }, { status: 400 });
    }

    // Get or create session
    const sessions = getSessionStore();
    let session = sessionId ? sessions[sessionId] : null;
    const isNewSession = !session;
    let currentSessionId = sessionId || '';

    if (!session) {
      currentSessionId = generateSessionId();
      const now = new Date().toISOString();
      session = {
        nodeId,
        canvasId,
        userId,
        phase: 'greeting',
        messages: [],
        extractedInfo: {},
        startedAt: now,
        lastActivityAt: now,
      };
      sessions[currentSessionId] = session;

      // Add initial greeting from assistant
      const greetingMessage: SSMTrainingMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: getGreetingMessage(),
        timestamp: new Date().toISOString(),
      };
      session.messages.push(greetingMessage);
    }

    // Add user message and update activity timestamp
    const messageTimestamp = new Date().toISOString();
    const userMessage: SSMTrainingMessage = {
      id: generateMessageId(),
      role: 'user',
      content: message,
      timestamp: messageTimestamp,
    };
    session.messages.push(userMessage);
    session.lastActivityAt = messageTimestamp; // Reset inactivity timer

    // Update extracted info based on user message
    session.extractedInfo = extractInfoFromMessage(message, session.extractedInfo);

    // Determine next phase
    session.phase = determinePhase(session.phase, session.messages.length, session.extractedInfo, message);

    // Check if training should complete
    if (session.phase === 'generating') {
      // Return completion signal - client should call finalize endpoint
      return NextResponse.json({
        success: true,
        sessionId: currentSessionId,
        message: {
          id: generateMessageId(),
          role: 'assistant',
          content: '✅ Training complete! I\'m now generating your monitoring rules...',
          timestamp: new Date().toISOString(),
        },
        phase: 'complete',
        extractedInfo: session.extractedInfo,
        isComplete: true,
        sessionStartedAt: session.startedAt,
      });
    }

    // Get user's API key for the selected provider
    const providerKey = provider === 'claude' ? 'claude' : 'openai';
    const apiKey = await getProviderKey(userId, providerKey);
    if (!apiKey) {
      const providerName = provider === 'claude' ? 'Claude' : 'OpenAI';
      return NextResponse.json({
        success: false,
        sessionId: currentSessionId,
        message: { id: '', role: 'system', content: '', timestamp: '' },
        phase: session.phase,
        extractedInfo: session.extractedInfo,
        isComplete: false,
        sessionStartedAt: session.startedAt,
        error: `Please configure your ${providerName} API key in Settings to use SSM training.`,
      }, { status: 403 });
    }

    // Generate AI response
    const aiResponse = await generateTrainingResponse(
      session.messages,
      session.phase,
      session.extractedInfo,
      provider,
      apiKey
    );

    // Add AI response to session
    const assistantMessage: SSMTrainingMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMessage);

    return NextResponse.json({
      success: true,
      sessionId: currentSessionId,
      message: assistantMessage,
      phase: session.phase,
      extractedInfo: session.extractedInfo,
      isComplete: false,
      sessionStartedAt: session.startedAt,
    });

  } catch (error) {
    console.error('[SSM Training] Error:', error);
    return NextResponse.json({
      success: false,
      sessionId: '',
      message: { id: '', role: 'system', content: '', timestamp: '' },
      phase: 'greeting',
      extractedInfo: {},
      isComplete: false,
      error: 'Failed to process training message',
    }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initial greeting message
 */
function getGreetingMessage(): string {
  return `Hi! 👋 I'm here to help you set up monitoring for this SSM node.

What would you like me to watch for? For example:
- **Email security** (phishing, suspicious links, impersonation)
- **Activity monitoring** (specific keywords, patterns, or events)
- **Compliance** (sensitive data, policy violations)

What's your main goal?`;
}

/**
 * Extract information from user message
 */
function extractInfoFromMessage(
  message: string,
  currentInfo: SSMExtractedInfo
): SSMExtractedInfo {
  const lowerMessage = message.toLowerCase();
  const updatedInfo = { ...currentInfo };

  // Extract monitoring goal
  if (!updatedInfo.monitoringGoal) {
    if (lowerMessage.includes('phishing') || lowerMessage.includes('security') || lowerMessage.includes('fraud')) {
      updatedInfo.monitoringGoal = 'Security threat detection';
    } else if (lowerMessage.includes('compliance') || lowerMessage.includes('sensitive')) {
      updatedInfo.monitoringGoal = 'Compliance monitoring';
    } else if (lowerMessage.includes('keyword') || lowerMessage.includes('watch for')) {
      updatedInfo.monitoringGoal = 'Keyword/pattern monitoring';
    }
  }

  // Extract specific threats mentioned
  const threatKeywords = [
    'phishing', 'impersonation', 'ceo fraud', 'invoice', 'urgent',
    'password', 'credential', 'malware', 'link', 'attachment',
  ];
  const foundThreats = threatKeywords.filter(t => lowerMessage.includes(t));
  if (foundThreats.length > 0) {
    updatedInfo.specificThreats = [
      ...(updatedInfo.specificThreats || []),
      ...foundThreats.filter(t => !updatedInfo.specificThreats?.includes(t)),
    ];
  }

  // Extract trusted domains
  const domainMatch = message.match(/@[\w.-]+\.\w+/g);
  if (domainMatch) {
    updatedInfo.trustedDomains = [
      ...(updatedInfo.trustedDomains || []),
      ...domainMatch.map(d => d.substring(1)).filter(d => !updatedInfo.trustedDomains?.includes(d)),
    ];
  }

  // Extract urgency preferences
  if (lowerMessage.includes('urgent') && (lowerMessage.includes('yes') || lowerMessage.includes('definitely'))) {
    updatedInfo.alertOnUrgency = true;
  }

  // Extract external sender preferences
  if (lowerMessage.includes('external') && (lowerMessage.includes('yes') || lowerMessage.includes('alert'))) {
    updatedInfo.alertOnExternalSenders = true;
  }

  return updatedInfo;
}

/**
 * Determine training phase based on conversation state
 */
function determinePhase(
  currentPhase: SSMTrainingPhase,
  messageCount: number,
  info: SSMExtractedInfo,
  userMessage: string
): SSMTrainingPhase {
  const lowerMessage = userMessage.toLowerCase();

  // Check for user confirmation to finish
  if (currentPhase === 'confirming') {
    if (
      lowerMessage.includes('yes') ||
      lowerMessage.includes('confirm') ||
      lowerMessage.includes('looks good') ||
      lowerMessage.includes('correct') ||
      lowerMessage === 'y'
    ) {
      return 'generating';
    }
    return 'gathering'; // User wants changes
  }

  // After summarizing, move to confirming
  if (currentPhase === 'summarizing') {
    return 'confirming';
  }

  // After greeting, move to gathering
  if (currentPhase === 'greeting') {
    return 'gathering';
  }

  // Check if user wants to finish
  if (
    lowerMessage.includes('done') ||
    lowerMessage.includes('finish') ||
    lowerMessage.includes("that's all") ||
    lowerMessage.includes('thats all') ||
    lowerMessage.includes('ready')
  ) {
    const hasInfo = info.monitoringGoal || (info.specificThreats?.length ?? 0) > 0;
    return hasInfo ? 'summarizing' : 'clarifying';
  }

  // After enough exchanges with good info, suggest summarizing
  const hasGoodInfo = info.monitoringGoal && (info.specificThreats?.length ?? 0) > 0;
  if (currentPhase === 'gathering' && messageCount >= 8 && hasGoodInfo) {
    return 'summarizing';
  }

  return currentPhase;
}

/**
 * Generate AI response for training
 */
async function generateTrainingResponse(
  messages: SSMTrainingMessage[],
  phase: SSMTrainingPhase,
  extractedInfo: SSMExtractedInfo,
  provider: 'claude' | 'openai',
  apiKey: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(phase, extractedInfo);
  const conversationHistory = buildConversationHistory(messages);

  if (provider === 'claude') {
    return generateWithClaude(systemPrompt, conversationHistory, apiKey);
  } else {
    return generateWithOpenAI(systemPrompt, conversationHistory, apiKey);
  }
}

/**
 * Generate response using Claude
 */
async function generateWithClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSM Training] Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || getFallbackResponse();
  } catch (error) {
    console.error('[SSM Training] Claude error:', error);
    throw error;
  }
}

/**
 * Generate response using OpenAI
 */
async function generateWithOpenAI(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSM Training] OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || getFallbackResponse();
  } catch (error) {
    console.error('[SSM Training] OpenAI error:', error);
    throw error;
  }
}

/**
 * Fallback response if AI fails
 */
function getFallbackResponse(): string {
  return "I understand. Could you tell me more about what specific patterns or events you'd like me to monitor for?";
}

// ============================================================================
// GET SESSION (for debugging/resuming)
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const sessions = getSessionStore();

  if (!sessionId || !sessions[sessionId]) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = sessions[sessionId];
  return NextResponse.json({
    sessionId,
    phase: session.phase,
    messages: session.messages,
    extractedInfo: session.extractedInfo,
  });
}
