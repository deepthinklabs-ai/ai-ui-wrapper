/**
 * useStripeCheckout Hook
 *
 * Handles the Stripe checkout flow for subscribing to Pro.
 * Supports optional trial period for new users.
 */

import { useState } from "react";

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
      // Call checkout API to create Stripe Checkout session
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        window.location.href = data.url;
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
