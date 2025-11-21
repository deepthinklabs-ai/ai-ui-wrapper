/**
 * TypeScript types for The Workforce feature
 * Virtual Employees that work together as a team to achieve goals
 */

export type Gender = 'male' | 'female' | 'nonbinary';

export type EmployeeStatus = 'idle' | 'training' | 'working' | 'waiting';

export type MessageType = 'report' | 'handoff' | 'question';

export type AIProvider = 'openai' | 'claude' | 'grok';

// ============================================================================
// Team
// ============================================================================

export type Team = {
  id: string;
  user_id: string;
  name: string;
  mission_statement: string;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// Virtual Employee
// ============================================================================

export type VirtualEmployee = {
  id: string;
  team_id: string;
  name: string;
  gender: Gender;
  title: string; // e.g. "Head of Content Creation"
  role_description: string;
  system_prompt: string; // Optimized prompt from training
  model_provider: AIProvider;
  model_name: string; // e.g. "gpt-4o", "claude-sonnet-4.5"
  voice_id: string; // ElevenLabs voice ID
  allowed_tools: string[]; // MCP server IDs
  oauth_connections: string[]; // OAuth connection IDs
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// Training Sessions
// ============================================================================

export type TrainingSession = {
  id: string;
  team_id: string;
  virtual_employee_id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null; // AI-generated summary
  prompt_updates: string | null; // Notes on what changed
  created_at: string;
};

export type TrainingMessage = {
  id: string;
  training_session_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: any[] | null;
  created_at: string;
};

// ============================================================================
// Instruction Sessions (Work)
// ============================================================================

export type InstructionSession = {
  id: string;
  team_id: string;
  virtual_employee_id: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
};

export type InstructionMessage = {
  id: string;
  instruction_session_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: any[] | null;
  created_at: string;
};

// ============================================================================
// Inter-Employee Communication
// ============================================================================

export type InterEmployeeMessage = {
  id: string;
  team_id: string;
  from_employee_id: string;
  to_employee_id: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
};

// ============================================================================
// UI/Component Types
// ============================================================================

export type EmployeeIdentity = {
  name: string;
  gender: Gender;
  voiceId: string;
};

export type CreateTeamInput = {
  name: string;
  missionStatement: string;
};

export type CreateEmployeeInput = {
  teamId: string;
  title: string;
  roleDescription: string;
  modelProvider: AIProvider;
  modelName: string;
  allowedTools?: string[];
  oauthConnections?: string[];
};

export type PromptContext = {
  teamMission: string;
  employeeName: string;
  employeeTitle: string;
  roleDescription: string;
  trainingSummaries: string[];
};
