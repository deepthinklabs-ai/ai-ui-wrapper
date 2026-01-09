<p align="center">
  <img src="apps/web/public/android-chrome-192x192.png" alt="aiuiw logo" width="80" height="80" />
</p>

<h1 align="center">aiuiw</h1>

<p align="center">
  <strong>An AI Communication Layer</strong><br/>
  Built to foster Creativity, Collaboration, and Expansion.
</p>

<p align="center">
  <a href="https://aiuiw.com">Website</a> |
  <a href="#features">Features</a> |
  <a href="#getting-started">Get Started</a> |
  <a href="#roadmap">Roadmap</a> |
  <a href="#contributing">Contributing</a>
</p>

---

## What is aiuiw?

**aiuiw** (AI UI Wrapper) is an open-source platform that reimagines how humans and AI interact, collaborate, and create together. It's not just a chatbot — it's infrastructure for the next era of AI experiences.

- **Chat with any AI** — Switch between OpenAI, Claude, Grok, and Gemini mid-conversation
- **Build visual workflows** — Orchestrate AI agents with an n8n-style canvas builder
- **Own your data** — Client-side encryption, bring your own API keys. API keys are **never stored at rest** and are handled **ephemerally, in-memory only**, then **immediately discarded after use**.
- **Share and discover** — Marketplace for chatbots, workflows, and AI experiences

---

## Features

### Multi-Model Chat
- Real-time streaming conversations with GPT-5, Claude Sonnet/Opus, Grok, Gemini
- Switch models mid-conversation without losing context
- File and image attachments with vision support
- Token tracking and context window awareness
- Client-side AES-GCM encryption for privacy

### Custom Chatbots
- Create AI agents with custom system prompts, models, and tools
- Organize chatbots in folders with drag-and-drop
- Import/export chatbot configurations as JSON
- Voice support with ElevenLabs TTS

### Canvas (Visual Workflow Builder)
- n8n-style node-and-edge workflow editor
- AI Agent nodes with full configurability
- Smart Router for intelligent query routing
- Response Compiler for multi-agent aggregation
- Bot-to-bot communication (Ask/Answer)
- OAuth integrations: Gmail, Calendar, Sheets, Docs, Slack

### Exchange (Marketplace)
- Share and discover chatbots, workflows, and system prompts
- Sandbox testing before download
- Bot-to-bot interaction testing
- Community ratings and feedback

### Security & Privacy
- Bring Your Own Keys (BYOK) — use your own API keys
- End-to-end encryption with PBKDF2 key derivation
- Two-factor authentication with recovery codes
- Session management with idle detection
- Rate limiting and CSRF protection

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand |
| **Canvas** | XYFlow (React Flow), dnd-kit |
| **Backend** | Next.js API Routes, Supabase (PostgreSQL) |
| **AI Providers** | OpenAI, Anthropic (Claude), xAI (Grok), Google (Gemini) |
| **Integrations** | MCP SDK, Google APIs, Slack, ElevenLabs, Stripe |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Supabase account (for database)
- API keys for AI providers (OpenAI, Anthropic, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/deepthinklabs-ai/ai-ui-wrapper.git
cd ai-ui-wrapper

# Install dependencies
cd apps/web
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys and Supabase credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers (users can also bring their own keys)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
XAI_API_KEY=your_xai_key
GOOGLE_AI_API_KEY=your_google_key

# Optional integrations
STRIPE_SECRET_KEY=your_stripe_key
RESEND_API_KEY=your_resend_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

---

## Roadmap

aiuiw is in active development. Here's where we're headed:

### Near Term
- [ ] Complete Exchange marketplace with payments
- [ ] Additional canvas node types (Training Session, Boardroom, Trigger)
- [ ] Canvas execution engine with parallel processing
- [ ] Full MCP tool management UI

### Medium Term
- [ ] **Cloud CLI LLMs** — Cloud-hosted CLI-based AI development
- [ ] **CLI Blending** — Combine multiple CLI LLMs for unified responses
- [ ] **Browser Extension** — Import chatbots, screen sharing with AI
- [ ] **Mobile App** — Full account access and cloud CLI from your phone
- [ ] **Enterprise Licensing** — SSO, audit logs, team management

### Long Term
- [ ] **Worlds** — AI agents in interactive experiences and games
- [ ] **Prompt-Based Gaming** — A new genre of AI-driven gameplay
- [ ] **AI-to-AI Communication Research** — Optimize how models communicate
- [ ] **Visual Canvas Characters** — Humanized node representations
- [ ] **Custom Skins Marketplace** — Personalize your canvas and chatbots
- [ ] **AI Music Radio** — Ambient AI-generated music while you work
- [ ] **n8n/Zapier Export** — Use aiuiw canvases as nodes in other platforms

### Always Ongoing
- New AI model support as providers release them
- Community-requested integrations
- Performance and UX improvements

---

## Project Structure

```
ai-ui-wrapper/
├── apps/
│   └── web/                    # Next.js application
│       ├── src/
│       │   ├── app/            # Pages and API routes
│       │   │   ├── dashboard/  # Chat interface
│       │   │   ├── canvas/     # Workflow builder
│       │   │   └── api/        # Backend endpoints
│       │   ├── components/     # React components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Utilities and services
│       │   └── types/          # TypeScript definitions
│       └── database-migrations/ # SQL migrations
└── README.md
```

---

## Contributing

We welcome contributions! aiuiw is built to foster collaboration, and that starts with the codebase itself.

**Important:** By contributing to this project, you agree to our [Contributor License Agreement (CLA)](CLA.md). This ensures we can continue to maintain and evolve the project while protecting both contributors and users.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Community

- **Website**: [aiuiw.com](https://aiuiw.com)
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and ideas

---

## License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

By contributing, you agree to the [Contributor License Agreement](CLA.md).

---

## Acknowledgments

Built with these amazing open-source projects:

- [Next.js](https://nextjs.org) — React framework
- [Supabase](https://supabase.com) — Backend infrastructure
- [XYFlow](https://xyflow.com) — Canvas/flow editor
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Zustand](https://zustand.docs.pmnd.rs) — State management

---

<p align="center">
  <strong>An AI Communication Layer</strong><br/>
  Built to foster Creativity, Collaboration, and Expansion.
</p>
