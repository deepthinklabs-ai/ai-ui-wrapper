/**
 * Canvas Feature - Type Definitions
 *
 * Comprehensive type system for the n8n-style workflow canvas.
 * Integrates Genesis Bots, Training Sessions, Boardrooms, and more.
 */

import type { AIModel } from '@/lib/apiKeyStorage';
import type { GmailOAuthConfig } from '../features/gmail-oauth/types';
import type { SheetsOAuthConfig } from '../features/sheets-oauth/types';
import type { DocsOAuthConfig } from '../features/docs-oauth/types';
import type { SlackOAuthConfig } from '../features/slack-oauth/types';
import type { CalendarOAuthConfig } from '../features/calendar-oauth/types';

// ============================================================================
// CANVAS
// ============================================================================

export type CanvasId = string;
export type NodeId = string;
export type EdgeId = string;

export type CanvasMode = 'workflow' | 'boardroom' | 'hybrid';

export interface Canvas {
  id: CanvasId;
  user_id: string;
  name: string;
  description?: string;
  mode: CanvasMode;
  thumbnail_url?: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// NODES
// ============================================================================

export type CanvasNodeType =
  | 'GENESIS_BOT'
  | 'SSM_AGENT'
  | 'TRAINING_SESSION'
  | 'BOARDROOM'
  | 'CABLE_CHANNEL'
  | 'TRIGGER'
  | 'MASTER_TRIGGER'
  | 'SMART_ROUTER'
  | 'RESPONSE_COMPILER'
  | 'TOOL'
  | 'TERMINAL_COMMAND'
  | 'CUSTOM';

export interface CanvasNode<TConfig = Record<string, any>> {
  id: NodeId;
  canvas_id: CanvasId;
  type: CanvasNodeType;
  position: { x: number; y: number };
  label: string;
  config: TConfig;
  // For MASTER_TRIGGER nodes: stored as unencrypted column for API querying
  is_exposed?: boolean;
  // UI state (not persisted to DB)
  selected?: boolean;
  dragging?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// NODE CONFIGURATIONS
// ============================================================================

/**
 * Genesis Bot Node
 * Represents a single AI bot instance with full configuration
 */
export interface GenesisBotNodeConfig {
  // Identity
  name: string;
  description?: string;

  // Model configuration
  model_provider: 'openai' | 'claude' | 'grok';
  model_name: AIModel;

  // Behavior
  system_prompt: string;
  temperature?: number;
  max_tokens?: number;

  // Features
  voice_id?: string; // ElevenLabs voice
  allowed_tools?: string[]; // MCP tool IDs
  oauth_connections?: string[]; // OAuth connection IDs

  // Memory & context
  memory_enabled?: boolean;
  context_window_size?: number;

  // UI options
  streaming_enabled?: boolean;
  show_thinking?: boolean;
  web_search_enabled?: boolean;

  // Gmail Integration
  gmail?: GmailOAuthConfig;

  // Google Calendar Integration
  calendar?: CalendarOAuthConfig;

  // Google Sheets Integration
  sheets?: SheetsOAuthConfig;

  // Google Docs Integration
  docs?: DocsOAuthConfig;

  // Slack Integration
  slack?: SlackOAuthConfig;
}

/**
 * Training Session Node
 * Configures a training session for refining a Genesis Bot
 */
export interface TrainingSessionNodeConfig {
  // Target bot (can reference another node or bot ID)
  genesis_bot_node_id?: NodeId;
  genesis_bot_id?: string; // Direct DB reference

  // Training settings
  training_mode: 'conversational' | 'instructional' | 'evaluation';
  auto_update_prompt: boolean; // Automatically update bot's system prompt

  // Training data
  training_documents?: string[]; // File URLs or text content
  example_conversations?: Array<{
    user: string;
    assistant: string;
  }>;

  // Evaluation criteria
  success_criteria?: string;
  evaluation_prompt?: string;

