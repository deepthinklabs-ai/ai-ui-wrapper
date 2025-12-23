# Infrastructure Cost Breakdown

**Generated:** December 2025
**Application:** ai-ui-wrapper (aiuiw.com)
**Pricing Model:** BYOK (Bring Your Own Key) - Users provide their own LLM API keys

---

## Summary

This document outlines all infrastructure costs for the application, excluding LLM API costs (which are borne by users under the BYOK model).

---

## 1. Supabase (Database & Authentication)

**Service:** PostgreSQL database, authentication, real-time subscriptions, file storage

| Plan | Monthly Cost | Notes |
|------|-------------|-------|
| Free | $0 | 500MB database, 1GB storage, 10k MAUs. Projects pause after 7 days inactivity. |
| **Pro** | **$25/month** | Recommended. Daily backups, no pausing, higher limits. Includes $10 compute credit. |
| Team | $599/month | SOC 2, SSO, compliance features |

**Your likely tier:** Pro ($25/month)

**Usage-based costs on Pro (pay-as-you-go):**
- Database: $0.125/GB-month (beyond 8GB included)
- Storage: $0.021/GB-month (beyond 100GB included)
- Bandwidth: $0.09/GB (beyond 50GB included)
- Auth MAUs: Free up to 50k, then $0.00325/MAU

