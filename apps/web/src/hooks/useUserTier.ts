"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserTier = "trial" | "pro" | "expired" | "pending";

export const TIER_LIMITS = {
  trial: {
    maxThreads: Infinity, // Unlimited threads during trial
  },
  pro: {
    maxThreads: Infinity, // Unlimited
  },
  expired: {
    maxThreads: 0, // Read-only, no new threads
  },
  pending: {
    maxThreads: 0, // No access until payment confirmed
  },
};

// Helper to check if a trial has expired
function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}

// Calculate days remaining in trial
function getDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const endDate = new Date(trialEndsAt);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

type UseUserTierResult = {
  tier: UserTier;
  loading: boolean;
  error: string | null;
  refreshTier: () => Promise<void>;
  trialEndsAt: string | null;
  daysRemaining: number;
  isExpired: boolean;
  canUseServices: boolean; // true for trial and pro, false for expired
};

/**
 * Hook to fetch and manage user's subscription tier
 * Handles trial expiration automatically
 */
export function useUserTier(userId: string | null | undefined): UseUserTierResult {
  const [tier, setTier] = useState<UserTier>("trial");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTier = useCallback(async () => {
    if (!userId) {
      setTier("trial");
      setTrialEndsAt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("user_profiles")
        .select("tier, trial_ends_at")
        .eq("id", userId)
        .single();

      if (fetchError) {
        // If profile doesn't exist, create it with pending tier
        // User must complete Stripe checkout to get trial/pro access
        if (fetchError.code === "PGRST116") {
          const { error: insertError } = await supabase
            .from("user_profiles")
            .insert({
              id: userId,
              tier: "pending",
              onboarding_completed: false,
            });

          if (insertError) {
            console.error("Error creating user profile:", insertError);
          }
          setTier("pending");
          setTrialEndsAt(null);
        } else {
          throw fetchError;
        }
      } else if (data) {
        // Handle tier from database
        let currentTier = (data.tier as string) || "trial";
        let currentTrialEndsAt = data.trial_ends_at;

        // Handle legacy "free" tier - treat as expired (safe default)
        // The database migration should properly convert free → trial or expired
        // based on whether the user had a subscription or not
        if (currentTier === "free") {
          console.warn(
            "[useUserTier] Found legacy 'free' tier - treating as 'expired'. " +
            "Run migration 017_fix_sync_user_tier_function.sql to fix."
          );
          // Don't auto-migrate to trial - that could grant unintended access
          // if this was actually a user with a canceled subscription.
          // Treat as expired until DB migration runs.
          currentTier = "expired";
        }

        // Check if trial has expired and update if needed
        if (currentTier === "trial" && isTrialExpired(currentTrialEndsAt)) {
          // Update tier to expired in database
          await supabase
            .from("user_profiles")
            .update({ tier: "expired" })
            .eq("id", userId);
          currentTier = "expired";
        }

        setTier(currentTier as UserTier);
        setTrialEndsAt(currentTrialEndsAt);
      }
    } catch (err: any) {
      console.error("Error fetching user tier:", JSON.stringify(err, null, 2));
      console.error("Error details:", err?.message, err?.code, err?.details);
      setError(err?.message ?? err?.code ?? "Failed to load user tier");
      setTier("pending"); // Default to pending on error (no access)
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setTier("trial");
      setTrialEndsAt(null);
      setLoading(false);
      return;
    }
    void refreshTier();
  }, [userId, refreshTier]);

  const daysRemaining = getDaysRemaining(trialEndsAt);
  const isExpired = tier === "expired";
  const isPending = tier === "pending";
  const canUseServices = tier === "trial" || tier === "pro"; // 'pending' and 'expired' cannot use services

  return {
    tier,
    loading,
    error,
    refreshTier,
    trialEndsAt,
    daysRemaining,
    isExpired,
    canUseServices,
  };
}
