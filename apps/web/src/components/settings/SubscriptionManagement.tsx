"use client";

import { useUserTier } from "@/hooks/useUserTier";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useStripePortal } from "@/hooks/useStripePortal";

type SubscriptionManagementProps = {
  priceId?: string; // Stripe Price ID (set in env or pass from parent)
};

export default function SubscriptionManagement({ priceId }: SubscriptionManagementProps) {
  const { user } = useAuthSession();
  const { tier, loading: tierLoading, daysRemaining, isExpired } = useUserTier(user?.id);

  // Stripe checkout hook (upgrade to Pro)
  const {
    startCheckout,
    isUpgrading,
    error: checkoutError,
  } = useStripeCheckout({
    userId: user?.id,
    priceId,
  });

  // Stripe portal hook (manage subscription)
  const {
    openPortal,
    isOpeningPortal,
    error: portalError,
  } = useStripePortal({
    userId: user?.id,
  });

  const isPro = tier === "pro";
  const isTrial = tier === "trial";
  const error = checkoutError || portalError;

  if (tierLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6" data-subscription-section>
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6" data-subscription-section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Subscription Plan</h3>
          <p className="text-sm text-slate-400 mt-1">
            {isPro && "You're on the Pro plan"}
            {isTrial && `7-day free trial - ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}
            {isExpired && "Your trial has expired"}
          </p>
        </div>
        <div>
          {isPro && (
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400 ring-1 ring-inset ring-green-500/20">
              Pro
            </span>
          )}
          {isTrial && (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
              Trial
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Trial plan - show upgrade prompt */}
      {isTrial && (
        <div className="mb-6">
          <div className="text-sm text-slate-400 mb-3">Trial includes:</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Use your own API keys (OpenAI, Claude, Grok, Gemini)
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Unlimited conversation threads
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-400">25% of Pro rate limits</span>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="text-sm font-semibold text-purple-400 mb-2">Upgrade to Pro - $5/month</div>
            <ul className="space-y-2 text-sm text-slate-300 mb-4">
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Full rate limits (4x more than trial)
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Secure API key storage (Google Secret Manager)
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Priority support
              </li>
            </ul>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={() => startCheckout()}
              disabled={isUpgrading || !priceId}
              className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpgrading ? "Redirecting to checkout..." : !priceId ? "Configure pricing first" : "Subscribe Now"}
            </button>
          </div>
        </div>
      )}

      {/* Expired trial - urgent upgrade prompt */}
      {isExpired && (
        <div className="mb-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-sm font-semibold text-red-300">Your trial has expired</div>
                <div className="text-xs text-red-400/80 mt-1">
                  Subscribe to Pro to continue using all AI features. Your threads are saved and will be accessible after subscribing.
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="text-sm font-semibold text-purple-400 mb-2">Subscribe to Pro - $5/month</div>
            <ul className="space-y-2 text-sm text-slate-300 mb-4">
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Use your own API keys (OpenAI, Claude, Grok, Gemini)
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Unlimited threads and full rate limits
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Priority support
              </li>
            </ul>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={() => startCheckout()}
              disabled={isUpgrading || !priceId}
              className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpgrading ? "Redirecting to checkout..." : !priceId ? "Configure pricing first" : "Subscribe Now"}
            </button>
          </div>
        </div>
      )}

      {/* Pro plan management */}
      {isPro && (
        <div>
          <div className="text-sm text-slate-400 mb-3">Pro plan includes:</div>
          <ul className="space-y-2 text-sm text-slate-300 mb-6">
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Use your own API keys (OpenAI, Claude, Grok, Gemini)
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Full rate limits
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Unlimited conversation threads
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Priority support
            </li>
          </ul>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={openPortal}
            disabled={isOpeningPortal}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOpeningPortal ? "Opening..." : "Manage Subscription"}
          </button>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Update payment method, view invoices, or cancel subscription
          </p>
        </div>
      )}
    </div>
  );
}
