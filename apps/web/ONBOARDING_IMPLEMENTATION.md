# Onboarding Flow Implementation

## Overview
Complete onboarding experience for new users that guides them through plan selection and setup.

## Files Created

### 1. Database Migration
**File**: `database-migrations/003_add_onboarding_completed.sql`
- Adds `onboarding_completed` boolean column to `user_profiles` table
- Sets existing users to `true` (already using the app)
- Creates index for faster lookups

### 2. Onboarding Detection Hook
**File**: `src/hooks/useOnboardingStatus.ts`
- Checks if user has completed onboarding
- Returns `needsOnboarding`, `loading`, and `markOnboardingComplete` function
- Reads from `user_profiles.onboarding_completed` column

### 3. Plan Selection Component
**File**: `src/components/onboarding/PlanSelection.tsx`
- Beautiful side-by-side comparison of Free and Pro plans
- Shows features, limits, and pricing for each tier
- **Free Plan Features**:
  - Up to 5 threads
  - Bring your own API keys
  - Access to all models
  - All features included
- **Pro Plan Features**:
  - Unlimited threads
  - API access included (no need for own keys)
  - Priority support
  - All features included

### 4. Onboarding Flow Orchestrator
**File**: `src/components/onboarding/OnboardingFlow.tsx`
- Manages the onboarding process
- **Free Plan Flow**:
  1. Mark onboarding as complete
  2. Redirect to `/settings?onboarding=true` to add API keys
- **Pro Plan Flow**:
  1. Mark onboarding as complete
  2. Redirect to Stripe checkout

### 5. Dashboard Integration
**File**: `src/app/dashboard/page.tsx` (updated)
- Added `useOnboardingStatus` hook
- Shows `OnboardingFlow` component if `needsOnboarding === true`
- Shows normal dashboard if onboarding is complete

## User Flow

### New User Signs Up
1. User creates account on auth page
2. Redirected to dashboard
3. `useOnboardingStatus` detects `onboarding_completed = false`
4. Shows full-screen `PlanSelection` component

### User Selects Free Plan
1. Clicks "Start with Free Plan"
2. `onboarding_completed` set to `true` in database
3. Redirected to `/settings?onboarding=true`
4. Prompted to add OpenAI or Claude API keys
5. After adding keys, can navigate back to dashboard and start chatting

### User Selects Pro Plan
1. Clicks "Upgrade to Pro"
2. `onboarding_completed` set to `true` in database
3. Redirected to Stripe checkout
4. After successful payment:
   - Webhook updates `user_profiles` to Pro tier
   - User can navigate to dashboard
   - All models available immediately (no API keys needed)

## Database Setup

Run the migration:
```sql
-- In Supabase SQL Editor or your database tool
-- Run: database-migrations/003_add_onboarding_completed.sql
```

## Environment Variables

Make sure these are set in `.env.local`:
- `NEXT_PUBLIC_STRIPE_PRICE_ID` - Your Stripe Price ID for Pro plan

## Testing

### Test New User Onboarding
1. Create a new user account
2. Should see plan selection screen
3. Select Free or Pro and verify flow

### Reset Onboarding for Testing
```sql
UPDATE user_profiles
SET onboarding_completed = FALSE
WHERE user_id = 'your-user-id';
```

### Mark Existing Users as Onboarded
```sql
UPDATE user_profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;
```

## Future Enhancements

Potential improvements:
- Add welcome video or tutorial on plan selection page
- Track which plan was selected during onboarding
- Add tooltips explaining each feature
- A/B test different pricing displays
- Add testimonials or social proof
- Multi-step onboarding with personalization questions
