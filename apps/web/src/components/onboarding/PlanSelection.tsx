/**
 * PlanSelection Component
 *
 * Displays Free and Pro plan options with features and pricing.
 * Allows user to choose their plan during onboarding.
 */

"use client";

import React from 'react';

type PlanSelectionProps = {
  onSelectFreePlan: () => void;
  onSelectProPlan: () => void;
  loading?: boolean;
};

export default function PlanSelection({
  onSelectFreePlan,
  onSelectProPlan,
  loading = false,
}: PlanSelectionProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-100 mb-3">
            Welcome to AI Chat Platform
          </h1>
          <p className="text-lg text-slate-400">
            Choose the plan that's right for you
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="rounded-xl border-2 border-slate-700 bg-slate-900/50 p-8 hover:border-slate-600 transition-all">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Free Tier</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">$0</span>
                <span className="text-slate-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">Up to 5 threads</span>
                  <p className="text-sm text-slate-400">Create and manage up to 5 conversation threads</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">Bring your own API keys</span>
                  <p className="text-sm text-slate-400">Use your OpenAI or Claude API keys</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">Access to all models</span>
                  <p className="text-sm text-slate-400">GPT-4, GPT-5, Claude Sonnet, Opus, and more</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">All features included</span>
                  <p className="text-sm text-slate-400">File uploads, voice input, text conversion, and more</p>
                </div>
              </li>
            </ul>

            <button
              onClick={onSelectFreePlan}
              disabled={loading}
              className="w-full rounded-lg bg-slate-700 px-6 py-3 text-base font-semibold text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start with Free Plan
            </button>
          </div>

          {/* Pro Plan */}
          <div className="rounded-xl border-2 border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-8 relative hover:border-blue-400 transition-all">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center rounded-full bg-blue-500 px-4 py-1 text-sm font-semibold text-white">
                Recommended
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Pro Plan</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">$20</span>
                <span className="text-slate-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">Unlimited threads</span>
                  <p className="text-sm text-slate-300">Create as many conversation threads as you need</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">API access included</span>
                  <p className="text-sm text-slate-300">No need to provide your own API keys - we've got you covered</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">Priority support</span>
                  <p className="text-sm text-slate-300">Get help when you need it with priority email support</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">All features included</span>
                  <p className="text-sm text-slate-300">Everything from Free, plus unlimited usage</p>
                </div>
              </li>
            </ul>

            <button
              onClick={onSelectProPlan}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>

        {/* Fine Print */}
        <p className="text-center text-sm text-slate-500 mt-8">
          You can change your plan anytime from the Settings page
        </p>
      </div>
    </div>
  );
}
