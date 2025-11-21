/**
 * Split View Types
 *
 * Types for the split-screen dual chat feature.
 */

export type MessageType = 'instruction' | 'chat';

export interface SplitViewState {
  isActive: boolean;
  leftThreadId: string | null;
  rightThreadId: string | null;
  splitRatio: number; // 0-100, percentage for left panel
  crossChatEnabled: boolean; // Whether AIs can talk to each other
  leftPanelName: string; // Custom name for left panel (e.g., "Gamer", "Coder")
  rightPanelName: string; // Custom name for right panel
  messageType: MessageType; // Type of message to send: 'instruction' or 'chat'
}

export interface SplitViewConfig {
  enableSync?: boolean; // Sync scroll positions
  independentModels?: boolean; // Allow different models per side
  minPanelWidth?: number; // Minimum width for each panel in pixels
}

export interface CrossChatMessage {
  fromPanel: 'left' | 'right';
  toPanel: 'left' | 'right';
  content: string;
  timestamp: Date;
}

/**
 * Quick Send Types
 *
 * Types for the quick-send button feature that allows
 * direct message routing to specific panels.
 */

export interface QuickSendTarget {
  panelId: 'left' | 'right';
  panelName: string;
  threadId: string | null;
}

export interface QuickSendButtonProps {
  target: QuickSendTarget;
  onQuickSend: (targetPanelId: 'left' | 'right', message: string) => void;
  disabled?: boolean;
}
