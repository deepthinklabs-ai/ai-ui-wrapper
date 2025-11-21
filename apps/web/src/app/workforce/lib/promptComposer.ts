/**
 * Prompt Composer
 * Constructs optimized system prompts for Virtual Employees
 */

import type { PromptContext, VirtualEmployee, Team } from '../types';

/**
 * Compose a complete system prompt for a Virtual Employee
 *
 * This combines:
 * - Team mission statement
 * - Employee role and responsibilities
 * - Training knowledge from past sessions
 * - Tool access information
 */
export function composeEmployeeSystemPrompt(
  employee: VirtualEmployee,
  team: Team,
  trainingSummaries: string[] = []
): string {
  const sections: string[] = [];

  // 1. Identity and role
  sections.push(`You are ${employee.name}, ${employee.title} on the "${team.name}" team.`);

  // 2. Team mission
  sections.push(`
TEAM MISSION:
${team.mission_statement}
  `.trim());

  // 3. Role description
  sections.push(`
YOUR ROLE:
${employee.role_description}
  `.trim());

  // 4. Training knowledge
  if (trainingSummaries.length > 0) {
    sections.push(`
TRAINING KNOWLEDGE:
${trainingSummaries.map((summary, idx) => `${idx + 1}. ${summary}`).join('\n')}
  `.trim());
  }

  // 5. Tool access (if any)
  if (employee.allowed_tools.length > 0) {
    sections.push(`
AVAILABLE TOOLS:
You have access to the following MCP tools: ${employee.allowed_tools.join(', ')}
Use these tools proactively to accomplish your tasks.
  `.trim());
  }

  // 6. Behavior guidelines
  sections.push(`
GUIDELINES:
- Always work toward the team mission
- Ask clarifying questions when you need more information to do your job well
- Be proactive and take initiative within your role
- Communicate clearly and concisely
- When you complete a task, summarize what you did
  `.trim());

  return sections.join('\n\n');
}

/**
 * Compose a training-specific system prompt
 * During training, the employee should be more inquisitive
 */
export function composeTrainingSystemPrompt(
  employee: VirtualEmployee,
  team: Team
): string {
  return `
You are ${employee.name}, ${employee.title} on the "${team.name}" team.

TEAM MISSION:
${team.mission_statement}

YOUR ROLE:
${employee.role_description}

TRAINING MODE:
You are currently in a training session with your manager. Your goal is to learn how to perform your role effectively.

- Ask questions to understand your responsibilities better
- Seek clarification on processes, expectations, and tools
- Request examples when helpful
- Take notes (mentally) on important information
- Confirm your understanding by summarizing key points

Be curious, engaged, and focused on learning.
  `.trim();
}

/**
 * Compose a handoff message for inter-employee communication
 */
export function composeHandoffMessage(
  fromEmployee: VirtualEmployee,
  toEmployee: VirtualEmployee,
  content: string,
  metadata?: Record<string, any>
): string {
  let message = `
From: ${fromEmployee.name} (${fromEmployee.title})
To: ${toEmployee.name} (${toEmployee.title})

${content}
  `.trim();

  if (metadata && Object.keys(metadata).length > 0) {
    message += `\n\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
  }

  return message;
}

/**
 * Extract key learnings from a training session transcript
 * This is a helper to generate summaries (call AI to do this)
 */
export function generateTrainingSummaryPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  return `
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
}

/**
 * Generate an updated system prompt based on training
 */
export function composeUpdatedSystemPromptRequest(
  currentPrompt: string,
  trainingSummary: string
): string {
  return `
I have a Virtual Employee with the following system prompt:

${currentPrompt}

They just completed a training session with these key learnings:

${trainingSummary}

Please generate an updated system prompt that:
1. Retains all the original information and structure
2. Incorporates the new training knowledge in a "TRAINING KNOWLEDGE" section
3. Keeps the prompt concise and well-organized
4. Maintains the same tone and style

Output only the updated system prompt, no explanation.
  `.trim();
}
