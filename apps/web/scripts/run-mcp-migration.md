# Run MCP Credentials Database Migration

## Instructions

To run the database migration for encrypted MCP credentials:

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://hmuaidpblauzmhkotzob.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the contents of `database-migrations/006_add_encrypted_mcp_credentials.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify success message appears

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref hmuaidpblauzmhkotzob

# Run the migration
supabase db push database-migrations/006_add_encrypted_mcp_credentials.sql
```

### Option 3: Direct SQL Connection

If you have database credentials:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.hmuaidpblauzmhkotzob.supabase.co:5432/postgres" \
  -f database-migrations/006_add_encrypted_mcp_credentials.sql
```

## Verification

After running the migration, verify it was successful:

### Check Table Exists

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'mcp_server_credentials';
```

Expected result: 1 row showing `mcp_server_credentials`

### Check RLS Policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'mcp_server_credentials';
```

Expected result: 4 policies (SELECT, INSERT, UPDATE, DELETE)

### Check Columns

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mcp_server_credentials'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- user_id (uuid)
- server_id (character varying)
- server_name (character varying)
- server_type (character varying)
- encrypted_config (text)
- encryption_iv (text)
- enabled (boolean)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

## Troubleshooting

### Error: "relation already exists"
The table already exists. You can either:
- Skip the migration (already done)
- Drop the table first: `DROP TABLE IF EXISTS mcp_server_credentials CASCADE;`

### Error: "permission denied"
Make sure you're using the service role key or are logged in as the database owner.

### Error: "schema auth does not exist"
This shouldn't happen in Supabase. Make sure you're connected to the correct database.

## Next Steps

After successful migration:
1. ✅ Encryption key set in .env.local
2. ✅ Database schema created
3. ⏳ Run localStorage migration script (next step)
4. ⏳ Update frontend to use database API
5. ⏳ Test end-to-end

---

**Migration File**: `database-migrations/006_add_encrypted_mcp_credentials.sql`
**Created**: 2025-11-16
**Security Level**: AES-256-GCM encryption with RLS
