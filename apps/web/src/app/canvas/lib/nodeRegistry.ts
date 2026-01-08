/**
 * Node Registry
 *
 * Central registry mapping node types to their:
 * - React components
 * - Default configurations
 * - Port definitions (inputs/outputs)
 * - Validation schemas
 * - Display metadata (icons, colors, descriptions)
 */

import type {
  CanvasNodeType,
  GenesisBotNodeConfig,
  TrainingSessionNodeConfig,
  BoardroomNodeConfig,
  TriggerNodeConfig,
  MasterTriggerNodeConfig,
  SmartRouterNodeConfig,
  ResponseCompilerNodeConfig,
  CableChannelNodeConfig,
  ToolNodeConfig,
  TerminalCommandNodeConfig,
  CustomNodeConfig,
} from '../types';
import type { SSMAgentNodeConfig } from '../types/ssm';
import { DEFAULT_SSM_CONFIG } from '../features/ssm-agent/lib/ssmDefaults';

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

// Category list for node palette organization
export const NODE_CATEGORIES = [
  { id: 'bot' as const, label: 'Bots', icon: '🤖' },
  { id: 'training' as const, label: 'Training', icon: '🎓' },
  { id: 'collaboration' as const, label: 'Collaboration', icon: '🏛️' },
  { id: 'trigger' as const, label: 'Triggers', icon: '⚡' },
  { id: 'tool' as const, label: 'Tools', icon: '🔧' },
  { id: 'other' as const, label: 'Other', icon: '⭐' },
];

// ============================================================================
// NODE PORT DEFINITIONS
// ============================================================================

export interface NodePort {
  id: string;
  label: string;
  type: 'input' | 'output';
  dataType: 'any' | 'message' | 'data' | 'trigger' | 'bot' | 'file';
  required?: boolean;
}

export interface NodeDefinition {
  type: CanvasNodeType;
  label: string;
  description: string;
  category: 'bot' | 'training' | 'collaboration' | 'trigger' | 'tool' | 'other';
  icon: string; // Emoji or icon name
  color: string; // Tailwind color class

  // Ports
  inputs: NodePort[];
  outputs: NodePort[];

  // Default configuration
  defaultConfig: any;

  // Component to render (import path)
  componentPath: string;

  // Capabilities
  capabilities: {
    canHaveMultipleInstances: boolean;
    requiresAuth?: boolean;
    requiresPro?: boolean;
    canBeDisabled?: boolean;
  };

  // UI visibility - if true, node is hidden from palette (for unfinished features)
  hidden?: boolean;
}

// ============================================================================
// NODE DEFINITIONS
// ============================================================================

