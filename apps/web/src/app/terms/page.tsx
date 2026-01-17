import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export const metadata = {
  title: "Terms of Service - AI UI Wrapper",
  description: "Terms of Service for AI UI Wrapper",
};

export default function TermsPage() {
  return (
    <div className="flex h-full flex-col text-foreground overflow-auto">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/30 bg-white/40 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center">
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.DASHBOARD}
              className="rounded-md p-2 text-foreground/60 hover:bg-white/40 hover:text-foreground transition-colors"
              title="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">Terms of Service</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <p className="text-foreground/60 text-sm mb-6">
              Last updated: January 2025
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-foreground/80 mb-6">
              By accessing or using AI UI Wrapper, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground/80 mb-6">
              AI UI Wrapper provides a multi-provider AI chat platform with workflow automation capabilities. We reserve the right to modify, suspend, or discontinue the service at any time.
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Accounts</h2>
            <p className="text-foreground/80 mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 mb-6">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mb-4">4. Acceptable Use</h2>
            <p className="text-foreground/80 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 mb-6">
              <li>Use the service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mb-4">5. API Keys and Third-Party Services</h2>
            <p className="text-foreground/80 mb-6">
              You are responsible for your own API keys and compliance with third-party AI provider terms of service (OpenAI, Anthropic, xAI, etc.).
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">6. Limitation of Liability</h2>
            <p className="text-foreground/80 mb-6">
              AI UI Wrapper is provided &quot;as is&quot; without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">7. Contact</h2>
            <p className="text-foreground/80">
              For questions about these Terms, please{" "}
              <Link href={ROUTES.CONTACT} className="text-sky hover:text-sky/80 transition-colors">
                contact us
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
