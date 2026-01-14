import {
  withDebugSession,
  createDebugLogger,
  getDebugSessionId,
  getDebugLogPrefix,
} from 'vercel-debugpack/server';
import { NextRequest } from 'next/server';

export { withDebugSession, createDebugLogger, getDebugSessionId, getDebugLogPrefix };

// Generic context type that works with any route params
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;

// Generic route handler type compatible with Next.js 15
type RouteHandler = (
  request: NextRequest,
  context: AnyContext
) => Promise<Response> | Response;

// Debug route handler includes sessionId as second parameter
type DebugRouteHandler = (
  request: NextRequest,
  sessionId: string | null,
  context?: AnyContext
) => Promise<Response> | Response;

/**
 * Wrap any App Router handler with debug session logging.
 * Compatible with Next.js 15+ route handlers.
 */
export function withDebug(handler: DebugRouteHandler): RouteHandler {
  return async (request, context) => {
    const sessionId = getDebugSessionId(request);

    if (sessionId) {
      const prefix = `[debugSessionId=${sessionId}]`;
      console.log(`${prefix} ${request.method} ${new URL(request.url).pathname}`);
    }

    try {
      return await handler(request, sessionId, context);
    } catch (error) {
      if (sessionId) {
        console.error(`[debugSessionId=${sessionId}] Unhandled error:`, error);
      }
      throw error;
    }
  };
}
