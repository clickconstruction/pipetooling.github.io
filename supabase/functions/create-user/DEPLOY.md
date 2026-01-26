# Deploy Create User Function

This Edge Function allows devs to manually create users in the system.

## Prerequisites

1. **Service Role Key** - Required for admin operations (creating users in `auth.users`)
2. **Supabase CLI** (optional) - Or use the Dashboard method

## Step 1: Set Service Role Key Secret

The function needs `SUPABASE_SERVICE_ROLE_KEY` to perform admin operations:

1. Go to Supabase Dashboard → Settings → API
2. Copy your **Service Role Key** (starts with `eyJ...`, keep this secret!)
3. Go to Edge Functions → Secrets
4. Add secret (if not already set):
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Your service role key
   - Click **"Add Secret"**

**⚠️ WARNING**: The service role key has full admin access. Never expose it in client-side code!

## Step 2: Deploy the Function

### Option A: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **"Create a new function"**

3. **Set Function Name**
   - Name: `create-user`

4. **Copy the Code**
   - Open `supabase/functions/create-user/index.ts` from your project
   - Copy ALL the code
   - Paste it into the function editor in Supabase Dashboard

5. **Configure Function Settings**
   - **Verify JWT**: Set to **DISABLED** (unchecked)
     - The function does manual JWT validation, so gateway verification must be off

6. **Deploy**
   - Click **"Deploy"** button
   - Wait for deployment to complete (usually 10-30 seconds)

### Option B: Via Supabase CLI

From the project root directory:

```bash
cd /Users/robertdouglas/_SYNC/github/Click-Construction/pipetooling/pipetooling.github.io
supabase functions deploy create-user --no-verify-jwt
```

## Step 3: Verify Deployment

After deployment, you should see:
- Function listed in Edge Functions
- Status: Active/Deployed
- Verify JWT: Disabled

## Step 4: Test the Function

1. **Go to Settings page** in your app (as a dev user)
2. **Click "Manually add user"** button
3. **Fill in the form** with email, password, role, and optional name
4. **Submit** and verify the user is created

## Function Behavior

- **Authentication**: Only devs can create users
- **Email**: Must be unique, automatically lowercased
- **Password**: Set during creation, user can change later
- **Role**: Must be one of: `dev`, `master_technician`, `assistant`
- **Name**: Optional, can be set later
- **Email Confirmation**: Automatically confirmed for manually created users
