"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type UseAuthSessionResult = {
  user: User | null;
  loadingUser: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

export function useAuthSession(): UseAuthSessionResult {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoadingUser(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Failed to load user");
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    }

    loadUser();

    // Optional: subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clear user state immediately for better UX
      setUser(null);
      setLoadingUser(true);

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Force redirect to auth page
      window.location.href = "/auth";
    } catch (err) {
      console.error("Error signing out:", err);
      // Force redirect anyway
      window.location.href = "/auth";
    }
  };

  return { user, loadingUser, error, signOut };
}
