# Tech Stack Documentation

**Generated:** December 2025
**Application:** ai-ui-wrapper (aiuiw.com)
**Purpose:** AI Chat Platform with Multi-Provider Support & Workflow Automation

---

## 1. Frontend Framework & Libraries

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.8 | Full-stack React framework (App Router) |
| React | 19.2.0 | UI library |
| TypeScript | 5.x | Type safety |

### Styling
| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.1.16 | Utility-first CSS |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.21 | Vendor prefixing |

### State Management
| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | 5.0.8 | Client state management |
| TanStack React Query | 5.90.6 | Server state & caching |

### UI Components & Libraries
| Technology | Version | Purpose |
|------------|---------|---------|
| React Markdown | 10.1.0 | Markdown rendering |
| Remark GFM | 4.0.1 | GitHub Flavored Markdown |
| XYFlow React | 12.9.3 | Visual workflow canvas (n8n-style) |
| dnd-kit | 6.3.1+ | Drag and drop |
| React Three Fiber | 9.4.0 | 3D graphics (Three.js) |
| React Three Drei | 10.7.7 | Three.js helpers |

### Utilities
| Technology | Version | Purpose |
|------------|---------|---------|
| UUID | 13.0.0 | Unique ID generation |
| Crypto-JS | 4.2.0 | Client-side encryption |

---

## 2. Backend / API

### Framework
- **Next.js API Routes** - Serverless functions
- **App Router** - File-based routing with server/client components

### API Endpoints

```
/api/
├── auth/
│   ├── check-2fa/          # Two-factor authentication check
│   ├── send-verification/  # Email verification codes
│   └── verify-code/        # Code verification
├── chat/                   # Chat completions (OpenAI)
├── canvas/
│   ├── smart-router/       # Route queries to Genesis Bots
│   ├── ask-answer/query/   # Ask/answer nodes
│   ├── calendar/           # Google Calendar (execute/status)
│   ├── gmail/              # Gmail (execute/status)
│   ├── sheets/             # Google Sheets (execute/status)
│   ├── docs/               # Google Docs (execute/status)
│   └── slack/              # Slack (execute/status)
├── encryption/             # E2E encryption operations
├── mcp/
│   ├── credentials/        # MCP credential management
│   └── stdio/              # MCP stdio transport
├── oauth/
│   ├── google/             # Google OAuth (authorize/callback/revoke)
│   └── slack/              # Slack OAuth (authorize/callback)
├── pro/
│   ├── openai/             # Pro tier OpenAI access
│   ├── claude/             # Pro tier Claude access
│   └── grok/               # Pro tier Grok access
├── stripe/
│   ├── checkout/           # Create checkout session
│   ├── portal/             # Customer portal
│   ├── webhook/            # Stripe webhooks
│   └── verify-subscription/ # Subscription verification
├── tts/
│   └── elevenlabs/         # Text-to-speech
└── workflows/
    ├── exposed/            # Public workflow endpoints
    └── trigger/            # Workflow triggers
```

---

## 3. Database & Authentication

### Database
| Service | Purpose |
|---------|---------|
| **Supabase (PostgreSQL)** | Primary database, real-time subscriptions, file storage |

### Key Tables
| Table | Purpose |
|-------|---------|
| `threads` | Conversation threads |
| `messages` | Chat messages with token tracking |
| `folders` | Thread organization |
| `canvases` | Workflow definitions |
| `canvas_nodes` | Workflow nodes |
| `canvas_edges` | Node connections |
| `workflow_executions` | Execution logs |
| `subscriptions` | Stripe subscription data |
| `user_tiers` | Trial/Pro/Expired status |
| `oauth_tokens` | Encrypted OAuth tokens |
| `mcp_servers` | MCP server configs |
| `encrypted_mcp_credentials` | Encrypted MCP credentials |
| `encryption_bundles` | E2E encryption keys |
| `recovery_codes` | 2FA backup codes |
| `rate_limits` | API rate limiting |

