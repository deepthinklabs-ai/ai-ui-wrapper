/**
 * Employee AI Client
 * Wrapper for making AI calls with Virtual Employee context
 */

import { sendUnifiedChatRequest, type UnifiedChatMessage } from '@/lib/unifiedAIClient';
import type { VirtualEmployee, Team } from '../types';
import { composeEmployeeSystemPrompt, composeTrainingSystemPrompt } from './promptComposer';

export type EmployeeChatOptions = {
  userId: string;
  userTier: 'free' | 'pro';
  isTraining?: boolean;
  trainingSummaries?: string[];
  additionalContext?: string;
};

/**
 * Send a chat message as a Virtual Employee
 * Automatically includes the employee's system prompt and context
 */
export async function sendEmployeeChat(
  employee: VirtualEmployee,
  team: Team,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: EmployeeChatOptions
) {
  const { userId, userTier, isTraining = false, trainingSummaries = [], additionalContext } = options;

  // Build system prompt
  let systemPrompt: string;
  if (isTraining) {
    systemPrompt = composeTrainingSystemPrompt(employee, team);
  } else {
    systemPrompt = composeEmployeeSystemPrompt(employee, team, trainingSummaries);
  }

  // Add additional context if provided
  if (additionalContext) {
    systemPrompt += `\n\n${additionalContext}`;
  }

  // Build message array with system prompt
  const chatMessages: UnifiedChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Call the AI with the employee's model
  const response = await sendUnifiedChatRequest(chatMessages, {
    model: employee.model_name as any, // Cast to AIModel type
    userTier,
    userId,
    enableWebSearch: true, // Enable web search for employees
  });

  return {
    content: response.content,
    usage: response.usage,
    citations: response.citations,
  };
}

/**
 * Generate a summary of a training session
 */
export async function generateTrainingSummary(
  employee: VirtualEmployee,
  messages: Array<{ role: string; content: string }>,
  options: EmployeeChatOptions
) {
  const summaryPrompt = `
Please analyze this training session transcript and generate a concise summary of key learnings.

Focus on:
1. New knowledge or skills learned
2. Important processes or procedures
3. Tools or resources to use
4. Common patterns or best practices
5. Important clarifications or corrections

Transcript:
${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

Provide a bullet-point summary of the most important takeaways.
  `.trim();

  const response = await sendUnifiedChatRequest(
    [
      {
        role: 'user',
        content: summaryPrompt,
      },
    ],
    {
      model: employee.model_name as any,
      userTier: options.userTier,
      userId: options.userId,
    }
  );

  return response.content;
}

/**
 * Update an employee's system prompt based on training (OPTIMIZED - single AI call)
 * Generates summary and updates prompt in one go
 */
export async function updateSystemPromptFromTraining(
  employee: VirtualEmployee,
  trainingSummary: string,
  options: EmployeeChatOptions,
  notifyEmployee?: VirtualEmployee | null
) {
  let updatePrompt = `
I have a Virtual Employee with the following system prompt:

${employee.system_prompt}

They just completed a training session with these key learnings:

${trainingSummary}

Please generate an updated system prompt that:
1. Retains all the original information and structure
2. Incorporates the new training knowledge
3. Keeps the prompt concise and well-organized
4. Maintains the same tone and style`;

  if (notifyEmployee) {
    updatePrompt += `
5. IMPORTANT: Adds a clear instruction to notify ${notifyEmployee.name} (${notifyEmployee.title}) when their task is complete by sending them the results

Add this notification instruction prominently in the prompt, making it clear that when ${employee.name} completes their assigned work, they MUST send the results to ${notifyEmployee.name}.`;
  }

  updatePrompt += `

Output only the updated system prompt, no explanation.
  `.trim();

  const response = await sendUnifiedChatRequest(
    [
      {
        role: 'user',
        content: updatePrompt,
      },
    ],
    {
      model: employee.model_name as any,
      userTier: options.userTier,
      userId: options.userId,
    }
  );

  return response.content;
}

/**
 * OPTIMIZED: Generate summary and update system prompt in a single AI call
 * This is much faster than calling generateTrainingSummary + updateSystemPromptFromTraining separately
 */
export async function generateSummaryAndUpdatePrompt(
  employee: VirtualEmployee,
  messages: Array<{ role: string; content: string }>,
  options: EmployeeChatOptions,
  notifyEmployee?: VirtualEmployee | null
): Promise<{ summary: string; updatedPrompt: string }> {
  let combinedPrompt = `
You are helping to update a Virtual Employee's system prompt after a training session.

CURRENT SYSTEM PROMPT:
${employee.system_prompt}

TRAINING SESSION TRANSCRIPT:
${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

TASK:
1. First, analyze the training session and create a concise bullet-point summary of key learnings (focus on: new knowledge, processes, tools, best practices, clarifications)
2. Then, generate an updated system prompt that:
   - Retains all the original information and structure
   - Incorporates the new training knowledge
   - Keeps the prompt concise and well-organized
   - Maintains the same tone and style`;

  if (notifyEmployee) {
    combinedPrompt += `
   - IMPORTANT: Adds a clear instruction to notify ${notifyEmployee.name} (${notifyEmployee.title}) when their task is complete by sending them the results`;
  }

  combinedPrompt += `

OUTPUT FORMAT (use exactly this format):
---SUMMARY---
[Your bullet-point summary here]

---UPDATED_PROMPT---
[The complete updated system prompt here]
  `.trim();

  const response = await sendUnifiedChatRequest(
    [
      {
        role: 'user',
        content: combinedPrompt,
      },
    ],
    {
      model: employee.model_name as any,
      userTier: options.userTier,
      userId: options.userId,
    }
  );

  // Parse the response to extract summary and updated prompt
  const content = response.content;
  const summaryMatch = content.match(/---SUMMARY---\s*([\s\S]*?)\s*---UPDATED_PROMPT---/);
  const promptMatch = content.match(/---UPDATED_PROMPT---\s*([\s\S]*)/);

  const summary = summaryMatch ? summaryMatch[1].trim() : content.substring(0, 500);
  const updatedPrompt = promptMatch ? promptMatch[1].trim() : employee.system_prompt;

  return {
    summary,
    updatedPrompt,
  };
}
