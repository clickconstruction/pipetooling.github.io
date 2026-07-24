# Edge Functions API Reference

---
file: EDGE_FUNCTIONS.md
type: API Reference
purpose: Complete API documentation for all 58 Supabase Edge Functions
audience: Developers, DevOps, AI Agents
last_updated: 2026-07-24
estimated_read_time: 20-25 minutes
difficulty: Intermediate

runtime: "Deno (TypeScript)"
authentication: "In-function JWT / signature / cron-secret validation for most functions (see Overview for the two gateway-verified exceptions)"
total_functions: 58

key_sections:
  - name: "Functions"
    anchor: "#functions"
    description: "Per-function reference (all 58), user admin through Stripe/Mercury"
  - name: "create-user"
    anchor: "#create-user"
    description: "Create users with roles (dev-only)"
  - name: "archive-user"
    anchor: "#archive-user"
    description: "Archive users by email/name (dev-only)"
  - name: "login-as-user"
    anchor: "#login-as-user"
    description: "Generate magic link for impersonation"
  - name: "send-workflow-notification"
    anchor: "#send-workflow-notification"
    description: "Send email notifications via Resend"
  - name: "stripe-webhook"
    anchor: "#stripe-webhook"
    description: "Stripe invoice lifecycle webhook"
  - name: "mercury-webhook"
    anchor: "#mercury-webhook"
    description: "Mercury transaction webhook"
  - name: "Error Handling"
    anchor: "#error-handling"
    description: "Standard error responses"
  - name: "Deployment"
    anchor: "#deployment"
    description: "Deploy and test procedures + required secrets"

quick_navigation:
  - "[All Functions](#functions) - Complete function list"
  - "[Error Responses](#error-handling) - Error format and codes"
  - "[Deployment Guide](#deployment) - How to deploy"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Architecture context"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role requirements"
  - "EMAIL_TEMPLATES_SETUP.md - Email config"

prerequisites:
  - Understanding of Supabase Edge Functions
  - Familiarity with Deno runtime
  - Knowledge of JWT authentication

required_secrets:
  - "SUPABASE_URL"
  - "SUPABASE_ANON_KEY"
  - "SUPABASE_SERVICE_ROLE_KEY"
  - "RESEND_API_KEY (for email functions)"
  - "DEV_PROMOTION_CODE (for claim-dev)"
  - "…plus push/cron/Mercury/Stripe/maps secrets — full annotated list in Deployment → Required Secrets"

when_to_read:
  - Calling edge functions from frontend
  - Adding new edge functions
  - Debugging function errors
  - Understanding authentication flow
  - Deploying functions