**Source:** [Supabase Pricing](https://supabase.com/pricing)

---

## 2. Vercel (Hosting & Deployment)

**Service:** Next.js hosting, serverless functions, edge network

| Plan | Monthly Cost | Notes |
|------|-------------|-------|
| Hobby | $0 | Personal/non-commercial only. Limited bandwidth. |
| **Pro** | **$20/user/month** | Commercial use, 1TB bandwidth, 10M edge requests included |
| Enterprise | Custom | SLAs, advanced security |

**Your likely tier:** Pro ($20/month for 1 seat)

**Usage-based costs on Pro:**
- Fast Data Transfer: $0.15/GB beyond 1TB included
- Edge Requests: $2/million beyond 10M included
- Serverless Function Duration: $0.18/GB-hour beyond included
- Build minutes: $0.024/min beyond 6000 included

**Source:** [Vercel Pricing](https://vercel.com/pricing)

---

## 3. Stripe (Payment Processing)

**Service:** Subscription billing, payment processing

| Fee Type | Cost | Notes |
|----------|------|-------|
| Monthly fee | $0 | No fixed monthly cost |
| **Card transactions** | **2.9% + $0.30** | Per successful charge |
| International cards | +1% | Additional fee |
| Currency conversion | +1% | If applicable |
| ACH transfers | 0.8% (max $5) | Bank transfers |
| Chargebacks | $15 each | Dispute fee |
| Invoicing | 0.4% | After 25 free/month |

**Cost depends on revenue.** Example at $50/month subscription:
- Per subscriber fee: ~$1.75/subscriber/month (2.9% + $0.30)
- 100 subscribers = ~$175/month in Stripe fees

**Source:** [Stripe Pricing](https://stripe.com/pricing)

---

## 4. Resend (Transactional Email)

**Service:** Email delivery for verification, password reset, notifications

| Plan | Monthly Cost | Emails/Month |
|------|-------------|--------------|
| **Free** | **$0** | 3,000 emails |
| Pro | $20 | 50,000 emails |
| Scale | $90 | 100,000 emails |

**Your likely tier:** Free ($0) - sufficient for most early-stage apps

**Source:** [Resend Pricing](https://resend.com/pricing)

---

## 5. ElevenLabs (Text-to-Speech)

**Service:** AI voice generation for TTS features

| Plan | Monthly Cost | Credits | Approx. Minutes |
|------|-------------|---------|-----------------|
| **Free** | **$0** | 10,000 | ~10 min TTS |
| Starter | $5 | 30,000 | ~30 min TTS |
| Creator | $22 | 100,000 | ~100 min TTS |
| Pro | $99 | 500,000 | ~500 min TTS |

**Your likely tier:** Depends on TTS usage. Start with Free.

**Note:** 1 character = 1 credit. Average word = ~5 characters.

**Source:** [ElevenLabs Pricing](https://elevenlabs.io/pricing)

---

## 6. Google Cloud (OAuth & APIs)

**Service:** Gmail, Google Docs, Sheets, Calendar integrations via OAuth

| Service | Cost | Notes |
|---------|------|-------|
| OAuth 2.0 | **$0** | Free - only rate limited |
| Gmail API | $0 | Free quota: 1B units/day |
| Sheets API | $0 | Free quota: Generous |
| Docs API | $0 | Free quota: Generous |
| Calendar API | $0 | Free quota: 1M queries/day |

**Your likely cost:** $0 (all within free quotas)

**Source:** [Google Cloud Pricing](https://cloud.google.com/pricing)

---

## 7. Slack (OAuth Integration)

**Service:** Slack bot/integration for canvas features

| Component | Cost | Notes |
|-----------|------|-------|
| Slack API | **$0** | Free to build apps/bots |
| Workspace (if needed) | $0 - $8.75/user | Only if you need your own workspace |

**Your likely cost:** $0 (API usage is free)

**Source:** [Slack Pricing](https://slack.com/pricing)

---

## Monthly Cost Summary

### Minimum Viable (Early Stage)

| Service | Monthly Cost |
|---------|-------------|
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| Stripe | Variable (per transaction) |
| Resend Free | $0 |
| ElevenLabs Free | $0 |
| Google OAuth | $0 |
| Slack API | $0 |
| **TOTAL (Fixed)** | **$0** |
| **TOTAL (Variable)** | **~2.9% + $0.30 per transaction** |

### Production Ready (Recommended)

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| Vercel Pro (1 seat) | $20 |
| Stripe | Variable (per transaction) |
| Resend Free | $0 |
| ElevenLabs Starter | $5 |
| Google OAuth | $0 |
| Slack API | $0 |
| **TOTAL (Fixed)** | **$50/month** |
| **TOTAL (Variable)** | **~2.9% + $0.30 per transaction** |

### Scaling (100+ users)

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro + usage | ~$50-100 |
| Vercel Pro | $20 + usage |
| Stripe (100 subs @ $50) | ~$175 |
| Resend Pro | $20 |
| ElevenLabs Creator | $22 |
| Google OAuth | $0 |
| Slack API | $0 |
| **TOTAL** | **~$290-340/month** |

---

## Cost Per User Estimate

At the recommended production tier ($50/month fixed):

| Users | Fixed Cost/User | Stripe Fee/User | Total/User |
|-------|-----------------|-----------------|------------|
| 10 | $5.00 | $1.75 | $6.75 |
| 50 | $1.00 | $1.75 | $2.75 |
| 100 | $0.50 | $1.75 | $2.25 |
| 500 | $0.10 | $1.75 | $1.85 |

**Note:** With BYOK model, you have no LLM API costs. All AI costs are passed to users.

---

## Domain & SSL

| Service | Annual Cost | Monthly Equivalent |
|---------|------------|-------------------|
| Domain (aiuiw.com) | ~$12-15/year | ~$1.25/month |
| SSL Certificate | $0 | Included with Vercel |

---

## Not Included in This Analysis

- LLM API costs (OpenAI, Anthropic, xAI) - BYOK model
- Development tools (IDE, GitHub, etc.)
- Marketing & advertising
- Legal & compliance costs
- Your time/labor

---

## Sources

- [Supabase Pricing](https://supabase.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
- [Stripe Pricing](https://stripe.com/pricing)
- [Resend Pricing](https://resend.com/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [Google Cloud Pricing](https://cloud.google.com/pricing)
- [Slack Pricing](https://slack.com/pricing)

---

---

## Profitability Analysis: $5/month Subscription

### Assumptions
- Subscription price: $5/month
- Stripe fee per transaction: 2.9% + $0.30 = **$0.45 per $5 charge**
- Net revenue per user: $5.00 - $0.45 = **$4.55/user/month**
- Infrastructure: Production Ready tier ($50/month fixed)

### Profitability by User Count

| Users | Gross Revenue | Stripe Fees | Net Revenue | Fixed Costs | **Profit/Loss** | Margin |
|-------|---------------|-------------|-------------|-------------|-----------------|--------|
| 10 | $50 | $4.50 | $45.50 | $50 | **-$4.50** | -9% |
| 15 | $75 | $6.75 | $68.25 | $50 | **+$18.25** | 24% |
| 20 | $100 | $9.00 | $91.00 | $50 | **+$41.00** | 41% |
| 25 | $125 | $11.25 | $113.75 | $50 | **+$63.75** | 51% |
| 30 | $150 | $13.50 | $136.50 | $50 | **+$86.50** | 58% |
| 40 | $200 | $18.00 | $182.00 | $50 | **+$132.00** | 66% |
| 50 | $250 | $22.50 | $227.50 | $50 | **+$177.50** | 71% |
| 75 | $375 | $33.75 | $341.25 | $50 | **+$291.25** | 78% |
| 100 | $500 | $45.00 | $455.00 | $50 | **+$405.00** | 81% |

### Break-Even Analysis

**Break-even point: ~11 users**

- At 11 users: $55 gross - $4.95 Stripe = $50.05 net (covers $50 fixed costs)
- Every user beyond 11 adds ~$4.55 pure profit

### Using Free Tiers (Minimum Viable)

If you use all free tiers ($0 fixed cost):

| Users | Gross Revenue | Stripe Fees | **Profit** | Margin |
|-------|---------------|-------------|------------|--------|
| 10 | $50 | $4.50 | **+$45.50** | 91% |
| 25 | $125 | $11.25 | **+$113.75** | 91% |
| 50 | $250 | $22.50 | **+$227.50** | 91% |
| 100 | $500 | $45.00 | **+$455.00** | 91% |

**Warning:** Free tiers have limitations (Supabase pauses after 7 days inactivity, Vercel is non-commercial only). Not recommended for paying customers.

### Key Takeaways

1. **Break-even:** 11 paying users (Production Ready tier)
2. **Stripe takes 9%** of each $5 charge ($0.45)
3. **At 50 users:** $177.50/month profit (71% margin)
4. **At 100 users:** $405/month profit (81% margin)
5. **No LLM costs** with BYOK - all AI expenses on users

---

*This document is for planning purposes. Verify current pricing directly with each provider before making financial decisions.*
