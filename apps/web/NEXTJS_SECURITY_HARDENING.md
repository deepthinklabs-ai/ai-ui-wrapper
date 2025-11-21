# Next.js Server Security Hardening Guide

## 🎯 **Threat Model**

Your Next.js backend is the most critical component because it:
- Holds the encryption key for decrypting MCP credentials
- Has access to your Supabase database
- Executes MCP server processes with user credentials
- Processes user authentication

**If compromised, an attacker could**:
- Decrypt all stored API keys
- Access user data in Supabase
- Execute arbitrary MCP commands
- Impersonate users

---

## 🔐 **1. Environment Variable Security**

### **Current State**
```bash
# .env.local (NEVER commit this)
MCP_ENCRYPTION_KEY=d0249ec6a5e60732a409bb867f037ba6...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### **✅ Best Practices**

#### **A. Local Development**
```bash
# .env.local - Add to .gitignore
MCP_ENCRYPTION_KEY=your-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-key  # If needed

# .env.example - Commit this as template
MCP_ENCRYPTION_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

#### **B. Production Deployment**

**For Vercel**:
1. Dashboard → Project → Settings → Environment Variables
2. Add `MCP_ENCRYPTION_KEY` as **Sensitive** (encrypted at rest)
3. Use different keys for Preview vs Production environments
4. Enable "Protect Sensitive Environment Variables" (hides in logs)

**For Self-Hosted**:
```bash
# Use a secrets manager
# AWS Secrets Manager, HashiCorp Vault, etc.

# OR encrypted environment file
# Use tools like dotenv-vault or sops
```

**For Docker**:
```dockerfile
# Use Docker secrets (not ENV)
docker secret create mcp_encryption_key ./key.txt
```

#### **C. Key Rotation**
```bash
# Generate new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Migration strategy:
# 1. Keep old key as MCP_ENCRYPTION_KEY_OLD
# 2. Add new key as MCP_ENCRYPTION_KEY
# 3. Re-encrypt all credentials
# 4. Remove old key after migration
```

---

## 🌐 **2. Network Security**

### **A. HTTPS Everywhere**

**Vercel** (Automatic):
- ✅ Free SSL certificates
- ✅ Automatic HTTPS redirect
- ✅ HTTP/2 enabled

**Self-Hosted**:
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourapp.com;

    ssl_certificate /etc/letsencrypt/live/yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourapp.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;

    # Security headers (see section 3)
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourapp.com;
    return 301 https://$server_name$request_uri;
}
```

### **B. Firewall Configuration**

```bash
# Only allow necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH (change default port!)
ufw allow 80/tcp     # HTTP (for Let's Encrypt)
ufw allow 443/tcp    # HTTPS
ufw enable

# Fail2ban for SSH brute force protection
apt-get install fail2ban
```

---

## 🔒 **3. HTTP Security Headers**

Add to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'  // Prevents clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'  // Prevents MIME sniffing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'  // XSS protection
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js needs unsafe-eval
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com",
              "frame-ancestors 'none'"
            ].join('; ')
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

**Test your headers**: https://securityheaders.com

---

## 🚦 **4. Rate Limiting**

Prevent abuse of your API endpoints.

### **Install Middleware**:
```bash
npm install @upstash/ratelimit @upstash/redis
```

### **Create Rate Limiter**:
```typescript
// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create rate limiter
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
  analytics: true,
});

