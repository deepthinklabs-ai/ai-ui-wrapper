# AI UI Wrapper - Codebase Reference

## Getting Started (For New AI Assistants)

When starting a new session, follow these steps to understand the project:

### 1. Review This Documentation
Read this entire CLAUDE.md file to understand the project architecture, tech stack, and naming conventions.

### 2. Check Git Status & Recent Activity
```bash
git status                    # Current branch and changes
git log --oneline -10         # Recent commits
git branch -a                 # All branches (main = production, staging = development)
gh pr list --state all -L 5   # Recent pull requests
```

### 3. Explore Key Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/app/canvas/` - Visual workflow builder (n8n-style)
- `src/app/dashboard/` - Main chat interface
- `src/components/` - Reusable React components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities, clients, and services
- `src/types/` - TypeScript type definitions
- `database-migrations/` - SQL migration files

### 4. Understand the Two Main Features
1. **Chat Dashboard** (`/dashboard`) - Multi-model AI chat with threading, folders, encryption
2. **Canvas System** (`/canvas`) - Visual workflow builder for AI agent orchestration

### 5. Key Files to Review
- `src/lib/unifiedAIClient.ts` - Multi-provider AI abstraction
- `src/lib/availableModels.ts` - Supported AI models
- `src/app/canvas/lib/nodeRegistry.ts` - Canvas node definitions
- `src/hooks/useMessages.ts` - Chat message handling
- `src/lib/encryption.ts` - Client-side encryption

### 6. GitHub Repository
- **Repo:** https://github.com/deepthinklabs-ai/ai-ui-wrapper
- **Main branch:** `main` (production)
- **Development branch:** `staging`
- PRs merge to `staging` first, then to `main`

### 7. Git Workflow for AI Assistants

#### Staging Branch (Development)
Automatically commit and push changes to `staging` after completing code modifications:
1. Complete a feature or fix
2. Verify the build passes (run `npx tsc --noEmit`)
3. Commit and push to staging

```bash
# Standard workflow after making changes:
git checkout staging
git add -A
git commit -m "Description of changes"
git push origin staging
```

#### Main Branch (Production) - CRITICAL RULES
**🚨 NEVER push to `main` without EXPLICIT user approval. 🚨**

- **DO NOT** create PRs to main automatically
- **DO NOT** merge PRs to main without the user saying "push to main" or similar
- **ALWAYS** wait for user to test changes in staging first
- **ALWAYS** ask for confirmation before any main branch operations

The workflow is:
1. Push changes to `staging` → User tests in staging environment
2. User explicitly requests: "push to main" / "merge to main" / "deploy to production"
3. Only THEN create PR from staging → main and merge

This ensures production stability. Breaking this rule causes production issues.

---

## Project Overview

**AI UI Wrapper** (aiuiw.com) - A multi-provider AI chat platform with an n8n-style visual workflow builder (Canvas system).

### Key Features
- Multi-model AI chat interface with model switching
- n8n-style canvas/workflow builder for automation
- AI chatbot orchestration and routing
- End-to-end encryption support
- OAuth integrations (Google, Slack, GitHub)
- Subscription management via Stripe
- Advanced AI features (web search, voice, MCP tools)

### Naming Conventions (Code vs UI)
| Code Identifier | UI Label | Description |
|-----------------|----------|-------------|
| `GENESIS_BOT` | **AI Agent** | AI agent node in canvas |
| `MASTER_TRIGGER` | **Chatbot Trigger** | Exposes workflows to Chatbot page |
| `Chatbot` | **Chatbot** | User-configured AI assistant profiles |

> **Note:** Legacy code references "Genesis Bot" in type names and file names (e.g., `GenesisBotNode.tsx`, `GenesisBotNodeConfig`), but the **user-facing UI** displays "AI Agent" and "Chatbot".

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16.0.8 (App Router)
- **React:** 19.2.0
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4.1.16 + PostCSS
- **State Management:** Zustand 5.0.8 + TanStack React Query 5.90.6
- **Workflow Canvas:** XYFlow React 12.9.3 (n8n-style visual builder)
- **Drag & Drop:** dnd-kit (6.3.1+)
- **Voice:** ElevenLabs SDK 2.24.1