### Authentication
| Feature | Implementation |
|---------|----------------|
| Email/Password | Supabase Auth |
| Two-Factor Auth | Email-based verification codes |
| Recovery Codes | Backup codes for 2FA |
| OAuth | Google, Slack |
| Session Management | JWT tokens via Supabase |

---

## 4. AI/LLM Integrations

### Providers & Models

#### OpenAI
| Model | Context Window | Features |
|-------|---------------|----------|
| GPT-5.1 | 272,000 | Latest, web search, images |
| GPT-5 Mini | 128,000 | Balanced performance |
| GPT-5 Nano | 128,000 | Fast, affordable |
| GPT-4o | 128,000 | Previous flagship |
| GPT-4o Mini | 128,000 | Cost-efficient |
| GPT-4 Turbo | 128,000 | Extended context |
| GPT-3.5 Turbo | 16,385 | Legacy, cheapest |

**SDK:** `openai@6.8.1`

#### Anthropic (Claude)
| Model | Context Window | Features |
|-------|---------------|----------|
| Claude Sonnet 4.5 | 200,000 | Latest Sonnet |
| Claude Sonnet 4 | 200,000 | Previous Sonnet |
| Claude Opus 4.1 | 200,000 | Highest intelligence |
| Claude Haiku 4.5 | 200,000 | Fast, cost-effective |
| Claude Haiku 3.5 | 200,000 | Cheapest Claude |

**Integration:** Direct API calls (CORS-enabled)

#### xAI (Grok)
| Model | Context Window | Features |
|-------|---------------|----------|
| Grok 4 Fast Reasoning | 2,000,000 | Reasoning enabled |
| Grok 4 Fast Non-Reasoning | 2,000,000 | Faster responses |
| Grok 4.1 Fast Reasoning | 131,072 | Agentic tool calling |
| Grok 4.1 Fast Non-Reasoning | 131,072 | Fast |
| Grok Code Fast 1 | 256,000 | Code optimized |

**Integration:** OpenAI-compatible API

### API Key Management
- **BYOK Model:** Users provide their own keys (stored in localStorage)
- **Pro Tier:** Backend API keys for paying users
- **Never sent to backend:** User API keys stay client-side

### Key Files
```
src/lib/
├── clientOpenAI.ts          # OpenAI client
├── clientClaude.ts          # Claude client with web search
├── clientGrok.ts            # Grok client
├── unifiedAIClient.ts       # Unified abstraction
├── apiKeyStorage.ts         # OpenAI key storage
├── apiKeyStorage.claude.ts  # Claude key storage
├── apiKeyStorage.grok.ts    # Grok key storage
└── availableModels.ts       # Model availability logic
```

---

## 5. Third-Party Services

### Payment Processing
| Service | SDK Version | Purpose |
|---------|-------------|---------|
| **Stripe** | 17.7.0 | Subscriptions, checkout, webhooks |

### Email
| Service | SDK Version | Purpose |
|---------|-------------|---------|
| **Resend** | 6.5.2 | Transactional email (verification, recovery) |

### Text-to-Speech
| Service | SDK Version | Purpose |
|---------|-------------|---------|
| **ElevenLabs** | 2.24.1 | AI voice synthesis |

### Google Integration
| Service | SDK Version | Purpose |
|---------|-------------|---------|
| **Google APIs** | 166.0.0 | Gmail, Calendar, Sheets, Docs |

### Slack Integration
| Service | SDK Version | Purpose |
|---------|-------------|---------|
| **@slack/web-api** | 7.13.0 | Slack bot/app API |

### Model Context Protocol (MCP)
| Package | Version | Purpose |
|---------|---------|---------|
| @modelcontextprotocol/sdk | 1.22.0 | MCP client |
| @modelcontextprotocol/server-github | 2025.4.8 | GitHub MCP server |

---

## 6. Key Features

