"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Message, MessageRole, ToolCall, ToolResult } from "@/types/chat";
import { sendUnifiedChatRequest, type UnifiedContentPart } from "@/lib/unifiedAIClient";
import { generateThreadTitle, shouldGenerateTitle } from "@/lib/titleGenerator";
import { processFiles, formatFilesForMessage } from "@/lib/fileProcessor";
import { getSelectedModel } from "@/lib/apiKeyStorage";
import { useMCPServers } from "./useMCPServers";
import { formatToolsForClaude, parseClaudeToolUse, formatToolResultForClaude } from "@/lib/mcpToolFormatter";
import { executeToolCalls } from "@/lib/toolExecutor";
import { getMCPServers } from "@/lib/mcpStorage";
import { getSlackTools, generateSlackSystemPrompt } from "@/lib/slackMCPIntegration";

// Gmail tool types (imported inline to avoid circular deps)
interface GmailToolConfig {
  enabled: boolean;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  systemPrompt: string;
  executor: (toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>) => Promise<Array<{ toolCallId: string; result: string; isError: boolean }>>;
}

type UseMessagesOptions = {
  onThreadTitleUpdated?: () => void;
  systemPromptAddition?: string;
  userTier?: 'free' | 'pro';
  userId?: string;
  enableWebSearch?: boolean;
  disableMCPTools?: boolean;
  gmailTools?: GmailToolConfig; // Gmail integration for Genesis Bots
};

type UseMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  sendMessage: (content: string, files?: File[], overrideThreadId?: string) => Promise<void>;
  summarizeThread: () => Promise<void>;
  generateSummary: () => Promise<string>;
  refreshMessages: () => Promise<void>;
};

