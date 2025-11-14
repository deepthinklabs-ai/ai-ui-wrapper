# Feature Toggles System Setup Guide

This guide explains how to set up and use the Feature Toggles system that allows users to customize which chatbot features are enabled.

## Database Setup

**IMPORTANT:** You need to run the database migration before users can use the feature toggles.

### Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Open the file: `database-migrations/004_add_user_feature_preferences.sql`
4. Copy all the SQL and paste it into the SQL Editor
5. Click "Run" to execute the migration

This will create:
- `user_feature_preferences` table to store user preferences
- Proper indexes for performance
- Row-level security policies
- Automatic `updated_at` trigger

### Step 2: Verify the Migration

Run this query to verify the table was created:

```sql
SELECT * FROM user_feature_preferences LIMIT 1;
```

## How It Works

### Architecture

The system is highly modular and consists of:

1. **Feature Definitions** (`src/types/features.ts`)
   - Central registry of all available features
   - Each feature has: ID, name, description, category, default state, icon
   - Easy to add new features

2. **Feature Toggle Hook** (`src/hooks/useFeatureToggles.ts`)
   - Manages loading/saving preferences from/to database
   - Provides `isFeatureEnabled()` to check feature state
   - Provides `toggleFeature()` to change feature state
   - Caches preferences for performance

3. **Settings UI** (`src/components/settings/FeatureToggles.tsx`)
   - Organized by category
   - Beautiful toggle switches
   - Reset to defaults button

### Available Features

Currently toggleable features:

**Message Actions:**
- Revert to Point
- Revert with Draft

**Thread Operations:**
- Fork Thread
- Summarize Thread
- Summarize & Continue

**Input Enhancements:**
- Voice Input
- File Attachments

**AI Controls:**
- Step-by-Step Mode
- Model Selection
- Context Window Indicator

**Advanced Features:**
- Context Panel
- Text Selection Actions
- Convert to Markdown
- Convert to JSON

## Adding a New Feature

### 1. Add Feature Definition

Edit `src/types/features.ts`:

```typescript
export type FeatureId =
  // ... existing features
  | 'my_new_feature';  // Add your feature ID

// Add to FEATURE_DEFINITIONS
export const FEATURE_DEFINITIONS: Record<FeatureId, FeatureDefinition> = {
  // ... existing features
  my_new_feature: {
    id: 'my_new_feature',
    name: 'My New Feature',
    description: 'Description of what this feature does',
    category: 'ai_controls',  // Choose appropriate category
    defaultEnabled: true,      // Default state
    icon: '✨',                // Optional emoji icon
  },
};
```

### 2. Use in Components

In any component, use the `useFeatureToggles` hook:

```typescript
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

function MyComponent({ userId }) {
  const { isFeatureEnabled } = useFeatureToggles(userId);

  return (
    <>
      {isFeatureEnabled('my_new_feature') && (
        <MyNewFeatureComponent />
      )}
    </>
  );
}
```

### 3. Example: Conditional Rendering

```typescript
// In MessageActions.tsx
const { isFeatureEnabled } = useFeatureToggles(userId);

// Show/hide based on feature toggle
{isFeatureEnabled('revert') && showRevert && (
  <RevertButton onClick={handleRevert} />
)}
```

## Usage in Dashboard

The system automatically integrates with the Settings page. Users can:

1. Go to Settings
2. Scroll to "Customize Features" section
3. Toggle any feature on/off
4. Changes save automatically
5. Click "Reset to Defaults" to restore default settings

## Performance Considerations

- Preferences are loaded once when the dashboard mounts
- Cached in React state for instant access
- Only updates database when user toggles a feature
- Uses Row Level Security for data protection

## Future Enhancements

Potential additions:
- Per-tier feature restrictions (some features only for Pro users)
- Feature usage analytics
- A/B testing framework
- Feature deprecation warnings
- Import/Export feature profiles
- Shareable feature presets
