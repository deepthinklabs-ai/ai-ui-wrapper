
# AIUIW BYOK Implementation Specification  
## Google Secret Manager Integration  
### Option B (JSON Blob Per User) + Option A (Merge & Replace)  
### **FULL ENGINEERING HANDOFF DOCUMENT**  
### Includes: Implementation Spec + Migration Guide + Testing Plan

---

# 1. OVERVIEW

This document provides a full, production-grade specification for implementing **BYOK (Bring Your Own Key)** using **Google Secret Manager** in the AIUIW platform.  
It is designed to be handed directly to *Claude Code* for implementation.

This spec aligns fully with:

- Next.js 16 App Router
- Vercel serverless execution environment
- Supabase Auth & DB
- Unified AI Client structure
- Multi-provider LLM support
- AIUIW's existing folder layout  
- New pricing strategy ($5 BYOK tier)

The implementation uses:

### **Option B:**  
✓ One secret per user (JSON blob storing keys for ALL providers)

### **Option A:**  
✓ When saving a key, retrieve existing JSON → update one field → write entire blob back → create new secret version

This is the **industry-standard** BYOK security model.

---

# 2. ARCHITECTURE

## 2.1 Data Flow Summary

```
Frontend → /api/byok/store → Vercel Serverless → Google Secret Manager
                  ↓
Frontend → /api/byok/get → Vercel Serverless → GCP Secret Manager → Use key for LLM
```

### No data is ever:
- Stored in localStorage  
- Stored in Supabase  
- Returned after initial submission  
- Logged anywhere  

### Keys live only:
- In GCP Secret Manager  
- In RAM in Vercel serverless instances for milliseconds during use

---

# 3. FILE STRUCTURE

Claude Code must create the following:

```
apps/web/
  src/
    lib/
      secretManager/
        index.ts
    app/
      api/
        byok/
          store/route.ts
          get/route.ts
```

Additionally, modifications must be made to:

```
src/lib/unifiedAIClient.ts
src/lib/clientOpenAI.ts
src/lib/clientClaude.ts
src/lib/clientGrok.ts
```

All client-side key access will be deleted.

---

# 4. ENVIRONMENT VARIABLES

Add to Vercel:

```
GCP_PROJECT_ID=<your-gcp-project-id>
GCP_SERVICE_ACCOUNT_KEY=<base64-json-key>
```

Claude must ensure the base64 key is decoded:

```ts
credentials: JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY!, 'base64').toString())
```

---

# 5. SECRET FORMAT (Option B)

Store ONE secret per user:

### Secret Name:
```
aiuiw-user-<userId>
```

### JSON Payload:
```json
{
  "openai": "sk-...",
  "claude": "sk-...",
  "grok": "sk-...",
  "gemini": null
}
```

When a user adds a key for ANY provider:
→ Retrieve existing secret  
→ Modify one field  
→ Replace entire JSON as a new version  

---

# 6. BACKEND LOGIC

## 6.1 Helper Module

Path: `src/lib/secretManager/index.ts`

Claude Code must implement:

### **Functions:**
```
getUserSecret(userId)
updateUserSecret(userId, provider, apiKey)
getProviderKey(userId, provider)
```

### Requirements:
- Zero logging of keys  
- Zero persistent storage  
- Zero lingering variables  
- Write-back uses new secret version  
- Wrap all errors with generic messages  

### Example scaffolding:

```ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient({
  credentials: JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY!, 'base64').toString())
});

export async function getUserSecret(userId: string) {
  // Fetch existing secret or return empty template
}

export async function updateUserSecret(userId: string, provider: string, apiKey: string) {
  // Retrieve old blob
  // Update provider field
  // Write back entire JSON as new version
}

export async function getProviderKey(userId: string, provider: string) {
  // Retrieve blob, extract field, wipe memory
}
```

Claude must fill in all logic.

---

# 7. API ROUTES

## 7.1 `/api/byok/store` (POST)

### Body:
```json
{
  "provider": "openai",
  "apiKey": "sk-..."
}
```

### Behavior:
- Retrieve userId from Supabase session  
- Fetch existing secret  
- Update JSON with new provider key  
- Return success  
- Zero-out memory  

---

## 7.2 `/api/byok/get` (POST)

