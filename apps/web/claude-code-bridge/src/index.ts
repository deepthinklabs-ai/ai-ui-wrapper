/**
 * Claude Code Bridge Server
 *
 * HTTP API server that acts as a bridge between the web GUI and Claude Code CLI.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import selfsigned from 'selfsigned';
import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './claudeCodeProcess';
import type { BridgeMessage, BridgeResponse, SessionInfo, ClaudeCodeConfig } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

// SECURITY: Disable X-Powered-By header to prevent information exposure (CWE-200)
app.disable('x-powered-by');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Claude Code process instance
let claudeCodeProcess: ClaudeCodeProcess | null = null;
let sessionId: string = generateSessionId();
let sessionStatus: 'idle' | 'processing' | 'error' = 'idle';

// Store active WebSocket connections
const wsConnections = new Set<WebSocket>();

/**
 * Generate a unique session ID using cryptographically secure randomness
 */
function generateSessionId(): string {
  // SECURITY: Use crypto.randomUUID() instead of Math.random()
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().split('-')[0]
    : require('crypto').randomBytes(8).toString('hex');
  return `session-${Date.now()}-${randomPart}`;
}

/**
 * Get Claude Code configuration from environment or defaults
 */
function getClaudeCodeConfig(): ClaudeCodeConfig {
  return {
    command: process.env.CLAUDE_CODE_PATH || 'claude',
    args: process.env.CLAUDE_CODE_ARGS?.split(' ') || [],
    workingDirectory: process.env.CLAUDE_CODE_WORKDIR || process.cwd()
  };
}

/**
 * Initialize Claude Code process
 */
async function initializeClaudeCode(): Promise<void> {
  if (claudeCodeProcess?.isRunning()) {
    console.log('[Server] Claude Code is already running');
    return;
  }

  try {
    const config = getClaudeCodeConfig();
    console.log('[Server] Initializing Claude Code with config:', config);

    claudeCodeProcess = new ClaudeCodeProcess(config);

    // Set up event listeners
    claudeCodeProcess.on('output', (data: string) => {
      console.log('[Server] Output:', data);
      broadcastToWebSockets({ type: 'output', data });
    });

    claudeCodeProcess.on('error-output', (data: string) => {
      console.log('[Server] Error output:', data);
      broadcastToWebSockets({ type: 'error', data });
    });

    claudeCodeProcess.on('response-complete', (response: any) => {
      console.log('[Server] Response complete:', response.messageId);
      sessionStatus = 'idle';
      broadcastToWebSockets({
        type: 'response-complete',
        data: response
      });
    });

    claudeCodeProcess.on('exit', ({ code, signal }: any) => {
      console.log(`[Server] Claude Code exited: code=${code}, signal=${signal}`);
      sessionStatus = 'error';
      claudeCodeProcess = null;
      broadcastToWebSockets({
        type: 'exit',
        data: { code, signal }
      });
    });

    claudeCodeProcess.on('error', (error: Error) => {
      console.error('[Server] Claude Code error:', error);
      sessionStatus = 'error';
      broadcastToWebSockets({
        type: 'error',
        data: { message: error.message }
      });
    });

    // Start the process
    await claudeCodeProcess.start();
    sessionStatus = 'idle';
    console.log('[Server] Claude Code initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize Claude Code:', error);
    sessionStatus = 'error';
    throw error;
  }
}

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcastToWebSockets(message: any): void {
  const data = JSON.stringify(message);
  wsConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// ============================================================================
// HTTP ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now()
  });
});

/**
 * GET /session
 * Get current session information
 */
app.get('/session', (req: Request, res: Response) => {
  const info: SessionInfo = {
    sessionId,
    status: sessionStatus,
    startTime: Date.now(),
    lastActivity: Date.now()
  };

  res.json(info);
});

/**
 * POST /start
 * Start or restart Claude Code process
 */
