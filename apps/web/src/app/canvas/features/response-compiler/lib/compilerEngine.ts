/**
 * Response Compiler - Compiler Engine
 *
 * Core logic for compiling multiple agent responses into a single cohesive answer.
 */

import type { ResponseCompilerNodeConfig } from '../../../types';
import type { AgentResponse } from '../types';

/**
 * Build system prompt for the Response Compiler AI
 */
export function buildCompilerSystemPrompt(
  originalQuery: string,
  config: ResponseCompilerNodeConfig
): string {
  let prompt = `You are a Response Compiler that synthesizes multiple AI agent responses into a single, cohesive answer.

## Original User Query:
"${originalQuery}"

## Your Task:
You will receive responses from multiple AI agents that each handled a part of the user's request.
Your job is to:
1. Understand what each agent accomplished
2. Combine the information into a single, helpful response
3. Resolve any conflicts or redundancies
4. Present the combined result in a clear, organized manner

## Output Format: ${config.output_format}`;

  if (config.output_format === 'bullet_points') {
    prompt += `
- Use bullet points to organize the combined response
- Group related items together
- Keep each point concise`;
  } else if (config.output_format === 'prose') {
    prompt += `
- Write a natural, flowing response
- Use paragraphs to organize information logically
- Maintain a conversational tone`;
  } else if (config.output_format === 'structured') {
    prompt += `
- Use clear sections with headers
- Include summaries for each major action
- Provide structured data where applicable`;
  }

  if (config.include_source_attribution) {
    prompt += `

## Attribution:
Include brief attribution when relevant (e.g., "Your email was sent successfully" or "A calendar event has been created").
Don't just list which agent did what - integrate the attribution naturally into the response.`;
  }

  if (config.summarization_prompt) {
    prompt += `

## Additional Instructions:
${config.summarization_prompt}`;
  }

  prompt += `

## Important:
- Focus on what was accomplished, not the process
- If any actions failed, mention what didn't work and why (if known)
- Be concise but complete
- The user wants to know the outcome, not the technical details`;

  return prompt;
}

/**
 * Execute Response Compilation
 */
export async function executeResponseCompiler(
  config: ResponseCompilerNodeConfig,
  originalQuery: string,
  agentResponses: AgentResponse[],
  userId: string,
  internalBaseUrl: string
): Promise<string> {
  const startTime = Date.now();

  console.log(`[Response Compiler] Compiling ${agentResponses.length} responses`);
  console.log(`[Response Compiler] Strategy: ${config.compilation_strategy}`);

  // Filter successful responses
  const successfulResponses = agentResponses.filter(r => r.success);
  const failedResponses = agentResponses.filter(r => !r.success);

  console.log(`[Response Compiler] Successful: ${successfulResponses.length}, Failed: ${failedResponses.length}`);

  // Handle all failures
  if (successfulResponses.length === 0) {
    const errors = failedResponses.map(r => `${r.agentName}: ${r.error || 'Unknown error'}`);
    return `I encountered issues processing your request:\n\n${errors.map(e => `- ${e}`).join('\n')}`;
  }

  // Single response - return with optional attribution
  if (successfulResponses.length === 1) {
    const response = successfulResponses[0];
    let result = response.response;

    // Add failure notice if some agents failed
    if (failedResponses.length > 0) {
      const failedNames = failedResponses.map(r => r.agentName).join(', ');
      result += `\n\n(Note: Some actions couldn't be completed: ${failedNames})`;
    }

    return result;
  }

  // Multiple responses - apply compilation strategy
  if (config.compilation_strategy === 'concatenate') {
    return concatenateResponses(successfulResponses, failedResponses, config);
  }

  if (config.compilation_strategy === 'prioritized') {
    // Return the first successful response (assumes order matters)
    const primary = successfulResponses[0];
    let result = primary.response;

    if (successfulResponses.length > 1) {
      result += '\n\n**Additional Results:**\n';
      result += successfulResponses
        .slice(1)
        .map(r => `- ${r.agentName}: ${r.response.substring(0, 200)}${r.response.length > 200 ? '...' : ''}`)
        .join('\n');
    }

    return result;
  }

  // AI summarization (default)
  return await aiSummarize(
    config,
    originalQuery,
    successfulResponses,
    failedResponses,
    userId,
    internalBaseUrl
  );
}

/**
 * Simple concatenation of responses
 */
function concatenateResponses(
  successful: AgentResponse[],
  failed: AgentResponse[],
  config: ResponseCompilerNodeConfig
): string {
  let result = '';

  if (config.include_source_attribution) {
    result = successful
      .map(r => `**${r.agentName}:**\n${r.response}`)
      .join('\n\n---\n\n');
  } else {
    result = successful.map(r => r.response).join('\n\n---\n\n');
  }

  // Add failure notice
  if (failed.length > 0) {
    const failedNames = failed.map(r => r.agentName).join(', ');
    result += `\n\n---\n\n*Some actions couldn't be completed: ${failedNames}*`;
  }

  return result;
}

/**
 * AI-powered summarization
 */
async function aiSummarize(
  config: ResponseCompilerNodeConfig,
  originalQuery: string,
  successful: AgentResponse[],
  failed: AgentResponse[],
  userId: string,
  internalBaseUrl: string
): Promise<string> {
  const systemPrompt = buildCompilerSystemPrompt(originalQuery, config);

  // Build the user message with all responses
  let userMessage = `Here are the responses from the AI agents:\n\n`;

  successful.forEach((r, i) => {
    userMessage += `## Response ${i + 1} from "${r.agentName}":\n${r.response}\n\n`;
  });

  if (failed.length > 0) {
    userMessage += `## Failed Actions:\n`;
    failed.forEach(r => {
      userMessage += `- ${r.agentName}: ${r.error || 'Unknown error'}\n`;
    });
    userMessage += '\n';
  }

  userMessage += `Please compile these into a single, cohesive response for the user.`;

  // Determine API endpoint
  const apiEndpoint =
    config.model_provider === 'openai'
      ? '/api/pro/openai'
      : config.model_provider === 'claude'
      ? '/api/pro/claude'
      : '/api/pro/grok';

  try {
    const response = await fetch(new URL(apiEndpoint, internalBaseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        messages: [{ role: 'user', content: userMessage }],
        model: config.model_name,
        systemPrompt,
        temperature: config.temperature || 0.5,
        maxTokens: config.max_tokens || 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Response Compiler] AI API error: ${response.status} - ${errorText}`);
      // Fall back to concatenation
      return concatenateResponses(successful, failed, config);
    }

    const data = await response.json();
    const compiledResponse = data.content || data.message || '';

    console.log(`[Response Compiler] AI compilation complete (${compiledResponse.length} chars)`);

    return compiledResponse;
  } catch (error) {
    console.error(`[Response Compiler] AI compilation error:`, error);
    // Fall back to concatenation
    return concatenateResponses(successful, failed, config);
  }
}