// Stricter limits for sensitive endpoints
export const strictRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "60 s"), // 3 requests per minute
  analytics: true,
});
```

### **Apply to MCP Routes**:
```typescript
// src/app/api/mcp/stdio/route.ts
import { strictRatelimit } from "@/lib/ratelimit";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function POST(request: Request) {
  // Get user first
  const authResult = await getAuthenticatedUser(request);
  if (authResult.error || !authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit per user
  const { success, limit, reset, remaining } = await strictRatelimit.limit(
    `mcp_${authResult.user.id}`
  );

  if (!success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        limit,
        remaining,
        reset: new Date(reset)
      },
      { status: 429 }
    );
  }

  // ... rest of handler
}
```

### **Alternative: Simple In-Memory (Development)**:
```typescript
// src/lib/simpleRatelimit.ts
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function ratelimit(userId: string, maxRequests = 10, windowMs = 10000) {
  const now = Date.now();
  const userKey = userId;
  const record = requestCounts.get(userKey);

  if (!record || now > record.resetTime) {
    requestCounts.set(userKey, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { success: false, remaining: 0, reset: record.resetTime };
  }

  record.count++;
  return { success: true, remaining: maxRequests - record.count };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Every minute
```

---

## 🔍 **5. Logging & Monitoring**

### **A. Security Event Logging**

Already implemented in `mcpCommandValidator.ts`, but enhance:

```typescript
// src/lib/securityLogger.ts
import * as Sentry from "@sentry/nextjs";

export type SecurityEvent = {
  type: string;
  severity: "info" | "warning" | "critical";
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
};

export function logSecurityEvent(event: SecurityEvent) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Console (development)
  console.log("[SECURITY]", JSON.stringify(logEntry));

  // Production logging
  if (process.env.NODE_ENV === "production") {
    // Sentry for critical events
    if (event.severity === "critical") {
      Sentry.captureMessage(`Security Event: ${event.type}`, {
        level: "error",
        extra: logEntry,
      });
    }

    // Send to logging service (DataDog, LogDNA, etc.)
    // await fetch(process.env.LOGGING_ENDPOINT, {
    //   method: "POST",
    //   body: JSON.stringify(logEntry),
    // });
  }
}
```

### **B. Set Up Sentry** (Error Tracking):
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```javascript
// sentry.server.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Don't log sensitive data
  beforeSend(event) {
    // Remove sensitive environment variables
    if (event.contexts?.runtime?.environment) {
      delete event.contexts.runtime.environment.MCP_ENCRYPTION_KEY;
      delete event.contexts.runtime.environment.SUPABASE_SERVICE_ROLE_KEY;
    }
    return event;
  },

  // Sample rate
  tracesSampleRate: 0.1,
});
```

---

## 🐳 **6. Server Hardening (Self-Hosted)**

### **A. Run as Non-Root User**
```bash
# Create dedicated user
sudo useradd -r -s /bin/false nextjs

# Set ownership
sudo chown -R nextjs:nextjs /app

# Run with systemd
# /etc/systemd/system/nextjs.service
[Unit]
Description=Next.js Application
After=network.target

[Service]
Type=simple
User=nextjs
WorkingDirectory=/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /app/.next/standalone/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### **B. Docker Security**
```dockerfile
# Use official Node image (regularly updated)
FROM node:20-alpine AS base

# Run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy files with correct ownership
COPY --chown=nextjs:nodejs . .

# Build
RUN npm ci --only=production
RUN npm run build

# Run as non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", ".next/standalone/server.js"]
```

### **C. File Permissions**
```bash
# Restrict file permissions
chmod 700 /app
chmod 600 /app/.env.local
chmod 644 /app/package.json

# Verify
ls -la /app
```

---

## 🔐 **7. Secrets Management (Production)**

### **Option A: Vercel (Easiest)**
- Use Vercel Environment Variables
- Enable "Sensitive" flag
- Different values for Preview/Production

### **Option B: HashiCorp Vault**
```typescript
// src/lib/secrets.ts
import vault from "node-vault";

const client = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

export async function getSecret(key: string): Promise<string> {
  const { data } = await client.read(`secret/data/${key}`);
  return data.data.value;
}

// Usage
const encryptionKey = await getSecret("mcp_encryption_key");
```

### **Option C: AWS Secrets Manager**
```bash
npm install @aws-sdk/client-secrets-manager
```

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

export async function getSecret(secretName: string) {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString;
}
```

---

## 🛡️ **8. Dependency Security**

### **A. Audit Dependencies**
```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# For high-severity issues
npm audit fix --force
```

### **B. Automated Scanning**
```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm audit --audit-level=high

  # Snyk scanning
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### **C. Dependabot**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

---

## 🔒 **9. Input Validation & Sanitization**

