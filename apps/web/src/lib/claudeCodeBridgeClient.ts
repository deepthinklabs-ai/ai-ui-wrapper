/**
 * Claude Code Bridge Client
 *
 * Client library for connecting to the local Claude Code bridge server.
 */

export interface BridgeClientConfig {
  baseUrl?: string;
  wsUrl?: string;
}

export interface BridgeMessage {
  id: string;
  content: string;
  timestamp: number;
}

export interface BridgeResponse {
  type: 'output' | 'error' | 'response-complete' | 'exit' | 'session-info';
  data: any;
}

export class ClaudeCodeBridgeClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(config: BridgeClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3001';
    this.wsUrl = config.wsUrl || 'ws://localhost:3001';
  }

  /**
   * Connect to the bridge WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('[Bridge Client] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: BridgeResponse = JSON.parse(event.data);
            console.log('[Bridge Client] Received:', response.type);

            // Emit to listeners
            const listeners = this.listeners.get(response.type);
            if (listeners) {
              listeners.forEach((callback) => callback(response.data));
            }

            // Emit to wildcard listeners
            const wildcardListeners = this.listeners.get('*');
            if (wildcardListeners) {
              wildcardListeners.forEach((callback) => callback(response));
            }
          } catch (error) {
            console.error('[Bridge Client] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Bridge Client] WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[Bridge Client] WebSocket closed');
          this.ws = null;

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Bridge Client] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.connect().catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the bridge
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Listen for events from the bridge
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Check if bridge is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get session information
   */
  async getSession(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/session`);
    if (!response.ok) {
      throw new Error('Failed to get session info');
    }
    return response.json();
  }

  /**
   * Start Claude Code process
   */
  async start(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to start Claude Code');
    }

    return response.json();
  }

  /**
   * Stop Claude Code process
   */
  async stop(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to stop Claude Code');
    }

    return response.json();
  }

  /**
   * Send a message to Claude Code
   */
  async sendMessage(content: string, id?: string): Promise<any> {
    const message: BridgeMessage = {
      id: id || `msg-${Date.now()}`,
      content,
      timestamp: Date.now(),
    };

    const response = await fetch(`${this.baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  }

  /**
   * Get current output buffer
   */
  async getBuffer(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/buffer`);

    if (!response.ok) {
      throw new Error('Failed to get buffer');
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let bridgeClient: ClaudeCodeBridgeClient | null = null;

/**
 * Get or create the bridge client singleton
 */
export function getBridgeClient(config?: BridgeClientConfig): ClaudeCodeBridgeClient {
  if (!bridgeClient) {
    bridgeClient = new ClaudeCodeBridgeClient(config);
  }
  return bridgeClient;
}