  // State
  is_active?: boolean;
  session_id?: string; // Current training session ID
}

/**
 * Boardroom Node
 * Multi-bot collaborative discussion configuration
 */
export interface BoardroomNodeConfig {
  // Participants (can reference Genesis Bot nodes or bot IDs)
  participant_node_ids: NodeId[];
  participant_bot_ids?: string[];

  // Discussion settings
  topic: string;
  agenda?: string;
  discussion_style: 'debate' | 'brainstorming' | 'consensus' | 'expert_panel';

  // Flow control
  max_rounds: number;
  time_limit_minutes?: number;
  turn_order: 'sequential' | 'random' | 'ai_moderated';

  // Moderation
  moderator_prompt?: string;
  enable_voting?: boolean;

  // Output
  generate_summary: boolean;
  summary_format?: 'markdown' | 'json' | 'bullet_points';
  decision_required?: boolean;
}

/**
 * Trigger Node
 * Defines workflow start/stop conditions
 */
export interface TriggerNodeConfig {
  trigger_type: 'manual' | 'schedule' | 'webhook' | 'event';

  // Schedule (cron-like)
  schedule?: {
    cron_expression: string;
    timezone: string;
  };

  // Webhook
  webhook?: {
    endpoint_id: string;
    method: 'GET' | 'POST';
    auth_required: boolean;
  };

  // Event-based
  event?: {
    event_name: string;
    filter?: Record<string, any>;
  };

  // Output data to workflow
  payload_template?: Record<string, any>;

  // State
  is_enabled: boolean;
  last_triggered_at?: string;
}

/**
 * Master Genesis Bot Trigger Node
 * Exposes a workflow to be triggered from the main Genesis Bot page
 */
export interface MasterTriggerNodeConfig {
  // Display name shown in Genesis Bot dropdown
  display_name: string;

  // Description shown in dropdown (optional)
  description?: string;

  // Whether this trigger is currently exposed to the Genesis Bot page
  is_exposed: boolean;

  // Output format for connected nodes
  output_format: 'raw' | 'structured';

  // Optional: Restrict to specific users (future feature)
  allowed_user_ids?: string[];

  // State tracking
  last_triggered_at?: string;
  trigger_count?: number;
}

/**
 * Integration type for routing context
 */
export type IntegrationType = 'gmail' | 'calendar' | 'sheets' | 'docs' | 'slack';

/**
 * Keyword-based routing rule
 */
export interface KeywordRoutingRule {
  id: string;
  keywords: string[]; // Keywords to match (case-insensitive)
  integration_type?: IntegrationType; // Optional: only match if agent has this integration
  priority: number; // Higher priority rules checked first
  enabled: boolean;
}

/**
 * Connected agent info for routing context (runtime only, not persisted)
 */
export interface ConnectedAgentInfo {
  nodeId: string;
  name: string;
  integrations: IntegrationType[];
  capabilities: string[]; // Human-readable capability descriptions
}

/**
 * Smart Router Node
 * Intelligent routing node that analyzes queries and routes to appropriate agents
 * based on their capabilities and integrations.
 */
export interface SmartRouterNodeConfig {
  // Identity
  name: string;
  description?: string;

  // Model configuration (for AI routing decisions)
  model_provider: 'openai' | 'claude' | 'grok';
  model_name: AIModel;

  // Routing configuration
  routing_strategy: 'ai_only' | 'keyword_then_ai' | 'keyword_only';

  // Keyword routing rules (for preset detection)
  keyword_rules: KeywordRoutingRule[];

  // AI routing settings
  ai_routing_prompt?: string; // Custom prompt for AI routing decision
  temperature?: number;

  // Execution settings
  allow_parallel_routing: boolean; // Can route to multiple agents simultaneously
  max_parallel_agents?: number; // Max agents to route to in parallel (default: 5)
  fallback_agent_id?: string; // Default agent if no routing match

