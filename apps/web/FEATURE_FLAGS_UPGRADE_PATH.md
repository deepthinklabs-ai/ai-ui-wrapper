# Feature Flags Upgrade Path

**Current Status:** Option 1 (Simple Environment Flags) ✅
**Future Goal:** Option 5 (Hybrid System) when you hire a team

---

## Current Implementation (Option 1)

**What you have now:**
- Simple on/off switches using environment variables
- `NEXT_PUBLIC_ENABLE_ASK_ANSWER=true/false`
- Controls dev vs production visibility
- Located in: `src/lib/featureFlags.ts`

**How to use:**
```typescript
import { FEATURE_FLAGS } from '@/lib/featureFlags';

{FEATURE_FLAGS.ASK_ANSWER && <AskAnswerUI />}
```

---

## When to Upgrade to Option 5 (Hybrid)

Consider upgrading when you need:

1. **User Tier Control** - Different features for free vs pro users
2. **Beta Testing** - Enable features for specific users
3. **A/B Testing** - Test features with subset of users
4. **Runtime Control** - Change flags without redeployment
5. **Team Development** - Multiple devs need different feature access

**Typical scenarios:**
- Hired 2+ developers who need different access levels
- Want to charge for premium features
- Need to test features with select users before full launch
- Want emergency shutoff without redeploying

---

## Upgrade Path: Option 1 → Option 5

### Phase 1: Keep Current System ✅ (DONE)
```typescript
// src/lib/featureFlags.ts
export const FEATURE_FLAGS = {
  ASK_ANSWER: process.env.NEXT_PUBLIC_ENABLE_ASK_ANSWER === 'true',
  DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const;
```

### Phase 2: Add User Tier Support (When you have paying customers)

1. **Add tier checking:**
```typescript
// src/lib/featureFlags.ts
import { useAuth } from '@/hooks/useAuth';

export function useFeatureAccess(feature: string) {
  const { user } = useAuth();

  // Layer 1: Environment override (keeps current behavior)
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env[`NEXT_PUBLIC_ENABLE_${feature}`] === 'true') return true;
  if (process.env[`NEXT_PUBLIC_ENABLE_${feature}`] === 'false') return false;

  // Layer 2: User tier check (NEW)
  const tierAccess = {
    ask_answer: ['pro', 'dev', 'admin'],
    experimental_nodes: ['dev', 'admin'],
  };

  if (user?.tier && tierAccess[feature]?.includes(user.tier)) {
    return true;
  }

  return false;
}
```

2. **Update components:**
```typescript
// Before (Option 1):
{FEATURE_FLAGS.ASK_ANSWER && <AskAnswerUI />}

// After (Option 2):
const canAccess = useFeatureAccess('ask_answer');
{canAccess && <AskAnswerUI />}
```

### Phase 3: Add Database Flags (When you need runtime control)

1. **Create database table:**
```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_for_users UUID[] DEFAULT '{}',
  enabled_for_tiers TEXT[] DEFAULT '{}',
  rollout_percentage INT DEFAULT 0, -- For A/B testing
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example data
INSERT INTO feature_flags (feature_key, enabled, enabled_for_tiers, description) VALUES
('ask_answer', false, '{"pro", "dev"}', 'Genesis Bot Ask/Answer feature'),
('experimental_nodes', false, '{"dev"}', 'Experimental Canvas node types');
```

2. **Create feature manager:**
```typescript
// src/lib/features/FeatureManager.ts
export class FeatureManager {
  async canAccess(
    featureKey: string,
    context: {
      userId?: string;
      userTier?: 'free' | 'pro' | 'dev' | 'admin';
    }
  ): Promise<boolean> {

    // Layer 1: Development mode (keeps current behavior)
    if (process.env.NODE_ENV === 'development') return true;

    // Layer 2: Environment override (keeps current behavior)
    const envVar = process.env[`NEXT_PUBLIC_ENABLE_${featureKey.toUpperCase()}`];
    if (envVar === 'true') return true;
    if (envVar === 'false') return false;

    // Layer 3: User tier check (from Phase 2)
    const tierAccess = TIER_ACCESS[featureKey];
    if (context.userTier && tierAccess?.includes(context.userTier)) {
      return true;
    }

    // Layer 4: Database check (NEW)
    const dbFlag = await this.checkDatabaseFlag(featureKey, context.userId);
    if (dbFlag?.enabled) return true;
    if (dbFlag?.userAllowlist?.includes(context.userId)) return true;

    // Layer 5: A/B testing (NEW)
    if (dbFlag?.rollout_percentage > 0) {
      const userHash = this.hashUserId(context.userId);
      if (userHash % 100 < dbFlag.rollout_percentage) return true;
    }

    return false;
  }

  private async checkDatabaseFlag(featureKey: string, userId?: string) {
    const { data } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('feature_key', featureKey)
      .single();
    return data;
  }

  private hashUserId(userId?: string): number {
    if (!userId) return 0;
    // Simple hash for consistent A/B assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const featureManager = new FeatureManager();
```