export function useMessages(
  threadId: string | null,
  options?: UseMessagesOptions
): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sendInFlight, setSendInFlight] = useState(false);
  const [summarizeInFlight, setSummarizeInFlight] = useState(false);

  // Get MCP tools for tool calling
  const { tools, isEnabled: isMCPEnabled } = useMCPServers();

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    void refreshMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const refreshMessages = async () => {
    if (!threadId) return;
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data ?? []);
    } catch (err: any) {
      console.error("refreshMessages error:", err);
      setMessagesError(err.message ?? "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string, files?: File[], overrideThreadId?: string) => {
    // Use overrideThreadId if provided, otherwise use the hook's threadId
    const activeThreadId = overrideThreadId || threadId;

    if (!activeThreadId || (!content.trim() && (!files || files.length === 0))) return;

    setSendInFlight(true);
    try {
      // Process files if provided
      const processedFiles = files && files.length > 0 ? await processFiles(files) : [];

      // Build the final content for database storage
      // Include text files inline in the stored message
      const textFilesContent = formatFilesForMessage(processedFiles);
      const dbContent = content + textFilesContent;

      // Store attachment metadata for later restoration
      const attachmentMetadata = processedFiles.length > 0
        ? processedFiles.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            content: f.content,
            isImage: f.isImage,
          }))
        : null;

      // 1) Insert user message into DB
      const { data: insertedUser, error: insertUserError } = await supabase
        .from("messages")
        .insert({
          thread_id: activeThreadId,
          role: "user",
          content: dbContent,
          model: null,
          attachments: attachmentMetadata,
        })
        .select()
        .single();

      if (insertUserError) throw insertUserError;
      if (!insertedUser) throw new Error("Failed to insert user message");

      // 2) Optimistically add user message to local state
      setMessages((prev) => [...prev, insertedUser as Message]);

      // 3) Build payload for chat API (full conversation + new message)
      // For previous messages, use simple string content
      const previousMessages = messages.map((m) => ({
        role: m.role as MessageRole,
        content: m.content,
      }));

      // For the new message, if there are images, use the vision format
      const imageFiles = processedFiles.filter(f => f.isImage);
      let newMessageContent: string | UnifiedContentPart[];

      if (imageFiles.length > 0) {
        // Use vision format with content parts
        const contentParts: UnifiedContentPart[] = [];

        // Add text part if there's any text
        if (content.trim() || processedFiles.some(f => !f.isImage)) {
          contentParts.push({
            type: "text",
            text: dbContent,
          });
        }

        // Add image parts
        imageFiles.forEach(img => {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${img.type};base64,${img.content}`,
            },
          });
        });

        newMessageContent = contentParts;
      } else {
        // No images, use simple string content
        newMessageContent = dbContent;
      }

      // Add system prompt if provided (for step-by-step mode or other instructions)
      const payloadMessages: Array<{ role: MessageRole; content: string | UnifiedContentPart[] }> = [];

      if (options?.systemPromptAddition) {
        payloadMessages.push({
          role: "system" as MessageRole,
          content: options.systemPromptAddition,
        });
      }

      // Add web search encouragement system prompt (only if web search is enabled)
      if (options?.enableWebSearch !== false) {
        payloadMessages.push({
          role: "system" as MessageRole,
          content: `🌐 WEB SEARCH: You have real-time web search. For news/current events, always cite DIRECT article URLs (not homepages/feeds). Each story needs its own specific URL. Format: [Article Title](direct-article-url)`,
        });
      }

      // 4) Format tools for Claude if we have MCP tools AND MCP is enabled AND not disabled via options
      const shouldUseMCPTools = tools.length > 0 && isMCPEnabled && !options?.disableMCPTools;
      console.log('[MCP Tools Debug]', {
        toolsLength: tools.length,
        isMCPEnabled,
        disableMCPTools: options?.disableMCPTools,
        shouldUseMCPTools,
      });
      let claudeTools = shouldUseMCPTools ? formatToolsForClaude(tools) : undefined;

      // 4b) Add Gmail tools if configured
      const gmailConfig = options?.gmailTools;
      if (gmailConfig?.enabled && gmailConfig.tools.length > 0) {
        console.log('[Gmail Tools Debug]', {
          enabled: gmailConfig.enabled,
          toolCount: gmailConfig.tools.length,
        });

        // Merge Gmail tools with existing tools
        claudeTools = [
          ...(claudeTools || []),
          ...gmailConfig.tools,
        ];

        // Add Gmail system prompt
        if (gmailConfig.systemPrompt) {
          payloadMessages.push({
            role: "system" as MessageRole,
            content: gmailConfig.systemPrompt,
          });
        }
      }

      // Add MCP context information if tools are available AND MCP is enabled AND not disabled
      if (claudeTools && claudeTools.length > 0 && shouldUseMCPTools) {
        // Group tools by server for better context
        const serverGroups = tools.reduce((acc, tool) => {
          const serverName = tool.serverName || 'Unknown';
          if (!acc[serverName]) acc[serverName] = [];
          acc[serverName].push(tool.name);
          return acc;
        }, {} as Record<string, string[]>);

        const toolSummary = Object.entries(serverGroups)
          .map(([server, toolNames]) => `- ${server}: ${toolNames.join(', ')}`)
          .join('\n');

        // Add general MCP context
        payloadMessages.push({
          role: "system" as MessageRole,
          content: `🔌 MCP TOOLS ENABLED - You have access to ${tools.length} external tools via Model Context Protocol (MCP):

${toolSummary}

IMPORTANT: You can and SHOULD use these tools to help the user. When the user asks questions or requests actions related to these services, proactively use the available tools to accomplish tasks.`,
        });

        // Extract GitHub tools if available
        const githubTools = tools.filter(t => t.serverName?.toLowerCase().includes('github'));
        if (githubTools.length > 0) {
          // Get the GitHub server configuration to extract username
          const allServers = getMCPServers();
          const githubServer = allServers.find(s =>
            s.name.toLowerCase().includes('github') && s.enabled
          );

          let githubUsername = '';
          if (githubServer?.env?.GITHUB_USERNAME) {
            githubUsername = githubServer.env.GITHUB_USERNAME;
          }

          const usernameContext = githubUsername
            ? `\n\nIMPORTANT: You are authenticated as GitHub user "${githubUsername}". ALL repository operations (create, fork, etc.) MUST use "${githubUsername}" as the owner/username. Do NOT use any other username.`
            : '';

          payloadMessages.push({
            role: "system" as MessageRole,
            content: `🔧 GITHUB MCP CONTEXT: You have access to GitHub MCP tools. When performing ANY GitHub operations (creating repos, issues, PRs, etc.):

1. ALWAYS use the "get_user" tool FIRST to verify the authenticated user's login/username
2. NEVER assume or guess usernames like "Cjoseph4" or any other name
3. Use the authenticated user's actual login from get_user for ALL repository operations
4. The owner parameter in create_repository and other tools must be the authenticated user's login${usernameContext}

Example workflow:
- Step 1: Call get_user() to get authenticated user's login
- Step 2: Use that login as the owner parameter
- Step 3: Then proceed with create_repository or other operations

DO NOT skip get_user - ALWAYS call it first when working with GitHub.`,
          });
        }

        // Extract Slack tools if available
        const slackTools = getSlackTools(tools);
        if (slackTools.length > 0) {
          // Get the Slack server configuration to extract team ID
          const allServers = getMCPServers();
          const slackServer = allServers.find(s =>
            s.name.toLowerCase().includes('slack') && s.enabled
          );

          const teamId = slackServer?.env?.SLACK_TEAM_ID;

          payloadMessages.push({
            role: "system" as MessageRole,
            content: generateSlackSystemPrompt(slackTools, teamId),
          });
        }
      }

      payloadMessages.push(
        ...previousMessages,
        {
          role: "user" as MessageRole,
          content: newMessageContent,
        }
      );

      // Debug: Log system prompts being sent (optional - uncomment to see what's included)
      const systemPrompts = payloadMessages.filter(m => m.role === 'system');
      console.log('[System Prompts]', systemPrompts.length, 'prompts:', systemPrompts.map(p => p.content.substring(0, 100) + '...'));
      console.log('[Full System Prompts]', JSON.stringify(systemPrompts, null, 2));
      console.log('[Total Payload Messages]', payloadMessages.length, 'messages');
      console.log('[Full Payload]', JSON.stringify(payloadMessages, null, 2));

      // 5) Call unified AI client (routes to OpenAI or Claude based on selected model and user tier)
      const response = await sendUnifiedChatRequest(payloadMessages, {
        userTier: options?.userTier,
        userId: options?.userId,
        tools: claudeTools,
        enableWebSearch: options?.enableWebSearch ?? true,
      });

      // 6) Check if Claude wants to use tools
      let finalContent = response.content;
      let toolCalls: ToolCall[] | null = null;
      let toolResults: ToolResult[] | null = null;

      if (response.stop_reason === "tool_use" && response.contentBlocks) {
        console.log("[Tool Calling] Claude requested tool use");

        // Parse tool calls from response
        const parsedToolCalls = parseClaudeToolUse(response.contentBlocks);
        console.log("[Tool Calling] Parsed tool calls:", parsedToolCalls);

        if (parsedToolCalls.length > 0) {
          // Separate Gmail tools from MCP tools
          const gmailToolCalls = parsedToolCalls.filter(tc => tc.name.startsWith('gmail_'));
          const mcpToolCalls = parsedToolCalls.filter(tc => !tc.name.startsWith('gmail_'));

          // Execute MCP tools
          let mcpResults: ToolResult[] = [];
          if (mcpToolCalls.length > 0) {
            mcpResults = await executeToolCalls(mcpToolCalls, tools);
            console.log("[MCP Tool Calling] Tool execution results:", mcpResults);
          }

          // Execute Gmail tools if we have a Gmail executor
          let gmailResults: ToolResult[] = [];
          if (gmailToolCalls.length > 0 && gmailConfig?.executor) {
            console.log("[Gmail Tool Calling] Executing Gmail tools:", gmailToolCalls.map(t => t.name));
            gmailResults = await gmailConfig.executor(gmailToolCalls);
            console.log("[Gmail Tool Calling] Tool execution results:", gmailResults);
          }

          // Combine results
          const executedResults = [...mcpResults, ...gmailResults];
          console.log("[Tool Calling] Combined tool execution results:", executedResults);

          // Store tool calls and results
          toolCalls = parsedToolCalls;
          toolResults = executedResults;

          // Format tool results for Claude
          const toolResultBlocks = executedResults.map(result =>
            formatToolResultForClaude(result.toolCallId, result.result, result.isError)
          );

          // Continue conversation with tool results
          console.log("[MCP Tool Calling] Sending tool results back to Claude");
          const continueResponse = await sendUnifiedChatRequest(
            [
              ...payloadMessages,
              { role: "assistant" as MessageRole, content: response.contentBlocks },
              { role: "user" as MessageRole, content: toolResultBlocks },
            ],
            {
              userTier: options?.userTier,
              userId: options?.userId,
              tools: claudeTools,
              enableWebSearch: options?.enableWebSearch ?? true,
            }
          );

          // Use the final response content
          finalContent = continueResponse.content;
          console.log("[MCP Tool Calling] Got final response from Claude");
        }
      }

      // 7) Insert assistant reply into DB with token usage and tool data
      // Try with token fields first (if migration has been run)
      let insertedAssistant;
      let insertAssistantError;

      const assistantMessageWithTokens = {
        thread_id: activeThreadId,
        role: "assistant",
        content: finalContent,
        model: getSelectedModel(), // Use user's selected model
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
        tool_calls: toolCalls,
        tool_results: toolResults,
        citations: response.citations || null,
      };

      const result = await supabase
        .from("messages")
        .insert(assistantMessageWithTokens)
        .select()
        .single();

      insertedAssistant = result.data;
      insertAssistantError = result.error;

      // If error (likely due to missing columns), retry without token/tool fields
      if (insertAssistantError) {
        console.warn("Failed to insert with token/tool fields, retrying without them. Run the database migration to enable token tracking and tool calling.");
        const assistantMessageWithoutTokens = {
          thread_id: activeThreadId,
          role: "assistant",
          content: finalContent,
          model: getSelectedModel(),
        };

        const retryResult = await supabase
          .from("messages")
          .insert(assistantMessageWithoutTokens)
          .select()
          .single();

        insertedAssistant = retryResult.data;
        insertAssistantError = retryResult.error;
      }

      if (insertAssistantError) throw insertAssistantError;
      if (!insertedAssistant)
        throw new Error("Failed to insert assistant message");

      // 8) Optimistically add assistant message
      setMessages((prev) => [...prev, insertedAssistant as Message]);

      // 7) Auto-generate thread title if this is the first user message
      // Check the database directly for message count to avoid race conditions with local state
      try {
        console.log("[Title Generation] Checking if we should generate title for thread:", activeThreadId);

        // Count messages in the database for this thread (excluding the one we just inserted)
        const { count, error: countError } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", activeThreadId);

        console.log("[Title Generation] Message count in DB:", count);

        // If there are exactly 2 messages (1 user + 1 assistant we just added), this is the first exchange
        const isFirstMessage = count === 2;

        console.log("[Title Generation] isFirstMessage:", isFirstMessage);

        if (isFirstMessage) {
          // Fetch the current thread to check its title
          const { data: threadData, error: threadError } = await supabase
            .from("threads")
            .select("title")
            .eq("id", activeThreadId)
            .single();

          console.log("[Title Generation] Current thread title:", threadData?.title);
          console.log("[Title Generation] Should generate?", shouldGenerateTitle(threadData?.title ?? null));

          if (!threadError && threadData && shouldGenerateTitle(threadData.title)) {
            console.log("[Title Generation] Generating title for content:", content.substring(0, 100));

            // Generate a title based on the user's first message (use the original content without file additions)
            const newTitle = await generateThreadTitle(content, {
              userTier: options?.userTier,
              userId: options?.userId,
            });

            console.log("[Title Generation] Generated title:", newTitle);

            // Update the thread title in the database
            const { error: updateError } = await supabase
              .from("threads")
              .update({ title: newTitle })
              .eq("id", activeThreadId);

            if (updateError) {
              console.error("[Title Generation] Error updating thread title:", updateError);
            } else {
              console.log("[Title Generation] Successfully updated thread title to:", newTitle);
              // Notify parent component to refresh threads list
              options?.onThreadTitleUpdated?.();
            }
          }
        }
      } catch (titleErr) {
        console.error("[Title Generation] Error in title generation:", titleErr);
        // Don't fail the message send if title generation fails
      }

      // 8) FINAL: force a full refresh from DB to ensure consistency
      await refreshMessages();
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessagesError(err.message ?? "Error sending message");
    } finally {
      setSendInFlight(false);
    }
  };

  // Generate summary text without inserting it into the database
  const generateSummary = async (): Promise<string> => {
    if (messages.length === 0) {
      throw new Error("No messages to summarize");
    }

    // Create a comprehensive summary prompt that explicitly references the full conversation
    const conversationText = messages
      .map((m, idx) => `Message ${idx + 1} (${m.role}):\n${m.content}`)
      .join("\n\n");

    const systemPrompt = `You are an expert conversation summarizer. You will be given a COMPLETE conversation thread with ${messages.length} messages.

Your task is to provide a comprehensive summary of the ENTIRE conversation from beginning to end. Do not focus only on recent messages - analyze and summarize ALL messages in chronological order.

Required sections:
1. **Overview**: Brief summary of what this conversation is about
2. **Key Topics Discussed**: List all major topics covered throughout the thread (in order)
3. **Important Decisions & Conclusions**: Any decisions made or conclusions reached
4. **Action Items**: Tasks, next steps, or things to implement (if any)
5. **Technical Details**: Important code, configurations, or technical specifics mentioned

Be thorough and ensure you capture information from the BEGINNING, MIDDLE, and END of the conversation.`;

    const summaryPrompt = `Please summarize this complete conversation thread:\n\n${conversationText}`;

    const payloadMessages: { role: MessageRole; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: summaryPrompt },
    ];

    const response = await sendUnifiedChatRequest(payloadMessages, {
      userTier: options?.userTier,
      userId: options?.userId,
      enableWebSearch: options?.enableWebSearch ?? true,
    });
    return response.content;
  };

  const summarizeThread = async () => {
    if (!threadId || messages.length === 0) return;

    setSummarizeInFlight(true);
    try {
      const summaryBody = await generateSummary();
      const summaryContent = `**Thread summary**\n\n${summaryBody}`;

      const { data: summaryMessage, error: insertSummaryError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role: "assistant",
          content: summaryContent,
          model: getSelectedModel(),
        })
        .select()
        .single();

      if (insertSummaryError) throw insertSummaryError;
      if (!summaryMessage)
        throw new Error("Failed to insert summary message");

      setMessages((prev) => [...prev, summaryMessage as Message]);

      // Force refresh so the message list always reflects DB state
      await refreshMessages();
    } catch (err) {
      console.error("Error summarizing thread:", err);
      // we keep messagesError for sendMessage; summaries are "nice-to-have"
    } finally {
      setSummarizeInFlight(false);
    }
  };

  return {
    messages,
    loadingMessages,
    messagesError,
    sendInFlight,
    summarizeInFlight,
    sendMessage,
    summarizeThread,
    generateSummary,
    refreshMessages,
  };
}

