# Database Migrations

This directory contains SQL migration files for setting up database tables and policies.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of the migration file
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

Or to run a specific migration:

```bash
supabase migration up
```

## Migration Files

### `create_email_templates.sql`
Creates the `email_templates` table with:
- Table schema with all 11 template types
- RLS policies (owners only)
- Index for faster lookups

**Run this first** to fix the "Could not find the table 'public.email_templates'" error.
