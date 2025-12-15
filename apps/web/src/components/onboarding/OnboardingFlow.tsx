/**
 * OnboardingFlow Component
 *
 * Orchestrates the onboarding process for new users.
 * Steps:
 * 1. Email Verification (2FA setup)
 * 2. Encryption Welcome - Educate about privacy and encryption
 * 3. Encryption Setup - Set password and save recovery codes
 * 4. Plan Selection (7-day Trial or Pro)
 * 5. If Trial -> Redirect to dashboard (trial includes API access)
 * 6. If Pro -> Redirect to Stripe checkout ($50/month)
 *
 * The flow automatically detects completed steps and resumes from the correct point.
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmailVerification from './EmailVerification';
import EncryptionWelcome from './EncryptionWelcome';
import EncryptionSetupOnboarding from './EncryptionSetupOnboarding';
import PlanSelection from './PlanSelection';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { useEncryption } from '@/contexts/EncryptionContext';
import { supabase } from '@/lib/supabaseClient';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';

type OnboardingFlowProps = {
  userId: string;
  userEmail?: string;
  onComplete: () => Promise<void>;
};

type OnboardingStep = 'loading' | 'email-verification' | 'encryption-welcome' | 'encryption-setup' | 'plan-selection';

export default function OnboardingFlow({ userId, userEmail, onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('loading');
  const [isProcessing, setIsProcessing] = useState(false);

  const { saveEncryptionSetup, setDataKey, state: encryptionState } = useEncryption();

  // Get Stripe price ID from environment
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  // DEBUG: Log the price ID from client
  console.log('[OnboardingFlow] Price ID from env:', priceId);

  const { startCheckout, isUpgrading } = useStripeCheckout({
    userId,
    priceId,
  });

  // Determine initial step based on what's already completed
  useEffect(() => {
    const determineInitialStep = async () => {
      try {
        // Check if email 2FA is already enabled
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('email_2fa_enabled')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('[OnboardingFlow] Error fetching profile:', error);
          // Default to email verification if we can't determine status
          setStep('email-verification');
          return;
        }

        const email2FAComplete = profile?.email_2fa_enabled === true;
        const encryptionComplete = encryptionState.hasEncryption;

        console.log('[OnboardingFlow] Determining step:', {
          email2FAComplete,
          encryptionComplete,
          encryptionStateLoading: encryptionState.isLoading,
        });

        // Wait for encryption state to finish loading before deciding
        if (encryptionState.isLoading) {
          return; // Will re-run when isLoading becomes false
        }

        if (email2FAComplete && encryptionComplete) {
          // Both complete - go to plan selection
          setStep('plan-selection');
        } else if (email2FAComplete) {
          // Email done, encryption not done - go to encryption welcome
          setStep('encryption-welcome');
        } else {
          // Start from beginning
          setStep('email-verification');
        }
      } catch (err) {
        console.error('[OnboardingFlow] Error determining initial step:', err);
        setStep('email-verification');
      }
    };

    if (userId) {
      determineInitialStep();
    }
  }, [userId, encryptionState.hasEncryption, encryptionState.isLoading]);

  // Step 1: Email verification complete, move to encryption welcome
  const handleEmailVerificationComplete = useCallback(() => {
    setStep('encryption-welcome');
  }, []);

  // Step 2: User understood encryption, move to setup
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

  // Step 3a: User selected trial plan (7-day free trial with credit card)
  const handleSelectFreePlan = async () => {
    setIsProcessing(true);
    try {
      // DO NOT mark onboarding complete here - wait for Stripe webhook
      // This prevents users from bypassing payment by clicking back
      // The webhook will set onboarding_completed: true after successful checkout

      // Redirect to Stripe checkout with 7-day trial
      await startCheckout(7);
    } catch (err) {
      console.error('Error starting trial:', err);
      setIsProcessing(false);
    }
  };

  // Step 3b: User selected pro plan (immediate billing, no trial)
  const handleSelectProPlan = async () => {
    setIsProcessing(true);
    try {
      // DO NOT mark onboarding complete here - wait for Stripe webhook
      // This prevents users from bypassing payment by clicking back
      // The webhook will set onboarding_completed: true after successful checkout

      // Redirect to Stripe checkout (no trial, immediate billing)
      await startCheckout();
    } catch (err) {
      console.error('Error starting Pro upgrade:', err);
      setIsProcessing(false);
    }
  };

  // Render current step
  switch (step) {
    case 'loading':
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-slate-400">Loading...</p>
          </div>
        </div>
      );

    case 'email-verification':
      return (
        <EmailVerification
          userId={userId}
          userEmail={userEmail || ''}
          onComplete={handleEmailVerificationComplete}
        />
      );

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