### Backend
- **Framework:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth + Email/2FA

### AI/LLM Integrations
- **OpenAI:** GPT-5.1, GPT-5 Mini, GPT-4o, GPT-3.5 Turbo
- **Anthropic (Claude):** Claude Sonnet 4.5, Opus 4.1, Haiku 4.5
- **xAI (Grok):** Grok 4 Fast, Grok 4.1 Fast (with reasoning)
- **Model Context Protocol (MCP):** SDK 1.22.0 for tool integration

> **Maintenance Note:** AI models are frequently updated. When adding or removing models in `src/lib/availableModels.ts`, remember to update this documentation to reflect the current supported models.

### Third-Party Services
- **Payments:** Stripe - subscriptions & checkout
- **Email:** Resend - transactional emails
- **Google APIs:** Gmail, Calendar, Sheets, Docs
- **Slack:** @slack/web-api
- **Voice:** ElevenLabs TTS

---

## Project Structure

```
apps/web/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # API routes (auth, canvas, chat, oauth, etc.)
│   │   │   ├── auth/                # Authentication endpoints
│   │   │   ├── canvas/              # Canvas workflow endpoints
│   │   │   ├── claude/              # Claude API proxy
│   │   │   ├── byok/                # Bring-Your-Own-Key APIs
│   │   │   └── stripe/              # Stripe webhooks & checkout
│   │   ├── auth/                    # Authentication pages
│   │   ├── dashboard/               # Main chat interface
│   │   ├── canvas/                  # n8n-style workflow builder
│   │   │   ├── components/          # Canvas UI components
│   │   │   │   ├── nodes/           # Node type implementations
│   │   │   │   ├── edges/           # Connection rendering
│   │   │   │   ├── modals/          # Modal dialogs
│   │   │   │   └── config/          # Node configuration panels
│   │   │   ├── features/            # Feature modules
│   │   │   │   ├── ask-answer/      # Bot-to-bot communication
│   │   │   │   ├── smart-router/    # Intelligent routing
│   │   │   │   ├── response-compiler/ # Response aggregation
│   │   │   │   ├── chatbot-trigger/ # Workflow orchestration
│   │   │   │   └── *-oauth/         # Google & Slack integrations
│   │   │   ├── hooks/               # Canvas-specific hooks
│   │   │   ├── context/             # Canvas context & state
│   │   │   ├── lib/                 # Canvas utilities
│   │   │   │   └── nodeRegistry.ts  # Central node definitions
│   │   │   └── types/               # Canvas type definitions
│   │   └── settings/                # User settings pages
│   ├── components/                  # Reusable components (53+ files)
│   │   ├── auth/                    # Authentication components
│   │   ├── dashboard/               # Chat UI components
│   │   ├── settings/                # Settings UI components
│   │   ├── encryption/              # Encryption modals
│   │   ├── contextPanel/            # Side panel Q&A
│   │   └── markdown/                # Markdown rendering
│   ├── hooks/                       # Custom hooks (30+ files)
│   ├── lib/                         # Utilities & clients (60+ files)
│   │   ├── config/                  # Configuration
│   │   ├── services/                # Business logic services
│   │   ├── unifiedAIClient.ts       # Multi-provider AI abstraction
│   │   ├── encryption.ts            # AES-GCM encryption
│   │   └── mcpClient.ts             # MCP integration
│   ├── types/                       # TypeScript type definitions
│   └── contexts/                    # React contexts
├── database-migrations/             # SQL migration files
└── public/                          # Static assets
```

---

## Canvas System (n8n-Style Workflow Builder)

Visual workflow editor for orchestrating AI agents and automations.

### Node Types

| Type | Description |
|------|-------------|
| **CHATBOT** | AI agent with model selection, system prompt, tools, voice, memory |
| **SSM_AGENT** | State-Space Model monitor for continuous event streams (email, logs, activity) |
| **TRAINING_SESSION** | Fine-tune bots through conversation |
| **BOARDROOM** | Multi-bot collaborative discussions |
| **CHATBOT_TRIGGER** | Expose workflows to main Chatbot page |
| **SMART_ROUTER** | Intelligent query routing based on capabilities |
| **RESPONSE_COMPILER** | Aggregate responses from multiple agents |
| **TRIGGER** | Manual, scheduled, webhook, or event-based triggers |
| **CABLE_CHANNEL** | References Cable Box mode configurations |
| **TOOL** | MCP tools or OAuth-enabled actions |
| **TERMINAL_COMMAND** | Terminal Bot integration |
| **CUSTOM** | User-defined extensible nodes |

