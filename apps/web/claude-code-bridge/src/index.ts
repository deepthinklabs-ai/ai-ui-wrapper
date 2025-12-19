/**
 * Claude Code Bridge Server
 *
 * HTTP API server that acts as a bridge between the web GUI and Claude Code CLI.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
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
// Uses provided certificates or bundled self-signed certs for local development

// Bundled self-signed certificate for localhost development
// Generated with: openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 3650 -subj "/CN=localhost"
// This is safe because: 1) It's only for localhost, 2) Self-signed certs require explicit browser trust
const LOCALHOST_DEV_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7o5ZYqV7WVFHB
kZKJwPGIEiadL9NLYvRnNhJakfSS4VzR3XJv8jqRJV7ZHXB5kF5hQK9qPTKL6PnK
vPp0owHI7L8KrXYSNgfPFSAL0FJ1H8VAJpLNq7XQOZ0MxZC3dC1eDHLlFkfVFRLJ
8VYQJZ8R+OB9FQoCVeMlKwLIknIGq8TFQQ0ixkCSJAMU7q5VeXk0SANA7z0dFnpO
7wF5OhCfOCBsKNML1f4RBVjSGwYm5BhL0huDPnMl1VdT8FDhJLlNklC0k8H8dD1O
j6jCK7s5bCLL0mLz4NjJ2F1vDrJXQ7VnFJlHoKMKxF9vKcxLqMsnCETnoDl7qMiL
C3p7X3rlAgMBAAECggEAGEpMaeGT7SgB7YSzfOKIPosmV5cD8dJkFTqEjvOKPNVN
rBJBvTLBdHBvB7pXTLNL0e0Z0GMohVnFAT8sQZ5MiMdLtHKQ2tMBVTN0j+XZKP8K
dVODqnMtTmK1Yr+SZUCfFOzM3nZOsE8ZpT7sfB4NLDoGo7Vi0Xf5awM5QM0xKOAu
jC0BZ5shQzM0TAy0j+CV9v0FbnMUC3Jfn7J9RQljBLsP7T7YP7Y0h1fZqTTfLXLj
J0eP0vsTEKL7V4HHjV3V7VB0X2J8T8r7EqENRqLLfB0p5h3L+oZtXVJ3Bt4fC8u5
cK8T0mLBZ0oPXP8q0H7xOHkMjI9kYWxt0qP7FIZLAQKBgQDqGT7aU8TG5hKv9tx9
C7neNhDBtLg9rJX0TyzbVnD0ewFB1fy0EnHr7xnnCe9v8J1yUOAeBJdKn8mIvwJF
LHC11qTXwVrLrJq2FzXlLxM4g9mLxQCVl6jMOyKf4bOJlPHKrR9TW5F8qS2Q0mNS
3DeKFHWZ9u7I5zRh8VzN5Kb5FQKBgQDNVu0BzT7dZT6xNjl2x0wzVes8Lsx7y0KV
gWD9fA7P7F9x0BPML+SF7AvdYmZ0rXeXQBYhHWPNO6sPFQhvWJFMj7jTvfHJ8bRv
dRT5OK1T+AsGFJPV0ed70l0o3V7f0Xfrmc3hMxspxQlLqFD9f7Q5azM7dIPGNYaR
4mn2RG2b4QKBgQCWm4k8i9y0aKr4fF7J3V0unNBz3xJvuxE4RN0bLYJ9FqTzCXXb
sMj7FLofaXF01TlPSu7gB7LJFCXB4Rn8mGrJMPrB8g1dCVpzBPSQoXYnDLO0r0lk
aTPFH7WS6Pa6fxAd3ZFrekjq7fZpkhaBVFX0UCncYrTqZfFGPnFDlmvayQKBgFWr
b0LhLjnL2YS8p8vpfnVnCWYE3V1HPVR5UC0L5qT3K6d3BNkTVpOGV+CGJFJVRzYe
KhCmV7fJ0e3bLkA3F0QpFJ5u8cYb0Xp7CGjE8g3qNQSSaKNf5VB0jH3D0MvKdZEu
mxNl9yBN0dDx5z3l5Ec7PPXpE0u9mojMvNAqJQchAoGBAMCLBATnqBLt0F1TOnqz
NQ5tEL5LSfB8MdJCxfLXpBJ8Y8qTnFJMM8p9WsBY3ArZb8nNkVB9Z8E4OYQJK5Rj
fuC1j0l7BK5PP8rJFjb2y7QM1CfL9M9RRNvB9T8FHmJKNzlhL9X0p5PLoY4p0e3T
z7YLjKXxMgT3tZz7qKPP8sqP
-----END PRIVATE KEY-----`;

const LOCALHOST_DEV_CERT = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQCU+hU2FXcWH9ANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjMwMTAxMDAwMDAwWhcNMzMwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
o5ZYqV7WVFHBkZKJwPGIEiadL9NLYvRnNhJakfSS4VzR3XJv8jqRJV7ZHXB5kF5h
QK9qPTKL6PnKvPp0owHI7L8KrXYSNgfPFSAL0FJ1H8VAJpLNq7XQOZ0MxZC3dC1e
DHLlFkfVFRLJ8VYQJZ8R+OB9FQoCVeMlKwLIknIGq8TFQQ0ixkCSJAMU7q5VeXk0
SANA7z0dFnpO7wF5OhCfOCBsKNML1f4RBVjSGwYm5BhL0huDPnMl1VdT8FDhJLlN
klC0k8H8dD1Oj6jCK7s5bCLL0mLz4NjJ2F1vDrJXQ7VnFJlHoKMKxF9vKcxLqMsn
CETnoDl7qMiLC3p7X3rlAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAFqIJiLOT0A7
p7w8K8xEfN0b6q8xqM0yz7RqPFv5AjH4bT0J6dHqNvJ7CKl0qnLqjvEDjpJXmnqD
dHPr3LmB8mNC3F0AvopMy8EkR0B9T8K8jKfQC3d4LqT0m5Yn7K5MBPKXUE7T5OE7
1P8PA2mAyEi8KLm6h4faRmN0H9QJfCGJL7T8Aw5w5yHxS9bV6dOPmLpCvzN0Gj8R
2g0KLm8KNwT6CnGh4r5FEJHi2Q7gmBKP2LNEZP7YJKGnBPl5lxE9WpK0mr2bZN1I
dI7I8D5E2F0qC0ma9qQGS1TnrPDT2Pf3XlCcV0E0cMr8bhEjPFNEPNEU6CpGe0c0
0Ue0kb0O2dk=
-----END CERTIFICATE-----`;

// Check for provided certificates, otherwise use bundled localhost cert
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const hasProvidedCerts = SSL_KEY_PATH && SSL_CERT_PATH &&
                         existsSync(SSL_KEY_PATH) && existsSync(SSL_CERT_PATH);

let httpsOptions: { key: string | Buffer; cert: string | Buffer };
if (hasProvidedCerts) {
  httpsOptions = {
    key: readFileSync(SSL_KEY_PATH!),
    cert: readFileSync(SSL_CERT_PATH!),
  };
  console.log('[Server] Using provided SSL certificates');
} else {
  // Use bundled self-signed certificate for local development
  httpsOptions = {
    key: LOCALHOST_DEV_KEY,
    cert: LOCALHOST_DEV_CERT,
  };
  console.log('[Server] Using bundled self-signed certificate for localhost');
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
