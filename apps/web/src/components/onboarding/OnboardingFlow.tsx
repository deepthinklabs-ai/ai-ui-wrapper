/**
 * OnboardingFlow Component
 *
 * Orchestrates the onboarding process for new users.
 * Steps:
 * 1. Email Verification (2FA setup)
 * 2. Encryption Welcome - Educate about privacy and encryption
 * 3. Encryption Setup - Set password and save recovery codes
 * 4. Complete onboarding and redirect to settings to add API keys
 *
 * The flow automatically detects completed steps and resumes from the correct point.
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmailVerification from './EmailVerification';
import EncryptionWelcome from './EncryptionWelcome';
import EncryptionSetupOnboarding from './EncryptionSetupOnboarding';
import { useEncryption } from '@/contexts/EncryptionContext';
import { supabase } from '@/lib/supabaseClient';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';

type OnboardingFlowProps = {
  userId: string;
  userEmail?: string;
  onComplete: () => Promise<void>;
  onLogout?: () => void;
};

type OnboardingStep = 'loading' | 'email-verification' | 'encryption-welcome' | 'encryption-setup';

export default function OnboardingFlow({ userId, userEmail, onComplete, onLogout }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('loading');
  const [isProcessing, setIsProcessing] = useState(false);

  const { saveEncryptionSetup, setDataKey, state: encryptionState } = useEncryption();

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
          // Both complete - finish onboarding and go to settings
          await completeOnboardingAndRedirect();
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

  // Complete onboarding and redirect to settings
  const completeOnboardingAndRedirect = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Mark onboarding as complete
      await onComplete();

      // Redirect to settings page so user can add their API keys
      router.push('/settings?onboarding=true');
    } catch (error) {
      console.error('[Onboarding] Failed to complete onboarding:', error);
      setIsProcessing(false);
    }
  }, [onComplete, router]);

  // Step 1: Email verification complete, move to encryption welcome
  const handleEmailVerificationComplete = useCallback(() => {
    setStep('encryption-welcome');
  }, []);

  // Step 2: User understood encryption, move to setup
  const handleEncryptionWelcomeContinue = useCallback(() => {
    setStep('encryption-setup');
  }, []);

  // Step 3: Encryption setup complete, finish onboarding and redirect to settings
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

      // Complete onboarding and redirect to settings
      await completeOnboardingAndRedirect();
    } catch (error) {
      console.error('[Onboarding] Failed to save encryption setup:', error);
      throw error;
    }
  }, [saveEncryptionSetup, setDataKey, completeOnboardingAndRedirect]);

  // Render current step
  switch (step) {
    case 'loading':
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky border-r-transparent"></div>
            <p className="mt-4 text-foreground/60">Loading...</p>
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

    default:
      return null;
  }
}
