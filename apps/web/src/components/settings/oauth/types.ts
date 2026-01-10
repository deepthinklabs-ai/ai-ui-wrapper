/**
 * OAuth Settings Types
 *
 * Type definitions for OAuth connection management in Settings.
 * Separated for clean imports and debugging.
 */

/**
 * Status of an OAuth connection
 */
export type OAuthConnectionStatus = 'connected' | 'disconnected' | 'loading' | 'error';

/**
 * Generic OAuth connection info
 */
export interface OAuthConnectionInfo {
  id: string;
  provider: 'google' | 'slack';
  email: string;
  name: string | null;
  picture: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

/**
 * Google-specific connection with service breakdown
 */
export interface GoogleConnectionInfo extends OAuthConnectionInfo {
  provider: 'google';
  services: {
    gmail: boolean;
    calendar: boolean;
    sheets: boolean;
    docs: boolean;
    drive: boolean;
  };
}

/**
 * Slack-specific connection
 */
export interface SlackConnectionInfo extends OAuthConnectionInfo {
  provider: 'slack';
  workspace: string;
  teamId: string;
}

/**
 * Props for individual OAuth service cards
 */
export interface OAuthCardProps {
  onConnectionChange?: () => void;
}
