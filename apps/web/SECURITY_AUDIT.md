# Security Audit Report - AI UI Wrapper

**Date:** December 16, 2025
**Auditor:** Claude Code
**Scope:** Full codebase security review

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tech Stack Overview](#tech-stack-overview)
3. [Security Controls Implemented](#security-controls-implemented)
4. [Identified Security Gaps](#identified-security-gaps)
5. [Risk Assessment Matrix](#risk-assessment-matrix)
6. [Recommendations](#recommendations)

---

## Executive Summary

This security audit covers the AI UI Wrapper platform, a full-stack AI chat application with multi-provider LLM support, visual workflow automation, and OAuth integrations. The codebase demonstrates **strong security fundamentals** with excellent encryption implementations, comprehensive API protection, and thorough input validation. Key areas requiring attention include session management, audit logging, and distributed rate limiting for scale.

**Overall Security Posture: GOOD** (7.5/10)

| Category | Rating |
|----------|--------|
| Authentication | ✅ Strong |
| Encryption | ✅ Excellent |
| Input Validation | ✅ Excellent |
| API Security | ✅ Good |
| Session Management | ⚠️ Needs Improvement |
| Audit Trail | ⚠️ Needs Improvement |

---

## Tech Stack Overview

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.8 | Full-stack React framework (App Router) |
| React | 19.2.0 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.1.16 | Styling |

### Backend Infrastructure
| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | 2.79.0 | Database (PostgreSQL), Auth, Real-time |
| Next.js API Routes | - | 47 serverless endpoints |
| Google Secret Manager | 6.1.1 | API key storage (production) |

### AI/LLM Providers
| Provider | SDK Version | Models Supported |
|----------|-------------|------------------|
| OpenAI | 6.8.1 | GPT-5.1, GPT-5 Mini/Nano, GPT-4o, GPT-4 Turbo, GPT-3.5 |
| Anthropic (Claude) | Direct API | Claude Sonnet 4.5, Claude Opus 4.1, Claude Haiku 4.5/3.5 |
| xAI (Grok) | OpenAI-compatible | Grok 4 Fast, Grok 4.1 Fast, Grok Code Fast 1 |
| Google (Gemini) | 0.24.1 | Gemini Pro (Pro tier) |

### Payment & Email
| Service | Version | Purpose |
|---------|---------|---------|
| Stripe | 17.7.0 | Subscriptions, payments |
| Resend | 6.5.2 | Transactional email (2FA, recovery codes) |

### Third-Party Integrations
| Service | Purpose |
|---------|---------|
| Google OAuth | Gmail, Drive, Sheets, Docs, Calendar |
| Slack OAuth | Workspace messaging |
| ElevenLabs | Text-to-speech |
| MCP (Model Context Protocol) | Tool calling, external integrations |

### Client-Side State
| Library | Version | Purpose |
|---------|---------|---------|
| Zustand | 5.0.8 | Client state management |
| TanStack React Query | 5.90.6 | Server state, caching |
| XYFlow React | 12.9.3 | Visual workflow canvas |

---

## Security Controls Implemented

### 1. Authentication & Authorization

#### Two-Factor Authentication (2FA)
- **Location:** `src/app/api/auth/`
- **Implementation:**
  - 6-digit OTP codes sent via email (Resend)
  - 10-minute code expiration
  - Max 3 code requests per 60 seconds (rate limited)
  - Max 5 failed verification attempts per code
  - Database-tracked verification codes with timestamps

```
Flow: Login → Send OTP → Verify Code → Session Created
```

#### Supabase JWT Authentication
- **Location:** `src/lib/serverAuth.ts`
- Bearer token extraction from Authorization headers
- Server-side token validation via Supabase client
- Service role key restricted to server-side only

#### Recovery Code System
- **Location:** `src/lib/recoveryCodeDelivery.ts`, `src/lib/encryption.ts`
- 12 one-time recovery codes per user
- SHA-256 hashed before storage
- Codes marked as used after redemption
- Delivered securely via email

### 2. Encryption

#### API Key Encryption (Production)
- **Location:** `src/lib/secretManager/index.ts`
- **Technology:** Google Cloud Secret Manager
- **Features:**
  - Workload Identity Federation (Vercel production)
  - Service account impersonation
  - Keys never logged or persisted locally
  - Memory-only during API calls
  - Automatic secret versioning

#### MCP Credential Encryption
- **Location:** `src/lib/credentialEncryption.ts`
- **Algorithm:** AES-256-GCM
- **Key:** `MCP_ENCRYPTION_KEY` (256-bit hex, 64 chars)
- IV and auth tag stored with ciphertext
- Encrypted before database storage

#### Client-Side Message Encryption (E2E)
- **Location:** `src/lib/encryption.ts`
- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 with 100,000 iterations
- Password-derived keys wrap data encryption keys
- Encryption bundles stored in `encryption_bundles` table

#### OAuth Token Encryption
- **Location:** `src/app/api/oauth/*/callback/route.ts`
- **Key:** `OAUTH_ENCRYPTION_KEY` (256-bit)
- Google/Slack tokens encrypted before database storage
- Automatic token refresh with encrypted storage

### 3. Input Validation & Sanitization

#### Comprehensive Validation Library
- **Location:** `src/lib/inputValidation.ts`

| Input Type | Validation Rules |
|------------|------------------|
| GitHub tokens | `ghp_` or `github_pat_` prefix required |
| Slack tokens | `xoxb-` prefix required |
| Slack team IDs | `T` + alphanumeric pattern |
| Brave API keys | `BSA` prefix required |
| PostgreSQL URLs | Full URL validation with `postgres://` or `postgresql://` |
| OpenAI keys | `sk-` prefix format |
| Server names | 2-100 chars, alphanumeric + spaces/hyphens/underscores |
| Environment vars | Uppercase + numbers + underscores, letter start |
| Verification codes | Exactly 6 digits (`^\d{6}$`) |

#### String Sanitization
- Control character removal (0x00-0x1F, 0x7F)
- Null byte filtering
- Shell metacharacter removal for MCP commands

#### MCP Command Injection Prevention
- **Location:** `src/lib/mcpCommandValidator.ts`
- **Controls:**
  - Whitelist of allowed commands (`npx` only)
  - Package whitelist enforcement per server type
  - Path traversal prevention (`..` and `~` blocked)
  - Environment variable sanitization
  - Shell metacharacter stripping

### 4. Rate Limiting

#### Multi-Level Rate Limiting
- **Location:** `src/lib/rateLimiting.ts`, `src/lib/ratelimit.ts`

| Level | Scope | Implementation |
|-------|-------|----------------|
| Per-minute | Requests per minute | `user_minute_usage` table |
| Daily requests | Requests per day per model | `user_daily_usage` table |
| Daily tokens | Tokens per day per model | `user_daily_usage` table |
| Anti-bot | Min 2 seconds between requests | Timestamp tracking |

#### Endpoint-Specific Limits
| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `/api/mcp/stdio` | 3 requests/minute | Strict - MCP execution |
| `/api/mcp/credentials` | 10 requests/10 seconds | Standard |
| AI chat endpoints | Model-specific | Per `model_rate_limits` table |

#### Rate Limit Response
- HTTP 429 status code
- `Retry-After` header included
- User-friendly error messages
- Warning messages at 80% threshold

### 5. HTTP Security Headers

#### Configured in `next.config.ts`

```typescript
// Content Security Policy
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'  // Required by Next.js
style-src 'self' 'unsafe-inline'                  // Required by Tailwind
img-src 'self' data: https: blob:
font-src 'self' data:
connect-src 'self' https://*.supabase.co https://api.anthropic.com ...
object-src 'none'
frame-ancestors 'none'

// Additional Headers
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 6. Database Security

#### Row-Level Security (RLS)
- **Location:** `database-migrations/022_enable_rls_security.sql`

| Table | Policy |
|-------|--------|
| `workflow_executions` | User-scoped via canvas ownership |
| `boardroom_conversations` | User-scoped via canvas ownership |
| `boardroom_messages` | User-scoped via conversation ownership |
| `training_session_executions` | User-scoped |
| `training_interactions` | User-scoped |
| `user_daily_usage` | Self-scoped (`auth.uid() = user_id`) |
| `user_minute_usage` | Self-scoped |

#### Parameterized Queries
- All database operations use Supabase client
- No string interpolation in queries
- TypeScript types validate column names at compile time

### 7. OAuth Security

#### CSRF State Token Protection
- **Location:** `src/app/api/oauth/*/authorize/route.ts`
- Random state tokens stored in `oauth_states` table
- 10-minute expiration
- Verified before token exchange
- Deleted after successful use

#### Token Storage Security
- Refresh tokens encrypted with `OAUTH_ENCRYPTION_KEY`
- Stored in `oauth_tokens` table
- Automatic token refresh on expiration
- Revocation endpoints available

### 8. Webhook Security

#### Stripe Webhook Verification
- **Location:** `src/app/api/stripe/webhook/route.ts`
- Signature verification using `stripe.webhooks.constructEvent()`
- `STRIPE_WEBHOOK_SECRET` for HMAC validation
- Only processes verified events
- Proper error handling for invalid signatures

### 9. Environment Variable Protection

#### Security Measures
- `.gitignore` excludes all `.env*` files
- `.env.local.example` documents required variables
- Clear separation: `NEXT_PUBLIC_*` (client) vs unprefixed (server)

#### Critical Protected Variables
| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access |
| `MCP_ENCRYPTION_KEY` | MCP credential encryption |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth authentication |
| `OAUTH_ENCRYPTION_KEY` | Token encryption |
| `GCP_SERVICE_ACCOUNT_KEY` | Secret Manager access |

---

## Identified Security Gaps

### HIGH PRIORITY

#### 1. Session Management Gaps
- **Issue:** No visible session timeout enforcement
- **Risk:** Sessions may persist indefinitely
- **Impact:** Account takeover if session token leaked
- **Location:** Throughout auth flow
- **Recommendation:** Implement idle timeout (15-30 min) and absolute timeout (24 hours)

#### 2. Missing CSRF Protection on Forms
- **Issue:** Only OAuth and webhooks have CSRF protection
- **Risk:** Cross-site form submission attacks
- **Impact:** Unauthorized actions on user's behalf
- **Recommendation:** Implement double-submit cookie pattern or synchronizer tokens

#### 3. No Comprehensive Audit Logging
- **Issue:** Security events not systematically logged
- **Risk:** Unable to detect or investigate breaches
- **Impact:** Compliance issues, incident response challenges
- **Recommendation:** Log all auth events, API key access, admin actions

### MEDIUM PRIORITY

#### 4. In-Memory Rate Limiting Only
- **Issue:** Rate limits stored in process memory
- **Risk:** Rate limits reset on server restart; not shared across instances
- **Impact:** Rate limit bypass in scaled deployments
- **Location:** `src/lib/ratelimit.ts`
- **Recommendation:** Implement Redis-based rate limiting for production

#### 5. No API Key Rotation Mechanism
- **Issue:** No automated key rotation
- **Risk:** Stale keys increase exposure window
- **Impact:** Extended access if key compromised
- **Recommendation:** Implement key rotation reminders and automatic rotation

#### 6. Missing Startup Environment Validation
- **Issue:** No validation that required env vars are present
- **Risk:** Runtime failures, security misconfigurations
- **Impact:** Service crashes or insecure defaults
- **Recommendation:** Add startup validation script

#### 7. No Request Logging/Audit Middleware
- **Issue:** API requests not systematically logged
- **Risk:** No visibility into access patterns
- **Impact:** Cannot detect abuse or investigate incidents
- **Recommendation:** Add audit middleware for sensitive endpoints

### LOW PRIORITY

#### 8. No Pre-Commit Secret Scanning
- **Issue:** No git hooks to prevent secret commits
- **Risk:** Accidental credential exposure
- **Recommendation:** Add `gitleaks` or `detect-secrets` pre-commit hook

#### 9. No IP-Based Access Controls
- **Issue:** No IP whitelisting capability
- **Risk:** Cannot restrict admin access by location
- **Recommendation:** Consider IP allowlisting for admin functions

#### 10. No Request Signing
- **Issue:** No HMAC signing for inter-service calls
- **Risk:** Request tampering potential
- **Recommendation:** Implement for sensitive internal APIs

---

## Risk Assessment Matrix

| Risk | Likelihood | Impact | Current Mitigation | Priority |
|------|------------|--------|-------------------|----------|
| SQL Injection | Low | High | Parameterized queries, RLS | ✅ Mitigated |
| XSS Attack | Low | Medium | CSP, sanitization | ✅ Mitigated |
| Command Injection | Low | Critical | Whitelist validation | ✅ Mitigated |
| API Key Exposure | Low | High | GCP Secret Manager | ✅ Mitigated |
| Session Hijacking | Medium | High | JWT tokens only | ⚠️ Needs timeout |
| CSRF Attack | Medium | Medium | Partial (OAuth only) | ⚠️ Needs form protection |
| Rate Limit Bypass | Medium | Medium | In-memory limits | ⚠️ Needs Redis |
| Brute Force | Low | Medium | 2FA, rate limits | ✅ Mitigated |
| Data Breach | Low | Critical | Encryption, RLS | ✅ Mitigated |
| Insider Threat | Medium | High | No audit logs | ⚠️ Needs logging |

---

## Recommendations

### Immediate Actions (Week 1-2)

1. **Implement Session Timeout**
   ```typescript
   // Add to Supabase config
   const supabase = createClient(url, key, {
     auth: {
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: true,
       flowType: 'pkce',
       // Add session timeout
       storageKey: 'sb-auth-token',
       storage: {
         getItem: (key) => {
           const item = localStorage.getItem(key);
           if (item) {
             const { expires_at } = JSON.parse(item);
             if (Date.now() > expires_at) {
               localStorage.removeItem(key);
               return null;
             }
           }
           return item;
         }
       }
     }
   });
   ```

2. **Add CSRF Middleware**
   ```typescript
   // src/middleware.ts - Add CSRF token validation
   import { csrf } from '@edge-csrf/nextjs';

   export const csrfProtect = csrf({
     cookie: {
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict'
     }
   });
   ```

3. **Add Environment Validation**
   ```typescript
   // src/lib/validateEnv.ts
   const requiredVars = [
     'SUPABASE_SERVICE_ROLE_KEY',
     'MCP_ENCRYPTION_KEY',
     'STRIPE_SECRET_KEY'
   ];

   export function validateEnvironment() {
     const missing = requiredVars.filter(v => !process.env[v]);
     if (missing.length) {
       throw new Error(`Missing required env vars: ${missing.join(', ')}`);
     }
   }
   ```

### Short-Term Actions (Month 1)

4. **Implement Audit Logging**
   ```typescript
   // src/lib/auditLog.ts
   interface AuditEvent {
     userId: string;
     action: string;
     resource: string;
     ip: string;
     userAgent: string;
     timestamp: Date;
     metadata?: Record<string, unknown>;
   }

   export async function logAuditEvent(event: AuditEvent) {
     await supabase.from('audit_logs').insert(event);
   }
   ```

5. **Add Redis Rate Limiting**
   ```typescript
   // Use Upstash Redis for edge-compatible rate limiting
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';

   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_URL,
     token: process.env.UPSTASH_REDIS_TOKEN
   });

   export const rateLimiter = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(10, '10 s')
   });
   ```

6. **Add Pre-Commit Secret Scanning**
   ```yaml
   # .pre-commit-config.yaml
   repos:
     - repo: https://github.com/gitleaks/gitleaks
       rev: v8.18.0
       hooks:
         - id: gitleaks
   ```

### Long-Term Actions (Quarter 1)

7. **Implement Key Rotation**
   - Add key rotation reminders (90-day cycle)
   - Support multiple active keys during rotation
   - Automatic deprecation of old keys

8. **Security Monitoring Dashboard**
   - Real-time failed auth attempts
   - Rate limit breaches
   - Unusual access patterns
   - API key usage analytics

9. **Third-Party Security Audit**
   - Engage penetration testing firm
   - OWASP Top 10 assessment
   - Infrastructure security review

---

## Compliance Considerations

### GDPR (If serving EU users)
- ✅ Data encryption at rest
- ⚠️ Need data export functionality
- ⚠️ Need data deletion ("right to be forgotten")
- ⚠️ Need cookie consent mechanism

### SOC 2 (If pursuing certification)
- ✅ Access controls implemented
- ⚠️ Need comprehensive audit logging
- ⚠️ Need incident response procedures
- ⚠️ Need security training documentation

---

## Conclusion

The AI UI Wrapper codebase demonstrates strong security engineering with excellent implementations of:
- **Encryption** (AES-256-GCM throughout)
- **Input validation** (comprehensive format checking)
- **API key protection** (GCP Secret Manager)
- **Database security** (RLS, parameterized queries)
- **HTTP security headers** (full suite implemented)

Priority improvements should focus on:
1. Session management (timeout, revocation)
2. CSRF protection for all forms
3. Audit logging infrastructure
4. Redis-based rate limiting for scale

With these improvements, the platform would achieve an **excellent security posture** suitable for enterprise deployment.

---

*Report generated by Claude Code Security Audit*
