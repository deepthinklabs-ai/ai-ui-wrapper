"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OnboardingWelcomeModal from "@/components/settings/OnboardingWelcomeModal";
import EncryptionSettings from "@/components/settings/EncryptionSettings";
import BYOKSettings from "@/components/settings/BYOKSettings";
import { OAuthConnectionsSettings } from "@/components/settings/oauth";
import { useAuthSession } from "@/hooks/useAuthSession";

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthSession();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Check if user came from onboarding
  useEffect(() => {
    const isFromOnboarding = searchParams.get('onboarding') === 'true';
    if (isFromOnboarding) {
      setShowOnboardingModal(true);
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

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

          {/* BYOK API Keys Section - Primary for BYOK model */}
          <BYOKSettings />

          {/* OAuth Connections Section */}
          <OAuthConnectionsSettings />

          {/* Encryption Settings Section */}
          <EncryptionSettings userEmail={user?.email} />

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