  // State tracking
  last_routed_at?: string;
  routing_count?: number;
}

/**
 * Response Compiler Node
 * Collects responses from multiple upstream agents and compiles them
 * into a single cohesive response.
 */
export interface ResponseCompilerNodeConfig {
  // Identity
  name: string;
  description?: string;

  // Model configuration (for AI summarization)
  model_provider: 'openai' | 'claude' | 'grok';
  model_name: AIModel;

  // Compilation settings
  compilation_strategy: 'ai_summarize' | 'concatenate' | 'prioritized';

  // AI summarization settings
  summarization_prompt?: string; // Custom prompt for compilation
  temperature?: number;
  max_tokens?: number;

  // Output formatting
  include_source_attribution: boolean; // Add "[From Agent X]" prefixes
  output_format: 'prose' | 'bullet_points' | 'structured';

  // Timing settings
  wait_timeout_ms?: number; // How long to wait for all responses (default: 30000)
  partial_response_behavior: 'wait' | 'proceed' | 'fail';

  // State tracking
  last_compiled_at?: string;
  compilation_count?: number;
}

/**
 * Cable Channel Node
 * References a Cable Box mode/channel configuration
 */
export interface CableChannelNodeConfig {
  channel_name: string;
  channel_mode: 'research' | 'draft' | 'review' | 'creative' | 'custom';

  // Bot configuration (inherits from Genesis Bot but with channel-specific tweaks)
  genesis_bot_node_id?: NodeId;
  mode_specific_prompt_addition?: string;

  // UI settings
  ui_layout: 'chat' | 'split' | 'fullscreen';
  theme?: string;
}

/**
 * Tool Node
 * Represents an MCP tool or OAuth-enabled action
 */
export interface ToolNodeConfig {
  tool_type: 'mcp' | 'oauth' | 'custom';

  // MCP
  mcp_server_id?: string;
  mcp_tool_name?: string;

  // OAuth
  oauth_provider?: 'google' | 'github' | 'slack';
  oauth_action?: string;

  // Custom
  custom_function_name?: string;

  // Parameters
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;

  // Execution
  timeout_seconds?: number;
  retry_on_failure?: boolean;
  max_retries?: number;
}

/**
 * Terminal Command Node
 * Integrates Terminal Bot for canvas modifications
 */
export interface TerminalCommandNodeConfig {
  command_type: 'create_node' | 'modify_canvas' | 'run_script' | 'custom';

  // Command specification
  command_template: string;
  parameters?: Record<string, any>;

  // Execution context
  allow_canvas_modification: boolean;
  require_confirmation: boolean;

  // Terminal Bot settings
  terminal_bot_model?: AIModel;
  terminal_bot_prompt?: string;
}

/**
 * Custom Node
 * User-defined node type for extensibility
 */
export interface CustomNodeConfig {
  custom_type: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  handler_code?: string; // Future: allow users to write custom logic
  config: Record<string, any>;
}

// ============================================================================
// EDGES (CONNECTIONS)
// ============================================================================

export interface CanvasEdge {
  id: EdgeId;
  canvas_id: CanvasId;
  from_node_id: NodeId;
  from_port?: string;
  to_node_id: NodeId;
  to_port?: string;

  // Flow control
  condition?: string; // Expression to evaluate before following edge
  transform?: string; // Data transformation logic

  // UI
  label?: string;
  animated?: boolean;

  // Metadata
  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowExecution {
  id: string;
  canvas_id: CanvasId;
  status: WorkflowStatus;
  started_at: string;
  ended_at?: string;
  error?: string;

  // Node execution states
  node_states: Record<NodeId, NodeExecutionState>;

  // Outputs
  final_output?: any;
  execution_log: ExecutionLogEntry[];
}

export interface NodeExecutionState {
  node_id: NodeId;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  ended_at?: string;
  input?: any;
  output?: any;
  error?: string;
}

export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  node_id?: NodeId;
  message: string;
  data?: any;
}

// ============================================================================
// BOARDROOM EXECUTION
// ============================================================================

export interface BoardroomConversation {
  id: string;
  boardroom_node_id: NodeId;
  canvas_id: CanvasId;
  topic: string;
  status: 'active' | 'completed' | 'cancelled';
  current_round: number;
  started_at: string;
  ended_at?: string;

