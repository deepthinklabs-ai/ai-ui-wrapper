"use client";

import { useState, FormEvent, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import { useSignupsEnabled } from "@/hooks/useSystemStatus";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import TwoFactorLogin from "@/components/auth/TwoFactorLogin";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

// Session timeout reason messages
const SESSION_TIMEOUT_MESSAGES: Record<string, string> = {
  idle_timeout: "You were signed out due to inactivity. Please sign in again.",
  absolute_timeout: "Your session has expired. Please sign in again.",
  manual_logout: "You have been signed out successfully.",
};

// Humorous email placeholders
const EMAIL_PLACEHOLDERS = [
  "type@your.email",
  "email@goes.here",
  "you@typehere.com",
  "your@email.here",
  "insert@email.now",
  "hello@itsme.com",
  "definitely@real.email",
  "not@aspam.bot",
  "human@verified.yes",
  "cool@person.vibes",
  "awesome@human.here",
  "email@required.pls",
  "type@something.fun",
  "yes@thisis.email",
  "real@human.promise",
  "totally@legit.email",
  "your@inbox.awaits",
  "mail@me.maybe",
  "ping@my.inbox",
  "drop@aline.here",
];

// Loading fallback for Suspense
function AuthPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
        <div className="animate-pulse text-foreground/60">Loading...</div>
      </div>
    </div>
  );
}

// Wrapper component with Suspense
export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [pending2FAEmail, setPending2FAEmail] = useState<string | null>(null);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Session timeout message
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  // Random email placeholder (stable per mount)
  const emailPlaceholder = useMemo(() => {
    return EMAIL_PLACEHOLDERS[Math.floor(Math.random() * EMAIL_PLACEHOLDERS.length)];
  }, []);

  // Check for session timeout reason in URL
  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason && SESSION_TIMEOUT_MESSAGES[reason]) {
      setSessionMessage(SESSION_TIMEOUT_MESSAGES[reason]);
      // Clear the URL parameter without triggering navigation
      window.history.replaceState({}, "", "/auth");
    }
  }, [searchParams]);

  // Password strength checking (only enabled during signup)
  const passwordStrength = usePasswordStrength({
    password,
    enabled: isSignUp,
  });

  // Check if signups are enabled (kill switch)
  const { enabled: signupsEnabled, loading: signupsLoading } = useSignupsEnabled();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // Check if signups are enabled
        if (!signupsEnabled) {
          setError("New registrations are temporarily closed. Please try again later.");
          setLoading(false);
          return;
        }

        // Sign up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          setMessage("Account created! Redirecting to dashboard...");
          // Redirect to dashboard after successful signup
          setTimeout(() => router.push("/dashboard"), 1500);
        }
      } else {
        // Sign in - first check if user has 2FA enabled
        const check2FAResponse = await fetch('/api/auth/check-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const check2FAData = await check2FAResponse.json();

        // Attempt to sign in with password
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.user) {
          // Check if 2FA is required
          if (check2FAData.requires2FA) {
            // Sign out temporarily and show 2FA screen
            await supabase.auth.signOut();
            setPending2FAUserId(data.user.id);
            setPending2FAEmail(email);
            setShow2FA(true);
          } else {
            // No 2FA required, redirect to dashboard
            router.push("/dashboard");
          }
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errorMessage = err.message || "Authentication failed";

      // Check if user already exists (during signup)
      if (isSignUp && (
        errorMessage.toLowerCase().includes("already registered") ||
        errorMessage.toLowerCase().includes("already been registered") ||
        errorMessage.toLowerCase().includes("user already exists")
      )) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle 2FA verification success
  const handle2FAVerified = async () => {
    // Re-authenticate with the stored credentials
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: pending2FAEmail!,
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Re-auth error:", err);
      setError("Failed to complete sign in. Please try again.");
      setShow2FA(false);
    }
  };

  // Handle 2FA cancellation
  const handle2FACancel = () => {
    setShow2FA(false);
    setPending2FAUserId(null);
    setPending2FAEmail(null);
    setPassword(""); // Clear password for security
  };

  // Show 2FA screen if needed
  if (show2FA && pending2FAUserId && pending2FAEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
          </div>

          <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <TwoFactorLogin
              userId={pending2FAUserId}
              userEmail={pending2FAEmail}
              onVerified={handle2FAVerified}
              onCancel={handle2FACancel}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show forgot password screen if needed
  if (showForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90" />
            <p className="mt-4 text-sm text-foreground/60">
              Reset your password
            </p>
          </div>

          <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <ForgotPasswordForm
              onBack={() => setShowForgotPassword(false)}
              initialEmail={email}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Aiuiw" className="h-20 w-auto mx-auto brightness-90" />
          <p className="mt-4 text-sm text-black">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Session timeout message */}
          {sessionMessage && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 flex items-start gap-3">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{sessionMessage}</span>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-black bg-white/60 backdrop-blur-md p-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-black"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-black bg-white/80 px-3 py-2 text-black placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                placeholder={emailPlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-black"
              >
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-black bg-white/80 px-3 py-2 pr-10 text-black placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
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
              {isSignUp && (
                <p className="mt-1 text-xs text-foreground/50">
                  Must be at least 8 characters
                </p>
              )}

              {/* Password strength indicator (only show on signup) */}
              {isSignUp && password.length > 0 && (
                <PasswordStrengthIndicator
                  strength={passwordStrength.strength}
                  score={passwordStrength.score}
                  feedback={passwordStrength.feedback}
                  show={true}
                />
              )}

              {/* Forgot password link (only show on sign in) */}
              {!isSignUp && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-black hover:text-black/80"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">
                <p>{error}</p>
                {error.includes("already registered") && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setError(null);
                    }}
                    className="mt-2 text-sky hover:text-sky/80 underline"
                  >
                    Go to Sign In
                  </button>
                )}
              </div>
            )}

            {message && (
              <div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-emerald-600">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full rainbow-gradient border border-black px-4 py-2 text-sm font-semibold text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? isSignUp
                  ? "Creating account..."
                  : "Signing in..."
                : isSignUp
                ? "Create account"
                : "Sign in"}
            </button>
          </div>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-black hover:text-black/80"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
