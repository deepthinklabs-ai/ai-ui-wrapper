# Canvas Feature Setup

## Database Migration Required

The Canvas feature requires database tables that don't exist yet. You need to run the migration to create them.

### Option 1: Run in Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `database-migrations/010_canvas_tables.sql`
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click **Run** to execute the migration

### Option 2: Use Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to project root
cd C:\dev\ai-ui-wrapper\apps\web

# Run the migration
supabase db push
```

### What the Migration Creates

The migration creates 9 tables:

1. **canvases** - Main canvas/workflow containers
2. **canvas_nodes** - Individual nodes (Genesis Bots, Training Sessions, etc.)
3. **canvas_edges** - Connections between nodes
4. **workflow_executions** - Runtime execution state
5. **boardroom_conversations** - Multi-bot discussions
6. **boardroom_messages** - Individual discussion messages
7. **training_session_executions** - Training session state
8. **training_interactions** - Training conversation history
9. **canvas_templates** - Pre-built templates

All tables include:
- Row Level Security (RLS) policies
- Proper foreign key constraints
- Indexes for performance
- User-based access control

### Verify Migration Success

After running the migration:

1. Refresh the Canvas page: http://localhost:3001/canvas
2. You should see the "Create Your First Canvas" button
3. Click it to create a canvas and test the feature

### Troubleshooting

**Error: "relation canvases does not exist"**
- The migration hasn't been run yet
- Run the SQL migration as described above

**Error: "permission denied"**
- Check that your Supabase user has the correct permissions
- Verify you're running the migration with an admin/service role

**Still seeing errors?**
- Check the browser console for detailed error messages
- Verify your `.env.local` file has correct Supabase credentials:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  ```
