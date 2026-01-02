"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubscriptionManagement from "@/components/settings/SubscriptionManagement";
import OnboardingWelcomeModal from "@/components/settings/OnboardingWelcomeModal";
import PushToTalkSettings from "@/components/settings/PushToTalkSettings";
import EncryptionSettings from "@/components/settings/EncryptionSettings";
import BYOKSettings from "@/components/settings/BYOKSettings";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserTier } from "@/hooks/useUserTier";
import { verifySubscriptionWithRetry, RETRY_STRATEGIES } from "@/lib/services/subscriptionService";

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthSession();
  const { tier, refreshTier } = useUserTier(user?.id);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  // Check if user came from onboarding
  useEffect(() => {
    const isFromOnboarding = searchParams.get('onboarding') === 'true';
    if (isFromOnboarding && tier === 'trial') {
      setShowOnboardingModal(true);
    }
  }, [searchParams, tier]);

  // Check if user came from successful Stripe checkout and verify subscription
  useEffect(() => {
    const isUpgradeSuccess = searchParams.get('upgrade') === 'success';
    if (!isUpgradeSuccess || !user?.id) return;

    setShowUpgradeSuccess(true);
    // Clean up URL immediately
    window.history.replaceState({}, '', '/settings');

    // Use centralized subscription verification service
    const verifySubscription = async () => {
      try {
        const result = await verifySubscriptionWithRetry(
          user.id,
          RETRY_STRATEGIES.AGGRESSIVE, // 10 retries, 500ms delay for settings (fast feedback)
          (attempt, max) => console.log(`[Settings] Verification attempt ${attempt}/${max}`)
        );

        console.log('[Settings] Subscription verification:', result);

        // Refresh the tier from database
        await refreshTier();
        console.log('[Settings] Tier refreshed');
      } catch (error) {
        console.error('[Settings] Error verifying subscription:', error);
        // Still try to refresh tier on error
        await refreshTier();
      }
    };

    verifySubscription();
  }, [searchParams, user?.id, refreshTier]);

  return (
    <div className="flex h-screen flex-col text-foreground overflow-hidden">
      {/* Onboarding Welcome Modal */}
      <OnboardingWelcomeModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/30 bg-white/40 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-md p-2 text-foreground/60 hover:bg-white/40 hover:text-foreground transition-colors"
              title="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold text-foreground">Account Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Upgrade Success Banner */}
          {showUpgradeSuccess && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 backdrop-blur-md p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-700">Welcome to AI Chat Platform!</h3>
                  <p className="mt-2 text-sm text-green-600">
                    Your subscription is now active. To start chatting with AI models, configure at least one API key below.
                  </p>
                  <p className="mt-2 text-sm text-foreground/60">
                    You can use your own API keys from OpenAI, Claude (Anthropic), Grok (xAI), or Gemini (Google).
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeSuccess(false)}
                  className="flex-shrink-0 text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* BYOK API Keys Section - Primary for BYOK model */}
          <BYOKSettings />

          {/* Subscription Management Section */}
          <SubscriptionManagement
            priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_ID}
          />

          {/* Encryption Settings Section */}
          <EncryptionSettings userEmail={user?.email} />

          {/* Push-to-Talk Settings Section */}
          <section className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <PushToTalkSettings />
          </section>

        </div>
      </main>
    </div>
  );
}

function SettingsPageLoading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center text-foreground">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender"></div>
      <p className="mt-4 text-foreground/60">Loading settings...</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageLoading />}>
      <SettingsPageContent />
    </Suspense>
  );
}