export const NODE_DEFINITIONS: Record<CanvasNodeType, NodeDefinition> = {
  GENESIS_BOT: {
    type: 'GENESIS_BOT',
    label: 'AI Agent',
    description: 'AI agent with full configurability - model, system prompt, tools, voice, memory',
    category: 'bot',
    icon: '🤖',
    color: 'blue',
    inputs: [
      {
        id: 'input',
        label: 'Input',
        type: 'input',
        dataType: 'any',
      },
      {
        id: 'context',
        label: 'Context',
        type: 'input',
        dataType: 'data',
        required: false,
      },
    ],
    outputs: [
      {
        id: 'output',
        label: 'Response',
        type: 'output',
        dataType: 'message',
      },
      {
        id: 'data',
        label: 'Structured Data',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      name: 'New AI Agent',
      description: '',
      model_provider: 'claude',
      model_name: 'claude-sonnet-4-5',
      system_prompt: 'You are a helpful AI assistant.',
      temperature: 0.7,
      max_tokens: 2000,
      memory_enabled: false,
      streaming_enabled: true,
      show_thinking: false,
    } as GenesisBotNodeConfig,
    componentPath: './components/nodes/GenesisBotNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
  },

  SSM_AGENT: {
    type: 'SSM_AGENT',
    label: 'Stream Monitor',
    description: 'Rules-based event monitoring with $0 runtime cost. LLM generates rules at setup, pure pattern matching at runtime. Ideal for email, security logs, and activity streams.',
    category: 'bot',
    icon: '📊',
    color: 'teal',
    inputs: [
      {
        id: 'trigger',
        label: 'Trigger',
        type: 'input',
        dataType: 'trigger',
      },
      {
        id: 'events',
        label: 'Events',
        type: 'input',
        dataType: 'data',
      },
    ],
    outputs: [
      {
        id: 'info',
        label: 'Info',
        type: 'output',
        dataType: 'data',
      },
      {
        id: 'warning',
        label: 'Warning',
        type: 'output',
        dataType: 'data',
      },
      {
        id: 'critical',
        label: 'Critical → AI',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: DEFAULT_SSM_CONFIG as SSMAgentNodeConfig,
    componentPath: './components/nodes/SSMAgentNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
      requiresAuth: false,
    },
    hidden: false,
  },

  TRAINING_SESSION: {
    type: 'TRAINING_SESSION',
    label: 'Training Session',
    description: 'Train and refine an AI Agent through conversation and instruction',
    category: 'training',
    icon: '🎓',
    color: 'purple',
    inputs: [
      {
        id: 'bot',
        label: 'AI Agent',
        type: 'input',
        dataType: 'bot',
        required: true,
      },
      {
        id: 'training_data',
        label: 'Training Data',
        type: 'input',
        dataType: 'data',
        required: false,
      },
    ],
    outputs: [
      {
        id: 'trained_bot',
        label: 'Trained Bot',
        type: 'output',
        dataType: 'bot',
      },
      {
        id: 'summary',
        label: 'Training Summary',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      training_mode: 'conversational',
      auto_update_prompt: true,
      is_active: false,
    } as TrainingSessionNodeConfig,
    componentPath: './components/nodes/TrainingSessionNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },

  BOARDROOM: {
    type: 'BOARDROOM',
    label: 'Boardroom',
    description: 'Multi-bot collaborative discussion - debate, brainstorm, consensus building',
    category: 'collaboration',
    icon: '🏛️',
    color: 'emerald',
    inputs: [
      {
        id: 'bots',
        label: 'Participants (Bots)',
        type: 'input',
        dataType: 'bot',
        required: true,
      },
      {
        id: 'topic',
        label: 'Topic/Agenda',
        type: 'input',
        dataType: 'data',
        required: true,
      },
    ],
    outputs: [
      {
        id: 'summary',
        label: 'Discussion Summary',
        type: 'output',
        dataType: 'data',
      },
      {
        id: 'decision',
        label: 'Decision/Consensus',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      participant_node_ids: [],
      topic: '',
      discussion_style: 'consensus',
      max_rounds: 5,
      turn_order: 'sequential',
      generate_summary: true,
      summary_format: 'markdown',
    } as BoardroomNodeConfig,
    componentPath: './components/nodes/BoardroomNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },

  TRIGGER: {
    type: 'TRIGGER',
    label: 'Trigger',
    description: 'Start workflow on schedule, webhook, or event',
    category: 'trigger',
    icon: '⚡',
    color: 'yellow',
    inputs: [],
    outputs: [
      {
        id: 'trigger',
        label: 'Trigger Event',
        type: 'output',
        dataType: 'trigger',
      },
      {
        id: 'payload',
        label: 'Payload Data',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      trigger_type: 'manual',
      is_enabled: false,
    } as TriggerNodeConfig,
    componentPath: './components/nodes/TriggerNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
  },

  MASTER_TRIGGER: {
    type: 'MASTER_TRIGGER',
    label: 'Chatbot Trigger',
    description: 'Expose workflow to Chatbot page for triggering from chat',
    category: 'trigger',
    icon: '🎯',
    color: 'purple',
    inputs: [],
    outputs: [
      {
        id: 'message',
        label: 'User Message',
        type: 'output',
        dataType: 'message',
      },
      {
        id: 'attachments',
        label: 'Attachments',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      display_name: 'New Workflow Trigger',
      description: '',
      is_exposed: false,
      output_format: 'structured',
      trigger_count: 0,
    } as MasterTriggerNodeConfig,
    componentPath: './components/nodes/MasterTriggerNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
  },

  SMART_ROUTER: {
    type: 'SMART_ROUTER',
    label: 'Smart Router',
    description: 'Intelligently routes queries to appropriate AI Agents based on their capabilities',
    category: 'trigger',
    icon: '🔀',
    color: 'cyan',
    inputs: [
      {
        id: 'input',
        label: 'Query Input',
        type: 'input',
        dataType: 'message',
        required: true,
      },
    ],
    outputs: [
      {
        id: 'output',
        label: 'Routed Query',
        type: 'output',
        dataType: 'message',
      },
      {
        id: 'routing_info',
        label: 'Routing Info',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      name: 'Smart Router',
      description: 'Routes queries to appropriate agents',
      model_provider: 'claude',
      model_name: 'claude-sonnet-4-5',
      routing_strategy: 'keyword_then_ai',
      keyword_rules: [
        { id: 'email-rule', keywords: ['email', 'mail', 'send', 'inbox', 'compose', 'reply'], integration_type: 'gmail', priority: 10, enabled: true },
        { id: 'calendar-rule', keywords: ['schedule', 'calendar', 'meeting', 'appointment', 'event', 'reminder'], integration_type: 'calendar', priority: 10, enabled: true },
        { id: 'sheets-rule', keywords: ['spreadsheet', 'sheet', 'excel', 'data', 'table', 'csv'], integration_type: 'sheets', priority: 10, enabled: true },
        { id: 'docs-rule', keywords: ['document', 'doc', 'write', 'draft', 'notes'], integration_type: 'docs', priority: 10, enabled: true },
        { id: 'slack-rule', keywords: ['slack', 'channel', 'dm', 'workspace'], integration_type: 'slack', priority: 10, enabled: true },
      ],
      temperature: 0.3,
      allow_parallel_routing: true,
      max_parallel_agents: 5,
    } as SmartRouterNodeConfig,
    componentPath: './components/nodes/SmartRouterNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
  },

  RESPONSE_COMPILER: {
    type: 'RESPONSE_COMPILER',
    label: 'Response Compiler',
    description: 'Collects and synthesizes responses from multiple AI Agents into one cohesive answer',
    category: 'tool',
    icon: '📋',
    color: 'teal',
    inputs: [
      {
        id: 'responses',
        label: 'Agent Responses',
        type: 'input',
        dataType: 'message',
        required: true,
      },
      {
        id: 'context',
        label: 'Original Query',
        type: 'input',
        dataType: 'data',
        required: false,
      },
    ],
    outputs: [
      {
        id: 'compiled',
        label: 'Compiled Response',
        type: 'output',
        dataType: 'message',
      },
    ],
    defaultConfig: {
      name: 'Response Compiler',
      description: 'Compiles multiple agent responses',
      model_provider: 'claude',
      model_name: 'claude-sonnet-4-5',
      compilation_strategy: 'ai_summarize',
      temperature: 0.5,
      max_tokens: 2000,
      include_source_attribution: true,
      output_format: 'prose',
      wait_timeout_ms: 30000,
      partial_response_behavior: 'proceed',
    } as ResponseCompilerNodeConfig,
    componentPath: './components/nodes/ResponseCompilerNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
  },

  CABLE_CHANNEL: {
    type: 'CABLE_CHANNEL',
    label: 'Cable Channel',
    description: 'Pre-configured mode/channel from Cable Box (research, draft, review, etc.)',
    category: 'bot',
    icon: '📺',
    color: 'indigo',
    inputs: [
      {
        id: 'input',
        label: 'Input',
        type: 'input',
        dataType: 'any',
      },
    ],
    outputs: [
      {
        id: 'output',
        label: 'Channel Output',
        type: 'output',
        dataType: 'message',
      },
    ],
    defaultConfig: {
      channel_name: 'Custom Channel',
      channel_mode: 'custom',
      ui_layout: 'chat',
    } as CableChannelNodeConfig,
    componentPath: './components/nodes/CableChannelNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },

  TOOL: {
    type: 'TOOL',
    label: 'Tool',
    description: 'MCP tool, OAuth action, or custom function',
    category: 'tool',
    icon: '🔧',
    color: 'orange',
    inputs: [
      {
        id: 'parameters',
        label: 'Parameters',
        type: 'input',
        dataType: 'data',
      },
    ],
    outputs: [
      {
        id: 'result',
        label: 'Result',
        type: 'output',
        dataType: 'data',
      },
      {
        id: 'error',
        label: 'Error (if any)',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      tool_type: 'mcp',
      timeout_seconds: 30,
      retry_on_failure: false,
      max_retries: 3,
    } as ToolNodeConfig,
    componentPath: './components/nodes/ToolNode',
    capabilities: {
      canHaveMultipleInstances: true,
      requiresAuth: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },

  TERMINAL_COMMAND: {
    type: 'TERMINAL_COMMAND',
    label: 'Terminal Command',
    description: 'Use Terminal Bot to create/modify canvas features via natural language',
    category: 'tool',
    icon: '💻',
    color: 'green',
    inputs: [
      {
        id: 'command_input',
        label: 'Command Input',
        type: 'input',
        dataType: 'data',
      },
    ],
    outputs: [
      {
        id: 'result',
        label: 'Execution Result',
        type: 'output',
        dataType: 'data',
      },
    ],
    defaultConfig: {
      command_type: 'custom',
      command_template: '',
      allow_canvas_modification: false,
      require_confirmation: true,
      terminal_bot_model: 'claude-sonnet-4-5',
    } as TerminalCommandNodeConfig,
    componentPath: './components/nodes/TerminalCommandNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },

  CUSTOM: {
    type: 'CUSTOM',
    label: 'Custom Node',
    description: 'User-defined node type for extensibility',
    category: 'other',
    icon: '⭐',
    color: 'pink',
    inputs: [],
    outputs: [],
    defaultConfig: {
      custom_type: 'custom',
      inputs: [],
      outputs: [],
      config: {},
    } as CustomNodeConfig,
    componentPath: './components/nodes/CustomNode',
    capabilities: {
      canHaveMultipleInstances: true,
      canBeDisabled: true,
    },
    hidden: true, // Not yet implemented
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getNodeDefinition(type: CanvasNodeType): NodeDefinition {
  return NODE_DEFINITIONS[type];
}

export function getNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.category === category && !def.hidden);
}

export function getNodeColor(type: CanvasNodeType): string {
  const def = getNodeDefinition(type);
  return def.color;
}

export function getNodeIcon(type: CanvasNodeType): string {
  const def = getNodeDefinition(type);
  return def.icon;
}

export function validateNodeConfig(type: CanvasNodeType, config: any): boolean {
  // TODO: Implement Zod schema validation
  // For now, just check that config is an object
  return typeof config === 'object' && config !== null;
}

/**
 * Create a new node with default configuration
 */
export function createDefaultNode(
  type: CanvasNodeType,
  position: { x: number; y: number }
): {
  type: CanvasNodeType;
  position: { x: number; y: number };
  label: string;
  config: any;
} {
  const def = getNodeDefinition(type);

  return {
    type,
    position,
    label: def.label,
    config: { ...def.defaultConfig },
  };
}

/**
 * Get all available node types grouped by category
 * Filters out hidden nodes (unimplemented features)
 */
export function getNodePalette(): Record<string, NodeDefinition[]> {
  const categories: Record<string, NodeDefinition[]> = {
    bot: [],
    training: [],
    collaboration: [],
    trigger: [],
    tool: [],
    other: [],
  };

  Object.values(NODE_DEFINITIONS).forEach(def => {
    // Skip hidden nodes (not yet implemented)
    if (def.hidden) return;
    categories[def.category].push(def);
  });

  return categories;
}

/**
 * Get categories that have at least one visible (non-hidden) node
 */
export function getVisibleCategories() {
  const palette = getNodePalette();
  return NODE_CATEGORIES.filter(cat => palette[cat.id]?.length > 0);
}
