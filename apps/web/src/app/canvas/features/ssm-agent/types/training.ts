/**
 * SSM Training Session Types
 *
 * Type definitions for the conversational training interface.
 * Separating types for easy debugging and reuse.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Role of the message sender
 */
export type SSMTrainingRole = 'user' | 'assistant' | 'system';

/**
 * A single message in the training conversation
 */
export interface SSMTrainingMessage {
  id: string;
  role: SSMTrainingRole;
  content: string;
  timestamp: string;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Current phase of the training session
 */
export type SSMTrainingPhase =
  | 'greeting'      // Initial greeting, asking what to monitor
  | 'gathering'     // Gathering requirements through questions
  | 'clarifying'    // Clarifying specific details
  | 'summarizing'   // Summarizing what was learned
  | 'confirming'    // User confirms the summary
  | 'generating'    // Generating rules from conversation
  | 'complete';     // Training complete

/**
 * Training session state
 */
export interface SSMTrainingSession {
  id: string;
  nodeId: string;
  canvasId: string;
  userId: string;
  phase: SSMTrainingPhase;
  messages: SSMTrainingMessage[];
  startedAt: string;
  completedAt?: string;

  // Extracted information during training
  extractedInfo: SSMExtractedInfo;
}

/**
 * Information extracted during training conversation
 */
export interface SSMExtractedInfo {
  // What to monitor
  monitoringGoal?: string;
  specificThreats?: string[];

  // Trust rules
  trustedSenders?: string[];
  trustedDomains?: string[];

  // Alert preferences
  alertOnUrgency?: boolean;
  alertOnExternalSenders?: boolean;
  alertOnAttachments?: boolean;

  // Severity preferences
  criticalPatterns?: string[];
  warningPatterns?: string[];
  infoPatterns?: string[];

  // Custom rules from conversation
  customRules?: string[];
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Request to send a message in training
 */
export interface SSMTrainingRequest {
  sessionId?: string;  // If continuing existing session
  nodeId: string;
  canvasId: string;
  userId: string;
  message: string;
  provider: 'claude' | 'openai';
}

/**
 * Response from training API
 */
export interface SSMTrainingResponse {
  success: boolean;
  sessionId: string;
  message: SSMTrainingMessage;
  phase: SSMTrainingPhase;
  extractedInfo: SSMExtractedInfo;
  isComplete: boolean;
  sessionStartedAt?: string; // For countdown timer
  error?: string;
}

/**
 * Request to finalize training and generate rules
 */
export interface SSMFinalizeTrainingRequest {
  sessionId: string;
  nodeId: string;
  provider: 'claude' | 'openai';
}

/**
 * Response from finalizing training
 */
export interface SSMFinalizeTrainingResponse {
  success: boolean;
  monitoringDescription: string;
  rules: import('../../../types/ssm').SSMRulesConfig;
  responseTemplates: import('../../../types/ssm').SSMResponseTemplate[];
  error?: string;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

/**
 * Training hook state
 */
export interface SSMTrainingState {
  isOpen: boolean;
  isLoading: boolean;
  session: SSMTrainingSession | null;
  error: string | null;
}

/**
 * Training hook actions
 */
export interface SSMTrainingActions {
  openTraining: () => void;
  closeTraining: () => void;
  sendMessage: (message: string) => Promise<void>;
  finalize: () => Promise<boolean>;
  reset: () => void;
}
