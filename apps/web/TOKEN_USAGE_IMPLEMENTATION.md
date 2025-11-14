# Token Usage Implementation

## Overview
This implementation captures actual token usage data from OpenAI and Anthropic APIs and uses it for accurate context window tracking.

## Features Implemented

### 1. **API Response Handling**
- **OpenAI API**: Captures `prompt_tokens`, `completion_tokens`, and `total_tokens` from the `usage` field in API responses
- **Anthropic API**: Captures `input_tokens` and `output_tokens` from the `usage` field, calculates `total_tokens`

### 2. **Database Storage**
Added three new columns to the `messages` table:
- `input_tokens` (INTEGER): Tokens in the input/prompt
- `output_tokens` (INTEGER): Tokens in the output/completion
- `total_tokens` (INTEGER): Total tokens (input + output)

**Note**: These fields are `NULL` for user messages and populated only for assistant responses.

### 3. **Updated Components**

#### API Clients
- **src/lib/clientOpenAI.ts**: Returns `ChatResponse` with token usage
- **src/lib/clientClaude.ts**: Returns `ClaudeResponse` with token usage
- **src/app/api/claude/route.ts**: Extracts and returns token usage from Anthropic API
- **src/lib/unifiedAIClient.ts**: Returns `UnifiedChatResponse` normalizing both providers

#### Data Storage
- **src/hooks/useMessages.ts**: Stores token usage when inserting assistant messages
- **src/types/chat.ts**: Updated `Message` type with token fields

#### Token Tracking
- **src/hooks/useContextWindow.ts**:
  - Uses actual token counts from API when available
  - Falls back to estimation for user messages
  - Provides accurate context window usage

#### Supporting Utilities
All AI client usages updated to handle the new response format:
- `src/lib/titleGenerator.ts`
- `src/lib/contextChatClient.ts`
- `src/hooks/useTextConversion.ts`

## Database Migration

To add the token columns to your Supabase database, run the SQL migration:

```bash
# In Supabase SQL Editor, run:
cat database-migrations/add-token-usage-columns.sql
```

Or manually execute:

```sql
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
```

## How It Works

### For New Messages (After Migration)
1. User sends a message
2. API responds with token usage data
3. Token counts are stored in the database
4. Context window indicator shows accurate usage based on actual tokens

### For Existing Messages (Before Migration)
- Columns will be NULL
- System falls back to estimation (previous behavior)
- Maintains backward compatibility

### Context Window Calculation
```typescript
// For each message:
if (message.role === 'assistant' && message.total_tokens) {
  // Use actual tokens from API
  totalTokens += message.total_tokens;
} else {
  // Estimate tokens for user messages
  totalTokens += calculateMessageTokens(message.content, message.attachments);
}
```

## Benefits

1. **Accuracy**: Real token counts from API providers instead of estimates
2. **Cost Tracking**: Can track actual API usage costs
3. **Better Context Management**: More accurate warnings for context window limits
4. **Analytics**: Can analyze token usage patterns across conversations
5. **Backward Compatible**: Works with existing messages (uses estimation as fallback)

## Token Usage by Provider

### OpenAI
- Returns: `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`
- Mapped to: `input_tokens`, `output_tokens`, `total_tokens`

### Anthropic (Claude)
- Returns: `usage.input_tokens`, `usage.output_tokens`
- Mapped to: `input_tokens`, `output_tokens`, `total_tokens` (calculated)

## Future Enhancements

Possible additions:
- Cost calculator (tokens × model pricing)
- Usage analytics dashboard
- Per-thread token usage totals
- Budget alerts and limits
- Token usage trends over time

## Testing

After running the migration:
1. Send a new message in any thread
2. Check the browser console for Claude API responses - you should see token usage logs
3. The context window indicator will now show accurate token counts
4. Query the database to verify token columns are populated:
   ```sql
   SELECT id, role, total_tokens, created_at
   FROM messages
   WHERE role = 'assistant'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
