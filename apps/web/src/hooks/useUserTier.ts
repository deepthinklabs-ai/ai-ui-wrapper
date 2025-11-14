"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserTier = "free" | "pro";

export const TIER_LIMITS = {
  free: {
    maxThreads: 5,
  },
  pro: {
    maxThreads: Infinity, // Unlimited
  },
};

type UseUserTierResult = {
  tier: UserTier;
  loading: boolean;
  error: string | null;
  refreshTier: () => Promise<void>;
};

/**
 * Hook to fetch and manage user's subscription tier
 * Defaults to 'free' if no profile exists yet
 */
export function useUserTier(userId: string | null | undefined): UseUserTierResult {
  const [tier, setTier] = useState<UserTier>("free");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setTier("free");
      setLoading(false);
      return;
    }
    void refreshTier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshTier = async () => {
    if (!userId) {
      setTier("free");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("tier")
        .eq("id", userId)
        .single();

      if (error) {
        // If profile doesn't exist, create it with free tier
        if (error.code === "PGRST116") {
          const { error: insertError } = await supabase
            .from("user_profiles")
            .insert({ id: userId, tier: "free" });

          if (insertError) {
            console.error("Error creating user profile:", insertError);
          }
          setTier("free");
        } else {
          throw error;
        }
      } else {
        setTier((data?.tier as UserTier) || "free");
      }
    } catch (err: any) {
      console.error("Error fetching user tier:", err);
      setError(err.message ?? "Failed to load user tier");
      setTier("free"); // Default to free on error
    } finally {
      setLoading(false);
    }
  };

  return {
    tier,
    loading,
    error,
    refreshTier,
  };
}
