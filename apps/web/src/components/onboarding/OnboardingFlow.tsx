/**
 * OnboardingFlow Component
 *
 * Orchestrates the onboarding process for new users.
 * Steps:
 * 1. Plan selection (Free or Pro)
 * 2. If Free → Redirect to settings to add API keys
 * 3. If Pro → Redirect to Stripe checkout
 */

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import PlanSelection from './PlanSelection';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';

type OnboardingFlowProps = {
  userId: string;
  onComplete: () => Promise<void>;
};

export default function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get Stripe price ID from environment
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  const { startCheckout, isUpgrading } = useStripeCheckout({
    userId,
    priceId,
  });

  const handleSelectFreePlan = async () => {
    setIsProcessing(true);
    try {
      // Mark onboarding as complete
      await onComplete();

      // Redirect to settings page to add API keys
      router.push('/settings?onboarding=true');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setIsProcessing(false);
    }
  };

  const handleSelectProPlan = async () => {
    setIsProcessing(true);
    try {
      // Mark onboarding as complete before going to Stripe
      await onComplete();

      // Redirect to Stripe checkout
      await startCheckout();
    } catch (err) {
      console.error('Error starting Pro upgrade:', err);
      setIsProcessing(false);
    }
  };

  return (
    <PlanSelection
      onSelectFreePlan={handleSelectFreePlan}
      onSelectProPlan={handleSelectProPlan}
      loading={isProcessing || isUpgrading}
    />
  );
}