app.post('/start', async (req: Request, res: Response) => {
  try {
    // Stop existing process if running
    if (claudeCodeProcess?.isRunning()) {
      claudeCodeProcess.stop();
      claudeCodeProcess = null;
    }

    // Generate new session ID
    sessionId = generateSessionId();

    // Initialize Claude Code
    await initializeClaudeCode();

    res.json({
      success: true,
      sessionId,
      message: 'Claude Code started successfully'
    });
  } catch (error) {
    console.error('[Server] Error starting Claude Code:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /stop
 * Stop Claude Code process
 */
app.post('/stop', (req: Request, res: Response) => {
  if (claudeCodeProcess) {
    claudeCodeProcess.stop();
    claudeCodeProcess = null;
    sessionStatus = 'idle';

    res.json({
      success: true,
      message: 'Claude Code stopped'
    });
  } else {
    res.json({
      success: true,
      message: 'Claude Code was not running'
    });
  }
});

/**
 * POST /message
 * Send a message to Claude Code
 */
app.post('/message', async (req: Request, res: Response) => {
  try {
    const { content, id } = req.body as BridgeMessage;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Initialize Claude Code if not running
    if (!claudeCodeProcess?.isRunning()) {
      console.log('[Server] Claude Code not running, initializing...');
      await initializeClaudeCode();
    }

    if (!claudeCodeProcess) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Claude Code'
      });
    }

    // Update status
    sessionStatus = 'processing';

    // Generate message ID if not provided
    const messageId = id || `msg-${Date.now()}`;

    // Send message to Claude Code
    claudeCodeProcess.sendMessage(content, messageId);

    // Return immediately - response will come via WebSocket
    res.json({
      success: true,
      messageId,
      message: 'Message sent to Claude Code'
    });
  } catch (error) {
    console.error('[Server] Error sending message:', error);
    sessionStatus = 'error';
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /buffer
 * Get current output buffer
 */
app.get('/buffer', (req: Request, res: Response) => {
  if (!claudeCodeProcess) {
    return res.status(404).json({
      success: false,
      error: 'Claude Code is not running'
    });
  }

  res.json({
    success: true,
    content: claudeCodeProcess.getBuffer()
  });
});

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

// Security: Always use HTTPS to prevent cleartext transmission (CWE-319)
// Uses provided certificates or generates self-signed certs at runtime for local development

// Generate self-signed certificate at runtime for localhost development
// This avoids embedding private keys in source code (which triggers secret scanning)
async function generateDevCertificate(): Promise<{ key: string; cert: string }> {
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 1); // Valid for 1 year

  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    notAfterDate,
    algorithm: 'sha256',
  });
  return {
    key: pems.private,
    cert: pems.cert,
  };
}

// Check for provided certificates, otherwise generate at runtime
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const hasProvidedCerts = SSL_KEY_PATH && SSL_CERT_PATH &&
                         existsSync(SSL_KEY_PATH) && existsSync(SSL_CERT_PATH);

// Start server with async certificate generation
(async () => {
  let httpsOptions: { key: string | Buffer; cert: string | Buffer };

  if (hasProvidedCerts) {
    httpsOptions = {
      key: readFileSync(SSL_KEY_PATH!),
      cert: readFileSync(SSL_CERT_PATH!),
    };
    console.log('[Server] Using provided SSL certificates');
  } else {
    // Generate self-signed certificate at runtime for local development
    console.log('[Server] Generating self-signed certificate for localhost...');
    const devCert = await generateDevCertificate();
    httpsOptions = {
      key: devCert.key,
      cert: devCert.cert,
    };
    console.log('[Server] Self-signed certificate generated');
  }

  // Always use HTTPS - no HTTP fallback (CWE-319)
  const server = createHttpsServer(httpsOptions, app);

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Server] New WebSocket connection');
    wsConnections.add(ws);

    // Send current session info
    ws.send(JSON.stringify({
      type: 'session-info',
      data: {
        sessionId,
        status: sessionStatus,
        isRunning: claudeCodeProcess?.isRunning() || false
      }
    }));

    ws.on('close', () => {
      console.log('[Server] WebSocket connection closed');
      wsConnections.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[Server] WebSocket error:', error);
      wsConnections.delete(ws);
    });
  });

  // ============================================================================
  // START SERVER
  // ============================================================================

  // Always use HTTPS - bind to configurable host (default localhost for security)
  const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

  server.listen(Number(PORT), BIND_HOST, () => {
    console.log(`\n==============================================`);
    console.log(`🌉 Claude Code Bridge Server (HTTPS)`);
    console.log(`==============================================`);
    console.log(`HTTPS API: https://${BIND_HOST}:${PORT}`);
    console.log(`WebSocket: wss://${BIND_HOST}:${PORT}`);
    if (!hasProvidedCerts) {
      console.log(`\n⚠️  Using self-signed certificate (browser will show warning)`);
      console.log(`   Set SSL_KEY_PATH and SSL_CERT_PATH for custom certificates`);
    }
    console.log(`\nConfiguration:`);
    console.log(`  Command: ${process.env.CLAUDE_CODE_PATH || 'claude'}`);
    console.log(`  Working Dir: ${process.env.CLAUDE_CODE_WORKDIR || process.cwd()}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health      - Health check`);
    console.log(`  GET  /session     - Session info`);
    console.log(`  POST /start       - Start Claude Code`);
    console.log(`  POST /stop        - Stop Claude Code`);
    console.log(`  POST /message     - Send message`);
    console.log(`  GET  /buffer      - Get output buffer`);
    console.log(`==============================================\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    if (claudeCodeProcess) {
      claudeCodeProcess.stop();
    }
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM...');
    if (claudeCodeProcess) {
      claudeCodeProcess.stop();
    }
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });
})();
