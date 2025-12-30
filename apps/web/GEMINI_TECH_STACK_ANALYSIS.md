# Gemini's Tech Stack Analysis for AI UI Wrapper

This document provides a detailed analysis of the project's tech stack, based on a review of the `package.json` file and other configuration files. It builds upon the information found in `claude.md`.

## Summary of Findings

The project is a modern, full-stack web application built with Next.js and React. It integrates a wide array of AI models and third-party services. The codebase is well-structured, utilizing feature-based directories and custom hooks. Security is a key consideration, with client-side encryption and various other security measures in place.

A notable discovery not mentioned in previous documentation is the inclusion of the Three.js library for 3D graphics and the official Google Generative AI SDK, indicating capabilities for rendering 3D elements and integrating with Gemini models.

## Detailed Tech Stack

### Frontend
- **Framework:** Next.js `^16.0.8` (with App Router)
- **Compiler:** Babel React Compiler (`babel-plugin-react-compiler`) for optimization.
- **React:** `19.2.0`
- **TypeScript:** `^5`
- **Styling:** Tailwind CSS `^4.1.16` with PostCSS `^8.5.6` and Autoprefixer `^10.4.21`.
- **State Management:**
    - Zustand `^5.0.8` for client-side state.
    - TanStack React Query `^5.90.11` for server state management and caching.
- **Workflow Canvas:** XYFlow React `^12.9.3` for the n8n-style visual workflow builder.
- **Drag & Drop:** dnd-kit (`@dnd-kit/core: ^6.3.1`, `@dnd-kit/sortable: ^10.0.0`)
- **3D Graphics:**
    - Three.js `^0.181.1`
    - `@react-three/fiber: ^9.4.0` (React renderer for Three.js)
    - `@react-three/drei: ^10.7.7` (Helpers for `react-three-fiber`)
- **Markdown Rendering:** `react-markdown: ^10.1.0` with `remark-gfm: ^4.0.1`.
- **Voice:** ElevenLabs SDK (`@elevenlabs/elevenlabs-js: ^2.24.1`)

### Backend
- **Framework:** Next.js API Routes (serverless functions).
- **Database:** Supabase (`@supabase/supabase-js: ^2.79.0`), which uses PostgreSQL.
- **Authentication:** Supabase Auth, supplemented with custom logic for 2FA.

### AI/LLM Integrations
- **OpenAI:** `openai: ^6.8.1` (for GPT models).
- **Google Generative AI:** `@google/generative-ai: ^0.24.1` (for Gemini models).
- **Anthropic (Claude):** Accessed via a custom backend proxy at `/api/claude`. No client-side SDK.
- **xAI (Grok):** Likely accessed via a custom backend proxy (similar to Claude). No client-side SDK.
- **Model Context Protocol (MCP):** `@modelcontextprotocol/sdk: ^1.22.0` for tool integration.

### Third-Party Services & Integrations
- **Payments:** Stripe (`stripe: ^17.7.0`) for subscriptions and checkout.
- **Email:** Resend (`resend: ^6.5.2`) for transactional emails.
- **Google APIs:** `googleapis: ^166.0.0` for integration with Google services (Gmail, Calendar, etc.).
- **Slack:** `@slack/web-api: ^7.13.0`.
- **Rate Limiting:** Upstash (`@upstash/ratelimit: ^2.0.7`, `@upstash/redis: ^1.35.8`).
- **Error Tracking:** Sentry (`@sentry/nextjs: ^10.32.1`).
- **Secret Management:** `@google-cloud/secret-manager: ^6.1.1`

### Development & Tooling
- **Linting:** ESLint `^9` with `eslint-config-next`.
- **Package Manager:** npm (as indicated by `package-lock.json`).
- **Utilities:**
    - `uuid: ^13.0.0` for generating unique identifiers.

## Comparison with `claude.md`

This analysis confirms most of the information in `claude.md`, with the following additions and clarifications:

- **New Libraries Found:**
    - **Three.js Stack:** The presence of `three`, `react-three-fiber`, and `react-three-drei` was not mentioned. This is a significant capability for rendering 3D content.
    - **Google Generative AI SDK:** The `@google/generative-ai` package is used, indicating direct integration with Gemini models.
    - **Google Cloud Secret Manager:** The project uses `@google-cloud/secret-manager` for handling secrets.
    - **Babel React Compiler:** The project uses the new React optimizing compiler.
- **Version Updates:** Minor version differences were noted for some packages, like `@tanstack/react-query`. The versions listed in this document are taken directly from `package.json`.
- **API Proxies:** This analysis confirms the proxy-based approach for interacting with the Claude API, as no official SDK is listed in the dependencies. The same is likely true for Grok.

This document serves as an up-to-date reference for the project's technology stack.
