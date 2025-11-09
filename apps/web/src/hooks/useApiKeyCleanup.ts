/**
 * API Key Cleanup Hook
 *
 * Automatically clears the user's API keys from localStorage when they sign out.
 * This is a security best practice to prevent key exposure on shared devices.
 */

"use client";

import { useEffect } from "react";
import { clearApiKey } from "@/lib/apiKeyStorage";
import { clearClaudeApiKey } from "@/lib/apiKeyStorage.claude";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook that listens for auth state changes and clears API keys on logout
 */
export function useApiKeyCleanup() {
  useEffect(() => {
    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // When user signs out, clear all API keys
      if (event === "SIGNED_OUT") {
        console.log("User signed out - clearing API keys from localStorage");
        clearApiKey(); // Clear OpenAI key
        clearClaudeApiKey(); // Clear Claude key
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
