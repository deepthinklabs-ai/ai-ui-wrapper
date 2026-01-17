import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export const metadata = {
  title: "Contact - AI UI Wrapper",
  description: "Contact AI UI Wrapper support",
};

export default function ContactPage() {
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
            <h1 className="text-2xl font-semibold text-foreground">Contact Us</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Get in Touch</h2>
            <p className="text-foreground/80 mb-6">
              Have questions, feedback, or need support? We&apos;re here to help.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-foreground mb-2">Email Support</h3>
                <p className="text-foreground/80 mb-2">
                  For general inquiries and support:
                </p>
                <a
                  href="mailto:dave@deepthinklabs.ai"
                  className="text-blue-600 hover:text-blue-800 underline transition-colors"
                >
                  dave@deepthinklabs.ai
                </a>
              </div>

              <div>
                <h3 className="font-medium text-foreground mb-2">Response Time</h3>
                <p className="text-foreground/80">
                  We typically respond within 24-48 hours during business days.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Resources</h2>
            <ul className="space-y-3">
              <li>
                <Link
                  href={ROUTES.DOCS}
                  className="text-sky hover:text-sky/80 transition-colors"
                >
                  Documentation
                </Link>
                <span className="text-foreground/60"> - Learn how to use the platform</span>
              </li>
              <li>
                <Link
                  href={ROUTES.PRIVACY_POLICY}
                  className="text-sky hover:text-sky/80 transition-colors"
                >
                  Privacy Policy
                </Link>
                <span className="text-foreground/60"> - How we handle your data</span>
              </li>
              <li>
                <Link
                  href={ROUTES.TERMS}
                  className="text-sky hover:text-sky/80 transition-colors"
                >
                  Terms of Service
                </Link>
                <span className="text-foreground/60"> - Our service agreement</span>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