### Canvas Data Model

```typescript
Canvas {
  id, user_id, name, description
  mode: 'workflow' | 'boardroom' | 'hybrid'
  is_template, thumbnail_url
  created_at, updated_at
}

CanvasNode {
  id, canvas_id, type, position
  label, config (node-specific config object)
  is_exposed (for CHATBOT_TRIGGER)
}

CanvasEdge {
  id, canvas_id
  from_node_id, from_port
  to_node_id, to_port
  condition?, transform?, label?
}
```

### Canvas Features

- **Ask/Answer:** Chatbot nodes can communicate bidirectionally
- **Smart Router:** AI-powered query routing to appropriate agents
- **Response Compiler:** Aggregate and summarize multi-agent responses
- **Chatbot Trigger:** Expose canvas workflows as Chatbot actions
- **Integrations:** Gmail, Calendar, Sheets, Docs, Slack, MCP Tools

### SSM (State-Space Model) Nodes

SSM nodes use State-Space Model architectures (like Mamba) for efficient continuous monitoring:

**Key Advantages over Transformers:**
- **Linear O(n) complexity** - handles high-volume streams efficiently
- **Fixed-size state** - constant memory regardless of sequence length
- **4-5x faster inference** - ideal for real-time monitoring
- **No KV cache** - lower memory footprint

**Use Cases:**
- Email inbox monitoring (security, classification)
- Security log analysis (threat detection, anomaly detection)
- Activity stream classification
- Continuous event summarization

**Supported Providers:**
- **Ollama (local):** `mamba`, `mamba-2.8b`, `granite-mamba`
- **vLLM (self-hosted):** `state-spaces/mamba-2.8b`, `ibm/bamba-9b`
- **Hugging Face:** `state-spaces/mamba-130m`, `state-spaces/mamba-2.8b-slimpj`
- **Replicate:** `ibm/granite-4.0-tiny`, `ibm/granite-4.0-small`

**Feature Location:** `src/app/canvas/features/ssm-agent/`

### Canvas Hooks

- `useCanvas()` - CRUD for canvases
- `useCanvasNodes()` - CRUD for nodes
- `useCanvasEdges()` - CRUD for edges
- `useCanvasState()` - Unified state management
- `useCanvasOperations()` - High-level canvas operations

---

## Chat Dashboard

Multi-model conversational AI interface with threading and folders.

### Key Components

- **MessageComposer.tsx** - Input with attachments, model selection
- **MessageList.tsx** - Message display and rendering
- **ModelDropdown.tsx** - Switch between AI providers/models
- **FolderTree.tsx** - Thread organization hierarchy
- **ContextWindowIndicator.tsx** - Token usage display
- **MCPServerIndicator.tsx** - Active tool integrations

### Chat Features

- Multi-model support (switch mid-conversation)
- Context window awareness & token counting
- Web search integration (Claude, Grok)
- Image and file attachments
- Streaming responses
- Tool calling (MCP)
- Message operations: revert, fork, summarize

### Chat Hooks

- `useMessages()` - Message CRUD
- `useEncryptedMessages()` - Encrypted message operations
- `useFolders()` - Thread folder management
- `useContextPanel()` - Side panel Q&A
- `useMCPServers()` - MCP tool integration

---

## Admin Debug Tools

Admin-only debug overlays for troubleshooting. Toggle with **Ctrl+Shift+D**.

### Dashboard Debug Overlay
- User ID with copy button
- Current thread ID, title, folder ID, chatbot ID
- All messages with IDs and copy buttons
- Folder hierarchy with IDs
- All chatbots with IDs

### Canvas Debug Overlay
- Node IDs and labels (attached to nodes on canvas)
- Edge IDs and connections (attached to edge midpoints)
- Clickable node/edge list to highlight on canvas
- Copy buttons for all IDs

