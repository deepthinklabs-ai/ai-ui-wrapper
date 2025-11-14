/**
 * Split View Types
 *
 * Types for the split-screen dual chat feature.
 */

export interface SplitViewState {
  isActive: boolean;
  leftThreadId: string | null;
  rightThreadId: string | null;
  splitRatio: number; // 0-100, percentage for left panel
  crossChatEnabled: boolean; // Whether AIs can talk to each other
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