  // Participants
  participants: BoardroomParticipant[];

  // Messages
  messages: BoardroomMessage[];

  // Output
  summary?: string;
  decision?: string;
  votes?: Record<NodeId, any>;
}

export interface BoardroomParticipant {
  node_id: NodeId;
  bot_id?: string;
  name: string;
  role?: string;
  color: string; // For UI differentiation
}

export interface BoardroomMessage {
  id: string;
  participant_node_id: NodeId;
  content: string;
  round: number;
  timestamp: string;
  references?: string[]; // Message IDs this references
}

// ============================================================================
// TRAINING SESSION EXECUTION
// ============================================================================

export interface TrainingSessionExecution {
  id: string;
  training_node_id: NodeId;
  genesis_bot_node_id: NodeId;
  canvas_id: CanvasId;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  ended_at?: string;

  // Training interactions
  interactions: TrainingInteraction[];

  // Results
  original_system_prompt: string;
  updated_system_prompt?: string;
  training_summary?: string;
  improvements?: string[];
}

export interface TrainingInteraction {
  id: string;
  user_message: string;
  bot_response: string;
  feedback?: string;
  timestamp: string;
}

// ============================================================================
// CANVAS TEMPLATES
// ============================================================================

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'content' | 'analysis' | 'automation' | 'custom';
  thumbnail_url?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  is_official: boolean;
  created_by: string;
  uses_count: number;
}

// ============================================================================
// REACT FLOW INTEGRATION
// ============================================================================

// React Flow expects specific types, we'll map our types to theirs
export interface ReactFlowNode {
  id: NodeId;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: any;
    canvasNodeType: CanvasNodeType;
  };
  selected?: boolean;
  dragging?: boolean;
}

export interface ReactFlowEdge {
  id: EdgeId;
  source: NodeId;
  sourceHandle?: string;
  target: NodeId;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  type?: string;
  data?: {
    condition?: string;
    transform?: string;
  };
}

// ============================================================================
// HOOKS RETURN TYPES
// ============================================================================

export interface UseCanvasResult {
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  loading: boolean;
  error: string | null;
  createCanvas: (input: CreateCanvasInput) => Promise<Canvas | null>;
  updateCanvas: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  deleteCanvas: (id: CanvasId) => Promise<boolean>;
  selectCanvas: (canvas: Canvas | null) => void;
  refreshCanvases: () => Promise<void>;
}

export interface CreateCanvasInput {
  name: string;
  description?: string;
  mode: CanvasMode;
  template_id?: string; // Optional: start from template
}

export interface UseCanvasNodesResult {
  nodes: CanvasNode[];
  loading: boolean;
  addNode: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  updateNode: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  deleteNode: (id: NodeId) => Promise<boolean>;
  duplicateNode: (id: NodeId) => Promise<CanvasNode | null>;
  refreshNodes: () => Promise<void>;
}

export interface UseCanvasEdgesResult {
  edges: CanvasEdge[];
  loading: boolean;
  addEdge: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  updateEdge: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  deleteEdge: (id: EdgeId) => Promise<boolean>;
  refreshEdges: () => Promise<void>;
}

export interface UseWorkflowRunnerResult {
  execution: WorkflowExecution | null;
  isRunning: boolean;
  startWorkflow: () => Promise<void>;
  pauseWorkflow: () => Promise<void>;
  stopWorkflow: () => Promise<void>;
  resumeWorkflow: () => Promise<void>;
}

// ============================================================================
// SSM (STATE-SPACE MODEL) TYPES
// ============================================================================

export * from './ssm';
