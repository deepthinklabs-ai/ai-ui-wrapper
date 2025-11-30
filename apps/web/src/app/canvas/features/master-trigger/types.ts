/**
 * Master Genesis Bot Trigger - Type Definitions
 *
 * Types for the Master Trigger feature that allows Canvas workflows
 * to be exposed and triggered from the main Genesis Bot page.
 */

/**
 * Input passed from Genesis Bot page when triggering a workflow
 */
export interface MasterTriggerInput {
  /** The user's message/query */
  message: string;

  /** Attached files (images, documents, etc.) */
  attachments?: MasterTriggerAttachment[];

  /** User ID who triggered the workflow */
  userId: string;

  /** Thread ID from the Genesis Bot page (optional) */
  threadId?: string;

  /** Model selected by the user (optional) */
  model?: string;

  /** Timestamp when the trigger was invoked */
  timestamp: string;

  /** Conversation history for context (previous messages in the thread) */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * File attachment structure
 */
export interface MasterTriggerAttachment {
  /** File name */
  name: string;

  /** MIME type */
  type: string;

  /** File size in bytes */
  size: number;

  /** File content - base64 for images, text for documents */
  content: string;

  /** Whether this is an image file */
  isImage: boolean;
}

/**
 * Output returned from workflow execution
 */
export interface MasterTriggerOutput {
  /** Whether execution was successful */
  success: boolean;

  /** The workflow's response text */
  response: string;

  /** Unique execution ID for tracking */
  executionId: string;

  /** Execution duration in milliseconds */
  duration_ms: number;

  /** Error message if execution failed */
  error?: string;

  /** Additional metadata from the workflow */
  metadata?: Record<string, any>;
}

/**
 * Exposed workflow data shown in the Genesis Bot dropdown
 */
export interface ExposedWorkflow {
  /** Canvas/workflow ID */
  canvasId: string;

  /** Canvas name */
  canvasName: string;

  /** Master Trigger node ID within the canvas */
  triggerNodeId: string;

  /** Display name configured on the trigger */
  displayName: string;

  /** Optional description */
  description?: string;

  /** When this trigger was last used */
  lastTriggeredAt?: string;

  /** Number of times this trigger has been used */
  triggerCount?: number;
}

/**
 * API request body for triggering a workflow
 */
export interface TriggerWorkflowRequest {
  /** Canvas ID containing the workflow */
  canvasId: string;

  /** Master Trigger node ID to execute */
  triggerNodeId: string;

  /** Input data for the workflow */
  input: MasterTriggerInput;
}

/**
 * API response from workflow trigger endpoint
 */
export interface TriggerWorkflowResponse {
  /** Whether the request was successful */
  success: boolean;

  /** Execution output if successful */
  output?: MasterTriggerOutput;

  /** Error message if failed */
  error?: string;
}

/**
 * Validation result for trigger configuration
 */
export interface TriggerValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean;

  /** Validation error messages */
  errors: string[];

  /** Validation warning messages */
  warnings: string[];
}
