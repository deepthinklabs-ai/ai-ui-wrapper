/**
 * PlanSelection Component
 *
 * Displays Trial and Pro plan options with features and pricing.
 * Allows user to choose their plan during onboarding.
 */

"use client";

import React from 'react';

type PlanSelectionProps = {
  onSelectFreePlan: () => void;  // Now starts 7-day trial
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
            Start with a free trial or go Pro for full access
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Trial Plan */}
          <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-8 hover:border-amber-500 transition-all">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">7-Day Free Trial</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">$0</span>
                <span className="text-slate-400">for 7 days</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Then $50/month. Cancel anytime.</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">Access to all AI models</span>
                  <p className="text-sm text-slate-400">GPT-5, GPT-4o, Claude Sonnet, Opus, Grok, and more</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">Unlimited conversation threads</span>
                  <p className="text-sm text-slate-400">Create as many threads as you need</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-200 font-medium">All features included</span>
                  <p className="text-sm text-slate-400">File uploads, voice input, text conversion, and more</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="text-slate-400 font-medium">25% of Pro rate limits</span>
                  <p className="text-sm text-slate-500">Lower daily request and token limits</p>
                </div>
              </li>
            </ul>

            <button
              onClick={onSelectFreePlan}
              disabled={loading}
              className="w-full rounded-lg bg-amber-600 px-6 py-3 text-base font-semibold text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Free Trial
            </button>
          </div>

          {/* Pro Plan */}
          <div className="rounded-xl border-2 border-purple-500 bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-8 relative hover:border-purple-400 transition-all">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center rounded-full bg-purple-500 px-4 py-1 text-sm font-semibold text-white">
                Best Value
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Pro Plan</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">$50</span>
                <span className="text-slate-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">All AI models included</span>
                  <p className="text-sm text-slate-300">GPT-5, GPT-4o, Claude Sonnet, Opus, Grok - no API keys needed</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">Full rate limits</span>
                  <p className="text-sm text-slate-300">4x more requests and tokens than trial</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">Priority support</span>
                  <p className="text-sm text-slate-300">Get help when you need it with priority email support</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-slate-100 font-medium">Unlimited everything</span>
                  <p className="text-sm text-slate-300">Threads, file uploads, voice input, and all features</p>
                </div>
              </li>
            </ul>

            <button
              onClick={onSelectProPlan}
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 px-6 py-3 text-base font-semibold text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
            >
              Subscribe to Pro
            </button>
          </div>
        </div>

        {/* Fine Print */}
        <p className="text-center text-sm text-slate-500 mt-8">
          Cancel anytime during your trial. You can manage your subscription from the Settings page.
        </p>
      </div>
    </div>
  );
}
