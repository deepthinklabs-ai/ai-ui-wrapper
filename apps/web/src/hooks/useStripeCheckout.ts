/**
 * useStripeCheckout Hook
 *
 * Handles the Stripe checkout flow for subscribing to Pro.
 * Supports optional trial period for new users.
 */

import { useState } from "react";
import { getCSRFToken } from "@/hooks/useCSRF";
import { supabase } from "@/lib/supabaseClient";

type UseStripeCheckoutOptions = {
  userId: string | undefined;
  priceId: string | undefined;
};

export function useStripeCheckout({ userId, priceId }: UseStripeCheckoutOptions) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (trialDays?: number) => {
    if (!userId || !priceId) {
      setError("Configuration error. Please contact support.");
      return;
    }

    setIsUpgrading(true);
    setError(null);

    try {
      // Get session for auth header
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Call checkout API to create Stripe Checkout session
      const csrfToken = getCSRFToken();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          userId,
          priceId,
          trialDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        // Security: Validate and reconstruct URL to break taint flow (CWE-601)
        // We parse the URL, validate it, then construct a NEW URL from scratch
        // using only the pathname and search params with a hardcoded origin
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(data.url);
        } catch {
          throw new Error("Invalid checkout URL format");
        }

        // Only allow Stripe checkout domain
        if (parsedUrl.hostname !== "checkout.stripe.com") {
          throw new Error("Invalid checkout URL domain");
        }

        // Ensure HTTPS
        if (parsedUrl.protocol !== "https:") {
          throw new Error("Checkout URL must use HTTPS");
        }

        // Security: Extract and validate only the session ID (CWE-601)
        // Stripe checkout paths are like /c/pay/cs_xxx or /pay/cs_xxx
        // We extract ONLY the session ID and reconstruct the URL from scratch
        const sessionMatch = parsedUrl.pathname.match(/\/(cs_[a-zA-Z0-9_-]+)$/);
        if (!sessionMatch) {
          throw new Error("Invalid checkout session ID format");
        }

        // The session ID contains only safe characters (validated by regex)
        const sessionId = sessionMatch[1];

        // Security: Construct URL from hardcoded origin + path + validated session ID
        // This completely breaks the taint flow - only the validated session ID is used
        const safeUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;
        window.location.href = safeUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Error starting checkout:", err);
      setError(err.message || "Failed to start checkout");
      setIsUpgrading(false);
    }
  };

  return {
    startCheckout,
    isUpgrading,
    error,
  };
}