### Body:
```json
{
  "provider": "openai"
}
```

### Behavior:
- Retrieve userId from session  
- Access JSON blob  
- Extract provider key  
- Return key **ONLY TO SERVERLESS ENV**, not to frontend  
- Must be internal (called only by LLM proxy routes)  

---

# 8. UPDATING LLM CLIENTS

All client libraries must be modified:

### Before:
They read API keys from localStorage.

### After:
They send internal requests:

```
const apiKey = await internalGetKey(provider)
```

Then:

```
new OpenAI({ apiKey })
```

### Files to modify:

```
src/lib/clientOpenAI.ts
src/lib/clientClaude.ts
src/lib/clientGrok.ts
src/lib/unifiedAIClient.ts
```

Claude Code must ensure:

- The key is NEVER logged  
- The key is nullified after use  
- No access from frontend  

---

# 9. SECURITY REQUIREMENTS

Claude Code MUST implement:

## 9.1 Prevent logging of secrets

**Do NOT override global console methods.** Instead, implement proper secret handling:

### Recommended approach:

1. **Use a sanitization helper** at the source of logging:

```ts
// src/lib/sanitizeForLogging.ts
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,  // OpenAI/Anthropic keys
  /xai-[a-zA-Z0-9]{20,}/g, // xAI keys
];

export function sanitize(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let sanitized = value;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function sanitizeObject<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => sanitize(v)));
}
```

2. **Call sanitize() explicitly** before logging any data that might contain secrets:

```ts
console.log('[API] Request metadata:', sanitize(requestData));
```

3. **Never log API keys directly** - only log metadata (presence, length) as shown in the route examples.

## 9.2 Content Security Policy

Update `middleware.ts`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  connect-src 'self' https://<your-domain>;
```

## 9.3 No localStorage use  
All key storage code must be removed.

## 9.4 Zeroing sensitive RAM  
All variables containing secrets must be set to null.

---

# 10. MIGRATION PLAN

## Step 1 — Remove client-side key storage:
Delete:

```
apiKeyStorage.ts
apiKeyStorage.claude.ts
apiKeyStorage.grok.ts
```

## Step 2 — Update Settings UI:
Direct all "Save API Key" interactions to:
```
POST /api/byok/store
```

## Step 3 — Update all LLM proxy routes

Replace:

```
const apiKey = localStorage.getItem(...)
```

With:

```
const apiKey = await getProviderKeyFromBackend(...)
```

## Step 4 — Inform users that keys must be re-entered once.

---

# 11. TESTING PLAN

Claude Code must generate the following test scripts:

## 11.1 Secret Storage Tests
- Create new secret  
- Update existing secret  
- Validate merge & replace  

## 11.2 Security Tests
- Ensure no logs capture keys  
- Ensure CSP blocks malicious scripts  
- Ensure secret variables are nullified  

## 11.3 Functional Tests
- Store OpenAI key  
- Store Claude key  
- Retrieve OpenAI key  
- Retrieve Claude key  
- Use keys to make LLM calls  

## 11.4 Regression Tests
- Workflow canvas should still function  
- Chat should still route properly  
- Unified AI Client should not error  

---

# 12. DEPLOYMENT CHECKLIST

- Add env vars  
- Redeploy Vercel  
- Validate no logging  
- Test secret creation  
- Test secret retrieval  
- Test LLM call with BYOK  
- Run security validation  

---

# 13. COST MODEL (Final)

### Secret storage:
Option B →  
1 secret per user →  
$0.06/user/month  
Two keys per user →  
Still $0.06 (same secret)

### Retrieval:
~600 calls/month →
$0.0018/user (access ops are $0.03 per 10,000)

### Total:
**$0.0618 per user per month ≈ $0.06**

### Profit at $5/mo:
$4.94 per user
98.76% margin

---

# 14. FINAL NOTES FOR CLAUDE CODE

Claude Code must:

- Implement all file paths exactly  
- Ensure no logging  
- Not use localStorage anywhere  
- Use GCP Secret Manager exclusively  
- Nullify sensitive variables  
- Build internal fetch wrappers  
- Not expose keys to client  
- Carefully apply TypeScript types  

---

# END OF SPEC FILE  
Hand this entire file to Claude Code.
