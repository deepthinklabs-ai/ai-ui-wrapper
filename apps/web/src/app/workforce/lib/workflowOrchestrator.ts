/**
 * Workflow Orchestrator (STUB for v1)
 * Handles multi-employee coordination and task handoffs
 *
 * This is a placeholder for future multi-agent orchestration logic.
 * In v1, we create the data structures and basic handoff mechanism.
 */

import type { VirtualEmployee, InterEmployeeMessage, MessageType } from '../types';
import { supabase } from '@/lib/supabaseClient';

/**
 * Send a message from one employee to another
 *
 * @param fromEmployee - Employee sending the message
 * @param toEmployee - Employee receiving the message
 * @param messageType - Type of message (report, handoff, question)
 * @param content - Message content
 * @param metadata - Additional structured data
 */
export async function sendInterEmployeeMessage(
  fromEmployee: VirtualEmployee,
  toEmployee: VirtualEmployee,
  messageType: MessageType,
  content: string,
  metadata: Record<string, any> = {}
): Promise<InterEmployeeMessage | null> {
  // Validate that both employees are on the same team
  if (fromEmployee.team_id !== toEmployee.team_id) {
    throw new Error('Employees must be on the same team to communicate');
  }

  const { data, error } = await supabase
    .from('inter_employee_messages')
    .insert({
      team_id: fromEmployee.team_id,
      from_employee_id: fromEmployee.id,
      to_employee_id: toEmployee.id,
      message_type: messageType,
      content,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending inter-employee message:', error);
    return null;
  }

  return data;
}

/**
 * Get all messages for a specific employee
 *
 * @param employeeId - ID of the employee
 * @param onlyUnread - If true, only return messages not yet acknowledged
 */
export async function getMessagesForEmployee(
  employeeId: string,
  onlyUnread: boolean = false
): Promise<InterEmployeeMessage[]> {
  const query = supabase
    .from('inter_employee_messages')
    .select('*')
    .eq('to_employee_id', employeeId)
    .order('created_at', { ascending: false });

  // TODO: Add "read" flag to schema for filtering unread messages
  // if (onlyUnread) {
  //   query = query.eq('read', false);
  // }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching employee messages:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all handoff messages between employees in a team
 * Useful for visualizing the workflow timeline
 *
 * @param teamId - Team ID
 */
export async function getTeamWorkflowTimeline(teamId: string): Promise<InterEmployeeMessage[]> {
  const { data, error } = await supabase
    .from('inter_employee_messages')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching team timeline:', error);
    return [];
  }

  return data || [];
}

/**
 * TODO: Future orchestration logic
 *
 * This function will eventually handle:
 * - Automatic task routing based on employee roles
 * - Sequential workflow execution
 * - Parallel task distribution
 * - Error handling and retry logic
 * - Progress tracking
 */
export async function orchestrateWorkflow(
  teamId: string,
  workflowSteps: Array<{
    employeeId: string;
    task: string;
    dependsOn?: string[]; // IDs of employees that must complete first
  }>
): Promise<void> {
  // STUB: Placeholder for future implementation
  console.log(`[Workflow Orchestrator] Starting workflow for team ${teamId}`);
  console.log(`[Workflow Orchestrator] Steps:`, workflowSteps);

  // TODO: Implement workflow execution logic
  // 1. Build dependency graph
  // 2. Execute tasks in correct order
  // 3. Handle handoffs between employees
  // 4. Track progress and results
  // 5. Handle errors and retries

  throw new Error('Workflow orchestration not yet implemented');
}

/**
 * Check if an employee has pending work
 *
 * @param employeeId - Employee ID
 * @returns True if there are unhandled messages
 */
export async function hasPendingWork(employeeId: string): Promise<boolean> {
  const messages = await getMessagesForEmployee(employeeId, true);
  return messages.length > 0;
}
