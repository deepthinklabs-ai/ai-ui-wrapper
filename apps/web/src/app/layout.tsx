import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import DebugPanelWrapper from '@/components/DebugPanelWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI UI Wrapper",
  description: "Chat-style AI cockpit with threaded conversations",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {/* App-wide wrapper so pages can control their own flex layout */}
          <div id="app-root" className="h-screen w-screen overflow-hidden">
            {children}
          </div>
        </Providers>
        <DebugPanelWrapper />
      </body>
    </html>
  );
}
