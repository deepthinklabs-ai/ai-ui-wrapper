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
  const { tier, loading: tierLoading } = useUserTier(user?.id);

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
  const error = checkoutError || portalError;

  if (tierLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Subscription Plan</h3>
          <p className="text-sm text-slate-400 mt-1">
            {isPro ? "You're on the Pro plan" : "You're on the Free plan"}
          </p>
        </div>
        <div>
          {isPro ? (
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
              Pro
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Free plan features */}
      {!isPro && (
        <div className="mb-6">
          <div className="text-sm text-slate-400 mb-3">Current plan includes:</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              5 conversation threads
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Bring your own API keys
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              All basic features
            </li>
          </ul>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-sm font-semibold text-blue-400 mb-2">Upgrade to Pro</div>
            <ul className="space-y-2 text-sm text-slate-300 mb-4">
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Unlimited conversation threads
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Included API access (no keys needed)
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Priority support
              </li>
              <li className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Advanced features
              </li>
            </ul>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={startCheckout}
              disabled={isUpgrading || !priceId}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpgrading ? "Redirecting to checkout..." : !priceId ? "Configure pricing first" : "Upgrade to Pro"}
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
              <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Unlimited conversation threads
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Included API access
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
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
