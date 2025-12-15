"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSelectedModel,
  setSelectedModel,
  type AIModel,
} from "@/lib/apiKeyStorage";
import ModelSelector from "@/components/settings/ModelSelector";
import SubscriptionManagement from "@/components/settings/SubscriptionManagement";
import OnboardingWelcomeModal from "@/components/settings/OnboardingWelcomeModal";
import FeatureToggles from "@/components/settings/FeatureToggles";
import PushToTalkSettings from "@/components/settings/PushToTalkSettings";
import MCPServerSettings from "@/components/settings/MCPServerSettings";
import MCPMigrationBanner from "@/components/settings/MCPMigrationBanner";
import EncryptionSettings from "@/components/settings/EncryptionSettings";
import BYOKSettings from "@/components/settings/BYOKSettings";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserTier } from "@/hooks/useUserTier";

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthSession();
  const { tier, daysRemaining, isExpired, canUseServices } = useUserTier(user?.id);
  const [selectedModel, setSelectedModelState] = useState<AIModel>("gpt-5.1");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  // Check if user came from onboarding
  useEffect(() => {
    const isFromOnboarding = searchParams.get('onboarding') === 'true';
    if (isFromOnboarding && tier === 'trial') {
      setShowOnboardingModal(true);
    }
  }, [searchParams, tier]);

  // Check if user came from successful Stripe checkout
  useEffect(() => {
    const isUpgradeSuccess = searchParams.get('upgrade') === 'success';
    if (isUpgradeSuccess) {
      setShowUpgradeSuccess(true);
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  // Load existing settings on mount
  useEffect(() => {
    const existingModel = getSelectedModel();
    setSelectedModelState(existingModel);
  }, []);

  const handleModelChange = (model: AIModel) => {
    setSelectedModelState(model);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setSelectedModel(selectedModel);
    setHasUnsavedChanges(false);
    router.push("/dashboard");
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Onboarding Welcome Modal */}
      <OnboardingWelcomeModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-400">Unsaved changes</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Upgrade Success Banner */}
          {showUpgradeSuccess && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-300">Welcome to AI Chat Platform!</h3>
                  <p className="mt-2 text-sm text-green-400/90">
                    Your subscription is now active. To start chatting with AI models, configure at least one API key below.
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    You can use your own API keys from OpenAI, Claude (Anthropic), Grok (xAI), or Gemini (Google).
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeSuccess(false)}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* MCP Credentials Migration Banner */}
          <MCPMigrationBanner />

          {/* BYOK API Keys Section - Primary for BYOK model */}
          <BYOKSettings />

          {/* Subscription Management Section */}
          <SubscriptionManagement
            priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_ID}
          />

          {/* Account Status Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-100">Account Status</h2>
              <p className="mt-2 text-sm text-slate-400">
                Your subscription status and usage tier.
              </p>
            </div>

            {/* Trial tier status */}
            {tier === 'trial' && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-300">7-Day Free Trial</div>
                    <div className="text-xs text-amber-400/80 mt-1">
                      {daysRemaining > 0
                        ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining. Configure your API keys above to start chatting.`
                        : 'Your trial has expired. Subscribe to continue using the service.'
                      }
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Use your own API keys from: OpenAI, Claude, Grok, Gemini
                </div>
              </div>
            )}

            {/* Pro tier status */}
            {tier === 'pro' && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green-300">Pro Subscription Active</div>
                    <div className="text-xs text-green-400/80 mt-1">
                      You have full access to all features with higher rate limits.
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Use your own API keys from: OpenAI, Claude, Grok, Gemini
                </div>
              </div>
            )}

            {/* Expired tier status */}
            {tier === 'expired' && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-300">Trial Expired</div>
                    <div className="text-xs text-red-400/80 mt-1">
                      Your free trial has ended. Subscribe to Pro to continue using all features.
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      // Scroll to subscription section
                      document.querySelector('[data-subscription-section]')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
                  >
                    Subscribe Now - $5/month
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Encryption Settings Section */}
          <EncryptionSettings userEmail={user?.email} />

          {/* Model Selection Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Default Model</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose which AI model to use by default for your conversations. You can also switch models
                on any message.
              </p>
            </div>

            <ModelSelector value={selectedModel} onChange={handleModelChange} />

            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Note:</strong> You use your own API keys for each provider.
                Make sure you have the corresponding API key configured above for the model you select.
              </p>
            </div>
          </section>

          {/* Push-to-Talk Settings Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <PushToTalkSettings />
          </section>

          {/* MCP Servers Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <MCPServerSettings />
          </section>

          {/* Feature Toggles Section */}
          <section>
            <FeatureToggles userId={user?.id} />
          </section>

        </div>
      </main>
    </div>
  );
}

function SettingsPageLoading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      <p className="mt-4 text-slate-400">Loading settings...</p>
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
