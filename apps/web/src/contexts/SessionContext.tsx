"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  SESSION_CONFIG,
  SessionState,
  getSessionState,
  updateLastActivity,
  initializeSession,
  clearSession,
  formatTimeRemaining,
} from "@/lib/sessionManager";
import { IdleDetector } from "@/lib/idleDetector";

type SessionContextType = {
  // Session state
  sessionState: SessionState;
  isSessionValid: boolean;
  showTimeoutWarning: boolean;
  timeoutReason: SessionState["reason"];
  timeRemaining: string;

  // Actions
  extendSession: () => void;
  endSession: (reason?: SessionState["reason"]) => Promise<void>;
  dismissWarning: () => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

type SessionProviderProps = {
  children: React.ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [sessionState, setSessionState] = useState<SessionState>(() =>
    getSessionState()
  );
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const idleDetectorRef = useRef<IdleDetector | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isEndingSessionRef = useRef(false);

  /**
   * End the session and sign out
   */
  const endSession = useCallback(
    async (reason?: SessionState["reason"]) => {
      // Prevent multiple simultaneous logout attempts
      if (isEndingSessionRef.current) return;
      isEndingSessionRef.current = true;

      try {
        // Stop idle detection
        if (idleDetectorRef.current) {
          idleDetectorRef.current.stop();
          idleDetectorRef.current = null;
        }

        // Clear check interval
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }

        // Clear session data
        clearSession();

        // Sign out from Supabase
        await supabase.auth.signOut();

        // Redirect to auth page with reason
        const params = reason ? `?reason=${reason}` : "";
        window.location.href = `/auth${params}`;
      } catch (error) {
        console.error("[SessionContext] Error ending session:", error);
        // Force redirect anyway
        window.location.href = "/auth";
      }
    },
    []
  );

  /**
   * Handle activity detection - update last activity time
   */
  const handleActivity = useCallback(() => {
    updateLastActivity();
    // Reset warning dismissed state on activity
    setWarningDismissed(false);
  }, []);

  /**
   * Extend session by updating activity (user clicked "Stay logged in")
   */
  const extendSession = useCallback(() => {
    updateLastActivity();
    setShowTimeoutWarning(false);
    setWarningDismissed(false);
  }, []);

  /**
   * Dismiss the timeout warning without extending
   */
  const dismissWarning = useCallback(() => {
    setWarningDismissed(true);
    setShowTimeoutWarning(false);
  }, []);

  /**
   * Check session validity and update state
   */
  const checkSession = useCallback(() => {
    const state = getSessionState();
    setSessionState(state);

    // Handle invalid session
    if (!state.isValid && state.reason !== "no_session") {
      endSession(state.reason);
      return;
    }

    // Show warning if approaching timeout (and not already dismissed)
    if (state.shouldWarn && !warningDismissed) {
      setShowTimeoutWarning(true);
    } else if (!state.shouldWarn) {
      setShowTimeoutWarning(false);
    }
  }, [endSession, warningDismissed]);

  /**
   * Initialize session tracking when user is authenticated
   */
  useEffect(() => {
    let mounted = true;

    async function initSessionTracking() {
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (user) {
        // Initialize session if not already exists
        const currentState = getSessionState();
        if (!currentState.isValid || currentState.reason === "no_session") {
          initializeSession();
        }

        // Start idle detection
        if (!idleDetectorRef.current) {
          idleDetectorRef.current = new IdleDetector({
            onActivity: handleActivity,
          });
          idleDetectorRef.current.start();
        }

        // Start periodic session checks
        if (!checkIntervalRef.current) {
          checkIntervalRef.current = setInterval(
            checkSession,
            SESSION_CONFIG.CHECK_INTERVAL_MS
          );
        }

        // Initial check
        checkSession();
      } else {
        // No user - clear any stale session data
        clearSession();
      }
    }

    initSessionTracking();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        // New login - initialize fresh session
        initializeSession();

        // Start idle detection if not running
        if (!idleDetectorRef.current) {
          idleDetectorRef.current = new IdleDetector({
            onActivity: handleActivity,
          });
          idleDetectorRef.current.start();
        }

        // Start periodic checks if not running
        if (!checkIntervalRef.current) {
          checkIntervalRef.current = setInterval(
            checkSession,
            SESSION_CONFIG.CHECK_INTERVAL_MS
          );
        }

        checkSession();
      } else if (event === "SIGNED_OUT") {
        // User signed out - cleanup
        if (idleDetectorRef.current) {
          idleDetectorRef.current.stop();
          idleDetectorRef.current = null;
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        clearSession();
        setSessionState(getSessionState());
      }
    });

    return () => {
      mounted = false;

      // Cleanup
      if (idleDetectorRef.current) {
        idleDetectorRef.current.stop();
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      subscription.unsubscribe();
    };
  }, [handleActivity, checkSession]);

  // Calculate display values
  const minTimeRemaining = Math.min(
    sessionState.idleTimeRemaining,
    sessionState.absoluteTimeRemaining
  );
  const timeRemaining = formatTimeRemaining(minTimeRemaining);

  const value: SessionContextType = {
    sessionState,
    isSessionValid: sessionState.isValid,
    showTimeoutWarning,
    timeoutReason: sessionState.reason,
    timeRemaining,
    extendSession,
    endSession,
    dismissWarning,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * Hook to access session context
 */
export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider (for components that may render outside session)
 */
export function useSessionOptional(): SessionContextType | null {
  return useContext(SessionContext);
}
