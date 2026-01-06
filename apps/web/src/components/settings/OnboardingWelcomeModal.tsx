/**
 * OnboardingWelcomeModal Component
 *
 * Displayed when new users first arrive at the settings page
 * after completing onboarding. Explains that they need
 * to add an API key before they can use the chat.
 */

"use client";

import React from 'react';

type OnboardingWelcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function OnboardingWelcomeModal({ isOpen, onClose }: OnboardingWelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-white/40 bg-white/90 backdrop-blur-md shadow-2xl">
          {/* Header */}
          <div className="border-b border-foreground/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-lavender to-sky">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Welcome to AI UI Wrapper!</h2>
                <p className="text-sm text-foreground/60">One quick step to get started</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Main message */}
            <div className="rounded-lg border border-sky/30 bg-sky/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 flex-shrink-0 text-sky mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-sky">Before you can start chatting</p>
                  <p className="mt-2 text-sm text-foreground/70">
                    You need to add at least one API key below. This allows the app to connect to AI models on your behalf.
                  </p>
                </div>
              </div>
            </div>

            {/* What you need to do */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">What you need to do:</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-lavender/20 text-xs font-bold text-lavender">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground/70">
                      Add your <span className="font-semibold text-sky">OpenAI API key</span> or <span className="font-semibold text-orange-600">Claude API key</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-lavender/20 text-xs font-bold text-lavender">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground/70">
                      Click <span className="font-semibold text-lavender">"Save"</span> to store your key securely
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-lavender/20 text-xs font-bold text-lavender">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground/70">
                      Go to the Dashboard and start chatting!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-emerald-700">
                  <span className="font-semibold">Secure:</span> Your API keys are stored locally in your browser and never sent to our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-foreground/10 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gradient-to-r from-lavender to-sky px-4 py-3 text-sm font-semibold text-white hover:from-lavender/90 hover:to-sky/90 transition-all shadow-lg shadow-lavender/25"
            >
              Got it! Let's set up my API key
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
