"use client";

/**
 * EncryptionSetupOnboarding Component
 *
 * Full-page encryption setup for onboarding flow.
 * Multi-step process:
 * 1. Set encryption password
 * 2. Generate and save recovery codes
 * 3. Confirm understanding
 */

import React, { useState, useCallback } from 'react';
import {
  createKeyBundle,
  createRecoveryCodeBundle,
  type EncryptionKeyBundle,
  type RecoveryCodeBundle,
} from '@/lib/encryption';
import { generateRecoveryCodesPDF, printRecoveryCodes } from '@/lib/recoveryCodeDelivery';

type EncryptionSetupOnboardingProps = {
  userEmail?: string;
  onComplete: (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string,
    dataKey: CryptoKey
  ) => Promise<void>;
  onBack: () => void;
};

type Step = 'password' | 'recovery-codes' | 'confirm';
type DeliveryMethod = 'download_pdf' | 'print' | 'copy';

export default function EncryptionSetupOnboarding({
  userEmail,
  onComplete,
  onBack,
}: EncryptionSetupOnboardingProps) {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated bundles
  const [keyBundle, setKeyBundle] = useState<EncryptionKeyBundle | null>(null);
  const [recoveryBundle, setRecoveryBundle] = useState<RecoveryCodeBundle | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [codesDelivered, setCodesDelivered] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);

  // Confirmation state
  const [consentChecked, setConsentChecked] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const validatePassword = useCallback((pwd: string): string | null => {
    if (pwd.length < 12) {
      return 'Password must be at least 12 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  }, []);

  const handlePasswordSubmit = useCallback(async () => {
    const error = validatePassword(password);
    if (error) {
      setPasswordError(error);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');
    setIsGenerating(true);

    try {
      // Create the key bundle (returns both bundle and extractable data key)
      const { bundle, dataKey: key } = await createKeyBundle(password);
      setKeyBundle(bundle);
      setDataKey(key);

      // Create recovery code bundle using the extractable data key
      const { codes, bundle: recoveryBundleData } = await createRecoveryCodeBundle(key);
      setRecoveryCodes(codes);
      setRecoveryBundle(recoveryBundleData);

      // Move to recovery codes step
      setStep('recovery-codes');
    } catch (err) {
      console.error('[Encryption Setup] Failed to generate keys:', err);
      setPasswordError('Failed to generate encryption keys. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [password, confirmPassword, validatePassword]);

  const handleDownloadPDF = useCallback(async () => {
    if (!recoveryCodes.length) return;

    try {
      await generateRecoveryCodesPDF(recoveryCodes, userEmail);
      setDeliveryMethod('download_pdf');
      setCodesDelivered(true);
    } catch (err) {
      console.error('[Encryption Setup] Failed to generate PDF:', err);
    }
  }, [recoveryCodes, userEmail]);

  const handlePrint = useCallback(async () => {
    if (!recoveryCodes.length) return;

    try {
      await printRecoveryCodes(recoveryCodes, userEmail);
      setDeliveryMethod('print');
      setCodesDelivered(true);
    } catch (err) {
      console.error('[Encryption Setup] Failed to print:', err);
    }
  }, [recoveryCodes, userEmail]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!recoveryCodes.length) return;

    const text = recoveryCodes.join('\n');
    await navigator.clipboard.writeText(text);
    setDeliveryMethod('copy');
    setCodesCopied(true);
    setCodesDelivered(true);

    setTimeout(() => setCodesCopied(false), 2000);
  }, [recoveryCodes]);

  const handleComplete = useCallback(async () => {
    if (!keyBundle || !recoveryBundle || !deliveryMethod || !dataKey) return;

    setIsCompleting(true);
    try {
      await onComplete(keyBundle, recoveryBundle, deliveryMethod, dataKey);
    } catch (err) {
      console.error('[Encryption Setup] Failed to complete setup:', err);
    } finally {
      setIsCompleting(false);
    }
  }, [keyBundle, recoveryBundle, deliveryMethod, dataKey, onComplete]);

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-y-auto">
      <div className="flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-4 shadow-lg shadow-green-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {step === 'password' && 'Create Your Encryption Password'}
            {step === 'recovery-codes' && 'Save Your Recovery Codes'}
            {step === 'confirm' && 'Confirm Setup'}
          </h1>
          <p className="text-slate-400">
            Step {step === 'password' ? '1' : step === 'recovery-codes' ? '2' : '3'} of 3
          </p>

          {/* Progress bar */}
          <div className="mt-4 flex gap-2 max-w-xs mx-auto">
            <div className={`h-1.5 flex-1 rounded-full ${step === 'password' ? 'bg-green-500' : 'bg-green-500'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step === 'recovery-codes' || step === 'confirm' ? 'bg-green-500' : 'bg-slate-700'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step === 'confirm' ? 'bg-green-500' : 'bg-slate-700'}`} />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          {/* Step 1: Password */}
          {step === 'password' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-200">
                  This password encrypts all your messages. It's separate from your login password for maximum security.
                  <span className="text-blue-300 font-semibold"> Choose something memorable but strong.</span>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Encryption Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password (12+ characters)"
                    autoFocus
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-300">{passwordError}</p>
                  </div>
                )}

                {/* Password strength indicators */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`flex items-center gap-2 ${password.length >= 12 ? 'text-green-400' : 'text-slate-500'}`}>
                    {password.length >= 12 ? '✓' : '○'} 12+ characters
                  </div>
                  <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    {/[a-z]/.test(password) ? '✓' : '○'} Lowercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    {/[0-9]/.test(password) ? '✓' : '○'} Number
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onBack}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={isGenerating || !password || !confirmPassword}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Recovery Codes */}
          {step === 'recovery-codes' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-sm text-green-200">
                  <span className="font-semibold">Your encryption password is set!</span> Now save these recovery codes.
                  They're your only backup if you forget your password.
                </p>
              </div>

              {/* Recovery Codes Grid */}
              <div className="p-4 bg-slate-900 border border-slate-600 rounded-xl">
                <div className="grid grid-cols-3 gap-2">
                  {recoveryCodes.map((code, index) => (
                    <div
                      key={index}
                      className="bg-slate-800 rounded px-3 py-2 font-mono text-sm text-slate-200 text-center"
                    >
                      <span className="text-slate-500 text-xs mr-1">{index + 1}.</span>
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Options */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-300">Save your codes:</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleDownloadPDF}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      deliveryMethod === 'download_pdf'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-slate-200">Download PDF</span>
                    {deliveryMethod === 'download_pdf' && (
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={handlePrint}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      deliveryMethod === 'print'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span className="text-sm text-slate-200">Print</span>
                    {deliveryMethod === 'print' && (
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={handleCopyToClipboard}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      deliveryMethod === 'copy'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span className="text-sm text-slate-200">{codesCopied ? 'Copied!' : 'Copy'}</span>
                    {deliveryMethod === 'copy' && (
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-sm text-amber-200">
                  <span className="font-semibold">Keep these safe!</span> Each code can only be used once.
                  Store them in a password manager or a secure location.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('password')}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!codesDelivered}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  I've Saved My Codes
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-900 border border-slate-600 rounded-xl">
                <h3 className="text-sm font-medium text-slate-200 mb-3">Setup Summary:</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Encryption password created
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    12 recovery codes generated
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Codes saved via: {deliveryMethod === 'download_pdf' ? 'PDF Download' : deliveryMethod === 'print' ? 'Print' : 'Clipboard'}
                  </li>
                </ul>
              </div>

              <label className="flex items-start gap-4 cursor-pointer p-4 bg-slate-900 border border-slate-600 rounded-xl hover:border-slate-500 transition-colors">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-500 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-200 leading-relaxed">
                  I understand that if I lose both my encryption password and all recovery codes,
                  <span className="text-amber-400 font-semibold"> my encrypted messages cannot be recovered by anyone</span>, including the service provider.
                </span>
              </label>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-slate-300">
                    <span className="text-red-300 font-semibold">This is zero-knowledge encryption.</span> We do not store your encryption key and cannot recover your messages. This is by design - it's what keeps your data truly private.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('recovery-codes')}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={!consentChecked || isCompleting}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCompleting ? 'Completing...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
