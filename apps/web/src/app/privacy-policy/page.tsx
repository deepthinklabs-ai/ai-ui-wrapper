import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export const metadata = {
  title: "Privacy Policy - AI UI Wrapper",
  description: "Privacy Policy for AI UI Wrapper",
};

export default function PrivacyPolicyPage() {
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
            <h1 className="text-2xl font-semibold text-foreground">Privacy Policy</h1>
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

            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-foreground/80 mb-6">
              AI UI Wrapper (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-foreground/80 mb-4">
              We may collect information about you in a variety of ways, including:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 mb-6">
              <li>Personal data you provide when creating an account (email address)</li>
              <li>Usage data and analytics</li>
              <li>Chat messages and conversation history (encrypted)</li>
              <li>API keys you choose to store (encrypted)</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-foreground/80 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 mb-6">
              <li>Provide, operate, and maintain our services</li>
              <li>Improve and personalize your experience</li>
              <li>Communicate with you about updates and support</li>
              <li>Ensure the security of our platform</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mb-4">4. Data Security</h2>
            <p className="text-foreground/80 mb-6">
              We implement appropriate technical and organizational security measures to protect your personal information. This includes end-to-end encryption for sensitive data like messages and API keys.
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-4">5. Contact Us</h2>
            <p className="text-foreground/80">
              If you have questions about this Privacy Policy, please{" "}
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
