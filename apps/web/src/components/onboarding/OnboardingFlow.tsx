/**
 * OnboardingFlow Component
 *
 * Orchestrates the onboarding process for new users.
 * Steps:
 * 1. Encryption Welcome - Educate about privacy and encryption
 * 2. Encryption Setup - Set password and save recovery codes
 * 3. Plan Selection (Free or Pro)
 * 4. If Free -> Redirect to settings to add API keys
 * 5. If Pro -> Redirect to Stripe checkout
 */

"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EncryptionWelcome from './EncryptionWelcome';
import EncryptionSetupOnboarding from './EncryptionSetupOnboarding';
import PlanSelection from './PlanSelection';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { useEncryption } from '@/contexts/EncryptionContext';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';

type OnboardingFlowProps = {
  userId: string;
  userEmail?: string;
  onComplete: () => Promise<void>;
};

type OnboardingStep = 'encryption-welcome' | 'encryption-setup' | 'plan-selection';

export default function OnboardingFlow({ userId, userEmail, onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('encryption-welcome');
  const [isProcessing, setIsProcessing] = useState(false);

  const { saveEncryptionSetup, setDataKey } = useEncryption();

  // Get Stripe price ID from environment
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  const { startCheckout, isUpgrading } = useStripeCheckout({
    userId,
    priceId,
  });

  // Step 1: User understood encryption, move to setup
  const handleEncryptionWelcomeContinue = useCallback(() => {
    setStep('encryption-setup');
  }, []);

  // Step 2: Encryption setup complete, move to plan selection
  const handleEncryptionSetupComplete = useCallback(async (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string,
    dataKey: CryptoKey
  ) => {
    try {
      // Save to server
      await saveEncryptionSetup(keyBundle, recoveryBundle, deliveryMethod);

      // Set the data key in context (unlocks encryption)
      setDataKey(dataKey);

      // Move to plan selection
      setStep('plan-selection');
    } catch (error) {
      console.error('[Onboarding] Failed to save encryption setup:', error);
      throw error;
    }
  }, [saveEncryptionSetup, setDataKey]);

  // Step 3a: User selected free plan
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

  // Step 3b: User selected pro plan
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

  // Render current step
  switch (step) {
    case 'encryption-welcome':
      return (
        <EncryptionWelcome
          onContinue={handleEncryptionWelcomeContinue}
          loading={isProcessing}
        />
      );

    case 'encryption-setup':
      return (
        <EncryptionSetupOnboarding
          userEmail={userEmail}
          onComplete={handleEncryptionSetupComplete}
          onBack={() => setStep('encryption-welcome')}
        />
      );

    case 'plan-selection':
      return (
        <PlanSelection
          onSelectFreePlan={handleSelectFreePlan}
          onSelectProPlan={handleSelectProPlan}
          loading={isProcessing || isUpgrading}
        />
      );

    default:
      return null;
  }
}
