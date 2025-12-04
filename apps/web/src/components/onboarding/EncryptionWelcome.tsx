"use client";

/**
 * EncryptionWelcome Component
 *
 * First step of onboarding - explains why we use encryption and
 * why users need a separate encryption password.
 *
 * Key messaging:
 * - We take privacy seriously
 * - We cannot read your messages (zero-knowledge)
 * - Separate password = your data belongs to you
 * - Recovery codes are critical
 */

import React, { useState } from 'react';

type EncryptionWelcomeProps = {
  onContinue: () => void;
  loading?: boolean;
};

export default function EncryptionWelcome({ onContinue, loading }: EncryptionWelcomeProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-y-auto">
      <div className="flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-6 shadow-lg shadow-green-500/25">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Your Privacy Matters to Us
          </h1>
          <p className="text-lg text-slate-400">
            Before we get started, let's set up your message encryption
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-6">
          {/* Why Encryption */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zero-Knowledge Encryption
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Every message you send is <span className="text-green-400 font-semibold">encrypted on your device</span> before
              it ever reaches our servers. This means:
            </p>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span><strong className="text-white">We cannot read your messages</strong> - not our employees, not hackers, not anyone</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span><strong className="text-white">Your data belongs to you</strong> - only you have the key to unlock it</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span><strong className="text-white">Enterprise-grade security</strong> - the same encryption used by banks and governments</span>
              </li>
            </ul>
          </div>

          {/* Separate Password */}
          <div className="mb-8 p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
              </svg>
              Why a Separate Password?
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Your <span className="text-blue-300 font-semibold">encryption password</span> is different from your login password for a critical reason:
              it ensures that even if someone gains access to your account, they still can't read your messages
              without this second password. Think of it as a <span className="text-blue-300 font-semibold">vault within a vault</span>.
            </p>
          </div>

          {/* Critical Warning */}
          <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="text-lg font-semibold text-amber-300 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              This Is Important
            </h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">1.</span>
                <span><strong className="text-white">Choose a memorable but strong password</strong> - you'll need it each time you log in on a new device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">2.</span>
                <span><strong className="text-white">Save your recovery codes securely</strong> - they're your only backup if you forget your encryption password</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">3.</span>
                <span><strong className="text-white">We cannot recover your data</strong> - if you lose both your password and recovery codes, your messages are permanently inaccessible</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Confirmation & Continue */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <label className="flex items-start gap-4 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-500 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-offset-0"
            />
            <span className="text-slate-200">
              I understand that my messages will be encrypted with a password that only I know, and that
              <span className="text-amber-400 font-semibold"> losing both my encryption password and recovery codes means my data cannot be recovered</span>.
            </span>
          </label>

          <button
            onClick={onContinue}
            disabled={!understood || loading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-lg hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Setting up...
              </span>
            ) : (
              "Continue to Set Up Encryption"
            )}
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            AES-256 Encryption
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Zero-Knowledge
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
            </svg>
            Client-Side Only
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