---

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Functions](#functions)
   - [create-user](#create-user)
   - [invite-user](#invite-user)
   - [send-sign-in-email](#send-sign-in-email)
   - [merge-users](#merge-users)
   - [notify-help-feedback](#notify-help-feedback)
   - [gsa-per-diem](#gsa-per-diem)
   - [archive-user](#archive-user)
   - [restore-user](#restore-user)
   - [login-as-user](#login-as-user)
   - [dev-login](#dev-login)
   - [send-workflow-notification](#send-workflow-notification)
   - [get-estimate-for-customer](#get-estimate-for-customer)
   - [get-estimate-public-terms](#get-estimate-public-terms)
   - [accept-estimate](#accept-estimate)
   - [send-estimate-to-customer](#send-estimate-to-customer)
   - [get-contract-for-signer](#get-contract-for-signer)
   - [accept-contract](#accept-contract)
   - [send-contract-for-signature](#send-contract-for-signature)
   - [get-contract-signing-link-for-self](#get-contract-signing-link-for-self)
   - [check-estimate-attachment-url](#check-estimate-attachment-url)
   - [resolve-ip-geolocation](#resolve-ip-geolocation)
   - [street-view-preview](#street-view-preview)
   - [geocode-address-batch](#geocode-address-batch)
   - [geocode-one](#geocode-one)
   - [travel-time-batch](#travel-time-batch)
   - [send-bid-pricing-package](#send-bid-pricing-package)
   - [send-checklist-notification](#send-checklist-notification)
   - [send-report-notification](#send-report-notification)
   - [send-report-email](#send-report-email)
   - [notify-dispatch-request](#notify-dispatch-request)
   - [notify-estimator-request](#notify-estimator-request)
   - [notify-team-lead-clock](#notify-team-lead-clock)
   - [send-scheduled-reminders](#send-scheduled-reminders)
   - [recurring-job-report-preview](#recurring-job-report-preview)
   - [recurring-job-report-test-send](#recurring-job-report-test-send)
   - [recurring-job-report-dispatch](#recurring-job-report-dispatch)
   - [schedule-day-email-dispatch](#schedule-day-email-dispatch)
   - [schedule-share-dispatch](#schedule-share-dispatch)
   - [paid-job-email](#paid-job-email)
   - [sync-salary-sessions](#sync-salary-sessions)
   - [set-user-password](#set-user-password)
   - [claim-dev](#claim-dev)
   - [test-email](#test-email)
   - [create-stripe-invoice](#create-stripe-invoice)
   - [send-physical-invoice-email](#send-physical-invoice-email)
   - [send-hazmat-notice-email](#send-hazmat-notice-email)
   - [send-stripe-invoice](#send-stripe-invoice)
   - [update-collect-payment-stripe-customer-email](#update-collect-payment-stripe-customer-email)
   - [get-stripe-invoice-details](#get-stripe-invoice-details)
   - [record-stripe-invoice-out-of-band-payment](#record-stripe-invoice-out-of-band-payment)
   - [reverse-stripe-invoice-out-of-band-payment](#reverse-stripe-invoice-out-of-band-payment)
   - [stripe-invoice-agreed-write-down](#stripe-invoice-agreed-write-down)
   - [preview-stripe-invoice](#preview-stripe-invoice)
   - [void-stripe-invoice-for-revert](#void-stripe-invoice-for-revert)
   - [stripe-webhook](#stripe-webhook)
   - [sync-mercury-transactions](#sync-mercury-transactions)
   - [mercury-webhook](#mercury-webhook)
   - [get-mercury-account-balances](#get-mercury-account-balances)
   - [mercury-reconcile](#mercury-reconcile)
   - [import-manual-transactions](#import-manual-transactions)
   - [manage-manual-account](#manage-manual-account)
4. [Error Handling](#error-handling)
5. [Deployment](#deployment)

---

## Overview

PipeTooling uses Supabase Edge Functions (Deno runtime) for privileged server-side operations that require elevated permissions or external API access. Nearly all functions validate the caller inside the handler — a user JWT (`auth.getUser` + role check), a webhook signature (`stripe-webhook`, `mercury-webhook`), or a cron secret (`X-Cron-Secret`) — with gateway verification disabled via a `[functions.<name>] verify_jwt = false` block in [`supabase/config.toml`](../supabase/config.toml). **Two exceptions**: `merge-users` and `schedule-share-dispatch` have no `[functions.*]` block, so the gateway default (`verify_jwt = true`) applies to them per repo config.

**Field collect payment (Stripe):** The app uses **hosted Stripe invoices** and **`stripe-webhook`** (**`invoice.paid`**) with **`complete_job_collect_payment_flow_for_invoice`** — not physical Stripe Terminal readers. **`update-collect-payment-stripe-customer-email`** lets subcontractors correct payer email before **`send-stripe-invoice`**. Older **`terminal-connection-token`** / **`create-terminal-collect-payment-intent`** functions are **not** in the repo (see **`RECENT_FEATURES.md`** v2.344).

### Key Characteristics
- **Runtime**: Deno (TypeScript)
- **Authentication**: Manual JWT validation from `Authorization` header
- **CORS**: Enabled for all origins
- **Service Role Key**: Required for admin operations
- **Error Format**: Consistent JSON error responses

---

## Authentication

### Authorization Header

All Edge Functions require an `Authorization` header with a valid JWT token:

```typescript
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control

Each function checks the caller's role from the `public.users` table:
- **dev**: Full admin access (create users, delete users, set passwords)
- **master_technician**: Limited admin access (login as other users)
- **assistant, subcontractor, estimator**: No privileged access

### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized - No authorization header"
}
```

**403 Forbidden**:
```json
{
  "error": "Forbidden - Only devs can create users"
}
```

---

## Functions

### create-user

**Purpose**: Create new users with specified roles (dev-only operation)

**Endpoint**: `POST /functions/v1/create-user`

**Required Role**: `dev`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface CreateUserRequest {
  email: string      // User's email address
  password: string   // Initial password (min 6 characters)
  role: string       // User role
  name?: string      // Optional display name
}
```

**Valid Roles**:
- `'dev'`
- `'master_technician'`
- `'assistant'`
- `'subcontractor'`
- `'helpers'`
- `'estimator'`
- `'primary'`
- `'superintendent'`

#### Example Request

```typescript
const response = await supabase.functions.invoke('create-user', {
  body: {
    email: 'newuser@example.com',
    password: 'securePassword123',
    role: 'assistant',
    name: 'John Doe'
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "newuser@example.com",
    "name": "John Doe",
    "role": "assistant"
  },
  "message": "User created successfully"
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: email, password, and role"
}
```

**400 Bad Request** - Invalid role:
```json
{
  "error": "Invalid role. Must be one of: dev, master_technician, assistant, subcontractor, helpers, estimator, primary, superintendent, controller"
}
```

**409 Conflict** - User exists:
```json
{
  "error": "User with email newuser@example.com already exists"
}
```

**500 Internal Server Error** - Service role key missing:
```json
{
  "error": "SUPABASE_SERVICE_ROLE_KEY not configured"
}
```

#### Implementation Details

1. Validates caller is `dev` role
2. Checks for existing user with same email
3. Creates auth user with `supabase.auth.admin.createUser()`
4. Sets email as confirmed
5. Stores role in `user_metadata` (triggers `handle_new_user()`)
6. Creates corresponding `public.users` record
7. Returns user details

**Deployment**: See [`supabase/functions/create-user/DEPLOY.md`](../supabase/functions/create-user/DEPLOY.md)

---

### invite-user

**Purpose**: Create a user and email them an invite link to set their own password (dev-only). The email is sent through **Resend** using the editable Settings **invitation** email template (`email_templates` where `template_type = 'invitation'`, `{{name}}` / `{{role}}` / `{{link}}` placeholders); if the template row was never saved, the function falls back to the same defaults Settings seeds.

**Endpoint**: `POST /functions/v1/invite-user`

**Required Role**: `dev`

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

**Called from**: Settings → People & Accounts → "Invite via email" ([`Settings.tsx`](../src/pages/Settings.tsx) `handleInvite`) and People → Users → invite roster entry ([`People.tsx`](../src/pages/People.tsx) `inviteAsUser`).

#### Request Parameters

```typescript
interface InviteUserRequest {
  email: string             // Invitee's email address
  role: string              // One of the 8 modern roles (same list as create-user)
  name?: string             // Optional display name
  redirectTo?: string       // Where the invite link lands; must match https://pipetooling.com/*
                            // or http://localhost:5173|5175/*; defaults to
                            // https://pipetooling.com/accept-invite
  service_type_ids?: string[] // Optional restriction for estimator/subcontractor/helpers/superintendent
}
```

#### Flow

1. Validates caller is `dev`; validates role and any `service_type_ids`.
2. Duplicate check on `public.users.email`. A **pending invite** (auth user with `email_confirmed_at` and `last_sign_in_at` both null) is deleted and replaced — re-inviting the same address issues a fresh link ("resend invite"). Anyone else → 400 `User with this email already exists`.
3. `auth.admin.generateLink({ type: 'invite' })` creates the auth user and returns the action link **without** sending Supabase SMTP mail. The `handle_new_user` trigger reads `invited_role` from user metadata; the function also upserts `public.users` explicitly with role, name, and service-type restriction.
4. Renders the invitation template and sends via the shared [`sendEmailViaResend`](../supabase/functions/_shared/resendSendEmail.ts) helper (from `PipeTooling <team@noreply.pipetooling.com>`).
5. **If the Resend send fails, the auth user is deleted** (FK cascade removes `public.users`) and a 500 is returned — a failed invite leaves nothing behind, so retrying is always safe. The action link is never returned in the response.

#### Accepting the invite

The emailed link verifies through Supabase Auth and redirects to **`/accept-invite`** ([`AcceptInvite.tsx`](../src/pages/AcceptInvite.tsx)), where the invitee sets a password (`supabase.auth.updateUser`) and lands in the app already signed in. Expired/used links surface "invalid or expired — ask a dev to resend the invite"; re-inviting from Settings issues a fresh link. The redirect target must be covered by the Supabase Auth redirect allowlist (`https://pipetooling.com/**` — already configured).

#### Success Response

```json
{ "success": true, "message": "Invite sent to newuser@example.com" }
```

**Gateway JWT**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml) (function validates the JWT itself).

**Deploy**: `supabase functions deploy invite-user --no-verify-jwt`

---

### send-sign-in-email

**Purpose**: Email an existing user a magic sign-in link (dev-only). Replaces the old client-side `signInWithOtp` call, which depended on Supabase Auth SMTP; this sends through **Resend** using the editable Settings **Sign-In** email template (`email_templates` where `template_type = 'sign_in'`, `{{name}}` / `{{email}}` / `{{link}}` placeholders; hardcoded fallback matches the Settings defaults).

**Endpoint**: `POST /functions/v1/send-sign-in-email`

**Required Role**: `dev`

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

**Called from**: Settings → People & Accounts → Active Accounts → "Send email to sign in" ([`Settings.tsx`](../src/pages/Settings.tsx) `sendSignInEmail`).

#### Request Parameters

```typescript
interface SendSignInEmailRequest {
  email: string        // Must belong to an existing public.users row (never creates users)
  redirectTo?: string  // Where the link lands; must match https://pipetooling.com/* or
                       // http://localhost:5173|5175/*; defaults to https://pipetooling.com/dashboard
}
```

#### Flow

1. Validates caller is `dev`; looks up the target in `public.users` → 400 `No account with this email` if missing.
2. `auth.admin.generateLink({ type: 'magiclink' })` — returns the link without sending Supabase SMTP mail; nothing is created, so there is no cleanup path.
3. Renders the `sign_in` template and sends via the shared [`sendEmailViaResend`](../supabase/functions/_shared/resendSendEmail.ts) helper. The link is never returned in the response.
4. Clicking the link verifies through Supabase Auth and lands with a `type=magiclink` hash; `AuthHandler` ([`App.tsx`](../src/App.tsx)) sets the session and reloads.

#### Success Response

```json
{ "success": true, "message": "Sign-in email sent to user@example.com" }
```

**Gateway JWT**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml) (function validates the JWT itself).

**Deploy**: `supabase functions deploy send-sign-in-email --no-verify-jwt`

---

### merge-users

**Purpose**: Merge one user account into another (dev-only). Calls the `merge_user_accounts` RPC (migration `20260712190000` + `191500` fix) to reassign every reference from the absorbed account to the survivor — explicit handling for unique/membership tables, org pair tables, labels, roster link, `estimates.accept_notify_user_ids`, plus a dynamic FK sweep and a zero-leftovers coverage assert — then bans the absorbed login via the service role. Rules (validated in the RPC): both accounts same role; absorbed must be **archived or never signed in**; when one account is live it must be the survivor. Absorbed account keeps its email (tombstone) and stays restorable-in-name only — merges cannot be undone.

**Endpoint**: `POST /functions/v1/merge-users`

**Required Role**: `dev`

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface MergeUsersRequest {
  survivor_user_id: string   // account to keep
  absorbed_user_id: string   // account to merge away
  dry_run?: boolean          // true = full merge executed + rolled back; returns per-table counts
}
```

#### Response

```typescript
{ success: true, dry_run: boolean, moved: Record<string, number>, warnings: string[] }
// or { error: string, code?: string } with 400/401/403/404/409/500
```

**Used by**: Active Accounts → **Merge users** dialog (Preview merge = `dry_run: true`, then Merge now). See `RECENT_FEATURES.md` v2.652; guide `merge-user-accounts.md`.

### notify-help-feedback

**Purpose**: Push + inbox notification to devs when a user submits feedback on a /help guide (`help_feedback` table, migration `20260709150000`).

**Endpoint**: `POST /functions/v1/notify-help-feedback` (invoked by the help feedback form). See `RECENT_FEATURES.md` v2.643.

### gsa-per-diem

**Purpose**: GSA per-diem lookup for the Bids → Labor Travel section: checks the `gsa_per_diem_cache (zip, year)` table, else calls `api.gsa.gov/travel/perdiem/v2/rates/zip/{zip}/year/{year}` with the **`GSA_API_KEY`** secret and returns `{ ok, meals_rate, hotel_rate, city, state }` (friendly `{ ok:false }` for non-CONUS ZIPs / missing key). `verify_jwt = false` with an in-handler JWT/role gate (dev/master_technician/assistant/estimator). See `RECENT_FEATURES.md` v2.589.

**Setup**: `supabase secrets set GSA_API_KEY=…` (free key from api.data.gov); until set, the lookup reports `unconfigured` and manual entry still works.

### archive-user

**Purpose**: Archive users by email or name (dev-only operation). Archived users are hidden across the app and cannot sign in, but can be restored later.

**Endpoint**: `POST /functions/v1/archive-user`

**Required Role**: `dev`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Authentication**: 
- `verify_jwt: false` - Function handles its own authentication internally
- Validates JWT token and checks user role = 'dev' in the function code

#### Request Parameters

```typescript
interface ArchiveUserRequest {
  email?: string                    // Find user by email
  name?: string                     // Find user by name (if email not provided)
  reassign_customers_to?: string    // Optional: UUID of master to reassign customers to before archival
}
```

**Notes**: 
- Must provide either `email` or `name` (email takes precedence if both provided)
- Archiving an **already-archived** account returns **409** with `"That user is already archived (May 21, 2026)."` (second lookup without the archived filter; a genuinely unknown user still returns 404 `User not found`)
- If `reassign_customers_to` is provided, all customers owned by the user will be reassigned to the specified master before archival
- The new master must be a `dev` or `master_technician` role
- Sets `archived_at` in `public.users` and `banned_until` in `auth.users` (user cannot sign in)

#### Example Request

```typescript
const response = await supabase.functions.invoke('archive-user', {
  body: { email: 'user@example.com' }
})

// With customer reassignment
const response = await supabase.functions.invoke('archive-user', {
  body: {
    email: 'oldmaster@example.com',
    reassign_customers_to: 'uuid-of-new-master'
  }
})
```

#### Success Response

```json
{
  "success": true,
  "message": "User user@example.com archived successfully",
  "customersReassigned": 0
}
```

---

### restore-user

**Purpose**: Restore an archived user (dev-only). Clears `archived_at` and `banned_until` so the user can sign in again.

**Endpoint**: `POST /functions/v1/restore-user`

**Required Role**: `dev`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface RestoreUserRequest {
  user_id: string    // UUID of the archived user to restore
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('restore-user', {
  body: { user_id: 'uuid-of-archived-user' }
})
```

#### Success Response

```json
{
  "success": true,
  "message": "User user@example.com restored"
}
```

---

### login-as-user

**Purpose**: Generate magic link for user impersonation (dev, master, and assistant access)

**Endpoint**: `POST /functions/v1/login-as-user`

**Required Role**: `dev`, `master_technician`, or `assistant`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface LoginAsUserRequest {
  email: string       // Target user's email
  redirectTo: string  // URL to redirect after login (e.g., https://yourapp.com/dashboard)
}
```

#### Example Request

```typescript
// Settings imitate: redirect to localhost for local dev
const response = await supabase.functions.invoke('login-as-user', {
  body: {
    email: 'target@example.com',
    redirectTo: 'http://localhost:5173/dashboard'
  }
})

// People → Users imitate (dev-only): redirect to production
const response = await supabase.functions.invoke('login-as-user', {
  body: {
    email: 'target@example.com',
    redirectTo: 'https://pipetooling.com/dashboard'
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "magic_link": "https://yourproject.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=...",
  "message": "Magic link generated successfully",
  "user": {
    "id": "uuid",
    "email": "target@example.com",
    "name": "Target User"
  }
}
```

#### Error Responses

**400 Bad Request** - Missing email:
```json
{
  "error": "Missing required field: email"
}
```

**400 Bad Request** - Invalid email:
```json
{
  "error": "Invalid email address"
}
```

**404 Not Found** - User not found:
```json
{
  "error": "User not found with email: target@example.com"
}
```

**500 Internal Server Error** - Service role key missing:
```json
{
  "error": "SUPABASE_SERVICE_ROLE_KEY not configured. This is required for generating magic links."
}
```

#### Implementation Details

1. Validates caller is `dev`, `master_technician`, or `assistant` role
2. Rejects if target user is a dev (no one can impersonate devs)
3. Rejects if caller is assistant and target is master (assistants cannot impersonate masters)
4. Validates email format
5. Finds target user in `public.users` table
6. Uses `supabase.auth.admin.generateLink()` to create magic link
7. Returns magic link URL for frontend to redirect to
8. Frontend workflow:
   - Stores original session in `localStorage` (key: `impersonation_original`) so it survives reloads
   - Redirects to magic link
   - `AuthHandler` component processes tokens
   - User impersonated successfully
   - **Exit UI**: [`Layout`](../src/components/Layout.tsx) shows mobile **Back**; on desktop a short **Back** control with **`title`/`aria-label`** carrying the full “stop impersonating …” phrase. [`Settings`](../src/pages/Settings.tsx) uses **Back to my Account** on mobile and the same desktop pattern. See **`RECENT_FEATURES.md`** v2.231 and **`PROJECT_DOCUMENTATION.md`** Impersonation flow.

**Use Cases**:
- Debugging user-specific issues
- Assisting users with their accounts
- Testing permissions and access control

**Production URL Configuration**: For imitate to work on production (e.g. pipetooling.com), configure Supabase Auth:
- **Authentication** → **URL Configuration**
- **Site URL**: Set to production URL (e.g. `https://pipetooling.com`)
- **Redirect URLs**: Add both `https://pipetooling.com/**` and `http://localhost:5173/**`. Settings imitate uses localhost; People → Users imitate (dev-only) uses pipetooling.com.

**Deployment**: See [`supabase/functions/login-as-user/DEPLOY.md`](../supabase/functions/login-as-user/DEPLOY.md)

---

### dev-login

**Purpose**: Sign in as any user by email when running in development mode. No existing auth required. Used for local testing (e.g. checklist, E2E) without credentials.

**Endpoint**: `POST /functions/v1/dev-login`

**Authentication**: `X-Dev-Login-Secret` header must match `DEV_LOGIN_SECRET` env var. No JWT required.

**Availability**: Only intended for local dev. Frontend route `/dev-login` renders only when `import.meta.env.DEV` is true; production builds redirect to sign-in.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEV_LOGIN_SECRET` - Shared secret (also set as `VITE_DEV_LOGIN_SECRET` in `.env.local` for frontend)

#### Request Parameters

```typescript
interface DevLoginRequest {
  email: string        // Target user's email
  redirectTo?: string  // URL to redirect after login (e.g., http://localhost:5175/dashboard)
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('dev-login', {
  body: {
    email: 'test@example.com',
    redirectTo: 'http://localhost:5175/dashboard'
  },
  headers: { 'X-Dev-Login-Secret': import.meta.env.VITE_DEV_LOGIN_SECRET }
})
```

#### Usage

1. Add to `.env.local`: `VITE_DEV_LOGIN_SECRET=your-secret`
2. Set Edge Function secret: `supabase secrets set DEV_LOGIN_SECRET=your-secret`
3. Open `http://localhost:5175/dev-login?as=test@example.com` or use the form at `/dev-login`

**Note**: The email must exist in `auth.users`. If `user@example.com` or `test@example.com` is not in your database, the Edge Function returns a non-2xx status. Use an existing user email (e.g. `robert@douglasmining.com` in your project) or create the user first via the create-user Edge Function.

#### Supabase Auth Config

`additional_redirect_urls` in `supabase/config.toml` must include `http://localhost:5175/**` (and optionally `http://localhost:5173/**`) for dev-login magic links to redirect back to localhost. Production: `https://pipetooling.com/**`; local dev: localhost URLs.

---

### send-workflow-notification

**Purpose**: Send workflow stage email notifications via Resend; optionally send Web Push when **`recipient_user_id`** and VAPID keys are set.

**Endpoint**: `POST /functions/v1/send-workflow-notification`

**Required Role**: Authenticated user (any role); JWT validated in the function via **`auth.getUser(token)`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional but required for push + **`notification_history`** insert when **`recipient_user_id`** is sent)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (optional, for push)

**Gateway JWT**: Repo [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`** for this function; deploy with **`supabase functions deploy send-workflow-notification --no-verify-jwt`** so the gateway does not return 401 before the function runs.

#### Request body (actual contract)

```typescript
interface SendWorkflowNotificationRequest {
  template_type: string
  step_id: string // real project step id when logging history; may be a placeholder when not inserting notification_history
  recipient_email: string
  recipient_name: string
  recipient_user_id?: string // if set, may send push and insert notification_history (requires valid step linkage for FKs)
  push_title?: string
  push_body?: string
  push_url?: string
  variables?: Record<string, string> // merged into template {{keys}}
}
```

**`template_type`** values used in production workflows (rows in **`email_templates`**):

- `stage_assigned_started`, `stage_assigned_complete`, `stage_assigned_reopened`
- `stage_me_started`, `stage_me_complete`, `stage_me_reopened`
- `stage_next_complete_or_approved`, `stage_prior_rejected`

#### Example Request

```typescript
const { data: { session } } = await supabase.auth.refreshSession()
if (!session?.access_token) throw new Error('Not signed in')

const { data, error } = await supabase.functions.invoke('send-workflow-notification', {
  headers: { Authorization: `Bearer ${session.access_token}` },
  body: {
    template_type: 'stage_assigned_started',
    step_id: step.id,
    recipient_email: 'worker@example.com',
    recipient_name: 'Jane Doe',
    recipient_user_id: userIdOptional,
    push_title: 'Optional title',
    push_body: 'Optional body',
    push_url: 'https://app.example/workflows/proj#step-uuid',
    variables: {
      name: 'Jane Doe',
      email: 'worker@example.com',
      project_name: 'Smith Residence',
      stage_name: 'Rough In',
      assigned_to_name: 'Jane Doe',
      workflow_link: 'https://app.example/workflows/proj#step-uuid',
      previous_stage_name: 'Prior stage',
      rejection_reason: 'Reason text',
    },
  },
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Notification sent successfully",
  "email_id": "resend_email_id",
  "push_sent": 0
}
```

#### Error Responses

**400** — Missing **`template_type`**, **`step_id`**, **`recipient_email`**, or **`recipient_name`**, or invalid email.

**401** — Missing/invalid JWT (function body validation).

**404** — No row in **`email_templates`** for **`template_type`**.

**500** — **`RESEND_API_KEY`** missing, Resend failure, or other server error.

#### Dev smoke test (Settings UI)

Devs: **Settings → Templates & testing → Workflow email (Edge Function)** (collapsible): one-shot invoke with placeholder data; omits **`recipient_user_id`** so **`notification_history`** is not written. See **`WORKFLOW_EMAIL_TESTING.md`** and **[`RECENT_FEATURES.md`](./RECENT_FEATURES.md)** v2.186.

#### Implementation Details

1. **`getUser(JWT)`** from **`Authorization`** header
2. Load **`subject`/`body`** from **`public.email_templates`** by **`template_type`**
3. Replace **`{{variable}}`** from **`variables`**
4. POST to Resend
5. Optional Web Push to **`push_subscriptions`** for **`recipient_user_id`**
6. Optional **`notification_history`** insert when **`recipient_user_id`** and service role resolve **`step_id`** → workflow/project

**See Also**:

- EMAIL_TEMPLATES_SETUP.md
- WORKFLOW_EMAIL_TESTING.md

**Deployment**: [`supabase/functions/send-workflow-notification/DEPLOY.md`](../supabase/functions/send-workflow-notification/DEPLOY.md)

---

### get-estimate-for-customer

**Purpose**: Public read of a **sent** estimate for the customer acceptance page (no JWT).

**Endpoint**: `GET /functions/v1/get-estimate-for-customer?token=<opaque>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**Behavior**: SHA-256 hash of `token`; load row by `public_token_hash` where `status = sent`; enforce `public_token_expires_at` and `valid_until`. Returns estimate fields plus **`customer_experience`**: public UI strings (accept, thank-you, document labels — omits email subject/body). Uses **`customer_experience_sent`** when set, else merges **`app_settings`** + **`customer_experience_overrides`**. If **`status = customer_accepted`**, responds **409** with `code: already_accepted` and **`customer_experience`** for the thank-you page.

**200 response**: Includes **`for_line`** (`string | null`): staff **For:** line — trimmed **`for_address`** if set, else trimmed linked **`customers.address`**, else `null` (UI may show em dash).

**Audit**: On each successful **200** for **`status = sent`**, calls Postgres **`record_estimate_public_link_view`** via **`service_role`** **`rpc`** to append **`estimate_customer_events`** with **`event_type = public_link_view`** and **`client_ip` / `user_agent`** from the request ( **`SECURITY DEFINER`** in-db insert; failures are **`console.error`**’d and do not change the response). See migration [`20260406034514_record_estimate_public_link_view_rpc.sql`](../supabase/migrations/20260406034514_record_estimate_public_link_view_rpc.sql). **Dedupe**: [`20260412184127_dedupe_record_estimate_public_link_view.sql`](../supabase/migrations/20260412184127_dedupe_record_estimate_public_link_view.sql) skips a second **`public_link_view`** for the same estimate, IP, and user-agent within **5 seconds** (Strict Mode double-fetch, etc.).

---

### get-estimate-public-terms

**Purpose**: Public read of dev-editable **global** Terms and Conditions body for **`/estimate/terms`** (no JWT). Anonymous users cannot SELECT `app_settings`; this function uses the service role.

**Endpoint**: `GET /functions/v1/get-estimate-public-terms`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**200 response**: `{ "body": string }` — plain text from **`app_settings`** key **`estimate_public_terms_body`** (empty string if missing).

**Example**:

```bash
curl -sS "${SUPABASE_URL}/functions/v1/get-estimate-public-terms" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

---

### accept-estimate

**Purpose**: Record Approach A acceptance (typed name + `agreedTerms: true`); sets `customer_accepted` and audit fields.

**Endpoint**: `POST /functions/v1/accept-estimate`

**Body**: `{ "token": string, "printedName": string, "agreedTerms": true }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional; staff notify skipped if missing)

**Gateway**: `verify_jwt = false`

**Behavior**: Idempotent if already `customer_accepted` (returns **`200`** + **`alreadyAccepted: true`**). Captures **`acceptor_ip`** from **`x-forwarded-for`** (first hop) and **`user-agent`** on the real **`sent` → `customer_accepted`** update.

**Staff email** (after successful **`sent` → `customer_accepted`**): recipients are the **union** of (a) **`estimates.accept_notify_user_ids`** — this estimate's own picks (nullable before first save; empty array = no per-estimate extras) — and (b) the org-wide **always-notify** list in **`app_settings`** key **`estimate_accepted_notify_recipients_v1`** (v2.991; JSON array of `users.id` in `value_text`, dev-write, edited via the ⚙ **Accepted notifications** on Estimates; a missing/malformed row parses to **`[]`**, so behavior matches pre-v2.991). The union is deduped, then calls **`estimate_accept_notify_filter_eligible_user_ids`** and emails each resolved **`users.email`** via Resend (same From as customer estimate mail). Link uses **`ESTIMATE_PUBLIC_ORIGIN`** (or fallback **https://pipetooling.github.io**) to **`/estimates/{estimate_number}`**. Failures are **`console.error`** only; HTTP **`200`** is still returned if the DB update succeeded.

**Draft app default (not Edge)**: When the column is **`NULL`**, [`Estimates.tsx`](../src/pages/Estimates.tsx) pre-selects the signed-in user and every **`master_technician`** on estimate detail load (Supabase **`users`** query; dedupe; on failure, self only)—until staff save the draft, which persists the array. **`[]`** remains explicitly no recipients.

**Audit**:
- **First acceptance** (**`sent` → `customer_accepted`**): the **`estimate_customer_events`** row (**`public_accept_submitted`**, IP/UA, **`metadata.had_signature`**) is written by the **database trigger** [`estimates_audit_customer_accepted_trigger`](../supabase/migrations/20260406033952_estimates_audit_customer_accepted_trigger.sql) in the **same transaction** as the **`estimates`** update (Edge does not insert that row on the success path).
- **`alreadyAccepted: true`** (repeat **POST** while already accepted): best-effort **`insertEstimateCustomerEvent`** via **`log_estimate_customer_event`** / insert fallback in [`_shared/logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts), with **`metadata.repeat_after_accepted`** (does not change **`200`** success).

**Related (Postgres, not Edge)**: Staff create **`jobs_ledger`** and set **`estimates.job_ledger_id`** via authenticated RPC **`create_job_from_estimate`** — see [`20260405072854_estimate_create_job_rpc.sql`](../supabase/migrations/20260405072854_estimate_create_job_rpc.sql) and [`Estimates.tsx`](../src/pages/Estimates.tsx).

---

### send-estimate-to-customer

**Purpose**: Verify JWT, ensure caller can read draft estimate, generate token hash, set `sent`, persist resolved **`customer_experience_sent`**, email Resend link to `{public_origin}/estimate/accept?t=…`.

**Endpoint**: `POST /functions/v1/send-estimate-to-customer`

**Body**: `{ "estimate_id": string, "customer_email": string, "public_origin"?: string }` (`public_origin` should be `window.location.origin` from the app.)

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional; returns `accept_url` if missing)

**Gateway**: `verify_jwt = false`; JWT validated with `auth.getUser` in function.

**Optional**: `ESTIMATE_PUBLIC_ORIGIN` if link base should not come from the client.

**Copy**: Subject and body come from **`resolveEstimateCustomerExperience`** (`supabase/functions/_shared/estimateCustomerExperience.ts`, keep in sync with `src/lib/estimateCustomerExperience.ts`) using **`app_settings`** + row **`customer_experience_overrides`** and template vars **`{{accept_url}}`**, **`{{title}}`**, **`{{estimate_number}}`**. The same resolved object is stored as **`customer_experience_sent`** on **`sent`**. Staff previews use the client module.

---

### get-contract-for-signer

**Purpose**: Public read of a **sent** person contract document for the signing page (no JWT).

**Endpoint**: `GET /functions/v1/get-contract-for-signer?token=<opaque>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**Behavior**: SHA-256 hash of `token`; load row by **`public_token_hash`** where **`status = sent`**; enforce **`public_token_expires_at`**. Returns **`signing_body_html`**, **`canonical_document_url`** (canonical column, else legacy **`url`**), **`document_name`**, **`person_name`** (still used for staff/email context; the public signing page in [`ContractAccept.tsx`](../src/pages/ContractAccept.tsx) does **not** display **For:** **`person_name`**). If **`status = signed`**, responds **409** with **`code: already_signed`** and optional thank-you strings (the app thank-you may use title-only copy; see **`RECENT_FEATURES.md`** v2.368).

---

### accept-contract

**Purpose**: Record contract signature (typed or drawn PNG); sets **`status = signed`**, clears token, stores signature in **`contract-signer-signatures`** when drawn.

**Endpoint**: `POST /functions/v1/accept-contract`

**Body**: `{ "token": string, "printedName": string, "signaturePngBase64"?: string, "agreedTerms": true }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`

**Behavior**: Same PNG validation/size limits as **`accept-estimate`**. Idempotent if already **`signed`** (**`200`** + **`alreadySigned: true`**). Captures IP from **`x-forwarded-for`** (first hop) and **`user-agent`**.

---

### send-contract-for-signature

**Purpose**: Verify JWT, ensure caller can read the **`person_contract_documents`** row, require at least one of **`signing_body_html`**, **`canonical_document_url`**, or **`url`**, mint token, set **`status = sent`**, email Resend link to **`{public_origin}/contract/accept?t=…`**.

**Endpoint**: `POST /functions/v1/send-contract-for-signature`

**Body**: `{ "person_contract_document_id": string, "signer_email": string, "public_origin"?: string, "email_subject"?: string, "email_intro_plain"?: string }`

- **`email_subject`** (optional): Plain-text subject after trim; max **200** characters (server clamps). If empty, default is **`Sign contract: {document_name} ({person_name})`**.
- **`email_intro_plain`** (optional): Opening message only (plain text; control characters stripped; max **4000** characters, server clamps). If empty, default first line is **`Please review and sign your contract.`** The email always includes the **document name**, **person name**, and **signing link** after the intro (HTML intro is escaped; newlines / blank lines become paragraphs or `<br>`).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional)

**Gateway**: `verify_jwt = false`; JWT validated with **`auth.getUser`** in function.

**Optional**: `ESTIMATE_PUBLIC_ORIGIN` if link base should not come from the client.

---

### get-contract-signing-link-for-self

**Purpose**: Authenticated signer (not staff) mints a fresh **`/contract/accept?t=…`** link for their own **`person_contract_documents`** row when **`dashboard_prompt_after_clock_in`** is true. Does **not** send email. Same token rotation semantics as **`send-contract-for-signature`** (invalidates any prior emailed link for that row).

**Endpoint**: `POST /functions/v1/get-contract-signing-link-for-self`

**Body**: `{ "person_contract_document_id": string, "public_origin"?: string }`

**Identity**: Caller must match roster + auth the same way as **`list_my_contract_dashboard_prompts`** ( **`users.name`** equals **`person_name`**, or a non-archived **`people`** row with the same **`person_name`** and **`email`** as **`users.email`**).

**Success** (**200** JSON): `{ "ok": true, "accept_url": string }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`; JWT validated with **`auth.getUser`** in function.

**Optional**: `ESTIMATE_PUBLIC_ORIGIN` for link base.

**Implementation**: [`supabase/functions/get-contract-signing-link-for-self/index.ts`](../supabase/functions/get-contract-signing-link-for-self/index.ts)

---

### check-estimate-attachment-url

**Purpose**: Authenticated **heuristic** probe for a pasted **Google Drive** or **Google Docs** HTTPS URL (draft “supporting document” field). Classifies responses as **`likely_public`**, **`likely_ok_html`** (2xx HTML without restricted markers — e.g. typical viewer), **`likely_restricted`**, or **`unknown`** for staff guidance only; **does not** enforce access or block sending estimates.

**Endpoint**: `POST /functions/v1/check-estimate-attachment-url`

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`

**Body**: `{ "url": string }` (must normalize to HTTPS per shared **`normalizeCustomerAttachmentUrl`**; hostname must be **`drive.google.com`**, **`docs.google.com`**, or **`*.drive.google.com`**)

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

**Gateway**: `verify_jwt = false`; JWT validated with **`auth.getUser`** in the function (same pattern as **`send-estimate-to-customer`**).

**Success** (**200** JSON): `{ "ok": true, "result": "likely_public" | "likely_ok_html" | "likely_restricted" | "unknown", "message"?: string, "httpStatus"?: number }`

**Client errors**: **400** invalid URL or non‑Drive/Docs host; **401** missing/invalid session.

**Note**: Results are **best-effort** (HTML viewer pages, Workspace policies, timeouts). Staff should still verify in a private/incognito window when unsure.

**Implementation**: [`supabase/functions/check-estimate-attachment-url/index.ts`](../supabase/functions/check-estimate-attachment-url/index.ts); UI: draft **Check link** in [`Estimates.tsx`](../src/pages/Estimates.tsx); **Documents** add-link modal via [`checkGoogleDriveAttachmentUrl`](../src/lib/checkGoogleDriveAttachmentUrl.ts) ([`DocumentsAddDriveLinkModal.tsx`](../src/components/documents/DocumentsAddDriveLinkModal.tsx)).

---

### resolve-ip-geolocation

**Purpose**: Resolve a **public** IPv4/IPv6 address to approximate **lat/lng** (via **ipinfo.io**) so staff can open **Google Maps**. Used from **Estimates** customer activity and acceptance IP lines ([`IpAddressMapButton`](../src/components/estimates/IpAddressMapButton.tsx)).

**Endpoint**: `GET /functions/v1/resolve-ip-geolocation?ip=<address>` — **`ip` optional**. If **`ip` is omitted or empty**, the function uses the caller’s public IP from proxy headers (`x-forwarded-for` first hop, then `cf-connecting-ip`, then `x-real-ip`) for the same ipinfo lookup (used for **clock in/out** geo-IP fallback when GPS is unavailable).

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>` (same pattern as other staff `fetch` calls to Edge).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`IPINFO_TOKEN`** (ipinfo.io API token). If **`IPINFO_TOKEN`** is unset, returns **503** `Geolocation not configured`.

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** with the Bearer on the Supabase client.

**Validation**: Private/link-local/loopback/CGNAT IPv4 and common non-global IPv6 prefixes return **400** without calling ipinfo. If **`ip` is omitted** and no client IP can be read from headers, returns **400** `Could not determine client IP`.

**Success** (**200** JSON): `{ "lat": number, "lng": number, "label": string | null }` (`label` may combine city/region when present).

**Errors**: **401** if not signed in; **404** if provider has no `loc`; **502** if provider HTTP error or invalid coordinates.

**Note**: Geo-IP is **approximate** (often city/ISP). Respect ipinfo rate limits; the client caches results per IP in **`sessionStorage`** for 24 hours.

---

### street-view-preview

**Purpose**: **Proxy** Google **Street View Static** imagery and **metadata** so the Maps API key stays server-side. Used by **[`DetailJobModal`](../src/components/jobs/DetailJobModal.tsx)** (Street View preview under **Address**); client loads the image with **`fetch` + `Authorization`** (not `<img src>`) and **`URL.createObjectURL`**.

**Endpoint**:

- **Metadata** (**200** JSON): `GET /functions/v1/street-view-preview?location=<address>&meta=1`
- **Image** (**200** binary): `GET /functions/v1/street-view-preview?location=<address>`

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>` (same as **`resolve-ip-geolocation`**).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`GOOGLE_MAPS_API_KEY`**. If the Google key is unset, returns **503** `Street View not configured`.

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** with the Bearer on the Supabase client.

**Validation**: **`location`** query required (trimmed); max length **500**; **400** if missing or too long.

**Success**:

- **`meta=1`**: **`200`** JSON (always **200** for a handled Google metadata response so the browser does not log **404** for normal no-imagery cases):
  - Imagery OK: `{ "ok": true, "lat": number, "lng": number }`
  - No imagery or Google **non-OK** status (e.g. **`ZERO_RESULTS`**, **`REQUEST_DENIED`**): `{ "ok": false, "googleStatus": string, "detail"?: string }`
- **Image**: **`Content-Type`** from Google (typically **`image/jpeg`**), body is the proxied image.

**Errors**: **401** not signed in; **502** upstream or unexpected content type for image path.

**Deploy**: `supabase functions deploy street-view-preview`

**Implementation**: [`supabase/functions/street-view-preview/index.ts`](../supabase/functions/street-view-preview/index.ts); client: [`src/lib/fetchStreetViewPreview.ts`](../src/lib/fetchStreetViewPreview.ts).

---

### geocode-address-batch

**Purpose**: Batch geocoding for the **Map** page (**`dev`**, **`master_technician`**, **`assistant`**, **`estimator`** only). Normalizes addresses, reads/writes **`public.address_geocodes`** via the user’s JWT (RLS), and for cache misses: **OpenStreetMap Nominatim** first, then **Google Geocoding API** if **`GOOGLE_MAPS_API_KEY`** is set and Nominatim does not return coordinates (rate-limited **~1.1s** between *Nominatim* request rounds server-side). There is **no** extra inter-address delay before the Google attempt in the same row.

**Endpoint**: `POST /functions/v1/geocode-address-batch`

**Body** (JSON): `{ "addresses": string[] }` — display strings (e.g. job street); max **20** per request.

**Response** (**200** JSON): `{ "results": { "address_normalized": string, "lat": number, "lng": number }[] }`

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional **`GOOGLE_MAPS_API_KEY`** (same as [`street-view-preview`](#street-view-preview); enable **Geocoding API** in Google Cloud; key stays on the server). If the key is unset, behavior matches **Nominatim-only** (rows Nominatim cannot resolve are omitted from `results`).

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role` in `('dev','master_technician','assistant','estimator')`** in the function (**403** otherwise).

**Errors**: **401** not signed in; **403** role not allowed for map geocoding; **400** bad body or too many addresses; **500** DB or upsert failure.

**Deploy**: `supabase functions deploy geocode-address-batch`

**Implementation**: [`supabase/functions/geocode-address-batch/index.ts`](../supabase/functions/geocode-address-batch/index.ts) + shared [`supabase/functions/_shared/googleGeocode.ts`](../supabase/functions/_shared/googleGeocode.ts). **Map** page primary load: [`useMapPageData.ts`](../src/hooks/useMapPageData.ts) invokes this in **chunks of up to 20** addresses per request for cache misses (see **geocode-one** for single-address / review flows).

---

### geocode-one

**Purpose**: Single-address geocoding for **`address_geocodes`** (**`dev`**, **`master_technician`**, **`assistant`**, **`estimator`** only): same cache and upsert as batch. **Map** bulk resolution uses **`geocode-address-batch`** from [`useMapPageData.ts`](../src/hooks/useMapPageData.ts). **`geocode-one`** covers **Review geocodes** **`refresh_google_only`**, **Settings** default map label lookup ([`mapDefaultViewSettings.ts`](../src/lib/mapDefaultViewSettings.ts)), and any caller that wants one row per request. For a normal (non **`refresh_google_only`**) miss: **Nominatim** first, then **Google** if **`GOOGLE_MAPS_API_KEY`** is set and Nominatim does not return usable coordinates.

**Endpoint**: `POST /functions/v1/geocode-one`

**Body** (JSON):

- Default: `{ "address": string }` — display string (trimmed, min length **3**).
- **Google refresh (Map review modal):** `{ "address": string, "refresh_google_only": true }` — **skips** the **`address_geocodes` cache and Nominatim**; calls **only** the Google Geocoding API, then **upserts**. Use when a pin is wrong or the address was edited in the app. Requires **`GOOGLE_MAPS_API_KEY`**; if missing, returns **`ok: false`** with **`error`**: **`google_unconfigured`**. On success, **`refreshed`: `true`** is included with **`source`: `"google"`**.

**Response** (**200** JSON):

- Success: `{ "ok": true, "address_normalized": string, "lat": number, "lng": number, "fromCache": boolean, "source": "cache" | "nominatim" | "google", "refreshed"?: true }` — when **`fromCache` is** `true`, **`source`** is **`cache`**; when coordinates were just written, **`source`** is **`nominatim`** or **`google`**. **`refreshed`** is set for **`refresh_google_only`** successes.
- Failure: `{ "ok": false, "address_normalized": string, "error": string, "detail"?: string }` — same **`error`** codes as above. When Google’s JSON includes **`error_message`**, a sanitized, length-capped copy is included as **`detail`** (API key–like substrings redacted) so the Map UI can show *why* **REQUEST_DENIED** / quota / etc. failed.
- Auth / validation errors: `{ "error": string }` with **401** / **403** / **400** as appropriate; **500** on DB/upsert failure.

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional **`GOOGLE_MAPS_API_KEY`** (enable **Geocoding API** in Google Cloud; same key as Street View is typical). If unset, Nominatim miss returns **`ok: false`** (e.g. **`not_found`**) as before.

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role` in `('dev','master_technician','assistant','estimator')`** in the function (**403** otherwise).

**Client pacing**: The **batch** function waits **~1.1s** between *rows* for Nominatim inside one request. **Map** callers that loop **`geocode-one`** (e.g. **`refresh_google_only`** with a short sleep between rows — [`MapGeocodeReviewModal.tsx`](../src/components/map/MapGeocodeReviewModal.tsx)) should avoid hammering Nominatim / Google; follow Google’s Maps Platform terms for your deployment.

**Deploy**: `supabase functions deploy geocode-one`

**Implementation**: [`supabase/functions/geocode-one/index.ts`](../supabase/functions/geocode-one/index.ts) + shared [`supabase/functions/_shared/googleGeocode.ts`](../supabase/functions/_shared/googleGeocode.ts); client: **`Map`** **`refresh_google_only`** [`MapGeocodeReviewModal.tsx`](../src/components/map/MapGeocodeReviewModal.tsx), [`invokeGeocodeOneRefreshGoogleOnly.ts`](../src/lib/map/invokeGeocodeOneRefreshGoogleOnly.ts); **Settings** default map label lookup [`mapDefaultViewSettings.ts`](../src/lib/mapDefaultViewSettings.ts) (bulk **Map** load uses **`geocode-address-batch`** via [`useMapPageData.ts`](../src/hooks/useMapPageData.ts)).

---

### travel-time-batch

**Purpose**: Routed drive times between a person's **consecutive scheduled jobs** for the Day-view travel hints (Option B). Reads/fills the **`public.job_travel_times`** cache (7-day TTL, service-role writes) and routes cache misses through the **Google Routes API** (`distanceMatrix/v2:computeRouteMatrix`, `travelMode: DRIVE`, diagonal pairs only). **Every failure path returns partial results** — the client keeps its straight-line (Option A) estimate for any pair missing from `results`, so an unset key / disabled API / quota exhaustion degrades to Option A and never breaks the page. Routing is opt-in per org via **Dispatch Settings → Travel time hints** (`app_settings.travel_hints_config_v1`).

**Endpoint**: `POST /functions/v1/travel-time-batch`

**Body** (JSON): `{ "pairs": { "fromJobId": string, "toJobId": string, "from": { "lat": number, "lng": number }, "to": { "lat": number, "lng": number } }[] }` — max **25** pairs; same-job and non-finite-coordinate pairs are dropped server-side.

**Response** (**200** JSON): `{ "results": { "fromJobId": string, "toJobId": string, "seconds": number, "meters": number, "source": string }[] }` — only pairs that resolved (cache hit or `ROUTE_EXISTS`); callers treat missing pairs as "use the straight-line fallback".

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (cache reads/writes), **`GOOGLE_MAPS_API_KEY`** (enable the **Routes API** in Google Cloud; without it the function serves cache hits only).

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role` in `('dev','master_technician','assistant','controller','superintendent','estimator')`** in the function (**403** otherwise).

**Errors**: **401** not signed in; **403** role not allowed; **400** bad JSON; routing/API failures are swallowed (partial `results`, never 5xx for them).

**Deploy**: `supabase functions deploy travel-time-batch --no-verify-jwt` — **after** `supabase db push` applies `20260720202447_job_travel_times.sql` (the function reads/upserts that table).

**Implementation**: [`supabase/functions/travel-time-batch/index.ts`](../supabase/functions/travel-time-batch/index.ts). Client: [`src/lib/routedTravelTimes.ts`](../src/lib/routedTravelTimes.ts) (invoked from the Day view when `useRouting` is on), merged over the straight-line kernel [`src/lib/jobTravelEstimate.ts`](../src/lib/jobTravelEstimate.ts).

---

### send-bid-pricing-package

**Purpose**: Resend-backed delivery of a bid's **external Pricing package** — Job Plans link (+ optional CountTooling plans link) and the 4-column external pricing table (Fixture/Tie-in, Count, Unit price, Revenue). The server **re-computes pricing rows from the database** (count rows + `bid_pricing_assignments` + `bid_count_row_custom_prices` + `bid_count_row_submission_hides` + `price_book_entries`) instead of trusting client-built HTML, so the email always matches the live Pricing tab. Subject/heading use the Bids-tab label shape `{prefix}{n} project name`.

**Endpoint**: `POST /functions/v1/send-bid-pricing-package`

**Authentication**: `verify_jwt = false`; in-handler JWT + role gate. Sender must be a non-archived `dev` / `master_technician` / `assistant` / `estimator`; the bid itself is read with the **user-scoped** client, so bids RLS must let the sender see it.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

#### Request Parameters

```typescript
{
  bid_id: string
  price_book_version_id: string
  recipient_user_id: string   // org user; must be non-archived with an email on file
}
```

#### Response

```typescript
{ ok: true, resend_id: string | null, row_count: number, revenue_total_cents: number }
// or { ok: false, error: string } with 400/401/403/404/405/500/502
```

#### Behavior

1. Role-gate the sender; load bid (user-scoped), recipient (service-role — no dependence on a wide-open `users` read policy), and price book version.
2. Derive per-row unit price/revenue (`unit_price_override` → entry `total_price` → custom price; `is_fixed_price` rows charge the unit price once) and drop hidden / zero-count rows; **400** when no visible fixtures remain.
3. Build HTML + plain-text bodies (kernels in [`_shared/bidPricingPackage.ts`](../supabase/functions/_shared/bidPricingPackage.ts)) and send via Resend.
4. Append an audit row to **`bid_pricing_package_sends`** with the service-role client (recipient, revenue total in cents, row count, `resend_id`); an audit-insert failure is logged but does not fail the send.

**Used by**: Bids → Pricing tab → **Package and send** modal ([`PackageAndSendBidPricingModal.tsx`](../src/components/bids/PackageAndSendBidPricingModal.tsx)).

---

### send-checklist-notification

**Purpose**: Send Web Push notifications for checklist events (completion, test)

**Endpoint**: `POST /functions/v1/send-checklist-notification`

**Required Role**: Authenticated user (any role)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY` - Web Push VAPID public key
- `VAPID_PRIVATE_KEY` - Web Push VAPID private key

**Verify JWT**: `false` (manual JWT validation in function body; matches other functions)

#### Request Parameters

```typescript
interface ChecklistNotificationRequest {
  recipient_user_id: string  // User to receive the push
  push_title: string         // Notification title
  push_body: string          // Notification body
  push_url?: string          // URL to open on click (default: /checklist)
  tag?: string               // Notification tag for grouping (default: checklist)
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('send-checklist-notification', {
  body: {
    recipient_user_id: authUser.id,
    push_title: 'Checklist completed',
    push_body: 'John completed: Weekly inspection',
    push_url: '/checklist',
    tag: 'checklist-abc123'
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Checklist notification sent",
  "push_sent": 1
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: recipient_user_id, push_title, push_body"
}
```

**500 Internal Server Error** - VAPID keys not configured:
```json
{
  "error": "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
}
```

#### Implementation Details

1. Validates JWT from Authorization header
2. **Mute check**: If `tag` starts with `checklist-`, parses `checklist_instance_id` from tag; queries `checklist_instances` for `checklist_item_id`; queries `user_checklist_item_mute_preferences` for (recipient_user_id, checklist_item_id) where `muted_until > now`; if match found, returns success with `push_sent: 0` and skips sending
3. Fetches push subscriptions for recipient from `push_subscriptions` table
4. Sends Web Push via `web-push` library using VAPID keys
5. Returns count of notifications sent (0 if no subscriptions)
6. Used by: Checklist completion flow, Settings "Test notification" button

---

### send-report-notification

**Purpose**: Web-push notification when a report is submitted: loads the report + template + creator, resolves the job display name (`jobs_ledger.job_name` → `projects.name` → bid project/contact name), and pushes "New *{template}* — *{creator}* submitted a *{template}* for *{job}*" to every user who opted in for that template in **`user_report_notification_preferences`** (submitter excluded). Legacy template name "Superintendent Report" is displayed as "Status Report". Deep link `/jobs?tab=reports`; per-recipient sends recorded in `notification_history` (`template_type: report_submitted`, best-effort).

**Endpoint**: `POST /functions/v1/send-report-notification`

**Authentication**: `verify_jwt = false`; in-handler JWT (`auth.getUser`) — any authenticated user (the caller just submitted the report; recipients are decided by their own preferences).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

#### Request Parameters

```typescript
{ report_id: string }
```

#### Response

```typescript
{ success: true, message: string, push_sent: number }   // push_sent = successful subscription sends
// or { error: string } with 400/401/404/500
```

**Used by**: report save flows — [`NewReportModal.tsx`](../src/components/NewReportModal.tsx), [`AdditionalReportModal.tsx`](../src/components/AdditionalReportModal.tsx), and the Job Mode [`TurnawayModal.tsx`](../src/components/jobMode/TurnawayModal.tsx).

---

### send-report-email

**Purpose**: Emails a report to standing recipients configured in **`report_email_subscriptions`** (Dashboard → Recent Reports → mail button). Resolves report content (template name, author, job/project/bid display, `field_values` with signature fields rendered as `[signature captured]`), sends via Resend, and records a `report_email_dispatch_log` row so each `(subscription, report)` is emailed at most once across both modes.

- **`auto`** (`{ report_id }`) — fired fire-and-forget right after a report is created (next to `send-report-notification`). Emails every enabled subscription with `auto_send = true` whose scope matches (`all_authors`, or the report's `created_by_user_id` is in `report_email_subscription_authors`), skipping any already in the dispatch log.
- **`manual`** (`{ mode: 'manual', subscription_id, since_days? }`) — the "Send now" button. Requires the caller to be a manager (dev / master_technician / assistant / controller). Emails in-scope reports from the last `since_days` (default 14, max 50 reports) not yet dispatched to that subscription.

**Endpoint**: `POST /functions/v1/send-report-email`

**Authentication**: in-handler JWT (`auth.getUser`) — any authenticated user for `auto`; `manual` additionally checks the caller's role. Privileged work uses the service role.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

#### Request Parameters

```typescript
{ report_id: string }                                              // auto
{ mode: 'manual', subscription_id: string, since_days?: number }   // manual
```

#### Response

```typescript
{ ok: true, sent: number, matched?: number }                       // auto
{ ok: true, sent: number, candidates?: number, alreadySent?: number } // manual
// or { error: string } with 400/401/403/404/500
```

**Used by**: report save flows ([`NewReportModal.tsx`](../src/components/NewReportModal.tsx), [`AdditionalReportModal.tsx`](../src/components/AdditionalReportModal.tsx)) for `auto`; [`ReportEmailSettingsModal.tsx`](../src/components/dashboard/ReportEmailSettingsModal.tsx) "Send now" for `manual`.

**Deploy**: `supabase functions deploy send-report-email` (manual, per repo convention).

---

### notify-dispatch-request

**Purpose**: After a user creates a `dispatch_requests` row (Task Dispatch), notify every member of `dispatch_group_members` via Web Push without exposing the member list to the client (service role reads the group).

**Endpoint**: `POST /functions/v1/notify-dispatch-request`

**Required Role**: Authenticated user who is the request author (`from_user_id` on the row)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (if missing, returns 200 with `push_sent: 0`)

**Verify JWT**: `false` at gateway; function validates caller matches `from_user_id` (same as [`notify-estimator-request`](#notify-estimator-request)—gateway `verify_jwt` caused 401 for browser sessions if omitted from `config.toml`).

#### Request body

```json
{ "dispatch_request_id": "<uuid>" }
```

#### Success response

```json
{
  "success": true,
  "message": "Dispatch notifications processed",
  "push_sent": 2,
  "recipients": 3
}
```

When the Dispatch group is empty: `push_sent: 0`, `recipients: 0`, friendly `message`.

#### Implementation notes

1. User-scoped client loads `dispatch_requests` by id; rejects if not found or `from_user_id !== auth.uid()`.
2. Admin client loads all `dispatch_group_members`, then for each user loads `push_subscriptions` and sends push (`tag`: `dispatch-<request_id>`, `url`: `/dashboard`).
3. Logs `notification_history` with `template_type: dispatch_request` per recipient when at least one push succeeded for that recipient.
4. Optional **job/bid** line in the push body uses **`service_types.ledger_job_prefix`** / **`ledger_bid_prefix`** (fallback **J** / **B**) via shared **[`_shared/ledgerDisplayPrefixes.ts`](../supabase/functions/_shared/ledgerDisplayPrefixes.ts)** when the referenced row includes **`service_type_id`** — **RECENT_FEATURES** **v2.432**.
5. **`links[]`** is **optional** — empty arrays are tolerated (the function never dereferences `links` for push body composition). The Dashboard My Schedule *Link Customer Pictures* flow (**v2.556**) reuses this endpoint with `links: []` and the new **`pending_action = 'link_job_pictures'`** marker (used only by the inbox UI, not by the push payload), so no Edge-function change was required.

---

### notify-estimator-request

**Purpose**: After a user creates an `estimator_requests` row (Estimator Inbox), notify every member of `estimator_group_members` via Web Push without exposing the member list to the client (service role reads the group).

**Endpoint**: `POST /functions/v1/notify-estimator-request`

**Required Role**: Authenticated user who is the request author (`from_user_id` on the row)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (if missing, returns 200 with `push_sent: 0`)

**Verify JWT**: `false` at gateway; function validates caller matches `from_user_id` (same pattern as other client-invoked notify functions).

#### Request body

```json
{ "estimator_request_id": "<uuid>" }
```

#### Success response

```json
{
  "success": true,
  "message": "Estimator inbox notifications processed",
  "push_sent": 2,
  "recipients": 3
}
```

When the Estimator Inbox group is empty: `push_sent: 0`, `recipients: 0`, friendly `message`.

#### Implementation notes

1. User-scoped client loads `estimator_requests` by id; rejects if not found or `from_user_id !== auth.uid()`.
2. Admin client loads all `estimator_group_members`, then for each user loads `push_subscriptions` and sends push (`tag`: `estimator-<request_id>`, `url`: `/dashboard`).
3. Logs `notification_history` with `template_type: estimator_request` per recipient when at least one push succeeded for that recipient.
4. Optional **job/bid** line in the push body uses trade-specific prefixes (**`_shared/ledgerDisplayPrefixes.ts`**) — same as **notify-dispatch-request** (**v2.432**).

---

### notify-team-lead-clock

**Purpose**: When a team member **clocks in** (`clock_sessions` INSERT with `clocked_in_at`) or **clocks out** (`clocked_out_at` becomes non-null on UPDATE), send Web Push to each **leader** who opted in via `team_leader_clock_notify_prefs` for that leader–member assignment. Intended to be invoked by a **Database Webhook** on `public.clock_sessions` (INSERT + UPDATE), not from the browser.

**Endpoint**: `POST /functions/v1/notify-team-lead-clock`

**Required Role**: None (server-to-server). **Authorization** header must be `Bearer <SUPABASE_SERVICE_ROLE_KEY>` or `Bearer <TEAM_LEAD_CLOCK_WEBHOOK_SECRET>` when the optional secret is set (recommended for webhooks).

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (if missing, returns 200 with `push_sent: 0`)
- Optional: `TEAM_LEAD_CLOCK_WEBHOOK_SECRET` — if set, webhook can send this instead of the service role key.

**Verify JWT**: `false` (uses shared secret / service role only)

#### Request body (Supabase Database Webhook shape)

```json
{
  "type": "INSERT",
  "table": "clock_sessions",
  "schema": "public",
  "record": { "id": "…", "user_id": "…", "clocked_in_at": "…", "clocked_out_at": null, "work_date": "…" },
  "old_record": null
}
```

For **clock out**, `type` is `UPDATE`, `old_record.clocked_out_at` is null, and `record.clocked_out_at` is set.

#### Success response

```json
{ "success": true, "push_sent": 2, "leaders": 1, "kind": "clock_in" }
```

Skipped events return 200 with `skipped: true` (e.g. not a clock-in/out transition).

#### Deployment / wiring

1. Deploy the function: `supabase functions deploy notify-team-lead-clock`
2. In Supabase Dashboard → Database → Webhooks: add webhooks on `clock_sessions` for **Insert** and **Update**, HTTP POST to `https://<project-ref>.supabase.co/functions/v1/notify-team-lead-clock`, header `Authorization: Bearer <SERVICE_ROLE_KEY>` or the webhook secret.
3. Leaders enable **Notify on clock in/out** per member on Dashboard → My Team.

---

### send-scheduled-reminders

**Purpose**: Send Web Push reminders for incomplete checklist tasks at configured times (CST). Invoked by pg_cron every 15 minutes.

**Endpoint**: `POST /functions/v1/send-scheduled-reminders`

**Required Role**: None (invoked by pg_cron; validates `CRON_SECRET`)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET` - Must match value passed in `X-Cron-Secret` header or `cron_secret` in body

**Verify JWT**: `false` (uses CRON_SECRET for cron invocation)

#### Request

No body required. Validates via `X-Cron-Secret` header or `{"cron_secret": "..."}` in body.

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Scheduled reminders sent",
  "sent": 3,
  "users_notified": 2
}
```

#### Implementation Details

1. Validates CRON_SECRET (header or body)
2. Gets current time in America/Chicago, rounded to 15-minute boundary
3. Queries `checklist_items` where `reminder_time` matches current time
4. For each item, finds incomplete `checklist_instances` per `reminder_scope` (today_only or today_and_overdue)
5. Groups by assignee, sends one push per user with task summary
6. Logs to `notification_history` with `template_type: 'scheduled_reminder'`

**Prerequisites**:
- pg_cron and pg_net enabled (Supabase Dashboard > Database > Extensions)
- Vault secrets: `project_url`, `cron_secret` (same value as CRON_SECRET)
- Dev configures `reminder_time` and `reminder_scope` on checklist items (Checklist > Manage)

---

### recurring-job-report-preview

**Purpose**: Return server-built HTML for a job-activity digest (crew clock hours/session notes + field reports) **without sending mail**. Jobs are **all** **`jobs_ledger`** rows under **`scope_master_user_id`** that have qualifying **clock sessions** or **field reports** in the chosen window. **Recipient schedule blocks are not used** for which jobs appear. Validates JWT via `getUser`; caller must satisfy **`user_can_manage_recurring_job_report_scope`** for **`scope_master_user_id`**. Each job section shows **`jobs_ledger.job_address`** under the title when non-empty (multi-line addresses use line breaks; plain-text emails mirror the same). Optional **`include_costs`**: **`true`** adds a **Clock time** **Cost** column (**hours × people_pay_config.hourly_wage** where **`trim(users.name)`** matches **`person_name`**); missing or null wage shows **—** (service role reads pay rows).

**Endpoint**: `POST /functions/v1/recurring-job-report-preview`

**Body (JSON)**:
- `scope_master_user_id` (uuid, required) — org (**`jobs_ledger.master_user_id`**) universe
- **`activity_scope`** (required): **`calendar_yesterday`** \| **`calendar_today`** \| **`calendar_week`** \| **`calendar_last_week`** — calendar window in **`timezone`** (half-open local midnights → UTC; **`calendar_week`** is Sun–Sat week **containing** **`anchor_date`**; **`calendar_last_week`** is the **prior** Sun–Sat week).
- **`crew_filter`** (required): **`all_users`** \| **`my_team`** — **`my_team`** = **`recipient_user_id`** plus **`team_leader_assignments.member_user_id`** where **`leader_user_id = recipient_user_id`** (Dashboard **My team** roster); **`all_users`** does not restrict activity rows by user.
- `recipient_user_id` (optional) — defaults to caller; affects **`my_team`** resolution only.
- `timezone` (optional, default **`America/Chicago`**).
- **`anchor_date`** (**`YYYY-MM-DD`**, civil date in **`timezone`**, required when not sending a manual **`window`**) — **“today”** in zone for resolving yesterday / today / week bounds.
- Manual **`window`** (optional) overrides RPC bounds (**advanced testing**): provide **`window_start_utc`** / **`window_end_utc`** (ISO); optional **`period_kind`**: **`daily`** (default) \| **`weekly`** for **`reporting_date`** idempotency semantics when dispatching.
- **`include_costs`** (optional boolean, default false) — when **`true`**, HTML and eventual plain-text mirrors include wage-derived **cost** per person on clock rows (see purpose above).

**Response**: `{ "html": "..." }`

**Verify JWT**: `false` in `supabase/config.toml` (same gateway pattern as `test-email`); function validates Bearer.

**Secrets**: `SUPABASE_ANON_KEY` + Bearer for auth; **`SUPABASE_SERVICE_ROLE_KEY`** for aggregated reads inside the worker.

---

### recurring-job-report-test-send

Same payload as **`recurring-job-report-preview`** (including optional **`include_costs`**). Sends **`[TEST]`** email via **Resend** to the **authenticated user's** **`users.email`** only (never arbitrary addresses).

**Secrets**: **`RESEND_API_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`**.

---

### recurring-job-report-dispatch

**Purpose**: pg_cron `*/15` — finds **enabled** schedules whose **timezone wall day-of-week + quarter-hour TIME** matches **now**, loads recipients (max **50** per schedule), skips **dispatch log** duplicates for **`reporting_date`**, builds HTML body, sends with Resend to each **`recipient_user_id`**.

**Endpoint**: `POST /functions/v1/recurring-job-report-dispatch`

**Auth**: **`X-Cron-Secret`** **`CRON_SECRET`** (same as **`send-scheduled-reminders`**)

**Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, **`RESEND_API_KEY`**, `CRON_SECRET`

**Cron**: **`20260430054614_recurring_job_report_schedules.sql`** registers job **`recurring-job-report-dispatch`** with vault **`PROJECT_URL`** + **`CRON_SECRET`** (uppercase).

Per-recipient **`activity_scope`** + **`crew_filter`** + **`include_costs`** (from **`recurring_job_report_schedule_recipients`**) resolve the **UTC window**, filtered activity, and whether clock rows include **Cost**; **`recurring_job_report_dispatch_log.reporting_date`** dedupes by civil **summary day** for daily scopes and **week Sunday** for **`calendar_week`** and **`calendar_last_week`**.

---

### schedule-day-email-dispatch

**Purpose**: pg_cron `*/15` — loads **`schedule_day_email_requests`** rows with **`status = pending`** and **`send_at <= now()`**, calls **`list_job_schedule_blocks_for_schedule_email(p_recipient, p_work_date)`** (Schedule Dispatch hub–parity visibility for that calendar day), builds HTML + plain text, sends to the **recipient**’s **`users.email`** (row **`recipient_user_id`**) via Resend, then sets **`sent`** / **`failed`**.

**Who queues rows** (client **`INSERT`** + RLS — not decided by this Edge function): **master_technician** and **assistant** — **self** only; **dev** — may set **`recipient_user_id`** to any non-archived **`users`** row (**`schedule_day_email_requests_insert_dev_any_recipient`**, migration **`20270523120000_dev_schedule_day_email_for_other.sql`**). Cron dispatch always uses **`recipient_user_id`** for the Resend **To** address and for **`p_recipient`** on the blocks RPC (independent of **`created_by`**).

**Endpoint**: `POST /functions/v1/schedule-day-email-dispatch`

**Auth**: **`X-Cron-Secret`** **`CRON_SECRET`** (same as **`recurring-job-report-dispatch`**)

**Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, **`RESEND_API_KEY`**, `CRON_SECRET`

**Cron**: **`20270522120000_schedule_day_email_requests_and_rpc.sql`** registers job **`schedule-day-email-dispatch`** with vault **`PROJECT_URL`** + **`CRON_SECRET`**.

**Verify JWT**: `false` (`supabase/config.toml`)

**Request**: Optional body `{"cron_secret":"..."}` or header **`X-Cron-Secret`**.

**Success**: `{ "ok": true, "processed": n, "sent": k, "errors": [] }`

---

### schedule-share-dispatch

**Purpose**: Email the **Schedule board** (Dispatch hub blocks) to chosen recipients — two modes in one function, distinguished by the cron secret:

- **Instant** (caller JWT): POST from the Share Schedule modal sends the board for the selected dates to up to **50** recipients right now, rendered from the **sharer's** visibility (`list_schedule_blocks_for_share` RPC with `p_viewer = sender`). Same content to every recipient.
- **Recurring** (pg_cron, every 15 min): loads enabled **`schedule_share_recurring`** subscriptions, matches each row's `days_of_week` + quarter-hour `time_local` in its `timezone` against now, renders from the **creator's** visibility (falls back to the recipient), and emails the recipient. Idempotent — at most one send per subscription per local run date via **`schedule_share_recurring_log`** (also records failures).

**Endpoint**: `POST /functions/v1/schedule-share-dispatch`

**Authentication**: cron path — `X-Cron-Secret` header or `{"cron_secret": "..."}` body matching `CRON_SECRET`; otherwise instant path — Bearer JWT + role gate (non-archived `dev` / `master_technician` / `assistant` / `superintendent`, mirroring schedule-dispatch edit roles). **Note**: this function has **no** `[functions.*]` block in `config.toml`, so the repo config leaves the gateway default `verify_jwt = true` in place (see [Overview](#overview)).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`

#### Instant request

```typescript
{
  recipientUserIds: string[]        // max 50; deduped; each must be non-archived with an email
  baseDate: string                  // YYYY-MM-DD
  includeCurrentDay: boolean
  scope: 'none' | 'next_day' | 'rest_of_week'   // at least one of current day / scope required
}
```

#### Response

```typescript
// instant
{ ok: boolean, mode: 'instant', sent: number, results: Array<{ recipientUserId, ok, error? }> }
// recurring (cron)
{ ok: true, mode: 'recurring', processed: number, sent: number, skipped: number, errors: string[] }
```

**Cron**: archived migration `20270605160000_schedule_share.sql` registers pg_cron job **`schedule-share-dispatch`** (`*/15 * * * *`) posting with the vault `CRON_SECRET` as `X-Cron-Secret`. Shared kernels: [`_shared/scheduleShareCore.ts`](../supabase/functions/_shared/scheduleShareCore.ts) (dates + email build), [`_shared/recurringJobReportTimezone.ts`](../supabase/functions/_shared/recurringJobReportTimezone.ts) (wall-quarter matching).

**Used by**: Schedule → [`ScheduleShareModal.tsx`](../src/components/schedule/ScheduleShareModal.tsx) (instant sends + managing recurring subscriptions).

---

### paid-job-email

**Purpose**: "Customer paid" notifications (v2.965) — when a `jobs_ledger` row hits **`status = 'paid'`**, the `enqueue_paid_job_email()` DB trigger queues a `paid_job_email_queue` row; this function drains the queue and emails the configured recipients. **dev / master_technician** recipients get the **DETAILED** financial review (PAID IN FULL badge, Job Start / Last Work dates, Revenue / Payments / Costs / Profit scoreboard with per-person team-labor rows, monthly labor/parts/payments timeline); everyone else gets the **STERILIZED** summary — job identity + dates, **the exact paid amount/time (v2.969) but no cost or profit figures**. Money math comes from the service-role-only RPC **`get_paid_job_email_payload(p_job_id)`**. Renderers live in [`paid-job-email/render.ts`](../supabase/functions/paid-job-email/render.ts).

**Endpoint**: `POST /functions/v1/paid-job-email`

**Three modes** (JSON body):
- `{ "mode": "preview", "job_id": "<uuid>", "variant": "detailed" | "summary" }` — Bearer JWT, role **dev/master_technician** (non-archived); returns `{ "html": "..." }`. No DB writes, no send.
- `{ "mode": "test_send", "job_id": "<uuid>" }` — same role gate; sends the **detailed** variant via Resend to the **caller's own `users.email` only**, subject prefixed **`[TEST]`**.
- `{ "mode": "send_to", "job_id": "<uuid>", "recipient_user_id": "<uuid>" }` (v2.970) — same role gate; sends the **real** email (no `[TEST]`) to the chosen **active** user; the **recipient's role** picks detailed vs sterilized, and both variants carry a *"Sent manually by {sender}"* footer. Driven by the Job Detail ✉ modal.
- cron (no `mode` or `{ "mode": "dispatch" }`) — **`X-Cron-Secret`** (or body `cron_secret`) must equal **`CRON_SECRET`**. Loads pending queue rows (`sent_at IS NULL`, `attempts < 5`, limit 20); per row fetches the payload, loads recipients from `app_settings` key **`paid_job_email_recipients_v1`** (JSON array of user ids) joined to non-archived `users`, sends detailed vs summary by role, stamps `sent_at` on success or bumps `error`/`attempts`. **Empty recipient list stamps `sent_at` with `no recipients configured`** so rows never retry forever.

**Success (cron)**: `{ "ok": true, "processed": n, "sent": k, "errors": [] }`

**Verify JWT**: `false` in `supabase/config.toml` (in-function JWT/role or cron-secret validation).

**Cron**: [`20260722260000_paid_job_email.sql`](../supabase/migrations/20260722260000_paid_job_email.sql) registers pg_cron job **`paid-job-email`** (`*/15 * * * *`) with vault **`PROJECT_URL`** + **`CRON_SECRET`** (same pattern as `recurring-job-report-dispatch`).

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `CRON_SECRET`

**Used by**: Jobs → Stages → ⚙ across from the Paid in Full header → [`PaidInFullEmailSettingsModal.tsx`](../src/components/jobs/PaidInFullEmailSettingsModal.tsx) (recipient config + Preview detailed / Preview summary / Email me a test).

---

### sync-salary-sessions

**Purpose**: Materialize and close `clock_sessions` with `origin = 'salary_schedule'` for all users who have a row in `salary_work_schedule_templates`, for the current **America/Chicago** calendar date. Intended to run every 1–5 minutes via cron (same auth pattern as `send-scheduled-reminders`).

**Endpoint**: `POST /functions/v1/sync-salary-sessions`

**Required Role**: None (validates `CRON_SECRET`; uses service role for `sync_salary_clock_sessions_for_day`).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

**Verify JWT**: `false` (`supabase/config.toml`)

**Request**: Optional body `{"cron_secret":"..."}` or header `X-Cron-Secret`.

**Success**: `{ "success": true, "work_date": "YYYY-MM-DD" }`

**Database behavior**: Invokes **`sync_salary_clock_sessions_for_day`**, which runs **`salary_sync_one_user_clock_sessions`** per templated user — **canonical **`salary_schedule`** open/close**, **split-mode** half-open **overlap** guards, **continuous** indexed-fragment close at **`t_end`** after My Time splits (**`20270516120000`**); ordinary **`user_punch`** rows are **not** bulk-closed at template ends in the current function body. Details: **[`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)**.

---

### set-user-password

**Purpose**: Set password for any user (dev-only operation)

**Endpoint**: `POST /functions/v1/set-user-password`

**Required Role**: `dev`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface SetPasswordRequest {
  user_id: string   // Target user ID (UUID)
  password: string  // New password (min 6 characters)
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('set-user-password', {
  body: {
    user_id: 'uuid-of-target-user',
    password: 'newSecurePassword123'
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: user_id and password"
}
```

**400 Bad Request** - Password too short:
```json
{
  "error": "Password must be at least 6 characters"
}
```

**404 Not Found** - User not found:
```json
{
  "error": "User not found with ID: uuid"
}
```

**500 Internal Server Error** - Service role key missing:
```json
{
  "error": "SUPABASE_SERVICE_ROLE_KEY not configured."
}
```

#### Implementation Details

1. Validates caller is `dev` role
2. Validates password length (minimum 6 characters)
3. Checks user exists in `auth.users`
4. Updates password using `supabase.auth.admin.updateUserById()`
5. Does not require current password (admin override)

**Use Cases**:
- Password reset for users who lost access
- Initial password setup for manually created users
- Emergency account recovery

**Security Note**: Only devs can call this function. Use with caution.

**Deployment**: Function deployment handled via Supabase CLI

---

### claim-dev

**Purpose**: **Break-glass only (v2.706).** Promote the current user to dev *when no usable dev is available* — bootstrapping the first dev, or recovering when every dev is archived or read-only. It is **not** a general self-promotion path: if a usable dev exists, use **Settings → People & accounts** instead.

**Endpoint**: `POST /functions/v1/claim-dev`

**Required Role**: Authenticated user. **Refused** when a usable dev exists (`role='dev' AND archived_at IS NULL AND read_only=false`), when the caller is `read_only` or archived, or when the code is wrong.

**How it enforces**: the function checks the code (constant-time) and calls the SECURITY DEFINER RPC `claim_dev_attempt(p_user_id, p_code_ok)`, which holds the gate, performs the promotion and **audits every attempt** to `claim_dev_attempts` (dev-only SELECT). That RPC is `REVOKE`d from `authenticated` and granted only to `service_role`, so this function is its sole caller — it is not a new door.

> **Every refusal returns the same opaque `{ success: false }`**, including a *correct* code refused because a dev exists. Anything else would be a **code oracle**, confirming the secret is valid. The real reason is recorded in `claim_dev_attempts`; repeated `refused_*` rows raise a dev dashboard alert. Preserve this behaviour if you edit the function.

> Deploy order: this function calls `claim_dev_attempt()`, so **`supabase db push` must run before `supabase functions deploy claim-dev`**. `verify_jwt = false` in `config.toml` is intentional (the function does its own Bearer + `getUser` check) — preserve it on redeploy.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEV_PROMOTION_CODE` - Promotion code (add via Dashboard or `supabase secrets set DEV_PROMOTION_CODE <value>`)

#### Request Parameters

```typescript
interface ClaimDevRequest {
  code: string  // Promotion code to claim dev role
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('claim-dev', {
  body: { code: 'your-promotion-code' }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true
}
```

#### Error / Invalid Code Response

**Status**: 200 OK (invalid code returns success: false, not an error status)

```json
{
  "success": false
}
```

#### Error Responses

**401 Unauthorized** - No/invalid session:
```json
{
  "error": "Unauthorized - Invalid or expired session. Please sign out and sign in again."
}
```

**500 Internal Server Error** - Secret not configured:
```json
{
  "error": "DEV_PROMOTION_CODE not configured"
}
```

#### Implementation Details

1. Validates JWT (user must be logged in)
2. Reads `DEV_PROMOTION_CODE` from Supabase secrets (env var)
3. Compares input code to secret using constant-time comparison
4. On match: uses service role client to `UPDATE public.users SET role = 'dev' WHERE id = auth.uid()`
5. Returns `{ success: false }` for invalid code (does not reveal whether code was wrong)

**Use Cases**:
- Initial dev promotion (no existing dev to promote you)
- Bootstrap admin access

**Security Note**: Add `DEV_PROMOTION_CODE` in Supabase Dashboard (Project Settings → Edge Functions → Secrets) or via CLI. Do not reuse the old hardcoded value; generate a strong random code.

---

### test-email

**Purpose**: Test email templates with Resend API integration

**Endpoint**: `POST /functions/v1/test-email`

**Required Role**: `dev` (legacy `owner` still allowed)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase-hosted projects inject this automatically; used to read `public.users.role` reliably under RLS)
- `RESEND_API_KEY`

#### Request body

```typescript
interface TestEmailRequest {
  to: string
  subject: string
  body: string // plain text; HTML is simple line-break conversion server-side
  template_type?: string // optional tag for analytics/logging
}
```

#### Example Request

```typescript
const { data: { session } } = await supabase.auth.refreshSession()
if (!session?.access_token) throw new Error('Not signed in')

const { data, error } = await supabase.functions.invoke('test-email', {
  headers: { Authorization: `Bearer ${session.access_token}` },
  body: {
    to: 'test@example.com',
    subject: 'Hello',
    body: 'Line one\nLine two',
    template_type: 'invitation',
  },
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Test email sent successfully via Resend",
  "email_id": "resend_email_id",
  "email_preview": {
    "to": "test@example.com",
    "subject": "Hello",
    "body": "Line one\nLine two",
    "template_type": "invitation"
  }
}
```

#### Error Responses

**400** — Missing **`to`**, **`subject`**, or **`body`**, or invalid email.

**401** — Not authenticated or invalid token.

**403** — Caller is not **`dev`** / **`owner`**.

**500** — **`RESEND_API_KEY`** or Resend error.

#### Implementation Details

1. Verifies caller is **`dev`** (or legacy **`owner`**) via **`users.role`** using the service role client
2. Accepts **`to`**, **`subject`**, **`body`**, **`template_type`** in the JSON body (the **client** substitutes template variables before invoking; this function does **not** read **`email_templates`**)
3. Sends via Resend API
4. Returns Resend email ID for tracking

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`** for **`test-email`** (JWT is still validated in the function). Deploy with **`--no-verify-jwt`** if the hosted function still verifies JWT at the edge. Call **`functions.invoke`** with **`Authorization: Bearer`** from **`refreshSession()`**’s **`access_token`**.

**Request body** (required): **`to`**, **`subject`**, **`body`**; **`template_type`** is optional metadata for logging.

**See Also**: 
- EMAIL_TESTING.md - Complete testing documentation
- [`supabase/functions/test-email/README.md`](../supabase/functions/test-email/README.md)

**Deployment**: See [`supabase/functions/test-email/DEPLOY.md`](../supabase/functions/test-email/DEPLOY.md)

---

### create-stripe-invoice

**Purpose**: Create and finalize a Stripe invoice for a **`jobs_ledger_invoices`** row in **Ready to Bill**, then persist **`hosted_invoice_url`**, **`stripe_invoice_id`**, and set status **billed**.

**Endpoint**: `POST /functions/v1/create-stripe-invoice`

**Authentication**: Bearer JWT validated with **`getUser`**; caller must be able to **SELECT** the target invoice via RLS (**`verify_jwt = false`** on the gateway — same pattern as **`test-email`**).

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`

#### Request body

```typescript
interface CreateStripeInvoiceBody {
  jobs_ledger_invoice_id: string
  customer_id: string
  amount_dollars: number
  customer_email: string
  customer_name: string
  due_date: string // YYYY-MM-DD (local calendar day; server derives days_until_due)
  memo?: string
  /** Optional: Stripe Invoice `footer` (max **5000** chars). Omit or empty = Stripe account default footer. */
  footer?: string
  /** Optional: Stripe invoice **line item** `description`. Max **500** characters. If set (non-empty), forces a **single** line; omit to allow **multiple** lines from job **Specific Work** (`jobs_ledger_fixtures`) when billable rows exist. */
  line_description?: string
}
```

#### Example (browser)

```typescript
const { data: { session } } = await supabase.auth.refreshSession()
if (!session?.access_token) throw new Error('Not signed in')

const { data, error } = await supabase.functions.invoke('create-stripe-invoice', {
  headers: { Authorization: `Bearer ${session.access_token}` },
  body: {
    jobs_ledger_invoice_id: invoiceId,
    customer_id: customerId,
    amount_dollars: 1234.56,
    customer_email: 'customer@example.com',
    customer_name: 'Customer Name',
    due_date: '2026-04-15',
    memo: 'Optional',
  },
})
```

#### Success response

**Status**: 200

```json
{
  "success": true,
  "stripe_invoice_id": "in_...",
  "hosted_invoice_url": "https://invoice.stripe.com/...",
  "stripe_invoice_status": "open",
  "invoice_preview": {
    "currency": "usd",
    "subtotal": 123456,
    "total": 123456,
    "amount_due": 123456,
    "lines": [{ "description": "Job name · HCP 123", "amount": 123456 }]
  }
}
```

**`invoice_preview`**: Finalized invoice line items and totals (**amounts in cents**), same shape as **`preview-stripe-invoice`** line payload; omitted if an idempotent **`invoices.retrieve`** fails. When **multi-line**, **`invoice_preview.lines`** is passed through **`stripeInvoiceLinesDataForFixtureOrderDisplay`** in **[`stripeInvoiceLinesForFixtureOrderDisplay.ts`](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)** so the in-app table matches **invoice.stripe.com** (**v2.528** — **`RECENT_FEATURES.md`**). Bill Customer uses it to show the invoice table after create.

If **`stripe_invoice_id`** and **`hosted_invoice_url`** are already set, returns the same shape with **`idempotent: true`** (and **`invoice_preview`** when retrieve succeeds).

#### Error responses (400)

- **`Job must be linked to a customer before creating a Stripe invoice.`** — **`jobs_ledger.customer_id`** is null.
- **`Customer must match the job linked customer.`** — body **`customer_id`** does not equal the job’s **`customer_id`**.
- **`Line description too long (max 500 characters)`** — **`line_description`** exceeds the limit.
- **`Invoice footer too long (max 5000 characters)`** — **`footer`** exceeds the limit.

#### Implementation notes

1. Loads job and customer with **service role**; requires **`jobs_ledger.customer_id`** and matches body **`customer_id`** to it; ensures **`customers.master_user_id`** matches **`jobs_ledger.master_user_id`**.
2. Creates or reuses **`customers.stripe_customer_id`** on Stripe; updates Stripe customer email/name.
3. Stripe invoice **`number`** is **digits-only HCP**, a hyphen, **`YYMMDD`** from bill due date, then **`HHmm`** (24-hour) in **`America/Chicago`** at finalize time (e.g. `11-2605140020`; customer email may show a **`#`** prefix). **`preview-stripe-invoice`** uses the same rule at preview time; if the user waits between preview and create, the time suffix may differ.
4. Creates draft invoice + one or more invoice line items (see below), **finalize**s, then **UPDATE** **`jobs_ledger_invoices`** (**`status = 'billed'`**) and Stripe columns, plus **`external_send_channel = 'stripe'`**, **`stripe_invoice_memo`** (from **`memo`** → Stripe **`description`**), and **`stripe_invoice_footer`** (from optional **`footer`** → Stripe **`footer`**; **`null`** when omitted). **`sent_to_customer_at`** is **not** set here; it is recorded when **[send-stripe-invoice](#send-stripe-invoice)** successfully calls Stripe **`invoices.sendInvoice`** (customer email from Stripe).
5. **Line items from Specific Work**: Loads **`jobs_ledger_fixtures`** for the invoice’s job. When there are **billable** rows (trimmed **`name`**, **`count × line_unit_price`** in dollars **> 0**) and **`line_description`** is omitted or blank, creates **one** Stripe line per row (ordered by **`sequence_order`**; description from name + optional scope text), with cent amounts **scaled proportionally** to **`amount_dollars`** when the bill is less than the fixture subtotal so the lines sum exactly. A non-empty **`line_description`** keeps the legacy behavior: **one** line for the full amount using that description (or the default **`Customer · Job · HCP`** string when not overridden). Stripe **`invoice_items`** follow **`sequence_order`** ascending (**no** post-build **`reverse`** — **v2.527**, shared **[`stripeInvoiceItemsFromFixtures.ts`](../supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts)**).
6. **Staff-visible `lines` vs hosted invoice**: **`invoice_preview.lines`** from **`invoices.retrieve`** / line-item expansion uses **`stripeInvoiceLinesDataForFixtureOrderDisplay`** (**v2.528**, **[`stripeInvoiceLinesForFixtureOrderDisplay.ts`](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)**) when **multi-line**, because Stripe **`lines.data`** / **`listLineItems`** arrays can disagree with **invoice.stripe.com** top-to-bottom order.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`**. Deploy with **`supabase functions deploy create-stripe-invoice --no-verify-jwt`** when the hosted gateway still enforces JWT.

**extra_line_items** (v2.1002): optional `Array<{amount_cents, description}>` — validated (positive cents, description clamped 500); fixture lines allocate to `amount − extras` and each extra is appended as its own labeled invoice item (`source.kind: extra_line`). Used by the Bill Customer hazmat roll-in.

**Service address** (v2.998): the invoice is created with a `custom_fields` entry `Service address` from `jobs_ledger.job_address` (trimmed, capped 140 chars; omitted when blank) — renders in the header of the hosted page and PDF. Not shown by `preview-stripe-invoice` (`createPreview` lacks `custom_fields`).

---

### send-physical-invoice-email

> **v2.940**: accepts optional `additional_emails: string[]` (≤10, validated, deduped against `customer_email`) — extra recipients ride on the same Resend send (`to` array), so one email and one recorded send event regardless of recipient count.

**Purpose**: Email the customer a **PDF invoice** (generated in the app to match the on-screen preview) via **Resend**, then persist the **`jobs_ledger_invoices`** billing fields as a **Physical** send (**`status: billed`**, **`external_send_channel: physical`**, **`sent_to_customer_at`**, **`external_send_note`**, **`amount`**). It does **not** call **`update_job_status`** on **`jobs_ledger`**. After a **200** response, **[`SendRecordInvoiceModal`](../src/components/jobs/SendRecordInvoiceModal.tsx)** runs **`maybePromoteJobToBilledAfterCustomerInvoice`** ([`promoteJobToBilledIfFullyInvoiced.ts`](../src/lib/promoteJobToBilledIfFullyInvoiced.ts)) — the same helper used after **Stripe** **`create-stripe-invoice`** and **HouseCall Pro** manual bill — so when the job is **fully invoiced out** (no **`ready_to_bill`** rows; **`jobBillingUnallocatedDollars`** ~ 0), the **job** moves to **billed** together with the invoice line regardless of billing channel. The client may send a **detailed** multi-section PDF (Specific Work + materials + payment history) built from the job ledger; the Edge function only validates and attaches **`pdf_base64`**.

**Endpoint**: `POST /functions/v1/send-physical-invoice-email`

**Authentication**: Bearer JWT; **`auth.getUser`** in the function. All DB reads/writes use the **user-scoped** Supabase client (**RLS** applies). **`verify_jwt = false`** on the gateway (same pattern as **`send-estimate-to-customer`**).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`RESEND_API_KEY`**.

#### Request body

```typescript
interface SendPhysicalInvoiceEmailBody {
  jobs_ledger_invoice_id: string
  job_id: string
  amount_dollars: number
  sent_to_customer_at: string // ISO timestamp
  external_send_note?: string | null
  /** Must match **`jobs_ledger.customer_email`** (trimmed, case-insensitive). */
  customer_email: string
  subject?: string
  pdf_base64: string
  pdf_filename?: string
  email_text?: string
  email_html?: string
  /**
   * v2.849: companion documents sent as separate files beside the invoice PDF
   * (e.g. the Biohazard Remediation Fee Notice for hazmat rider invoices).
   * Max 2; each ≤ 6M base64 chars; combined with the invoice ≤ 9M.
   */
  extra_attachments?: Array<{ filename?: string; content_base64: string }>
}
```

#### Success (200)

```json
{ "success": true }
```

#### Errors

- **400** — Missing fields, invalid email, invoice not **ready_to_bill**, **`customer_email`** mismatch vs **`jobs_ledger.customer_email`**, invoice **`job_id`** mismatch, oversized PDF payload.
- **401** — Missing or invalid JWT.
- **403** — Invoice or job not visible under RLS.
- **502** — Resend API error.

**Client**: [`SendRecordInvoiceModal.tsx`](../src/components/jobs/SendRecordInvoiceModal.tsx) (**Physical invoice** tab) invokes this Edge Function, then **`maybePromoteJobToBilledAfterCustomerInvoice`** on success. **`subject`** is **[`physicalInvoiceEmailSubject`](../src/lib/physicalInvoiceDocument.ts)** (**`Click Plumbing Invoice [#…]`**). **`email_text`** / **`email_html`** are built by **[`buildPhysicalInvoiceEmailBodies`](../src/lib/physicalInvoiceDocument.ts)** (HTML summary: bold issuer **tagline** under the intro; no **Service date** or **Issuer** block—PDF is authoritative).

**Deploy**: `supabase functions deploy send-physical-invoice-email --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### send-hazmat-notice-email

**Purpose** (v2.850): Email the customer the **Biohazard Remediation Fee Notice PDF** as its own message — the **Stripe companion channel** (Stripe invoices cannot carry attachments) and the **re-send** path from Edit Job's **Riders** strip. The PDF is built client-side ([`hazmatFeeNoticePdf.ts`](../src/lib/jobsDocuments/hazmatFeeNoticePdf.ts)) from the persisted `job_hazmat_incidents` row; the function validates and attaches it. **No DB writes** — safe to re-send any time.

**Endpoint**: `POST /functions/v1/send-hazmat-notice-email`

**Authentication**: Bearer JWT; **`auth.getUser`** in the function; all reads via the **user-scoped** client (**RLS** applies — `job_hazmat_incidents` is readable by office/billing roles only). **`verify_jwt = false`** on the gateway (same pattern as **`send-physical-invoice-email`**).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`RESEND_API_KEY`**.

#### Request body

```typescript
interface SendHazmatNoticeEmailBody {
  job_id: string
  incident_id: string // job_hazmat_incidents.id; must belong to job_id
  /** Must match jobs_ledger.customer_email (trimmed, case-insensitive). */
  customer_email: string
  subject?: string
  pdf_base64: string // ≤ 6M base64 chars
  pdf_filename?: string
  email_text?: string
  email_html?: string
}
```

#### Success (200)

```json
{ "success": true }
```

#### Errors

- **400** — Missing fields, invalid email, incident/job mismatch, **`customer_email`** mismatch, oversized PDF.
- **401** — Missing or invalid JWT.
- **403** — Incident or job not visible under RLS.
- **502** — Resend API error.

**Client**: [`sendHazmatNoticeEmail.ts`](../src/lib/sendHazmatNoticeEmail.ts), called from the Bill Customer **Stripe** tab ("Also email the Biohazard Remediation Fee Notice", pre-checked for hazmat riders) after a successful `create-stripe-invoice`, and from Edit Job's **Riders** strip **Email notice…** button (confirm prompt; any time).

**Deploy**: `supabase functions deploy send-hazmat-notice-email --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### send-stripe-invoice

**Purpose**: Call Stripe **`invoices.sendInvoice`** for an open billed line so Stripe emails the customer the payment link. After Stripe accepts the send, updates **`jobs_ledger_invoices`** with **`sent_to_customer_at`** (now) and **`stripe_invoice_status`** from the returned invoice (service role; retries a few times on transient DB errors). Each successful send **overwrites** **`sent_to_customer_at`** (latest send only). On success, also **INSERT** into **`jobs_ledger_invoice_stripe_email_sends`** (append-only log for the confirm modal **Most recent sends** list; insert failure is **logged** only—the HTTP response still **200** if the invoice row updated). Used for the primary **Send Email invoice from Stripe** control and for **Resend invoice email** on Jobs **Stages** **Last activity** ([`StripeInvoiceSendFromStripeButton`](../src/components/jobs/StripeInvoiceSendFromStripeButton.tsx)), and for **Email invoice to customer** on Dashboard **Collect Payment** step 3 ([`CollectPaymentModal`](../src/components/jobs/CollectPaymentModal.tsx)).

Pre-send validation uses **[`customerEmailFromStripeInvoice`](../supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)** on the retrieved invoice (**expanded Customer `email` first**, then **`invoice.customer_email`**).

**Endpoint**: `POST /functions/v1/send-stripe-invoice`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Staff** (dev / master_technician / assistant / primary): invoice row loaded with the user-scoped client (**RLS** **`SELECT`** on **`jobs_ledger_invoices`**). **Subcontractor**: invoice row loaded with **service role** only after **`jobs_ledger_team_members`** proves the caller is on the job **and** **`job_collect_payment_flows`** for that job is **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request (collect-payment field flow only).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`**, Stripe secret for the chosen mode (`STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE` or legacy key).

#### Request body

```typescript
interface SendStripeInvoiceBody {
  jobs_ledger_invoice_id: string
  /** Optional: `test` | `live` — same as other Stripe billing functions. */
  stripe_mode?: 'test' | 'live'
}
```

#### Errors after a successful Stripe send

If the DB persist fails, the function may return **502** with **`stripe_may_have_sent: true`** and a message to check Stripe before resending (duplicate customer emails).

**Gateway JWT**: Deploy with **`supabase functions deploy send-stripe-invoice --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### update-collect-payment-stripe-customer-email

**Purpose**: Let a **subcontractor** on **Collect Payment** step 3 correct the payer email before **Email invoice to customer**. Updates the Stripe **Customer** `email` via **`customers.update`**, then updates the **open** Stripe invoice’s **`customer_email`** via **`invoices.update`** (keeps invoice snapshot aligned; UI resolution still prefers expanded Customer in **[`customerEmailFromStripeInvoice`](../supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**), then syncs **`jobs_ledger.customer_email`** and merges **`customers.contact_info.email`** (preserving **`phone`**) with the service role so office data and **`get_collect_payment_certify_payload`** stay aligned with **`send-stripe-invoice`** / **`get-stripe-invoice-details`**.

**Endpoint**: `POST /functions/v1/update-collect-payment-stripe-customer-email`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Subcontractor only** (v1): same **service-role** gate as **`send-stripe-invoice`** — **`jobs_ledger_team_members`** for the invoice’s job **and** **`job_collect_payment_flows`** **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request. Non-subcontractors receive **403**.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`**, Stripe secret for the chosen mode.

#### Request body

```typescript
interface UpdateCollectPaymentStripeCustomerEmailBody {
  jobs_ledger_invoice_id: string
  customer_email: string
  stripe_mode?: 'test' | 'live'
}
```

#### Success (200)

```json
{ "success": true, "customer_email": "payer@example.com", "stripe_mode": "live" }
```

#### Errors

- **400** — Missing invoice id, invalid/empty email, invoice not **billed**, no **`stripe_invoice_id`**, job has no **`customer_id`**, customer **`master_user_id`** mismatch vs job, missing **`stripe_customer_id`**, Stripe **`customers.update`** failure (including **missing Stripe customer** — contact office; v1 does not auto-create customers).
- **401** — Missing or invalid JWT.
- **403** — Not a subcontractor, or collect-payment gate failed (not on job team / flow not approved for this invoice).
- **502** — Stripe error (other than handled missing customer), **`invoices.update`** failure after **`customers.update`** (customer may be updated on Stripe; invoice email not synced — contact office), or partial DB failure after both Stripe updates.

**Client**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx) step 3 **Change email**.

**Gateway JWT**: Deploy with **`supabase functions deploy update-collect-payment-stripe-customer-email --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### get-stripe-invoice-details

**Purpose**: **`invoices.retrieve`** (with **`expand: ['customer']`**) + line items for a billed **`jobs_ledger_invoices`** row with **`stripe_invoice_id`**. Used by **Hosted bill** UI and **Collect Payment** step 3 (Stripe-resolved customer email). Response **`customer_email`** matches **`send-stripe-invoice`** resolution (**expanded Customer `email` first**, then **`invoice.customer_email`**) per **[`customerEmailFromStripeInvoice`](../supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**.

**Endpoint**: `POST /functions/v1/get-stripe-invoice-details`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Staff** (non–`subcontractor`): invoice row loaded with the user-scoped client (**RLS** **`SELECT`**). **`subcontractor`**: invoice row loaded with **service role** only after **`jobs_ledger_team_members`** and **`job_collect_payment_flows`** **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request (same gate as **`send-stripe-invoice`** for field email); memo/footer backfill uses **service role** for subs.

**Success body** (partial): includes **`memo`** (Stripe **`description`**) and **`footer`** (Stripe **`footer`**) as separate strings when present. May service-backfill **`stripe_invoice_memo`** / **`stripe_invoice_footer`** on the ledger row when empty.

Response **`lines`** (from Stripe **`listLineItems`**) pass through **`stripeInvoiceLinesDataForFixtureOrderDisplay`** ([**`stripeInvoiceLinesForFixtureOrderDisplay.ts`**](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)): **multi-line** payloads are reversed so hosted bill UI matches **invoice.stripe.com** (**v2.528**; creation / **`invoice_items`** order: **v2.527**, **`RECENT_FEATURES.md`**).

**Gateway JWT**: Deploy with **`supabase functions deploy get-stripe-invoice-details --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### record-stripe-invoice-out-of-band-payment

**Purpose**: Mark a **Stripe** invoice as paid **outside Stripe** (check, cash, wire, etc.): merges bookkeeping metadata onto the Stripe Invoice, calls **`invoices.pay` with `paid_out_of_band: true`** (no charge through Stripe), then the **`stripe-webhook`** **`invoice.paid`** / **`invoice.payment_succeeded`** handler updates **`jobs_ledger_payments`** via **`mark_invoice_paid_from_stripe`** (including **`payment_type`**, **`reference_number`**, effective date, internal note when present in metadata).

**Endpoint**: `POST /functions/v1/record-stripe-invoice-out-of-band-payment`

**Authentication**: Bearer JWT + RLS **`SELECT`** on **`jobs_ledger_invoices`** (**`verify_jwt = false`** on the gateway; JWT validated in-function).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, Stripe secret for the chosen mode (`STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE` or legacy key).

#### Request body

```typescript
interface RecordStripeInvoiceOobBody {
  jobs_ledger_invoice_id: string
  /** Must equal Stripe’s full open balance (`amount_remaining` in dollars). Partial pay is rejected. */
  amount_dollars: number
  paid_on: string // YYYY-MM-DD (effective date)
  payment_type: string // e.g. Cash, Check
  reference_number?: string
  internal_note?: string
  stripe_mode?: 'test' | 'live'
}
```

**Stripe does not move money** in this flow; it only updates invoice state to **paid** to match an external receipt.

#### Errors (400)

- **`Amount must match the full open balance on the Stripe invoice`** — v1 requires **`amount_dollars`** (in cents when compared) to match Stripe **`amount_remaining`** exactly.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy record-stripe-invoice-out-of-band-payment --no-verify-jwt`** if the hosted gateway still enforces JWT.

---

### reverse-stripe-invoice-out-of-band-payment

**Purpose**: Undo a **PipeTooling-recorded** Stripe **out-of-band** close: requires Stripe Invoice metadata **`pt_payment_type`** (set by **record-stripe-invoice-out-of-band-payment**) and **no** Stripe **`charge`** on the invoice (rejects normal card/ACH collects). Computes the credit amount as Stripe **`amount_paid`** when it is a positive number; when OOB leaves **`status = paid`** but **`amount_paid`** is **0**, uses invoice **`total`** instead. Creates a Stripe **credit note** for that amount minus existing credit notes on the invoice; when the path used **`total`** ( **`amount_paid`** not positive), sets **`out_of_band_amount`** on **`creditNotes.create`** to the new note amount so the sum of refund / **`credit_amount`** / **`out_of_band_amount`** matches Stripe’s **`post_payment_amount`**. Then calls RPC **`revert_stripe_oob_invoice_payment`** to remove **`jobs_ledger_payments`** for that invoice, set **`jobs_ledger_invoices.status`** to **`billed`**, recompute **`jobs_ledger.payments_made`**, optionally **`update_job_status`** **`paid`→`billed`**, append **`stripe_oob_payment_reverts`**, and reset **`job_collect_payment_flows`** from **`terminal_completed`** to **`approved_for_terminal`** when the **`stripe_invoice_id`** matches.

**Endpoint**: `POST /functions/v1/reverse-stripe-invoice-out-of-band-payment`

**Authentication**: Bearer JWT + RLS **`SELECT`** on **`jobs_ledger_invoices`** (**`verify_jwt = false`** on the gateway; JWT validated in-function). Roles enforced again in the RPC (dev / master_technician / assistant / primary + job access).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, Stripe secret for the chosen mode.

#### Request body

```typescript
interface ReverseStripeInvoiceOobBody {
  jobs_ledger_invoice_id: string
  reason: string // min 3 chars; stored in audit table
  stripe_mode?: 'test' | 'live'
}
```

#### Success (200)

```json
{
  "success": true,
  "stripe_invoice_id": "in_…",
  "stripe_credit_note_id": "cn_…",
  "stripe_invoice_status_after": "open"
}
```

#### Errors

- **400** — Invoice not **Paid** in PipeTooling, missing OOB metadata, invoice has a **charge**, Stripe invoice not **paid**, or neither **`amount_paid`** nor **`total`** yields a positive credit amount (**`Stripe invoice has no amount paid`**).
- **409** — Stripe credit note may have succeeded but RPC returned a business error (check both systems).
- **502** — Stripe API or RPC failure after credit note (partial state possible; message includes warning).

**Webhook**: Subscribe to **`credit_note.created`** so [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts) can **`invoices.retrieve`** and **`syncJobsLedgerStripeInvoiceStatus`**.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy reverse-stripe-invoice-out-of-band-payment --no-verify-jwt`**.

---

### stripe-invoice-agreed-write-down

**Purpose**: Apply an **agreed discount** on a **billed** **Stripe-hosted** **`jobs_ledger_invoices`** row: validates the requested **new total** against Stripe **`amount_paid`** / **`amount_remaining`**, creates a Stripe **credit note** (**`reason: order_change`** — the only credit-note reason that fits an agreed discount; Stripe rejects `customer_request`, which is a *refund* reason — metadata **`pipetooling_write_down`**), **retrieves** the invoice again, and calls RPC **`service_apply_agreed_write_down_from_stripe`** to set **`jobs_ledger_invoices.amount`** (and audit **`agreed_write_down_*`**) from **`(amount_paid + amount_remaining) / 100`**. Non-Stripe rows use **`apply_agreed_write_down_to_billed_invoice`** from the app instead.

**Endpoint**: `POST /functions/v1/stripe-invoice-agreed-write-down`

**Authentication**: Bearer JWT; role **`dev`** / **`master_technician`** / **`assistant`** / **`primary`**. RLS **`SELECT`** on the invoice row.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret for the chosen mode.

#### Request body

```typescript
interface Body {
  jobs_ledger_invoice_id: string
  /** New total obligation in USD after discount (must be < current paid+remaining, ≥ amount already paid). */
  new_total_dollars: number
  note: string // min 3 characters; stored in audit note (credit note id appended server-side)
  stripe_mode?: 'test' | 'live'
}
```

#### Success (200)

```json
{
  "ok": true,
  "stripe_credit_note_id": "cn_…",
  "new_amount": 1505.12
}
```

#### Errors

- **400** — Not **billed**, missing **`stripe_invoice_id`**, Stripe invoice already **paid**, **new_total** not below current obligation or below **`amount_paid`**, or discount exceeds **`amount_remaining`**.
- **401** / **403** — Missing/invalid JWT or role.
- **502** — Stripe API or **`service_apply_agreed_write_down_from_stripe`** failure (credit note may exist; check Stripe and DB).

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy stripe-invoice-agreed-write-down --no-verify-jwt`**.

---

### preview-stripe-invoice

**Purpose**: Return a **Stripe-accurate** invoice preview for a **`jobs_ledger_invoices`** row in **Ready to Bill** using **`invoices.createPreview`** (no Stripe customer creation, no DB writes).

**Endpoint**: `POST /functions/v1/preview-stripe-invoice`

**Authentication**: Same as **create-stripe-invoice** — Bearer JWT + RLS **`SELECT`** on the invoice.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`

#### Request body

Same fields as **create-stripe-invoice** (`jobs_ledger_invoice_id`, `customer_id`, `amount_dollars`, `customer_email`, `customer_name`, `due_date`, optional `memo`, optional **`line_description`** — same 500-char cap; non-empty **`line_description`** forces a single preview line). **`preview-stripe-invoice`** uses the same **Specific Work** multi-line rules as **create-stripe-invoice** when **`line_description`** is blank.

#### Success response (200)

```json
{
  "success": true,
  "currency": "usd",
  "subtotal": 123400,
  "total": 123400,
  "amount_due": 123400,
  "lines": [{ "description": "Job name · HCP 123", "amount": 123400 }]
}
```

Amounts are in **cents**, matching Stripe invoice objects.

#### Behavior

- Validates job/customer ownership via service role (same rules as create).
- Builds the same **`invoice_items`** as **create-stripe-invoice** (multi-line from **`jobs_ledger_fixtures`** when applicable; otherwise one line).
- If **`customers.stripe_customer_id`** is set, previews as that **`customer`**; otherwise uses **`customer_details`** from the body (no `cus_` creation).
- **`collection_method`**, **`days_until_due`**, memo/line description mirror **create-stripe-invoice**.
- Invoice **`number`** in the preview matches **create-stripe-invoice** (`{hcp}-{YYMMDD}{HHmm}` in Chicago time at request time); a later create may use a different **`HHmm`** if the clock has moved.
- Response **`lines`**: Derived from Stripe preview line items passed through **`stripeInvoiceLinesDataForFixtureOrderDisplay`** ([**`stripeInvoiceLinesForFixtureOrderDisplay.ts`**](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)). **Multi-line** arrays are reversed so Bill Customer preview matches **invoice.stripe.com** top-to-bottom (**v2.528**); **`invoice_items`** / creation still follow **`jobs_ledger_fixtures.sequence_order`** ascending (**v2.527**, **`stripeInvoiceItemsFromFixtures`**).

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](../supabase/config.toml). Deploy with **`supabase functions deploy preview-stripe-invoice --no-verify-jwt`** if needed.

---

### void-stripe-invoice-for-revert

**Purpose**: When sending a **billed** **`jobs_ledger_invoices`** row back to **Ready to Bill**, void or delete the Stripe invoice (draft delete, open → void), then clear Stripe columns and set **`status = ready_to_bill`**. Prevents leaving a collectible Stripe invoice after the in-app send-back.

**Endpoint**: `POST /functions/v1/void-stripe-invoice-for-revert`

**Authentication**: Bearer JWT + RLS **`SELECT`** on the invoice (same pattern as **create-stripe-invoice**). **`verify_jwt = false`** on the gateway.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret keys (test/live per **`stripe_mode`**).

#### Request body

```typescript
interface Body {
  jobs_ledger_invoice_id: string
  stripe_mode?: 'test' | 'live'
}
```

#### Success (200)

```json
{ "success": true, "stripe_action": "void" }
```

**`stripe_action`**: `delete_draft` | `void` | `noop` | `noop_missing` | `db_only_no_stripe_id` (Stripe channel but no stored `stripe_invoice_id`).

#### Errors

- **400** — Not **`billed`**, missing Stripe id when not Stripe channel, etc.
- **403** — Invoice not found / RLS.
- **409** — Stripe invoice **paid** or has **`amount_paid` &gt; 0**, or status not voidable automatically.
- **502** — Stripe API error (other than missing invoice).

#### Behavior

1. Requires row **`status = billed`** and Stripe-backed (**`stripe_invoice_id`** set and/or **`external_send_channel = stripe`**).
2. If channel is Stripe but **`stripe_invoice_id`** is empty, clears Stripe-related DB fields and sets **RTB** only (**no** Stripe API call).
3. Otherwise **retrieve** invoice: **draft** → **delete**; **open** (and **`amount_paid === 0`**) → **void**; **void** / **uncollectible** → DB update only; **paid** / payments → **409**.
4. If Stripe returns **resource missing** for the invoice id, still clears DB (idempotent).
5. Service-role **UPDATE** clears **`stripe_invoice_id`**, **`hosted_invoice_url`**, **`stripe_invoice_status`**, **`stripe_invoice_memo`**, **`external_send_channel`**, **`external_send_note`**, **`sent_to_customer_at`**, **`billed_at`**, sets **`ready_to_bill`**.

**Client**: [`src/lib/voidStripeInvoiceForRevert.ts`](../src/lib/voidStripeInvoiceForRevert.ts); Jobs/Dashboard send-back and job-level billed → RTB pre-flight.

**Deploy**: `supabase functions deploy void-stripe-invoice-for-revert --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### stripe-webhook

**Purpose**: Handle Stripe invoice lifecycle events: **`invoice.paid`** / **`invoice.payment_succeeded`** marks the matching **`jobs_ledger_invoices`** row paid via **`mark_invoice_paid_from_stripe`**, then **`complete_job_collect_payment_flow_for_invoice`** when a **`job_collect_payment_flows`** row is **`approved_for_terminal`** for that Stripe invoice (field collect payment hosted page). **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`** sync **`stripe_invoice_status`** only (does not downgrade app **`status`** when the row is already **`paid`**). **`credit_note.created`** **`invoices.retrieve`** + **`syncJobsLedgerStripeInvoiceStatus`** after **reverse-stripe-invoice-out-of-band-payment** credit notes.

**Endpoint**: `POST /functions/v1/stripe-webhook`

**Authentication**: **`Stripe-Signature`** header + raw body (**no** Bearer JWT). **`verify_jwt = false`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY_LIVE` / `STRIPE_SECRET_KEY_TEST` — dual live/test API keys; legacy `STRIPE_SECRET_KEY` is honored as a fallback when its `sk_live_` / `sk_test_` prefix matches the resolved mode (resolution in [`_shared/stripeSecrets.ts`](../supabase/functions/_shared/stripeSecrets.ts), `stripeApiKeyForMode`)
- `STRIPE_WEBHOOK_SECRET_LIVE` / `STRIPE_WEBHOOK_SECRET_TEST` — signature verification tries **live, then test, then legacy `STRIPE_WEBHOOK_SECRET`** (`stripeWebhookSecretsOrdered()`; live first because most prod traffic is livemode)
- `STRIPE_WEBHOOK_DEBUG_FINGERPRINT` (optional) — `1`/`true` logs safe secret fingerprints (length, `whsec_` prefix, last 4 chars — never the full value) when debugging signature failures

#### Request

- Method **POST** with **raw JSON body** (do not parse/re-stringify before verification).
- Header **`stripe-signature`**: signing secret from Stripe Dashboard (or Stripe CLI) must match **`STRIPE_WEBHOOK_SECRET`**.

#### Behavior

1. **`constructEvent`** on raw body.
2. **Dedupe:** insert **`stripe_event_id`** into **`stripe_webhook_events`** (unique). On conflict, respond **`200`** with **`{ "received": true, "duplicate": true }`** and skip processing (reduces duplicate work when Stripe retries). **Dev UI:** Banking → Stripe → **Data** reads this table ([`BankingStripeWebhookEventsPanel.tsx`](../src/components/BankingStripeWebhookEventsPanel.tsx); **`RECENT_FEATURES.md`** v2.284).
3. On **`invoice.paid`** / **`invoice.payment_succeeded`**, resolve **`jobs_ledger_invoices`** by **`stripe_invoice_id`**; invoke **`mark_invoice_paid_from_stripe`** when appropriate; update **`stripe_invoice_status`** to **`paid`** only when the RPC succeeds (or the row was already **`paid`**). Then call **`complete_job_collect_payment_flow_for_invoice`** (service role); log failures without failing the webhook. On lookup errors, RPC errors, or RPC JSON **`{ error }`** (business rule), respond **`200`** with **`applied: false`** and a **`reason`** (e.g. **`invoice_lookup_failed`**, **`mark_paid_rpc_failed`**, **`mark_paid_rejected`**) — **do not** return **`5xx`** for those paths so Stripe does not retry-storm.
4. On **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`**, resolve by **`stripe_invoice_id`** and **PATCH** **`stripe_invoice_status`** from the Stripe object’s **`status`** (skip downgrading when DB row **`status`** is already **`paid`** and Stripe is not **`paid`**).
5. **Unhandled exceptions:** respond **`200`** with **`applied: false`**, **`reason: unhandled_exception`** (logged) so Stripe stops retrying; fix data/code and replay from Stripe Dashboard if needed.
6. **Misconfigured secrets:** respond **`200`** with **`reason: misconfigured`** (no retries). **`400`** only for missing/invalid **`Stripe-Signature`**.

**Response shape (examples):** `{ "received": true }`, `{ "received": true, "applied": false, "reason": "…" }`, `{ "received": true, "duplicate": true }`, `{ "received": true, "skipped": "unknown invoice" }`.

**Ops**: Point Stripe webhook URL at **`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`**. In the Stripe Dashboard, subscribe the endpoint to **`invoice.paid`**, **`invoice.payment_succeeded`**, **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`** (and any other events you still rely on). Use test mode keys in development. When **`applied`** is **`false`**, check **Supabase Edge Function logs** (`stripe-webhook`) and **Stripe → Webhooks → delivery** details — do not rely on HTTP **`5xx`** to surface most failures.

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](../supabase/config.toml). Deploy with **`--no-verify-jwt`**.

---

### sync-mercury-transactions

**Purpose**: **Dev-only** pull from Mercury **[List transactions](https://docs.mercury.com/reference/listtransactions)** into **`mercury_transactions`** (service-role upsert on `mercury_id`). Two invocation paths from the Banking page (`src/pages/Banking.tsx`):

- **Refresh from Mercury** — top-of-page button + Advanced menu item; daily refresh path. Always posts **`{ lookback_days: 90 }`** so the daily round-trip stays fast (~10s) and idempotent.
- **Backfill from Mercury…** (**v2.575**, dev-only Advanced menu item) — opens [`MercuryBackfillModal.tsx`](../src/components/banking/MercuryBackfillModal.tsx) and posts **`{ start, end }`** with a custom `[start, end]` range (default `[today − 365, today]`, range capped at 3650 days client-side; future / reverse ranges blocked). The function already supports this payload — no Edge change.

**Endpoint**: `POST /functions/v1/sync-mercury-transactions`

**Authentication**: either **`Authorization: Bearer <user JWT>`** (function validates session and **`users.role = 'dev'`**) **or** an **`X-Cron-Secret`** header matching the **`CRON_SECRET`** secret — the latter (v2.590) lets the unattended reconciliation cron call it without a dev JWT.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCURY_API_KEY` — read-only Mercury API token ([Getting Started](https://docs.mercury.com/docs/getting-started))
- `CRON_SECRET` — (v2.590) matched against the `X-Cron-Secret` header for the reconciliation cron; must equal Vault `cron_secret`.

#### Request body (optional JSON)

- `start`, `end` — YYYY-MM-DD filter on Mercury **`createdAt`** (defaults: last **90** days through today). When both are provided, `lookback_days` is ignored.
- `lookback_days` — if `start` omitted, use this many days back (default **90**, max **3650**). Used by the everyday **Refresh from Mercury** path; the **Backfill from Mercury…** modal uses explicit `start`/`end` instead.

#### Pagination cap

Internal: 500 rows per Mercury page, **`MAX_PAGES = 120`** (so up to **60,000 transactions per invocation**). A 1-year window for a typical plumbing business is comfortably under this. Larger ranges should be split into multiple invocations (the upsert on `mercury_id` makes overlap safe).

#### Response

```json
{ "success": true, "upserted": 1234, "start": "2025-01-01", "end": "2026-04-01" }
```

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`**; JWT is validated in the function (same pattern as **`create-stripe-invoice`**). Deploy with **`supabase functions deploy sync-mercury-transactions --no-verify-jwt`** if the hosted gateway still enforces JWT.

#### Reconciliation cron (v2.590)

Migration **`20270605150000_sync_mercury_transactions_pg_cron.sql`** schedules this function **every 30 minutes** with body `{"lookback_days": 2}` via pg_cron + `net.http_post` (Vault `project_url` + `cron_secret`, sent as the **`X-Cron-Secret`** header). It is a **safety net for missed webhook deliveries** — `mercury-webhook` is the ~1s real-time path; this slow sweep re-syncs the last 2 days to repair any gaps. `mapMercuryTransactionToRow` + `MERCURY_BASE` are shared with `mercury-webhook` via [`supabase/functions/_shared/mercuryTransaction.ts`](../supabase/functions/_shared/mercuryTransaction.ts).

---

### mercury-webhook

**Purpose**: Receive Mercury **[webhook](https://docs.mercury.com/reference/webhooks)** events for **`transaction`** resources; verify **`Mercury-Signature`**, **dedupe** the delivery, **`GET /transaction/{id}`**, upsert into **`mercury_transactions`** (shared mapper), then **pre-tag** the transaction with a suggested accounting label.

**Endpoint**: `POST /functions/v1/mercury-webhook`

**Authentication**: **`Mercury-Signature`** header + **raw body** (no Bearer JWT). **`verify_jwt = false`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCURY_API_KEY` — fetch full transaction after event
- `MERCURY_WEBHOOK_SECRET` — endpoint **`secretKey`** for HMAC verification (`t` + `.` + raw body per Mercury docs)

**Non-transaction events** (e.g. balance updates) return **200** with `skipped: true`.

**Dedup + auto-suggest** (v2.590):
- **Delivery dedup** — after signature verify, inserts the per-delivery signature into **`mercury_webhook_events`** (insert-first; unique-violation → `200 { duplicate: true }`). Mercury retries at-least-once; the downstream upsert is idempotent regardless, so dedup is an optimization.
- **Server-side label suggestion** — after the upsert, runs the **same accounting-rules matcher** as the Banking Accounting tab (pure copy in [`supabase/functions/_shared/accountingLabelRuleMatch.ts`](../supabase/functions/_shared/accountingLabelRuleMatch.ts)) and, on first match, inserts a **pending** `mercury_accounting_label_suggestions` row via the **service-role** RPC **`insert_accounting_label_suggestion_service`** (the existing `bulk_insert_accounting_label_suggestions` requires `auth.uid()`, which a service-role Edge call lacks). Best-effort — failures here never fail the webhook.
- **Shared mapper** — `mapMercuryTransactionToRow` + `fetchMercuryTransactionById` live in [`supabase/functions/_shared/mercuryTransaction.ts`](../supabase/functions/_shared/mercuryTransaction.ts) (shared with `sync-mercury-transactions`).
- **Migrations**: `20270605120000_mercury_webhook_events_dedupe.sql`, `20270605130000_insert_accounting_label_suggestion_service_rpc.sql`.

**Ops**: Register HTTPS URL **`https://<project-ref>.supabase.co/functions/v1/mercury-webhook`** in Mercury. Webhooks are **not** available in Mercury sandbox.

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](../supabase/config.toml). Deploy with **`--no-verify-jwt`**.

**Enable checklist (production)**:

1. **Deploy** (from repo): `supabase functions deploy mercury-webhook --no-verify-jwt` (use linked project or pass `--project-ref`).
2. **Secrets** (Dashboard → Edge Functions → Secrets, or `supabase secrets set`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCURY_API_KEY`, `MERCURY_WEBHOOK_SECRET` (must match Mercury’s webhook signing secret).
3. **Mercury dashboard**: Create webhook → URL `https://<project-ref>.supabase.co/functions/v1/mercury-webhook` → subscribe to **transaction** events so POST JSON includes `resourceType: "transaction"` and `resourceId`.
4. **Verify**: Edge logs show `200` with `received: true`; new rows appear in `mercury_transactions`. **UI**: After migration adding `mercury_transactions` to `supabase_realtime`, Banking Sorting and Quickfill Banking sorting **debounced-refetch** on `postgres_changes` (no manual Refresh required for DB-driven updates).

---

### get-mercury-account-balances

**Purpose**: Live Mercury account balances for the Balance Sheet cash line: `GET /accounts` from the Mercury API, filters out archived accounts, and returns per-account `currentBalance` / `availableBalance` plus totals. Read-only — nothing is written to the database.

**Endpoint**: `POST /functions/v1/get-mercury-account-balances` (empty JSON body)

**Authentication**: `verify_jwt = false`; in-handler JWT + Banking role gate (`dev` / `master_technician` / `assistant`).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MERCURY_API_KEY`

#### Response

```typescript
{
  ok: true,
  accounts: Array<{ id, name, kind, currentBalance, availableBalance }>,
  totalCurrentBalance: number,
  totalAvailableBalance: number
}
// or { error: string } with 401/403/405/500; 502 on Mercury API failure
```

**Used by**: Banking → [`BankingMercuryCategoryReviewTab.tsx`](../src/components/banking/BankingMercuryCategoryReviewTab.tsx) (Balance Sheet cash).

---

### mercury-reconcile

**Purpose**: Reconcile the books (`mercury_transactions`) against Mercury **statements** and live balances, per account per month: fetches non-archived accounts + up to `monthsBack` statements each (singular `/account/{id}/statements` with plural fallback), checks which statement transaction ids exist in the books via the service-role RPC **`list_present_mercury_ids`** (ids batched 2000-per-call in the POST body — a giant `in.(...)` GET filter would blow PostgREST's URL limit), and reports per-month present/missing counts, missing value + a sample (cap 50), statement net vs. transaction sum, and a **current open period** check (`expectedCurrent = latest ending balance + book activity since close`, `delta` vs. Mercury's live balance).

**Endpoint**: `POST /functions/v1/mercury-reconcile`

**Authentication**: `verify_jwt = false`; in-handler JWT + Banking role gate (`dev` / `master_technician` / `assistant`). Existence checks run service-role because `mercury_transactions` SELECT is dev-only.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCURY_API_KEY`

#### Request Parameters

```typescript
{
  monthsBack?: number   // default 12, clamped 1–24
  accountId?: string    // optional: reconcile a single Mercury account
}
```

#### Response

```typescript
{
  ok: true, generatedAt: string, monthsBack: number,
  accounts: Array<{
    id, name, currentBalance, availableBalance,
    months: Array<{ period, startDate, endDate, statementCount, presentCount, missingCount,
                    missingValue, missingSample, endingBalance, prevEndingBalance,
                    statementNet, statementTxSum }>,
    current: { mercuryCurrentBalance, availableBalance, latestStatementEnd,
               bookActivitySinceClose?, expectedCurrent, delta }
  }>
}
// or { error: string } with 401/403/405/500; 502 on Mercury API failure
```

**Used by**: Banking reconciliation view via [`fetchMercuryReconciliation.ts`](../src/lib/fetchMercuryReconciliation.ts) + [`mercuryReconciliation.ts`](../src/lib/mercuryReconciliation.ts).

---

### import-manual-transactions

**Purpose**: Import **manual (non-Mercury) transactions** — e.g. a closed or external bank account's CSV — into `mercury_transactions` with `source = 'manual'`. Creates a new synthetic account (random UUID + `mercury_account_nicknames` row) or appends to an existing one; **refuses to write manual rows onto a real Mercury account** (any `source = 'mercury'` row on the target id → 400). Multiset de-dup by `(postedDate, amount, payee, memo)` against pre-existing manual rows: a re-upload of already-imported rows is skipped, but genuinely-duplicate rows *within* one upload all import. Rows are stamped with a shared `manual_upload_id`, `created_by`, and `posted_at = <date>T12:00:00Z` (noon UTC keeps the America/Chicago calendar day); the original CSV fields ride along in `raw`.

**Endpoint**: `POST /functions/v1/import-manual-transactions`

**Authentication**: `verify_jwt = false`; in-handler JWT + role gate (`dev` / `master_technician`).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
{
  accountName?: string   // required when creating a new synthetic account
  accountId?: string     // existing synthetic account uuid to append to
  rows: Array<{          // 1–5000 rows; postedDate YYYY-MM-DD + finite amount required
    postedDate: string, amount: number,   // signed; negative = money out
    payee?, memo?, category?, type?, refNo?, reconciliationStatus?
  }>
}
```

#### Response

```typescript
{ ok: true, accountId, accountName, manualUploadId, inserted: number, skipped: number }
// or { error: string } with 400/401/403/405/500
```

**Used by**: Banking → manual CSV import ([`Banking.tsx`](../src/pages/Banking.tsx) + [`parseBankingImportCsv.ts`](../src/lib/parseBankingImportCsv.ts)).

---

### manage-manual-account

**Purpose**: Rename or delete a **manual (synthetic) account** created by `import-manual-transactions`. Guard: refuses to touch any account with real Mercury rows (`source = 'mercury'` → 400) and 404s when the id has no manual rows. **rename** upserts `mercury_account_nicknames`; **delete** removes the account's `source = 'manual'` transactions (dependents clean up via `ON DELETE CASCADE`; `jobs_ledger_payments` is `SET NULL`) and drops the nickname row.

**Endpoint**: `POST /functions/v1/manage-manual-account`

**Authentication**: `verify_jwt = false`; in-handler JWT + role gate (`dev` / `master_technician`).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
{
  action: 'rename' | 'delete'
  accountId: string
  name?: string          // rename only; non-empty, max 120 chars
}
```

#### Response

```typescript
{ ok: true, action: 'rename', accountId, name }
// or { ok: true, action: 'delete', accountId, deleted: number }
// or { error: string } with 400/401/403/404/405/500
```

**Used by**: Banking → [`ManualAccountsModal.tsx`](../src/components/banking/ManualAccountsModal.tsx).

---

## Error Handling

### Standard Error Response Format

All Edge Functions return errors in consistent JSON format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- **200 OK**: Success
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **500 Internal Server Error**: Server-side error

### Common Error Patterns

#### Authentication Errors

```typescript
// No authorization header
{ "error": "Unauthorized - No authorization header" }

// Invalid token format
{ "error": "Unauthorized - Invalid authorization format" }

// Expired or invalid token
{ "error": "Unauthorized - Invalid or expired session. Please sign out and sign in again." }
```

#### Permission Errors

```typescript
// Insufficient role
{ "error": "Forbidden - Only devs can create users" }

// Role-specific restriction
{ "error": "Forbidden - Only devs and masters can login as other users" }
```

#### Validation Errors

```typescript
// Missing required fields
{ "error": "Missing required fields: email, password, and role" }

// Invalid field value
{ "error": "Invalid role. Must be one of: dev, master_technician, assistant, subcontractor, helpers, estimator, primary, superintendent, controller" }

// Password validation
{ "error": "Password must be at least 6 characters" }
```

#### Configuration Errors

```typescript
// Missing secret
{ "error": "SUPABASE_SERVICE_ROLE_KEY not configured" }

// Resend API key missing
{ "error": "RESEND_API_KEY not configured" }
```

### Frontend Error Handling Example

```typescript
try {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email: 'newuser@example.com',
      password: 'password123',
      role: 'assistant'
    }
  })
  
  if (error) {
    console.error('Function error:', error)
    alert(`Error: ${error.message}`)
    return
  }
  
  console.log('Success:', data)
  alert(data.message)
} catch (err) {
  console.error('Unexpected error:', err)
  alert('An unexpected error occurred')
}
```

---

## Deployment

### Prerequisites

1. **Supabase CLI** installed: `npm install -g supabase`
2. **Supabase project** initialized: `supabase login` and `supabase link`
3. **Required secrets** configured in Supabase dashboard

### Required Secrets

Configure these in Supabase Dashboard → Project Settings → Edge Functions (or `supabase secrets set`). The full set read via `Deno.env.get` across the functions:

```bash
# Core (nearly every function)
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # admin operations

# Email via Resend (invites, estimates/contracts, invoices, reports, schedule emails…)
RESEND_API_KEY=...

# Web push (send-workflow/checklist/report notifications, notify-* functions, send-scheduled-reminders)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Cron-driven functions (send-scheduled-reminders, sync-salary-sessions, recurring-job-report-dispatch,
# schedule-day-email-dispatch, schedule-share-dispatch, sync-mercury-transactions); must equal Vault cron_secret
CRON_SECRET=...

# Mercury banking (sync-mercury-transactions, mercury-webhook, get-mercury-account-balances, mercury-reconcile)
MERCURY_API_KEY=...
MERCURY_WEBHOOK_SECRET=...

# Stripe billing (dual live/test; legacy single-key names still honored as fallbacks —
# see _shared/stripeSecrets.ts)
STRIPE_SECRET_KEY_LIVE=...
STRIPE_SECRET_KEY_TEST=...
STRIPE_WEBHOOK_SECRET_LIVE=...
STRIPE_WEBHOOK_SECRET_TEST=...
# legacy fallbacks: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# optional debug: STRIPE_WEBHOOK_DEBUG_FINGERPRINT=1

# Maps / geo
GOOGLE_MAPS_API_KEY=...        # street-view-preview, geocode-one, geocode-address-batch
GSA_API_KEY=...                # gsa-per-diem
IPINFO_TOKEN=...               # resolve-ip-geolocation

# Misc
DEV_LOGIN_SECRET=...               # dev-login
DEV_PROMOTION_CODE=...             # claim-dev
ESTIMATE_PUBLIC_ORIGIN=...         # public estimate/contract links (accept-estimate,
                                   # send-estimate-to-customer, send-contract-for-signature,
                                   # get-contract-signing-link-for-self)
TEAM_LEAD_CLOCK_WEBHOOK_SECRET=... # notify-team-lead-clock DB webhook
```

### Deploy Individual Function

```bash
supabase functions deploy create-user
supabase functions deploy archive-user
supabase functions deploy restore-user
supabase functions deploy login-as-user
supabase functions deploy dev-login
supabase functions deploy send-workflow-notification
supabase functions deploy set-user-password
supabase functions deploy test-email
```

### Deploy All Functions

```bash
supabase functions deploy
```

### Verify Deployment

```bash
# List all functions
supabase functions list

# Check function logs
supabase functions logs create-user
```

### Local Testing

```bash
# Start local Supabase (includes Edge Functions)
supabase start

# Function available at:
# http://localhost:54321/functions/v1/create-user

# Test with curl
curl -X POST http://localhost:54321/functions/v1/create-user \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","role":"assistant"}'
```

### Function-Specific Deployment Notes

Each function has a `DEPLOY.md` or `DEPLOY_NOW.md` file with specific deployment instructions:

- [`create-user/DEPLOY.md`](../supabase/functions/create-user/DEPLOY.md)
- [`archive-user`](../supabase/functions/archive-user/) - Archive users (replaces delete-user)
- [`restore-user`](../supabase/functions/restore-user/) - Restore archived users
- [`login-as-user/DEPLOY.md`](../supabase/functions/login-as-user/DEPLOY.md)
- [`send-workflow-notification/DEPLOY.md`](../supabase/functions/send-workflow-notification/DEPLOY.md)
- [`test-email/DEPLOY.md`](../supabase/functions/test-email/DEPLOY.md)

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Overall architecture
- EMAIL_TEMPLATES_SETUP.md - Email template configuration
- EMAIL_TESTING.md - Email testing procedures
- [Settings page](../src/pages/Settings.tsx) - UI for user management and edge function calls

---

## Troubleshooting

### Common Issues

**Issue**: "SUPABASE_SERVICE_ROLE_KEY not configured"
- **Solution**: Add service role key in Supabase Dashboard → Settings → Edge Functions

**Issue**: "Invalid or expired session"
- **Solution**: Sign out and sign in again to refresh JWT token

**Issue**: "Forbidden - Only devs can..."
- **Solution**: Verify user has correct role in `public.users` table

**Issue**: Email not sending
- **Solution**: 
  1. Verify `RESEND_API_KEY` is configured
  2. Check domain is verified in Resend dashboard
  3. Review function logs: `supabase functions logs send-workflow-notification`

**Issue**: Function timeout
- **Solution**: Edge Functions have 60-second timeout; check for slow database queries or external API calls

### Debug Tips

1. **Check function logs**:
   ```bash
   supabase functions logs <function-name> --tail
   ```

2. **Test locally first**:
   ```bash
   supabase start
   supabase functions serve <function-name>
   ```

3. **Verify secrets**:
   - Check Supabase Dashboard → Settings → Edge Functions
   - Secrets are case-sensitive

4. **Test with curl**:
   ```bash
   curl -X POST https://yourproject.supabase.co/functions/v1/function-name \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"key":"value"}'
   ```

5. **Check CORS**:
   - All functions have CORS enabled
   - If issues persist, verify `corsHeaders` configuration in function code
