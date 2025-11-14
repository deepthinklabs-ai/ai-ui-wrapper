/**
 * Claude Code Process Manager
 *
 * Spawns and manages a Claude Code CLI process, handling stdin/stdout communication.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { ClaudeCodeConfig } from './types';

export class ClaudeCodeProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: ClaudeCodeConfig;
  private buffer: string = '';
  private isReady: boolean = false;
  private lastResponseId: string | null = null;
  private responseTimeout: NodeJS.Timeout | null = null;
  private readonly RESPONSE_TIMEOUT_MS = 30000; // 30 seconds

  constructor(config: ClaudeCodeConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the Claude Code process
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[Bridge] Starting Claude Code process...');
      console.log('[Bridge] Command:', this.config.command);
      console.log('[Bridge] Args:', this.config.args);
      console.log('[Bridge] Working directory:', this.config.workingDirectory || process.cwd());

      // Spawn Claude Code process
      this.process = spawn(this.config.command, this.config.args, {
        cwd: this.config.workingDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          // Force interactive mode
          FORCE_COLOR: '1',
          TERM: 'xterm-256color'
        }
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        reject(new Error('Failed to create process streams'));
        return;
      }

      // Handle stdout - this is where Claude Code responses come from
      this.process.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        console.log('[Bridge] STDOUT:', text);
        this.buffer += text;

        // Emit output event for streaming
        this.emit('output', text);

        // Check if Claude Code is ready (look for prompt or specific markers)
        if (!this.isReady && (text.includes('Claude Code') || text.includes('>'))) {
          this.isReady = true;
          console.log('[Bridge] Claude Code is ready!');
          resolve();
        }

        // Check for response completion signals
        this.checkResponseComplete(text);
      });

      // Handle stderr - errors and debug info
      this.process.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        console.log('[Bridge] STDERR:', text);
        this.emit('error-output', text);
      });

      // Handle process exit
      this.process.on('exit', (code: number | null, signal: string | null) => {
        console.log(`[Bridge] Claude Code process exited with code ${code}, signal ${signal}`);
        this.isReady = false;
        this.emit('exit', { code, signal });
      });

      // Handle process errors
      this.process.on('error', (error: Error) => {
        console.error('[Bridge] Process error:', error);
        this.emit('error', error);
        reject(error);
      });

      // Timeout if Claude Code doesn't start within 10 seconds
      setTimeout(() => {
        if (!this.isReady) {
          console.log('[Bridge] Timeout waiting for Claude Code to start');
          // Resolve anyway - we'll try to communicate
          this.isReady = true;
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Send a message to Claude Code via stdin
   */
  sendMessage(message: string, messageId: string): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Claude Code process is not running');
    }

    if (!this.isReady) {
      throw new Error('Claude Code is not ready');
    }

    console.log(`[Bridge] Sending message (ID: ${messageId}):`, message.substring(0, 100));

    // Store the message ID for response tracking
    this.lastResponseId = messageId;

    // Clear buffer for new response
    this.buffer = '';

    // Write message to stdin
    this.process.stdin.write(message + '\n');

    // Set timeout for response
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
    }

    this.responseTimeout = setTimeout(() => {
      console.log('[Bridge] Response timeout');
      this.emit('response-complete', {
        messageId,
        content: this.buffer || 'No response received (timeout)',
        isTimeout: true
      });
    }, this.RESPONSE_TIMEOUT_MS);
  }

  /**
   * Check if response is complete
   * This is heuristic-based since Claude Code doesn't have a clear end marker
   */
  private checkResponseComplete(text: string): void {
    // Look for patterns that suggest Claude Code is done responding
    // You may need to adjust these based on actual Claude Code output
    const completionMarkers = [
      /\n\s*$/,  // Empty line at the end
      />\s*$/,   // Prompt character
      /\u001b\[0m\s*$/,  // ANSI reset at the end
    ];

    // Check if any completion marker is present
    const isComplete = completionMarkers.some(marker => marker.test(this.buffer));

    if (isComplete && this.buffer.length > 0) {
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
      }

      console.log('[Bridge] Response appears complete');

      this.emit('response-complete', {
        messageId: this.lastResponseId,
        content: this.buffer.trim(),
        isTimeout: false
      });

      // Reset for next message
      this.buffer = '';
      this.lastResponseId = null;
    }
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Stop the Claude Code process
   */
  stop(): void {
    if (this.process) {
      console.log('[Bridge] Stopping Claude Code process...');

      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
      }

      // Try graceful shutdown first
      if (this.process.stdin) {
        this.process.stdin.end();
      }

      // Force kill after 2 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 2000);

      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed && this.isReady;
  }
}
