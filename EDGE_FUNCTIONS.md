# Edge Functions API Reference

---
file: EDGE_FUNCTIONS.md
type: API Reference
purpose: Complete API documentation for all 10+ Supabase Edge Functions
audience: Developers, DevOps, AI Agents
last_updated: 2026-04-21
estimated_read_time: 20-25 minutes
difficulty: Intermediate

runtime: "Deno (TypeScript)"
authentication: "Manual JWT validation"
total_functions: 35

key_sections:
  - name: "create-user"
    line: ~55
    anchor: "#create-user"
    description: "Create users with roles (dev-only)"
  - name: "archive-user"
    line: ~181
    anchor: "#archive-user"
    description: "Archive users by email/name (dev-only)"
  - name: "restore-user"
    line: ~250
    anchor: "#restore-user"
    description: "Restore archived users (dev-only)"
  - name: "login-as-user"
    line: ~293
    anchor: "#login-as-user"
    description: "Generate magic link for impersonation"
  - name: "send-workflow-notification"
    line: ~401
    anchor: "#send-workflow-notification"
    description: "Send email notifications via Resend"
  - name: "set-user-password"
    line: ~497
    anchor: "#set-user-password"
    description: "Set user password (dev-only)"
  - name: "test-email"
    line: ~571
    anchor: "#test-email"
    description: "Test email templates"
  - name: "Error Handling"
    line: ~655
    anchor: "#error-handling"
    description: "Standard error responses"
  - name: "Deployment"
    line: ~747
    anchor: "#deployment"
    description: "Deploy and test procedures"

