/**
 * useStripePortal Hook
 *
 * Handles opening the Stripe Customer Portal for subscription management.
 * Separates business logic from UI components.
 */

import { useState } from "react";

type UseStripePortalOptions = {
  userId: string | undefined;
};

export function useStripePortal({ userId }: UseStripePortalOptions) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    if (!userId) {
      setError("User not found. Please try logging in again.");
      return;
    }

    setIsOpeningPortal(true);
    setError(null);

    try {
      // Call portal API to create Customer Portal session
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open customer portal");
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (err: any) {
      console.error("Error opening portal:", err);
      setError(err.message || "Failed to open subscription management");
      setIsOpeningPortal(false);
    }
  };

  return {
    openPortal,
    isOpeningPortal,
    error,
  };
}
