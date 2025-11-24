'use client';

/**
 * Canvas Notifications
 *
 * Centralized notification system for Canvas operations.
 * Shows loading indicators, error messages, and success feedback.
 */

import React, { useEffect } from 'react';
import type { LoadingState, CanvasError } from '../hooks/useCanvasState';

interface CanvasNotificationsProps {
  loading: LoadingState;
  error: CanvasError | null;
  onClearError: () => void;
  onRetry?: () => void;
}

export default function CanvasNotifications({
  loading,
  error,
  onClearError,
  onRetry,
}: CanvasNotificationsProps) {
  // Auto-dismiss errors after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        onClearError();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [error, onClearError]);

  // Generate loading message
  const getLoadingMessage = (): string => {
    const { entity, operation } = loading;

    if (entity === 'none' || operation === 'none') return '';

    const operationText = {
      fetching: 'Loading',
      creating: 'Creating',
      updating: 'Updating',
      deleting: 'Deleting',
      duplicating: 'Duplicating',
      none: '',
    }[operation];

    const entityText = {
      canvas: 'canvas',
      node: 'node',
      edge: 'connection',
      none: '',
    }[entity];

    return `${operationText} ${entityText}...`;
  };

  const showLoading = loading.entity !== 'none' && loading.operation !== 'none';
  const loadingMessage = getLoadingMessage();

  return (
    <>
      {/* Loading Indicator */}
      {showLoading && (
        <div className="fixed top-4 right-4 z-[10000] animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-3 rounded-lg border border-blue-600/50 bg-blue-500/10 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-blue-200">{loadingMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="fixed top-4 right-4 z-[10000] animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-3 rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 shadow-lg backdrop-blur-sm max-w-md">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
              <span className="text-lg">❌</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-200">
                Error {error.operation === 'none' ? '' : error.operation} {error.entity}
              </p>
              <p className="text-xs text-red-300/80 mt-0.5 break-words">{error.message}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {error.canRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 transition-colors"
                >
                  Retry
                </button>
              )}
              <button
                onClick={onClearError}
                className="text-red-400 hover:text-red-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