quick_navigation:
  - "[All Functions](#functions) - Complete function list"
  - "[Error Responses](#error-handling) - Error format and codes"
  - "[Deployment Guide](#deployment) - How to deploy"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Architecture context"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role requirements"
  - "[EMAIL_TEMPLATES_SETUP.md](./EMAIL_TEMPLATES_SETUP.md) - Email config"

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
   - [archive-user](#archive-user)
   - [restore-user](#restore-user)
   - [login-as-user](#login-as-user)
   - [dev-login](#dev-login)
   - [send-workflow-notification](#send-workflow-notification)
   - [send-checklist-notification](#send-checklist-notification)
   - [notify-dispatch-request](#notify-dispatch-request)
   - [notify-estimator-request](#notify-estimator-request)
   - [notify-team-lead-clock](#notify-team-lead-clock)
   - [set-user-password](#set-user-password)
   - [claim-dev](#claim-dev)
   - [test-email](#test-email)
   - [create-stripe-invoice](#create-stripe-invoice)
   - [send-physical-invoice-email](#send-physical-invoice-email)
   - [send-stripe-invoice](#send-stripe-invoice)
   - [update-collect-payment-stripe-customer-email](#update-collect-payment-stripe-customer-email)
   - [get-stripe-invoice-details](#get-stripe-invoice-details)
   - [record-stripe-invoice-out-of-band-payment](#record-stripe-invoice-out-of-band-payment)
   - [reverse-stripe-invoice-out-of-band-payment](#reverse-stripe-invoice-out-of-band-payment)
   - [preview-stripe-invoice](#preview-stripe-invoice)
   - [void-stripe-invoice-for-revert](#void-stripe-invoice-for-revert)
   - [stripe-webhook](#stripe-webhook)
4. [Error Handling](#error-handling)
5. [Deployment](#deployment)

---

## Overview

PipeTooling uses Supabase Edge Functions (Deno runtime) for privileged server-side operations that require elevated permissions or external API access. All functions use manual JWT validation with gateway verification disabled.

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
- `'estimator'`

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
  "error": "Invalid role. Must be one of: dev, master_technician, assistant, subcontractor, estimator"
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

**Deployment**: See [`supabase/functions/create-user/DEPLOY.md`](supabase/functions/create-user/DEPLOY.md)

---

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
   - **Exit UI**: [`Layout`](src/components/Layout.tsx) shows mobile **Back**; on desktop a short **Back** control with **`title`/`aria-label`** carrying the full “stop impersonating …” phrase. [`Settings`](src/pages/Settings.tsx) uses **Back to my Account** on mobile and the same desktop pattern. See **`RECENT_FEATURES.md`** v2.231 and **`PROJECT_DOCUMENTATION.md`** Impersonation flow.

**Use Cases**:
- Debugging user-specific issues
- Assisting users with their accounts
- Testing permissions and access control

**Production URL Configuration**: For imitate to work on production (e.g. pipetooling.com), configure Supabase Auth:
- **Authentication** → **URL Configuration**
- **Site URL**: Set to production URL (e.g. `https://pipetooling.com`)
- **Redirect URLs**: Add both `https://pipetooling.com/**` and `http://localhost:5173/**`. Settings imitate uses localhost; People → Users imitate (dev-only) uses pipetooling.com.

**Deployment**: See [`supabase/functions/login-as-user/DEPLOY.md`](supabase/functions/login-as-user/DEPLOY.md)

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

**Gateway JWT**: Repo [`supabase/config.toml`](supabase/config.toml) sets **`verify_jwt = false`** for this function; deploy with **`supabase functions deploy send-workflow-notification --no-verify-jwt`** so the gateway does not return 401 before the function runs.

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

Devs: **Settings → Templates & testing → Workflow email (Edge Function)** (collapsible): one-shot invoke with placeholder data; omits **`recipient_user_id`** so **`notification_history`** is not written. See **[`WORKFLOW_EMAIL_TESTING.md`](./WORKFLOW_EMAIL_TESTING.md)** and **[`RECENT_FEATURES.md`](./RECENT_FEATURES.md)** v2.186.

#### Implementation Details

1. **`getUser(JWT)`** from **`Authorization`** header
2. Load **`subject`/`body`** from **`public.email_templates`** by **`template_type`**
3. Replace **`{{variable}}`** from **`variables`**
4. POST to Resend
5. Optional Web Push to **`push_subscriptions`** for **`recipient_user_id`**
6. Optional **`notification_history`** insert when **`recipient_user_id`** and service role resolve **`step_id`** → workflow/project

**See Also**:

- [EMAIL_TEMPLATES_SETUP.md](./EMAIL_TEMPLATES_SETUP.md)
- [WORKFLOW_EMAIL_TESTING.md](./WORKFLOW_EMAIL_TESTING.md)

**Deployment**: [`supabase/functions/send-workflow-notification/DEPLOY.md`](supabase/functions/send-workflow-notification/DEPLOY.md)

---

### get-estimate-for-customer

**Purpose**: Public read of a **sent** estimate for the customer acceptance page (no JWT).

**Endpoint**: `GET /functions/v1/get-estimate-for-customer?token=<opaque>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](supabase/config.toml).

**Behavior**: SHA-256 hash of `token`; load row by `public_token_hash` where `status = sent`; enforce `public_token_expires_at` and `valid_until`. Returns estimate fields plus **`customer_experience`**: public UI strings (accept, thank-you, document labels — omits email subject/body). Uses **`customer_experience_sent`** when set, else merges **`app_settings`** + **`customer_experience_overrides`**. If **`status = customer_accepted`**, responds **409** with `code: already_accepted` and **`customer_experience`** for the thank-you page.

**200 response**: Includes **`for_line`** (`string | null`): staff **For:** line — trimmed **`for_address`** if set, else trimmed linked **`customers.address`**, else `null` (UI may show em dash).

**Audit**: On each successful **200** for **`status = sent`**, calls Postgres **`record_estimate_public_link_view`** via **`service_role`** **`rpc`** to append **`estimate_customer_events`** with **`event_type = public_link_view`** and **`client_ip` / `user_agent`** from the request ( **`SECURITY DEFINER`** in-db insert; failures are **`console.error`**’d and do not change the response). See migration [`20260406034514_record_estimate_public_link_view_rpc.sql`](supabase/migrations/20260406034514_record_estimate_public_link_view_rpc.sql). **Dedupe**: [`20260412184127_dedupe_record_estimate_public_link_view.sql`](supabase/migrations/20260412184127_dedupe_record_estimate_public_link_view.sql) skips a second **`public_link_view`** for the same estimate, IP, and user-agent within **5 seconds** (Strict Mode double-fetch, etc.).

---

### get-estimate-public-terms

**Purpose**: Public read of dev-editable **global** Terms and Conditions body for **`/estimate/terms`** (no JWT). Anonymous users cannot SELECT `app_settings`; this function uses the service role.

**Endpoint**: `GET /functions/v1/get-estimate-public-terms`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](supabase/config.toml).

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

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`

**Behavior**: Idempotent if already `customer_accepted` (returns **`200`** + **`alreadyAccepted: true`**). Captures **`acceptor_ip`** from **`x-forwarded-for`** (first hop) and **`user-agent`** on the real **`sent` → `customer_accepted`** update.

**Audit**:
- **First acceptance** (**`sent` → `customer_accepted`**): the **`estimate_customer_events`** row (**`public_accept_submitted`**, IP/UA, **`metadata.had_signature`**) is written by the **database trigger** [`estimates_audit_customer_accepted_trigger`](supabase/migrations/20260406033952_estimates_audit_customer_accepted_trigger.sql) in the **same transaction** as the **`estimates`** update (Edge does not insert that row on the success path).
- **`alreadyAccepted: true`** (repeat **POST** while already accepted): best-effort **`insertEstimateCustomerEvent`** via **`log_estimate_customer_event`** / insert fallback in [`_shared/logEstimateCustomerEvent.ts`](supabase/functions/_shared/logEstimateCustomerEvent.ts), with **`metadata.repeat_after_accepted`** (does not change **`200`** success).

**Related (Postgres, not Edge)**: Staff create **`jobs_ledger`** and set **`estimates.job_ledger_id`** via authenticated RPC **`create_job_from_estimate`** — see [`20260405072854_estimate_create_job_rpc.sql`](supabase/migrations/20260405072854_estimate_create_job_rpc.sql) and [`Estimates.tsx`](src/pages/Estimates.tsx).

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

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](supabase/config.toml).

**Behavior**: SHA-256 hash of `token`; load row by **`public_token_hash`** where **`status = sent`**; enforce **`public_token_expires_at`**. Returns **`signing_body_html`**, **`canonical_document_url`** (canonical column, else legacy **`url`**), **`document_name`**, **`person_name`** (still used for staff/email context; the public signing page in [`ContractAccept.tsx`](src/pages/ContractAccept.tsx) does **not** display **For:** **`person_name`**). If **`status = signed`**, responds **409** with **`code: already_signed`** and optional thank-you strings (the app thank-you may use title-only copy; see **`RECENT_FEATURES.md`** v2.368).

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

**Implementation**: [`supabase/functions/get-contract-signing-link-for-self/index.ts`](supabase/functions/get-contract-signing-link-for-self/index.ts)

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

**Implementation**: [`supabase/functions/check-estimate-attachment-url/index.ts`](supabase/functions/check-estimate-attachment-url/index.ts); UI: draft **Check link** in [`Estimates.tsx`](src/pages/Estimates.tsx); **Documents** add-link modal via [`checkGoogleDriveAttachmentUrl`](src/lib/checkGoogleDriveAttachmentUrl.ts) ([`DocumentsAddDriveLinkModal.tsx`](src/components/documents/DocumentsAddDriveLinkModal.tsx)).

---

### resolve-ip-geolocation

**Purpose**: Resolve a **public** IPv4/IPv6 address to approximate **lat/lng** (via **ipinfo.io**) so staff can open **Google Maps**. Used from **Estimates** customer activity and acceptance IP lines ([`IpAddressMapButton`](src/components/estimates/IpAddressMapButton.tsx)).

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

**Purpose**: **Proxy** Google **Street View Static** imagery and **metadata** so the Maps API key stays server-side. Used by **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)** (Street View preview under **Address**); client loads the image with **`fetch` + `Authorization`** (not `<img src>`) and **`URL.createObjectURL`**.

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

**Implementation**: [`supabase/functions/street-view-preview/index.ts`](supabase/functions/street-view-preview/index.ts); client: [`src/lib/fetchStreetViewPreview.ts`](src/lib/fetchStreetViewPreview.ts).

---

### geocode-address-batch

**Purpose**: **Dev-only** batch geocoding for the **Map** page. Normalizes addresses, reads/writes **`public.address_geocodes`** via the user’s JWT (RLS), and for cache misses: **OpenStreetMap Nominatim** first, then **Google Geocoding API** if **`GOOGLE_MAPS_API_KEY`** is set and Nominatim does not return coordinates (rate-limited **~1.1s** between *Nominatim* request rounds server-side). There is **no** extra inter-address delay before the Google attempt in the same row.

**Endpoint**: `POST /functions/v1/geocode-address-batch`

**Body** (JSON): `{ "addresses": string[] }` — display strings (e.g. job street); max **20** per request.

**Response** (**200** JSON): `{ "results": { "address_normalized": string, "lat": number, "lng": number }[] }`

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional **`GOOGLE_MAPS_API_KEY`** (same as [`street-view-preview`](#street-view-preview); enable **Geocoding API** in Google Cloud; key stays on the server). If the key is unset, behavior matches **Nominatim-only** (rows Nominatim cannot resolve are omitted from `results`).

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role = 'dev'`** in the function (**403** otherwise).

**Errors**: **401** not signed in; **403** not dev; **400** bad body or too many addresses; **500** DB or upsert failure.

**Deploy**: `supabase functions deploy geocode-address-batch`

**Implementation**: [`supabase/functions/geocode-address-batch/index.ts`](supabase/functions/geocode-address-batch/index.ts) + shared [`supabase/functions/_shared/googleGeocode.ts`](supabase/functions/_shared/googleGeocode.ts). **Map** page uses the single-address function below; this batch function remains for bulk or scripts.

---

### geocode-one

**Purpose**: **Dev-only** single-address geocoding: same **`address_geocodes`** cache and upsert as batch. For a miss: **Nominatim** first, then **Google Geocoding API** if **`GOOGLE_MAPS_API_KEY`** is set and Nominatim does not return usable coordinates. One address per request for clearer logs. The **Map** app calls it **sequentially** and only waits **~1100ms** after responses that used **Nominatim** live (not cache, not a Google-only success); see **Client pacing** and **`source`**.

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

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role = 'dev'`** in the function (**403** otherwise).

**Client pacing**: The batch function waits **~1.1s** between *rows* for Nominatim. The Map hook waits **~1100ms** after each **`geocode-one`** success whose **`source`** is **`nominatim`** (Nominatim public etiquette). It does **not** add that delay after **cache** hits or after **`source: "google"`** so back-to-back Google resolutions stay fast. Coordinates are still stored in **`address_geocodes`** the same as today; follow Google’s Maps Platform terms for your deployment.

**Deploy**: `supabase functions deploy geocode-one`

**Implementation**: [`supabase/functions/geocode-one/index.ts`](supabase/functions/geocode-one/index.ts) + shared [`supabase/functions/_shared/googleGeocode.ts`](supabase/functions/_shared/googleGeocode.ts); client: [`src/hooks/useMapPageData.ts`](src/hooks/useMapPageData.ts) + Map UI: [`src/components/map/MapPageView.tsx`](src/components/map/MapPageView.tsx) + **Review geocodes** modal: [`src/components/map/MapGeocodeReviewModal.tsx`](src/components/map/MapGeocodeReviewModal.tsx), [`src/lib/map/invokeGeocodeOneRefreshGoogleOnly.ts`](src/lib/map/invokeGeocodeOneRefreshGoogleOnly.ts).

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

### sync-salary-sessions

**Purpose**: Materialize and close `clock_sessions` with `origin = 'salary_schedule'` for all users who have a row in `salary_work_schedule_templates`, for the current **America/Chicago** calendar date. Intended to run every 1–5 minutes via cron (same auth pattern as `send-scheduled-reminders`).

**Endpoint**: `POST /functions/v1/sync-salary-sessions`

**Required Role**: None (validates `CRON_SECRET`; uses service role for `sync_salary_clock_sessions_for_day`).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

**Verify JWT**: `false` (`supabase/config.toml`)

**Request**: Optional body `{"cron_secret":"..."}` or header `X-Cron-Secret`.

**Success**: `{ "success": true, "work_date": "YYYY-MM-DD" }`

**Database behavior**: Invokes **`sync_salary_clock_sessions_for_day`**, which runs **`salary_sync_one_user_clock_sessions`** per templated user. That function uses **template block boundaries**: mass-close all opens for the user/**`work_date`** at each block end; open canonical **`salary_schedule`** rows only when no session is open that day. See **[`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)**.

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

**Purpose**: Promote the current user to dev role by entering the promotion code (stored in Supabase secret)

**Endpoint**: `POST /functions/v1/claim-dev`

**Required Role**: Authenticated user (any role; promotes self to dev on success)

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

**Gateway JWT**: [`supabase/config.toml`](supabase/config.toml) sets **`verify_jwt = false`** for **`test-email`** (JWT is still validated in the function). Deploy with **`--no-verify-jwt`** if the hosted function still verifies JWT at the edge. Call **`functions.invoke`** with **`Authorization: Bearer`** from **`refreshSession()`**’s **`access_token`**.

**Request body** (required): **`to`**, **`subject`**, **`body`**; **`template_type`** is optional metadata for logging.

**See Also**: 
- [EMAIL_TESTING.md](./EMAIL_TESTING.md) - Complete testing documentation
- [`supabase/functions/test-email/README.md`](supabase/functions/test-email/README.md)

**Deployment**: See [`supabase/functions/test-email/DEPLOY.md`](supabase/functions/test-email/DEPLOY.md)

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

**`invoice_preview`**: Finalized invoice line items and totals (**amounts in cents**), same shape as **`preview-stripe-invoice`** line payload; omitted if an idempotent **`invoices.retrieve`** fails. Bill Customer uses it to show the invoice table after create.

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
5. **Line items from Specific Work**: Loads **`jobs_ledger_fixtures`** for the invoice’s job. When there are **billable** rows (trimmed **`name`**, **`count × line_unit_price`** in dollars **> 0**) and **`line_description`** is omitted or blank, creates **one** Stripe line per row (ordered by **`sequence_order`**; description from name + optional scope text), with cent amounts **scaled proportionally** to **`amount_dollars`** when the bill is less than the fixture subtotal so the lines sum exactly. A non-empty **`line_description`** keeps the legacy behavior: **one** line for the full amount using that description (or the default **`Customer · Job · HCP`** string when not overridden).

**Gateway JWT**: [`supabase/config.toml`](supabase/config.toml) sets **`verify_jwt = false`**. Deploy with **`supabase functions deploy create-stripe-invoice --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### send-physical-invoice-email

**Purpose**: Email the customer a **PDF invoice** (generated in the app to match the on-screen preview) via **Resend**, then persist the **`jobs_ledger_invoices`** billing fields as a **Physical** send (**`status: billed`**, **`external_send_channel: physical`**, **`sent_to_customer_at`**, **`external_send_note`**, **`amount`**). It does **not** call **`update_job_status`** on **`jobs_ledger`**. After a **200** response, **[`SendRecordInvoiceModal`](src/components/jobs/SendRecordInvoiceModal.tsx)** runs **`maybePromoteJobToBilledAfterCustomerInvoice`** ([`promoteJobToBilledIfFullyInvoiced.ts`](src/lib/promoteJobToBilledIfFullyInvoiced.ts)) — the same helper used after **Stripe** **`create-stripe-invoice`** and **HouseCall Pro** manual bill — so when the job is **fully invoiced out** (no **`ready_to_bill`** rows; **`jobBillingUnallocatedDollars`** ~ 0), the **job** moves to **billed** together with the invoice line regardless of billing channel. The client may send a **detailed** multi-section PDF (Specific Work + materials + payment history) built from the job ledger; the Edge function only validates and attaches **`pdf_base64`**.

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

**Client**: [`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx) (**Physical invoice** tab) invokes this Edge Function, then **`maybePromoteJobToBilledAfterCustomerInvoice`** on success. **`subject`** is **[`physicalInvoiceEmailSubject`](src/lib/physicalInvoiceDocument.ts)** (**`Click Plumbing Invoice [#…]`**). **`email_text`** / **`email_html`** are built by **[`buildPhysicalInvoiceEmailBodies`](src/lib/physicalInvoiceDocument.ts)** (HTML summary: bold issuer **tagline** under the intro; no **Service date** or **Issuer** block—PDF is authoritative).

**Deploy**: `supabase functions deploy send-physical-invoice-email --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### send-stripe-invoice

**Purpose**: Call Stripe **`invoices.sendInvoice`** for an open billed line so Stripe emails the customer the payment link. After Stripe accepts the send, updates **`jobs_ledger_invoices`** with **`sent_to_customer_at`** (now) and **`stripe_invoice_status`** from the returned invoice (service role; retries a few times on transient DB errors). Each successful send **overwrites** **`sent_to_customer_at`** (latest send only). On success, also **INSERT** into **`jobs_ledger_invoice_stripe_email_sends`** (append-only log for the confirm modal **Most recent sends** list; insert failure is **logged** only—the HTTP response still **200** if the invoice row updated). Used for the primary **Send Email invoice from Stripe** control and for **Resend invoice email** on Jobs **Stages** **Last activity** ([`StripeInvoiceSendFromStripeButton`](src/components/jobs/StripeInvoiceSendFromStripeButton.tsx)), and for **Email invoice to customer** on Dashboard **Collect Payment** step 3 ([`CollectPaymentModal`](src/components/jobs/CollectPaymentModal.tsx)).

Pre-send validation uses **[`customerEmailFromStripeInvoice`](supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)** on the retrieved invoice (**expanded Customer `email` first**, then **`invoice.customer_email`**).

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

**Purpose**: Let a **subcontractor** on **Collect Payment** step 3 correct the payer email before **Email invoice to customer**. Updates the Stripe **Customer** `email` via **`customers.update`**, then updates the **open** Stripe invoice’s **`customer_email`** via **`invoices.update`** (keeps invoice snapshot aligned; UI resolution still prefers expanded Customer in **[`customerEmailFromStripeInvoice`](supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**), then syncs **`jobs_ledger.customer_email`** and merges **`customers.contact_info.email`** (preserving **`phone`**) with the service role so office data and **`get_collect_payment_certify_payload`** stay aligned with **`send-stripe-invoice`** / **`get-stripe-invoice-details`**.

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

**Client**: [`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx) step 3 **Change email**.

**Gateway JWT**: Deploy with **`supabase functions deploy update-collect-payment-stripe-customer-email --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### get-stripe-invoice-details

**Purpose**: **`invoices.retrieve`** (with **`expand: ['customer']`**) + line items for a billed **`jobs_ledger_invoices`** row with **`stripe_invoice_id`**. Used by **Hosted bill** UI and **Collect Payment** step 3 (Stripe-resolved customer email). Response **`customer_email`** matches **`send-stripe-invoice`** resolution (**expanded Customer `email` first**, then **`invoice.customer_email`**) per **[`customerEmailFromStripeInvoice`](supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**.

**Endpoint**: `POST /functions/v1/get-stripe-invoice-details`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Staff** (non–`subcontractor`): invoice row loaded with the user-scoped client (**RLS** **`SELECT`**). **`subcontractor`**: invoice row loaded with **service role** only after **`jobs_ledger_team_members`** and **`job_collect_payment_flows`** **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request (same gate as **`send-stripe-invoice`** for field email); memo/footer backfill uses **service role** for subs.

**Success body** (partial): includes **`memo`** (Stripe **`description`**) and **`footer`** (Stripe **`footer`**) as separate strings when present. May service-backfill **`stripe_invoice_memo`** / **`stripe_invoice_footer`** on the ledger row when empty.

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

**Gateway JWT**: [`supabase/config.toml`](supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy record-stripe-invoice-out-of-band-payment --no-verify-jwt`** if the hosted gateway still enforces JWT.

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

**Webhook**: Subscribe to **`credit_note.created`** so [`stripe-webhook`](supabase/functions/stripe-webhook/index.ts) can **`invoices.retrieve`** and **`syncJobsLedgerStripeInvoiceStatus`**.

**Gateway JWT**: [`supabase/config.toml`](supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy reverse-stripe-invoice-out-of-band-payment --no-verify-jwt`**.

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

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](supabase/config.toml). Deploy with **`supabase functions deploy preview-stripe-invoice --no-verify-jwt`** if needed.

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

**Client**: [`src/lib/voidStripeInvoiceForRevert.ts`](src/lib/voidStripeInvoiceForRevert.ts); Jobs/Dashboard send-back and job-level billed → RTB pre-flight.

**Deploy**: `supabase functions deploy void-stripe-invoice-for-revert --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### stripe-webhook

**Purpose**: Handle Stripe invoice lifecycle events: **`invoice.paid`** / **`invoice.payment_succeeded`** marks the matching **`jobs_ledger_invoices`** row paid via **`mark_invoice_paid_from_stripe`**, then **`complete_job_collect_payment_flow_for_invoice`** when a **`job_collect_payment_flows`** row is **`approved_for_terminal`** for that Stripe invoice (field collect payment hosted page). **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`** sync **`stripe_invoice_status`** only (does not downgrade app **`status`** when the row is already **`paid`**). **`credit_note.created`** **`invoices.retrieve`** + **`syncJobsLedgerStripeInvoiceStatus`** after **reverse-stripe-invoice-out-of-band-payment** credit notes.

**Endpoint**: `POST /functions/v1/stripe-webhook`

**Authentication**: **`Stripe-Signature`** header + raw body (**no** Bearer JWT). **`verify_jwt = false`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

#### Request

- Method **POST** with **raw JSON body** (do not parse/re-stringify before verification).
- Header **`stripe-signature`**: signing secret from Stripe Dashboard (or Stripe CLI) must match **`STRIPE_WEBHOOK_SECRET`**.

#### Behavior

1. **`constructEvent`** on raw body.
2. **Dedupe:** insert **`stripe_event_id`** into **`stripe_webhook_events`** (unique). On conflict, respond **`200`** with **`{ "received": true, "duplicate": true }`** and skip processing (reduces duplicate work when Stripe retries). **Dev UI:** Banking → Stripe → **Data** reads this table ([`BankingStripeWebhookEventsPanel.tsx`](src/components/BankingStripeWebhookEventsPanel.tsx); **`RECENT_FEATURES.md`** v2.284).
3. On **`invoice.paid`** / **`invoice.payment_succeeded`**, resolve **`jobs_ledger_invoices`** by **`stripe_invoice_id`**; invoke **`mark_invoice_paid_from_stripe`** when appropriate; update **`stripe_invoice_status`** to **`paid`** only when the RPC succeeds (or the row was already **`paid`**). Then call **`complete_job_collect_payment_flow_for_invoice`** (service role); log failures without failing the webhook. On lookup errors, RPC errors, or RPC JSON **`{ error }`** (business rule), respond **`200`** with **`applied: false`** and a **`reason`** (e.g. **`invoice_lookup_failed`**, **`mark_paid_rpc_failed`**, **`mark_paid_rejected`**) — **do not** return **`5xx`** for those paths so Stripe does not retry-storm.
4. On **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`**, resolve by **`stripe_invoice_id`** and **PATCH** **`stripe_invoice_status`** from the Stripe object’s **`status`** (skip downgrading when DB row **`status`** is already **`paid`** and Stripe is not **`paid`**).
5. **Unhandled exceptions:** respond **`200`** with **`applied: false`**, **`reason: unhandled_exception`** (logged) so Stripe stops retrying; fix data/code and replay from Stripe Dashboard if needed.
6. **Misconfigured secrets:** respond **`200`** with **`reason: misconfigured`** (no retries). **`400`** only for missing/invalid **`Stripe-Signature`**.

**Response shape (examples):** `{ "received": true }`, `{ "received": true, "applied": false, "reason": "…" }`, `{ "received": true, "duplicate": true }`, `{ "received": true, "skipped": "unknown invoice" }`.

**Ops**: Point Stripe webhook URL at **`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`**. In the Stripe Dashboard, subscribe the endpoint to **`invoice.paid`**, **`invoice.payment_succeeded`**, **`invoice.updated`**, **`invoice.voided`**, and **`invoice.payment_failed`** (and any other events you still rely on). Use test mode keys in development. When **`applied`** is **`false`**, check **Supabase Edge Function logs** (`stripe-webhook`) and **Stripe → Webhooks → delivery** details — do not rely on HTTP **`5xx`** to surface most failures.

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](supabase/config.toml). Deploy with **`--no-verify-jwt`**.

---

### sync-mercury-transactions

**Purpose**: **Dev-only** pull from Mercury **[List transactions](https://docs.mercury.com/reference/listtransactions)** into **`mercury_transactions`** (service-role upsert). Invoked from the Banking page **Refresh** button via `supabase.functions.invoke`.

**Endpoint**: `POST /functions/v1/sync-mercury-transactions`

**Authentication**: **`Authorization: Bearer <user JWT>`**. Function validates session and **`users.role = 'dev'`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCURY_API_KEY` — read-only Mercury API token ([Getting Started](https://docs.mercury.com/docs/getting-started))

#### Request body (optional JSON)

- `start`, `end` — YYYY-MM-DD filter on Mercury **`createdAt`** (defaults: last **90** days through today).
- `lookback_days` — if `start` omitted, use this many days back (default **90**, max **3650**).

#### Response

```json
{ "success": true, "upserted": 1234, "start": "2025-01-01", "end": "2026-04-01" }
```

**Gateway JWT**: [`supabase/config.toml`](supabase/config.toml) sets **`verify_jwt = false`**; JWT is validated in the function (same pattern as **`create-stripe-invoice`**). Deploy with **`supabase functions deploy sync-mercury-transactions --no-verify-jwt`** if the hosted gateway still enforces JWT.

---

### mercury-webhook

**Purpose**: Receive Mercury **[webhook](https://docs.mercury.com/reference/webhooks)** events for **`transaction`** resources; verify **`Mercury-Signature`**, **`GET /transaction/{id}`**, upsert into **`mercury_transactions`**.

**Endpoint**: `POST /functions/v1/mercury-webhook`

**Authentication**: **`Mercury-Signature`** header + **raw body** (no Bearer JWT). **`verify_jwt = false`**.

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCURY_API_KEY` — fetch full transaction after event
- `MERCURY_WEBHOOK_SECRET` — endpoint **`secretKey`** for HMAC verification (`t` + `.` + raw body per Mercury docs)

**Non-transaction events** (e.g. balance updates) return **200** with `skipped: true`.

**Ops**: Register HTTPS URL **`https://<project-ref>.supabase.co/functions/v1/mercury-webhook`** in Mercury. Webhooks are **not** available in Mercury sandbox.

**Gateway JWT**: **`verify_jwt = false`** in [`supabase/config.toml`](supabase/config.toml). Deploy with **`--no-verify-jwt`**.

**Enable checklist (production)**:

1. **Deploy** (from repo): `supabase functions deploy mercury-webhook --no-verify-jwt` (use linked project or pass `--project-ref`).
2. **Secrets** (Dashboard → Edge Functions → Secrets, or `supabase secrets set`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCURY_API_KEY`, `MERCURY_WEBHOOK_SECRET` (must match Mercury’s webhook signing secret).
3. **Mercury dashboard**: Create webhook → URL `https://<project-ref>.supabase.co/functions/v1/mercury-webhook` → subscribe to **transaction** events so POST JSON includes `resourceType: "transaction"` and `resourceId`.
4. **Verify**: Edge logs show `200` with `received: true`; new rows appear in `mercury_transactions`. **UI**: After migration adding `mercury_transactions` to `supabase_realtime`, Banking Sorting and Quickfill Banking sorting **debounced-refetch** on `postgres_changes` (no manual Refresh required for DB-driven updates).

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
{ "error": "Invalid role. Must be one of: dev, master_technician, assistant, subcontractor, estimator" }

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

Configure these in Supabase Dashboard → Project Settings → Edge Functions:

```bash
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
RESEND_API_KEY=your-resend-api-key               # For email functions
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

- [`create-user/DEPLOY.md`](supabase/functions/create-user/DEPLOY.md)
- [`archive-user`](supabase/functions/archive-user/) - Archive users (replaces delete-user)
- [`restore-user`](supabase/functions/restore-user/) - Restore archived users
- [`login-as-user/DEPLOY.md`](supabase/functions/login-as-user/DEPLOY.md)
- [`send-workflow-notification/DEPLOY.md`](supabase/functions/send-workflow-notification/DEPLOY.md)
- [`test-email/DEPLOY.md`](supabase/functions/test-email/DEPLOY.md)

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Overall architecture
- [EMAIL_TEMPLATES_SETUP.md](./EMAIL_TEMPLATES_SETUP.md) - Email template configuration
- [EMAIL_TESTING.md](./EMAIL_TESTING.md) - Email testing procedures
- [Settings page](./src/pages/Settings.tsx) - UI for user management and edge function calls

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
