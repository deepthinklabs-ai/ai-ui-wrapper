"use client";

/**
 * @security-audit-requested
 * AUDIT FOCUS: Password reset flow
 * - Can an attacker access this page without a valid recovery session?
 * - Is the password strength validation sufficient?
 * - Is there rate limiting on password reset attempts?
 * - Can the session be hijacked during the reset flow?
 * - Is the old password invalidated immediately after reset?
 */

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength checking
  const passwordStrength = usePasswordStrength({
    password,
    enabled: true,
  });

  // Check if user has a valid session (from the recovery link)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsValidSession(!!session);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (passwordStrength.strength === "weak") {
      setError("Please choose a stronger password");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);

      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/auth");
      }, 3000);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (isValidSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-foreground/60">Loading...</div>
      </div>
    );
  }

  // Show error if no valid session
  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
          </div>

          <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">
              <p className="font-medium">Invalid or expired reset link</p>
              <p className="mt-1">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>

            <button
              onClick={() => router.push("/auth")}
              className="mt-4 w-full rounded-full rainbow-gradient border border-foreground/30 px-4 py-2 text-sm font-semibold text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 focus:ring-offset-white"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show success message
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
          </div>

          <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-emerald-600">
              <p className="font-medium">Password reset successful!</p>
              <p className="mt-1">
                Your password has been updated. Redirecting to sign in...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
          <p className="mt-4 text-sm text-foreground/60">
            Set your new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-foreground/20 bg-white/80 px-3 py-2 pr-10 text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                  placeholder="••••••••"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
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
              <p className="mt-1 text-xs text-foreground/50">
                Must be at least 8 characters
              </p>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <PasswordStrengthIndicator
                  strength={passwordStrength.strength}
                  score={passwordStrength.score}
                  feedback={passwordStrength.feedback}
                  show={true}
                />
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground"
              >
                Confirm New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-md border border-foreground/20 bg-white/80 px-3 py-2 pr-10 text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                  placeholder="••••••••"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
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
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password !== confirmPassword}
              className="w-full rounded-full rainbow-gradient border border-foreground/30 px-4 py-2 text-sm font-semibold text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Updating password..." : "Reset Password"}
            </button>
          </div>
        </form>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => router.push("/auth")}
            className="text-foreground hover:text-foreground/80"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