### Canvas/Workflow Builder
- Visual n8n-style workflow editor (XYFlow)
- **Node Types:**
  - Genesis Bot - AI agent with tools/integrations
  - Training Session - Fine-tune bots
  - Boardroom - Multi-bot conversations
  - Smart Router - Intent-based routing
  - Response Compiler - Aggregate responses
  - Master Trigger - Orchestration
  - Custom Nodes - User-defined logic

### Chat Features
- Multi-model support (switch models mid-conversation)
- Context window awareness & token counting
- Web search integration (Claude, Grok)
- Image and file attachments
- Streaming responses

### Message Operations
- Revert to any point
- Revert with draft
- Fork thread
- Summarize thread
- Summarize & Continue
- Convert to Markdown/JSON

### Voice Features
- Push-to-talk
- Speech recognition (Web Speech API)
- Voice Activity Detection
- Text-to-speech (ElevenLabs)

### Security
- End-to-end encryption (AES-GCM)
- Two-factor authentication
- Recovery codes
- OAuth token encryption (AES-256)
- Rate limiting

### Advanced Features
- Step-by-step mode (AI reasoning)
- Context Panel (side panel Q&A)
- Split view
- Thread folders
- MCP tool integration
- Feature toggle system

---

## 7. Project Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   ├── auth/               # Auth pages
│   │   ├── dashboard/          # Main chat UI
│   │   ├── canvas/             # Workflow builder
│   │   │   ├── components/     # Canvas UI
│   │   │   ├── features/       # Feature modules
│   │   │   ├── hooks/          # Canvas hooks
│   │   │   └── types/          # Type definitions
│   │   └── settings/           # User settings
│   ├── components/             # Reusable components (53)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── settings/
│   │   ├── encryption/
│   │   ├── contextPanel/
│   │   └── markdown/
│   ├── hooks/                  # Custom hooks (42)
│   ├── lib/                    # Utilities & clients
│   ├── types/                  # TypeScript types
│   └── contexts/               # React contexts
├── database-migrations/        # SQL migrations
├── public/                     # Static assets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. Environment Variables

### Required
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRICE_ID=

# AI Providers (Pro tier backend)
OPENAI_API_KEY=
CLAUDE_API_KEY=
GROK_API_KEY=

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Encryption
OAUTH_ENCRYPTION_KEY=
MCP_ENCRYPTION_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# TTS
ELEVENLABS_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=
```

---

## 9. Deployment

### Platform
- **Vercel** - Next.js hosting with automatic deployments

### Security Headers
- HSTS (HTTP Strict Transport Security)
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options

### Performance
- React Compiler enabled (automatic memoization)
- Edge caching
- Serverless functions

---

## 10. Dependencies Summary

### Production Dependencies (37)
```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@elevenlabs/elevenlabs-js": "^2.24.1",
  "@modelcontextprotocol/sdk": "^1.22.0",
  "@modelcontextprotocol/server-github": "^2025.4.8",
  "@react-three/drei": "^10.7.7",
  "@react-three/fiber": "^9.4.0",
  "@slack/web-api": "^7.13.0",
  "@supabase/supabase-js": "^2.79.0",
  "@tanstack/react-query": "^5.90.6",
  "@types/crypto-js": "^4.2.2",
  "@xyflow/react": "^12.9.3",
  "crypto-js": "^4.2.0",
  "googleapis": "^166.0.0",
  "next": "^16.0.8",
  "openai": "^6.8.1",
  "react": "19.2.0",
  "react-dom": "19.2.0",
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "resend": "^6.5.2",
  "stripe": "^17.7.0",
  "three": "^0.181.1",
  "uuid": "^13.0.0",
  "zustand": "^5.0.8"
}
```

### Dev Dependencies (12)
```json
{
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "@types/uuid": "^10.0.0",
  "autoprefixer": "^10.4.21",
  "babel-plugin-react-compiler": "1.0.0",
  "eslint": "^9",
  "eslint-config-next": "^16.0.8",
  "postcss": "^8.5.6",
  "tailwindcss": "^4.1.16",
  "typescript": "^5"
}
```

---

*This document provides a complete overview of the tech stack for review and planning purposes.*