### **Already Implemented**:
- ✅ Command whitelisting (`mcpCommandValidator.ts`)
- ✅ Environment variable isolation
- ✅ Path traversal protection

### **Additional Protection**:
```typescript
// src/lib/inputValidation.ts
import { z } from "zod";

// Validate API key format
export const GitHubTokenSchema = z.string()
  .regex(/^ghp_[a-zA-Z0-9]{36}$/, "Invalid GitHub token format");

export const SlackTokenSchema = z.string()
  .regex(/^xoxb-[a-zA-Z0-9-]+$/, "Invalid Slack token format");

// Validate in credential API
export async function POST(request: Request) {
  const body = await request.json();

  // Validate input
  if (body.serverType === "github") {
    const result = GitHubTokenSchema.safeParse(body.config.env.GITHUB_PERSONAL_ACCESS_TOKEN);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid GitHub token format" },
        { status: 400 }
      );
    }
  }

  // ... rest of handler
}
```

---

## 📊 **10. Security Monitoring**

### **A. Uptime Monitoring**
- **Uptime Robot**: https://uptimerobot.com (Free)
- **BetterStack**: https://betterstack.com
- **Pingdom**: https://pingdom.com

### **B. Application Performance Monitoring (APM)**
```bash
npm install @vercel/analytics
```

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### **C. Security Scanning**
- **OWASP ZAP**: Automated security testing
- **Burp Suite**: Manual penetration testing
- **Snyk**: Dependency vulnerability scanning

---

## 🎯 **11. Production Deployment Checklist**

### **Pre-Deployment**:
- [ ] Run `npm audit` and fix critical issues
- [ ] Verify all secrets are in environment variables (not code)
- [ ] Test rate limiting on staging
- [ ] Configure CSP headers
- [ ] Set up error tracking (Sentry)
- [ ] Enable HTTPS redirect
- [ ] Review Supabase RLS policies
- [ ] Test authentication flows
- [ ] Backup database

### **Post-Deployment**:
- [ ] Verify HTTPS is working
- [ ] Test security headers: https://securityheaders.com
- [ ] Monitor error rates
- [ ] Set up uptime monitoring
- [ ] Test rate limiting
- [ ] Verify environment variables loaded
- [ ] Check logs for security events

### **Ongoing**:
- [ ] Weekly dependency updates
- [ ] Monthly security audits
- [ ] Review access logs
- [ ] Rotate encryption keys annually
- [ ] Update SSL certificates (auto with Let's Encrypt)

---

## 🚨 **Incident Response Plan**

### **If Encryption Key is Compromised**:
1. **Immediately rotate key**:
   ```bash
   # Generate new key
   NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

   # Update environment variable
   # Vercel: Dashboard → Settings → Environment Variables
   # Self-hosted: Update .env and restart
   ```

2. **Force re-encryption**:
   - Decrypt all credentials with old key
   - Re-encrypt with new key
   - Update database

3. **Notify users**:
   - Ask users to rotate their API keys (GitHub, Slack, etc.)
   - Explain what happened

4. **Audit access logs**:
   - Check for unauthorized access
   - Review Supabase logs

### **If Server is Compromised**:
1. **Isolate server** (take offline)
2. **Review logs** for attack vector
3. **Rotate all secrets**
4. **Restore from backup**
5. **Patch vulnerability**
6. **Notify users** if data was accessed

---

## 📚 **Resources**

- **Next.js Security**: https://nextjs.org/docs/advanced-features/security-headers
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Node.js Security Best Practices**: https://nodejs.org/en/docs/guides/security/
- **Supabase Security**: https://supabase.com/docs/guides/platform/security

---

## ✅ **Quick Wins (Implement Today)**

1. **Add security headers** to `next.config.js` (5 min)
2. **Enable Vercel environment variable protection** (2 min)
3. **Add `.env.local` to `.gitignore`** (1 min)
4. **Set up Sentry error tracking** (10 min)
5. **Test security headers** at securityheaders.com (2 min)

**Total time**: ~20 minutes for significant security improvements!