3. **Create hook:**
```typescript
// src/hooks/useFeatureFlag.ts
export function useFeatureFlag(featureKey: string): boolean {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    async function checkFlag() {
      const hasAccess = await featureManager.canAccess(featureKey, {
        userId: user?.id,
        userTier: user?.tier,
      });
      setEnabled(hasAccess);
    }
    checkFlag();
  }, [featureKey, user]);

  return enabled;
}
```

4. **Update components:**
```typescript
// Before (Option 1/2):
const canAccess = useFeatureAccess('ask_answer');

// After (Option 5):
const canAccess = useFeatureFlag('ask_answer');
{canAccess && <AskAnswerUI />}
```

### Phase 4: Admin Dashboard (Optional - for easy management)

Create admin panel to manage flags:
```typescript
// src/app/admin/feature-flags/page.tsx
export default function FeatureFlagsAdmin() {
  const [flags, setFlags] = useState([]);

  return (
    <div>
      <h1>Feature Flags Management</h1>
      {flags.map(flag => (
        <div key={flag.id}>
          <h3>{flag.feature_key}</h3>
          <Toggle
            enabled={flag.enabled}
            onChange={(enabled) => updateFlag(flag.id, { enabled })}
          />
          <RolloutSlider
            value={flag.rollout_percentage}
            onChange={(pct) => updateFlag(flag.id, { rollout_percentage: pct })}
          />
          <UserAllowlist
            users={flag.enabled_for_users}
            onAdd={(userId) => addUserToAllowlist(flag.id, userId)}
            onRemove={(userId) => removeUserFromAllowlist(flag.id, userId)}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Migration Checklist

When you're ready to upgrade, follow this checklist:

### Phase 2: User Tiers
- [ ] Add `tier` column to users table (if not exists)
- [ ] Create `useFeatureAccess` hook
- [ ] Define tier-based feature access rules
- [ ] Update components to use new hook
- [ ] Test with different user tiers
- [ ] Keep env vars as override (backwards compatible)

### Phase 3: Database Flags
- [ ] Create `feature_flags` table in Supabase
- [ ] Implement `FeatureManager` class
- [ ] Create `useFeatureFlag` hook
- [ ] Migrate feature definitions to database
- [ ] Update components to use new hook
- [ ] Test database flag changes
- [ ] Keep env vars and tier checks (backwards compatible)

### Phase 4: Admin Dashboard
- [ ] Create admin route `/admin/feature-flags`
- [ ] Add role-based access control
- [ ] Build flag management UI
- [ ] Add rollout percentage slider
- [ ] Add user allowlist management
- [ ] Add feature flag history/audit log

---

## Quick Reference

### Current (Option 1) - What You Have Now

**Control:**
- Edit `.env.local` or `.env.production`
- Restart server or redeploy

**Use in code:**
```typescript
import { FEATURE_FLAGS } from '@/lib/featureFlags';
{FEATURE_FLAGS.ASK_ANSWER && <Component />}
```

**Visibility:**
- Dev environment: See everything
- Production: Only enabled flags

---

### Future (Option 5) - When You Upgrade

**Control:**
- Admin dashboard (no code changes needed)
- Database updates (instant effect)
- A/B testing with rollout percentages
- Per-user beta access

**Use in code:**
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const canAccess = useFeatureFlag('ask_answer');
  return canAccess ? <AskAnswerUI /> : null;
}
```

**Visibility:**
- Development mode: See everything (Layer 1)
- Environment override: Manual control (Layer 2)
- User tier: Free/Pro/Dev/Admin (Layer 3)
- Database flags: Per-user/Per-tier (Layer 4)
- A/B testing: Percentage rollout (Layer 5)

---

## Estimated Time to Upgrade

- **Phase 2 (User Tiers):** ~2-4 hours
- **Phase 3 (Database Flags):** ~4-6 hours
- **Phase 4 (Admin Dashboard):** ~6-8 hours
- **Total:** ~12-18 hours of development

---

## When to Start Upgrading

**Start Phase 2 when:**
- You have paying customers (Pro tier exists)
- You want to monetize premium features
- You need to differentiate free vs paid features

**Start Phase 3 when:**
- You have 2+ developers with different access needs
- You need to enable features for specific beta testers
- You want emergency shutoff without redeployment
- You need A/B testing capabilities

**Start Phase 4 when:**
- Managing flags in code becomes tedious
- Non-technical people need to control flags
- You need audit logs of flag changes

---

## Notes

- **Backwards Compatible:** Each phase keeps previous functionality working
- **No Breaking Changes:** Existing code continues to work as you upgrade
- **Gradual Migration:** Can upgrade one feature at a time
- **Rollback Safe:** Can always fall back to environment variables

---

**Last Updated:** 2025-11-24
**Current Implementation:** Option 1 (Simple Environment Flags)
**File Location:** `src/lib/featureFlags.ts`
