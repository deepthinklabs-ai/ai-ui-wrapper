/**
 * useStripePortal Hook
 *
 * Handles opening the Stripe Customer Portal for subscription management.
 * Separates business logic from UI components.
 */

import { useState } from "react";
import { getCSRFToken } from "@/hooks/useCSRF";

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
      const csrfToken = getCSRFToken();
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
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
        // Security: Validate and reconstruct URL to break taint flow (CWE-601)
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(data.url);
        } catch {
          throw new Error("Invalid portal URL format");
        }

        // Only allow Stripe billing portal domain
        if (parsedUrl.hostname !== "billing.stripe.com") {
          throw new Error("Invalid portal URL domain");
        }

        // Ensure HTTPS
        if (parsedUrl.protocol !== "https:") {
          throw new Error("Portal URL must use HTTPS");
        }

        // Security: Extract and validate only the session ID (CWE-601)
        // Stripe portal paths are like /p/session/xxx or /session/xxx
        const sessionMatch = parsedUrl.pathname.match(/\/(?:p\/)?session\/([a-zA-Z0-9_-]+)/);
        if (!sessionMatch) {
          throw new Error("Invalid portal session format");
        }

        // The session ID contains only safe characters (validated by regex)
        const sessionId = sessionMatch[1];

        // Security: Construct URL from hardcoded origin + path + validated session ID
        const safeUrl = `https://billing.stripe.com/p/session/${sessionId}`;
        window.location.href = safeUrl;
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