---

## Authentication & Security

### Authentication Methods
- Email/password via Supabase Auth
- Two-factor authentication (email verification codes)
- Recovery codes for 2FA backup
- Google OAuth (Gmail, Calendar, Sheets, Docs)
- Slack OAuth

### Encryption
- **Client-side AES-GCM** for message encryption
- **PBKDF2** with 600,000 iterations for key derivation
- **Key wrapping** for secure key storage
- **OAuth tokens encrypted** with AES-256

### Security Features
- Session timeout with warning
- Idle detection
- Rate limiting (Upstash Redis)
- CSRF protection
- Security headers (HSTS, CSP, X-Frame-Options)

---

## API Routes

### Authentication
- `POST /api/auth/send-verification` - Send email verification
- `POST /api/auth/verify-code` - Verify code
- `POST /api/auth/check-2fa` - Check 2FA status

### Canvas Workflow
- `POST /api/canvas/smart-router` - Route queries to agents
- `POST /api/canvas/ask-answer/query` - Bot-to-bot messaging
- `POST /api/canvas/{integration}/execute` - Execute integrations

### AI Providers
- `POST /api/claude` - Claude API proxy
- `POST /api/chat` - Chat completions (OpenAI)

### Integrations
- `GET/POST /api/canvas/gmail/execute`
- `GET/POST /api/canvas/calendar/execute`
- `GET/POST /api/canvas/sheets/execute`
- `GET/POST /api/canvas/docs/execute`
- `GET/POST /api/canvas/slack/execute`

### Payments
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/webhook` - Stripe webhook handler

---

## Database Schema (Key Tables)

### Canvas System
- `canvases` - Workflow definitions
- `canvas_nodes` - Node instances (encrypted config)
- `canvas_edges` - Node connections
- `workflow_executions` - Execution logs

### Chat System
- `threads` - Conversation threads
- `messages` - Chat messages with token tracking
- `folders` - Thread organization

### Users & Auth
- `auth.users` - Supabase auth table
- `profiles` - User metadata
- `user_tiers` - Subscription status

### Integrations
- `oauth_tokens` - Encrypted OAuth tokens
- `mcp_servers` - MCP server configurations

---

## Key Patterns

### State Management
- Context API for canvas state (`CanvasStateContext`)
- Zustand for client state
- TanStack Query for server state

### Code Organization
- Feature-based directory structure
- Custom hooks for feature encapsulation
- Service layer for business logic
- Centralized type definitions

### Security Practices
- Client-side encryption by default
- Server-side validation
- Input sanitization
- OAuth token encryption

### Separation of Concerns

When implementing new features, follow these principles to ensure maintainable, testable code:

**1. Single Responsibility**
- Each file should have one clear purpose
- Components render UI; hooks manage state; lib files contain utilities
- Avoid mixing business logic with presentation logic

**2. Feature Modules**
- Group related functionality in `features/` directories
- Each feature module should be self-contained with its own components, hooks, and utilities
- Use an `index.ts` to control public exports

**3. Type Separation**
- Define types in dedicated files, not inline in components
- Place feature-specific types in the feature module
- Export shared types from central type files

**4. Hook Extraction**
- Extract state management logic into custom hooks
- Hooks should encapsulate one concern (e.g., `useSSMConfig` for SSM configuration)
- Keep components focused on rendering

**5. Utility Isolation**
- Keep helpers, defaults, and validation in separate lib files
- Validation logic should be pure functions, easily testable
- Default values should be centralized for consistency

**Example feature module structure:**
```
src/app/canvas/features/[feature-name]/
├── index.ts              # Public exports
├── [Feature]Panel.tsx    # Main component
├── hooks/
│   └── use[Feature].ts   # State management hook
└── lib/
    ├── defaults.ts       # Default configurations
    └── validation.ts     # Validation logic
```

**Reference Implementation:** See `src/app/canvas/features/ssm-agent/` for a complete example following these patterns.

---

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Deployment

- **Platform:** Vercel (Next.js native)
- **Database:** Supabase (PostgreSQL)
- **Rate Limiting:** Upstash Redis
- **Error Tracking:** Sentry
