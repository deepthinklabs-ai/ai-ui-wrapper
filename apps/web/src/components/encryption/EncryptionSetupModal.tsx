"use client";

/**
 * EncryptionSetupModal Component
 *
 * Multi-step modal for setting up message encryption:
 * 1. Set encryption password
 * 2. Generate and deliver recovery codes
 * 3. Confirm codes saved with consent
 */

import React, { useState, useCallback } from 'react';
import {
  createKeyBundle,
  createRecoveryCodeBundle,
  type EncryptionKeyBundle,
  type RecoveryCodeBundle,
} from '@/lib/encryption';
import { generateRecoveryCodesPDF, printRecoveryCodes } from '@/lib/recoveryCodeDelivery';

type EncryptionSetupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (keyBundle: EncryptionKeyBundle, recoveryBundle: RecoveryCodeBundle, deliveryMethod: string) => Promise<void>;
  userEmail?: string;
};

type Step = 'password' | 'recovery-codes' | 'confirm';
type DeliveryMethod = 'download_pdf' | 'print' | 'copy' | 'email';

export default function EncryptionSetupModal({
  isOpen,
  onClose,
  onComplete,
  userEmail,
}: EncryptionSetupModalProps) {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Generated bundles
  const [keyBundle, setKeyBundle] = useState<EncryptionKeyBundle | null>(null);
  const [recoveryBundle, setRecoveryBundle] = useState<RecoveryCodeBundle | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

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
    // Validate password
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
      const { bundle, dataKey } = await createKeyBundle(password);
      setKeyBundle(bundle);

      // Create recovery code bundle using the extractable data key
      const { codes, bundle: recoveryBundleData } = await createRecoveryCodeBundle(dataKey);
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

    // Reset copied state after 2 seconds
    setTimeout(() => setCodesCopied(false), 2000);
  }, [recoveryCodes]);

  const handleComplete = useCallback(async () => {
    if (!keyBundle || !recoveryBundle || !deliveryMethod) return;

    setIsCompleting(true);
    try {
      await onComplete(keyBundle, recoveryBundle, deliveryMethod);
      onClose();
    } catch (err) {
      console.error('[Encryption Setup] Failed to complete setup:', err);
    } finally {
      setIsCompleting(false);
    }
  }, [keyBundle, recoveryBundle, deliveryMethod, onComplete, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b border-slate-800 px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Set Up Message Encryption</h2>
                <p className="text-sm text-slate-400">
                  {step === 'password' && 'Step 1 of 3: Create encryption password'}
                  {step === 'recovery-codes' && 'Step 2 of 3: Save your recovery codes'}
                  {step === 'confirm' && 'Step 3 of 3: Confirm setup'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 flex gap-2">
              <div className={`h-1.5 flex-1 rounded-full ${step === 'password' ? 'bg-green-500' : 'bg-green-500'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step === 'recovery-codes' || step === 'confirm' ? 'bg-green-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step === 'confirm' ? 'bg-green-500' : 'bg-slate-700'}`} />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
            {/* Step 1: Password */}
            {step === 'password' && (
              <>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-200">End-to-End Encryption</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Your messages will be encrypted before leaving your device. We cannot read your messages - only you can, with this password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Encryption Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password (12+ characters)"
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 pr-10 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 pr-10 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-sm text-red-300">{passwordError}</p>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 space-y-1">
                    <p className={password.length >= 12 ? 'text-green-400' : ''}>
                      {password.length >= 12 ? '✓' : '○'} At least 12 characters
                    </p>
                    <p className={/[A-Z]/.test(password) ? 'text-green-400' : ''}>
                      {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                    </p>
                    <p className={/[a-z]/.test(password) ? 'text-green-400' : ''}>
                      {/[a-z]/.test(password) ? '✓' : '○'} One lowercase letter
                    </p>
                    <p className={/[0-9]/.test(password) ? 'text-green-400' : ''}>
                      {/[0-9]/.test(password) ? '✓' : '○'} One number
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-200">Remember This Password</p>
                      <p className="mt-1 text-sm text-slate-300">
                        This is separate from your login password. If you forget it, you'll need recovery codes to access your messages.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Recovery Codes */}
            {step === 'recovery-codes' && (
              <>
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-200">Encryption Password Set!</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Now save your recovery codes. These are your backup if you forget your encryption password.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recovery Codes Grid */}
                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {recoveryCodes.map((code, index) => (
                      <div
                        key={index}
                        className="rounded bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 text-center"
                      >
                        <span className="text-slate-500 text-xs mr-2">{index + 1}.</span>
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Options */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">Save your codes securely:</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDownloadPDF}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                        deliveryMethod === 'download_pdf'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                        <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Download PDF</p>
                        <p className="text-xs text-slate-400">Save to your device</p>
                      </div>
                      {deliveryMethod === 'download_pdf' && (
                        <svg className="h-5 w-5 text-green-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={handlePrint}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                        deliveryMethod === 'print'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Print</p>
                        <p className="text-xs text-slate-400">Physical backup</p>
                      </div>
                      {deliveryMethod === 'print' && (
                        <svg className="h-5 w-5 text-green-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={handleCopyToClipboard}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                        deliveryMethod === 'copy'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                        <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {codesCopied ? 'Copied!' : 'Copy to Clipboard'}
                        </p>
                        <p className="text-xs text-slate-400">Paste to password manager</p>
                      </div>
                      {deliveryMethod === 'copy' && (
                        <svg className="h-5 w-5 text-green-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 opacity-50 cursor-not-allowed">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                        <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Email (Enterprise)</p>
                        <p className="text-xs text-slate-400">Coming soon</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-200">Keep These Safe!</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Each code can only be used once. Store them somewhere secure, like a password manager or a safe.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
              <>
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-200">Almost Done!</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Please confirm you've saved your recovery codes before we enable encryption.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4">
                    <h4 className="text-sm font-medium text-slate-200 mb-3">Summary:</h4>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Encryption password created
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        12 recovery codes generated
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Codes saved via: {deliveryMethod === 'download_pdf' ? 'PDF Download' : deliveryMethod === 'print' ? 'Print' : deliveryMethod === 'copy' ? 'Clipboard' : 'Email'}
                      </li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-300">
                      I understand that if I lose both my encryption password and all recovery codes,
                      <span className="text-amber-400 font-medium"> my encrypted messages cannot be recovered by anyone, including the service provider</span>.
                    </span>
                  </label>
                </div>

                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-200">No Recovery Possible</p>
                      <p className="mt-1 text-sm text-slate-300">
                        This is a zero-knowledge encryption system. We do not have access to your encryption key and cannot reset or recover your messages.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-6 py-4 flex-shrink-0">
            {step === 'password' && (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={isGenerating || !password || !confirmPassword}
                  className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : 'Continue'}
                </button>
              </div>
            )}

            {step === 'recovery-codes' && (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('password')}
                  className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!codesDelivered}
                  className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  I've Saved My Codes
                </button>
              </div>
            )}

            {step === 'confirm' && (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('recovery-codes')}
                  className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={!consentChecked || isCompleting}
                  className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCompleting ? 'Enabling Encryption...' : 'Enable Encryption'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
