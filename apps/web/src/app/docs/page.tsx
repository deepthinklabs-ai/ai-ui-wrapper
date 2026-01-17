import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export const metadata = {
  title: "Documentation - AI UI Wrapper",
  description: "Learn how to use AI UI Wrapper",
};

export default function DocsPage() {
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
            <h1 className="text-2xl font-semibold text-foreground">Documentation</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Getting Started</h2>
            <p className="text-foreground/80 mb-4">
              Welcome to AI UI Wrapper documentation. This guide will help you get started with the platform.
            </p>
            <p className="text-foreground/80">
              AI UI Wrapper is a multi-provider AI chat platform with an n8n-style visual workflow builder.
            </p>
          </section>

          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Features</h2>
            <ul className="list-disc list-inside text-foreground/80 space-y-2">
              <li>Multi-model AI chat interface with model switching</li>
              <li>Visual workflow builder (Canvas) for automation</li>
              <li>End-to-end encryption support</li>
              <li>Chatbot configuration and customization</li>
              <li>OAuth integrations (Google, Slack, GitHub)</li>
              <li>Advanced AI features (web search, voice, MCP tools)</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Need Help?</h2>
            <p className="text-foreground/80">
              If you have questions or need assistance, visit our{" "}
              <Link href={ROUTES.CONTACT} className="text-sky hover:text-sky/80 transition-colors">
                Contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
