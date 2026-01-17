"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex-shrink-0 border-t border-white/30 bg-white/40 backdrop-blur-md px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Left: Copyright */}
        <div className="text-xs text-foreground/50">
          &copy; {currentYear} AI UI Wrapper
        </div>

        {/* Right: Links */}
        <nav className="flex items-center gap-4">
          <Link
            href={ROUTES.DOCS}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
          <Link
            href={ROUTES.PRIVACY_POLICY}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href={ROUTES.TERMS}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href={ROUTES.CONTACT}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
