# Edge Functions API Reference

---
file: EDGE_FUNCTIONS.md
type: API Reference
purpose: Complete API documentation for all 84 Supabase Edge Functions
audience: Developers, DevOps, AI Agents
last_updated: 2026-09-05
estimated_read_time: 20-25 minutes
difficulty: Intermediate

runtime: "Deno (TypeScript)"
authentication: "In-function JWT / signature / cron-secret validation for most functions (see Overview for the two gateway-verified exceptions)"
total_functions: 84

key_sections:
  - name: "Functions"
    anchor: "#functions"
    description: "Per-function reference (all 84), user admin through Stripe/Mercury"
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
   - [send-supply-house-job-account](#send-supply-house-job-account)
   - [invite-user](#invite-user)
   - [send-sign-in-email](#send-sign-in-email)
   - [merge-users](#merge-users)
   - [notify-help-feedback](#notify-help-feedback)
   - [gsa-per-diem](#gsa-per-diem)
   - [archive-user](#archive-user)
   - [restore-user](#restore-user)
   - [login-as-user](#login-as-user)
   - [dev-login](#dev-login)
   - [twin-login](#twin-login)
   - [twin-mcp](#twin-mcp)
   - [drive-intake](#drive-intake)
   - [ct-bridge](#ct-bridge)
   - [audit-finish](#audit-finish)
   - [ct-roster-audit](#ct-roster-audit)
   - [address-autocomplete](#address-autocomplete)
   - [send-workflow-notification](#send-workflow-notification)
   - [get-estimate-for-customer](#get-estimate-for-customer)
   - [log-estimate-option-view](#log-estimate-option-view)
   - [get-bid-proposal-room](#get-bid-proposal-room)
   - [send-bid-room-link](#send-bid-room-link)
   - [sign-bid-room](#sign-bid-room)
   - [send-job-contract](#send-job-contract)
   - [get-job-contract](#get-job-contract)
   - [sign-job-contract](#sign-job-contract)
   - [remind-job-contracts](#remind-job-contracts)
   - [share-job-contract](#share-job-contract)
   - [get-rfq-quote-page](#get-rfq-quote-page)
   - [submit-rfq-quote](#submit-rfq-quote)
   - [send-rfq-email](#send-rfq-email)
   - [customer-portal](#customer-portal)
   - [submit-portal-request](#submit-portal-request)
   - [sub-portal](#sub-portal)
   - [submit-sub-portal](#submit-sub-portal)
   - [get-estimate-public-terms](#get-estimate-public-terms)
   - [accept-estimate](#accept-estimate)
   - [send-estimate-to-customer](#send-estimate-to-customer)
   - [get-contract-for-signer](#get-contract-for-signer)
   - [accept-contract](#accept-contract)
   - [send-contract-for-signature](#send-contract-for-signature)
   - [get-contract-signing-link-for-self](#get-contract-signing-link-for-self)
   - [open-contract-form-pdf](#open-contract-form-pdf)
   - [contract-form-paper-entry](#contract-form-paper-entry)
   - [complete-contract-form-office](#complete-contract-form-office)
   - [check-estimate-attachment-url](#check-estimate-attachment-url)
   - [resolve-ip-geolocation](#resolve-ip-geolocation)
   - [street-view-preview](#street-view-preview)
   - [job-share](#job-share)
   - [geocode-address-batch](#geocode-address-batch)
   - [geocode-one](#geocode-one)
   - [driving-distance](#driving-distance)
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
   - [billed-report-email](#billed-report-email)
   - [sync-salary-sessions](#sync-salary-sessions)
   - [set-user-password](#set-user-password)
   - [claim-dev](#claim-dev)
   - [test-email](#test-email)
   - [create-stripe-invoice](#create-stripe-invoice)
   - [send-physical-invoice-email](#send-physical-invoice-email)
   - [send-gc-statement-email](#send-gc-statement-email)
   - [gc-statement-email-dispatch](#gc-statement-email-dispatch)
   - [weekly-movement-email-dispatch](#weekly-movement-email-dispatch)
   - [weekly-money-email-dispatch](#weekly-money-email-dispatch)
   - [payment-forecast-email-dispatch](#payment-forecast-email-dispatch)
   - [money-waiting-email-dispatch](#money-waiting-email-dispatch)
   - [crew-day-email-dispatch](#crew-day-email-dispatch)
   - [statement-round-email-dispatch](#statement-round-email-dispatch)
   - [send-hazmat-notice-email](#send-hazmat-notice-email)
   - [send-lien-release-email](#send-lien-release-email)
   - [send-lien-filing-email](#send-lien-filing-email)
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
   - [sync-resend-emails](#sync-resend-emails)
   - [resend-webhook](#resend-webhook)
   - [get-mercury-account-balances](#get-mercury-account-balances)
   - [mercury-reconcile](#mercury-reconcile)
   - [import-manual-transactions](#import-manual-transactions)
   - [manage-manual-account](#manage-manual-account)
4. [Email Wording Overrides](#email-wording-overrides)
5. [Error Handling](#error-handling)
6. [Deployment](#deployment)

---

## Overview

PipeTooling uses Supabase Edge Functions (Deno runtime) for privileged server-side operations that require elevated permissions or external API access. Nearly all functions validate the caller inside the handler — a user JWT (`auth.getUser` + role check), a webhook signature (`stripe-webhook`, `mercury-webhook`, `resend-webhook`), or a cron secret (`X-Cron-Secret`) — with gateway verification disabled via a `[functions.<name>] verify_jwt = false` block in [`supabase/config.toml`](../supabase/config.toml). **Two exceptions**: `merge-users` and `schedule-share-dispatch` have no `[functions.*]` block, so the gateway default (`verify_jwt = true`) applies to them per repo config.

**Field collect payment (Stripe):** The app uses **hosted Stripe invoices** and **`stripe-webhook`** (**`invoice.paid`**) with **`complete_job_collect_payment_flow_for_invoice`** — not physical Stripe Terminal readers. **`update-collect-payment-stripe-customer-email`** lets subcontractors correct payer email before **`send-stripe-invoice`**. Older **`terminal-connection-token`** / **`create-terminal-collect-payment-intent`** functions are **not** in the repo (see **`RECENT_FEATURES.md`** v2.344).

### Key Characteristics
- **Runtime**: Deno (TypeScript)
- **Authentication**: In-handler validation — user JWT, webhook signature, or cron secret / public token depending on the function (see Authentication)
- **CORS**: Enabled for all origins
- **Service Role Key**: Required for admin operations
- **Error Format**: Consistent JSON error responses

---

## Authentication

### Three auth styles

Not every function takes an `Authorization` header — each function authenticates in one of three ways (see the Overview note on `verify_jwt`):

1. **In-handler user JWT** (the majority): the client sends `Authorization: Bearer <jwt_token>`; the handler calls `auth.getUser` and checks the caller's role from `public.users` before doing anything privileged.
2. **Webhook signature**: `stripe-webhook`, `mercury-webhook`, and `resend-webhook` are called by the provider, not a signed-in user — they validate the provider's signature header instead of a JWT.
3. **Cron secret / public token**: scheduled functions (`send-scheduled-reminders`, `sync-salary-sessions`, `recurring-job-report-dispatch`, `schedule-day-email-dispatch`, …) require the `X-Cron-Secret` header; public-token functions (`accept-estimate`, `get-estimate-for-customer`, `get-contract-for-signer`, `dev-login`, …) authenticate by an exact token/code in the request rather than a session.

### Role-Based Access Control

JWT-validating functions check the caller's role from the `public.users` table. The nine roles:
- **dev**: Full admin access (create/archive/restore users, set passwords, claim-dev administration, Stripe data surfaces)
- **master_technician**: Broad operational access; limited admin (e.g. login-as-user impersonation)
- **assistant**: Office staff — most operational functions (billing, notifications, reports) but no user administration
- **controller**: Assistant-like office access **plus** payroll/financial surfaces; included wherever functions gate on the assistant-like set
- **estimator**: Bid/estimate functions (e.g. `gsa-per-diem`, estimate sends) and limited customer surfaces
- **primary**: Billing-adjacent functions on jobs they can access (e.g. invoice flows); no admin functions
- **superintendent**: Project/schedule-scoped functions (e.g. schedule share/dispatch surfaces); no financial administration
- **subcontractor**: Own-scoped functions only (e.g. correcting payer email on their collect-payment flow); no privileged access
- **helpers**: Treated as subcontractor by every function gate (sub-like role)

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

### send-supply-house-job-account

**Purpose**: Email a job-account setup packet (property, phones, homeowner / building owner + company) to office-chosen supply house contacts — the Job Detail "Share with supply house" flow (v2.1605).

**Endpoint**: `POST /functions/v1/send-supply-house-job-account`

**Required Role**: `dev`, `master_technician`, `assistant`, or `controller` — JWT verified in-handler (`config.toml` sets `verify_jwt = false`); the `job_id` must be readable through the caller's RLS (blocks cross-tenant sends).

**Payload**: `{ job_id, recipients: [{label, email}] (1–10; v2.1606 — audit-logged) | to_emails: string[] (v2.1605 fallback), subject, email_html (≤100k chars), email_text }` — subject/html/text are composed client-side by `src/lib/supplyHouseJobAccount.ts` and sent verbatim. After a successful send, inserts one `supply_house_job_accounts` row per recipient with the service role (best-effort).

**Behavior**: sends via Resend from the `EMAIL_FROM` sender (secret; default `PipeTooling <team@noreply.pipetooling.com>`) with the caller's email as reply-to, then best-effort logs to `email_send_log`. No audit table.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY` (service key only for the shared email log helper).

**Deploy**: `supabase functions deploy send-supply-house-job-account` (after the v2.1605 client merge).

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
  role: string       // User role — an explicit choice; the dialog has no default (v2.2872)
  name?: string      // Optional display name
  service_type_ids?: string[] // Optional restriction for estimator/subcontractor/helpers/superintendent
  read_only?: boolean // v2.2872: start in training mode (users.read_only = true). Absent = false.
                      // Any non-boolean → 400 "read_only must be true or false".
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
- `'controller'`

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
    "role": "assistant",
    "read_only": false
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
6. Upserts the corresponding `public.users` record with role, name, any service-type restriction, and `read_only` (the training-mode flag chosen in the dialog — v2.2872). The service-role write passes `users_guard_privileged_columns` (`auth.uid()` IS NULL), so no migration was needed.
7. Returns user details (incl. `read_only`)

**Called from**: Active Accounts → **Manually add user** ([`useActiveAccountsManagement.ts`](../src/hooks/useActiveAccountsManagement.ts) `handleManualAdd`). Since v2.2872 the dialog opens with no role selected and **Create user** stays disabled until one is chosen (`inviteFormValid`, [`src/lib/inviteUserForm.ts`](../src/lib/inviteUserForm.ts)).

**Deployment**: See [`supabase/functions/create-user/DEPLOY.md`](../supabase/functions/create-user/DEPLOY.md)

---

### invite-user

**Purpose**: Create a user and email them an invite link to set their own password (dev-only). The email is sent through **Resend** using the editable Settings **invitation** email template (`email_templates` where `template_type = 'invitation'`, `{{name}}` / `{{role}}` / `{{link}}` placeholders); if the template row was never saved, the function falls back to the same defaults Settings seeds.

**Endpoint**: `POST /functions/v1/invite-user`

**Required Role**: `dev`

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

**Called from**: Active Accounts → "Invite via email" ([`useActiveAccountsManagement.ts`](../src/hooks/useActiveAccountsManagement.ts) `handleInvite`; the dialog opens with no role selected and **Send invite** stays disabled until one is chosen — v2.2872) and People → Users → invite roster entry ([`People.tsx`](../src/pages/People.tsx) `inviteAsUser`, role derived from the roster kind).

#### Request Parameters

```typescript
interface InviteUserRequest {
  email: string             // Invitee's email address
  role: string              // One of the 9 roles (same list as create-user)
  name?: string             // Optional display name
  read_only?: boolean       // v2.2872: start in training mode (users.read_only = true). Absent = false;
                            // any non-boolean → 400 "read_only must be true or false"
  redirectTo?: string       // Where the invite link lands; must match https://pipetooling.com/*,
                            // https://clicktooling.com/*, or http://localhost:5173|5175/*;
                            // defaults to APP_ORIGIN (else https://pipetooling.com) + /accept-invite
  service_type_ids?: string[] // Optional restriction for estimator/subcontractor/helpers/superintendent
}
```

#### Flow

1. Validates caller is `dev`; validates role and any `service_type_ids`.
2. Duplicate check on `public.users.email`. A **pending invite** (auth user with `email_confirmed_at` and `last_sign_in_at` both null) is deleted and replaced — re-inviting the same address issues a fresh link ("resend invite"). Anyone else → 400 `User with this email already exists`.
3. `auth.admin.generateLink({ type: 'invite' })` creates the auth user and returns the action link **without** sending Supabase SMTP mail. The `handle_new_user` trigger reads `invited_role` from user metadata; the function also upserts `public.users` explicitly with role, name, service-type restriction, and `read_only` (training mode from the first minute — v2.2872; service-role writes pass `users_guard_privileged_columns`).
4. Renders the invitation template — `{{role}}` is filled from the shared human labeler [`_shared/roleLabels.ts`](../supabase/functions/_shared/roleLabels.ts) (`humanRoleLabel`: "Helper", "Master", "Subcontractor" …, the twin of `src/lib/roleLabels.ts`; `src/lib/roleLabels.test.ts` fails when they drift), never the raw enum ("Master_technician") —  and sends via the shared [`sendEmailViaResend`](../supabase/functions/_shared/resendSendEmail.ts) helper (from the `EMAIL_FROM` sender (secret; default `PipeTooling <team@noreply.pipetooling.com>`)).
5. **If the Resend send fails, the auth user is deleted** (FK cascade removes `public.users`) and a 500 is returned — a failed invite leaves nothing behind, so retrying is always safe. The action link is never returned in the response.

#### Accepting the invite

The emailed link verifies through Supabase Auth and redirects to **`/accept-invite`** ([`AcceptInvite.tsx`](../src/pages/AcceptInvite.tsx)), where the invitee sets a password (`supabase.auth.updateUser`) and lands in the app already signed in. Expired/used links surface "invalid or expired — ask a dev to resend the invite"; re-inviting from Settings issues a fresh link. The redirect target must be covered by the Supabase Auth redirect allowlist (`https://pipetooling.com/**` — already configured).

#### Success Response

```json
{ "success": true, "message": "Invite sent to newuser@example.com", "read_only": false }
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
  redirectTo?: string  // Where the link lands; must match https://pipetooling.com/*,
                       // https://clicktooling.com/*, or http://localhost:5173|5175/*;
                       // defaults to APP_ORIGIN (else https://pipetooling.com) + /dashboard
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

**Purpose**: Archive users by email or name. Archived users are hidden across the app and cannot sign in, but can be restored later.

**Endpoint**: `POST /functions/v1/archive-user`

**Required Role**: `dev`, `controller`, or a **pay-approved** `master_technician` (v2.2713 — Person Desk End employment; was dev-only)

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

**Purpose**: Restore an archived user. Clears `archived_at` and `banned_until` so the user can sign in again.

**Endpoint**: `POST /functions/v1/restore-user`

**Required Role**: `dev`, `controller`, or a **pay-approved** `master_technician` (v2.2713; was dev-only)

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

**Purpose**: Password-free sign-in when running in development mode. No existing auth required. Used for local testing (e.g. checklist, E2E) without credentials. **Frontend identity is fixed (v2.1517)**: `src/pages/DevLogin.tsx` always sends `robert@douglasmining.com` (`DEV_LOGIN_EMAIL` constant) — the `?as=` value and the old email input no longer pick the account; `as`'s presence just triggers the auto-login. The function itself still accepts any existing user's email if invoked directly with the secret.

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
3. Open `http://localhost:5175/dev-login?as=1` (auto-fires; always signs in as `robert@douglasmining.com`) or use the form at `/dev-login`

**Note**: The email must exist in `auth.users`. If `user@example.com` or `test@example.com` is not in your database, the Edge Function returns a non-2xx status. Use an existing user email (e.g. `robert@douglasmining.com` in your project) or create the user first via the create-user Edge Function.

#### Supabase Auth Config

The frontend (`src/pages/DevLogin.tsx`, v2.1526) no longer follows the returned `action_link` — it parses the link's `token` and verifies it directly via `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })`, establishing the session on the current origin. This makes dev-login **port-agnostic**: any localhost port works, so parallel dev servers (5174, 5177, …) no longer get bounced to production when their port is missing from the auth redirect allow-list. `additional_redirect_urls` (`http://localhost:5175/**`, `http://localhost:5173/**`, production `https://pipetooling.com/**`) still matters for any flow that follows a magic link directly, but dev-login itself no longer depends on it.

---

### twin-login

**Purpose**: Sign-in mint for **digital twin** accounts (docs/DIGITAL_TWINS_PLAN.md Phase E1) so a cloud-hosted agent harness can establish a session on the **deployed** app: POST → magic-link `action_link` → the harness navigates a headless browser to it. dev-login's sibling with four hard guards — a leaked secret can only ever produce a session as a flagged, estimator-role twin, never a real person:

1. `X-Twin-Login-Secret` must match `TWIN_LOGIN_SECRET` (its **own** secret, rotatable independently — rotating it is the fleet-wide kill switch).
2. `email` must match the fleet pattern `twin-<role>-<n>@twins.pipetooling.local`.
3. `public.users` for the account must have `is_digital_twin = true` (v2.2426).
4. The account's role must be `estimator` (the estimator-only program).

**Endpoint**: `POST /functions/v1/twin-login` · **Auth**: secret header only (`verify_jwt = false`). **Request**: `{ email, redirectTo?, run? }` — `run` is a mission label logged with the mint. **Response**: `{ success, action_link }`. Every mint logs to the function log and (fail-soft until the ledger table exists) inserts a `twin_runs` row.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWIN_LOGIN_SECRET`.

**Note**: unlike dev-login, cloud harnesses **follow the action_link directly**, so the deployed origin must be in the auth redirect allow-list (production `https://pipetooling.com/**` already is).

---

### twin-mcp

**Purpose**: The digital-twin **MCP server** (Model Context Protocol, streamable-HTTP) — lets any MCP-capable agent (Claude, Grok/xAI, GPT, …) hold a twin seat: `initialize` / `tools/list` / `tools/call` over stateless JSON-RPC POST (GET → 405, no SSE; spec-permitted). Tools: `mint_session` (pass-through to twin-login — guards/rate-limit/ledger stay single-sourced there), `get_brief` / `get_directory` / `get_harness_guide` / `get_mission` (docs bundled at deploy), `submit_report` (→ `twin_runs`, `mission = report:<id>`). The server exposes **no business data** — the work happens in the app via the minted browser session.

**Endpoint**: `POST /functions/v1/twin-mcp` · **Auth**: per-twin token on every `tools/call` (`X-Twin-Token` or `Authorization: Bearer`; `initialize`/`tools/list` are open metadata). `verify_jwt = false`.

**Dates** (v2.2703): the `due` date of a bid the twin creates is `today (Central) + due_in_days` via `ymdAddDays`.

**Bundled docs are GENERATED**: `supabase/functions/twin-mcp/briefs.ts` is written by `node scripts/build-twin-mcp-briefs.mjs` from `docs/twins/*` (missions carry only the verbatim mission text, never the scorer sections) — regenerate + redeploy after editing those docs.

**Two-app companion (v2.2439)**: `mint_session` takes `app: 'pipetooling' | 'counttooling'` — the CT path calls CountTooling's `twin-login` with CT's twin secret held server-side (one per-twin credential covers both apps; CT per-twin-credential parity deliberately deferred). The CT path re-applies the 6/min rate limit against `twin_runs` (PT's twin-login isn't in that path) and logs the mint (`app=counttooling` in the note).

**Agent reads (v2.2477** — estimator-twin pipeline Wave 1.4 + 2.3/2.4**)**: three service-role read tools, all bid-scoped ones enforcing **assignment-is-the-grant** (the bid's `estimator_id` or `created_by` must be the calling twin): `get_assignments` (the twin's work queue — bids where it is the estimator, with due/GC/link-presence), `get_plan_brief(bid, full?)` (latest `bids_plan_substrates` row for the bid; rollup by default, `full: true` for per-sheet records — contract in `docs/twins/SUBSTRATE.md`), `get_work_state(bid)` (composite resume: bid facts, stamped links, substrate version, counts-row count, last-10 audit-ledger entries). Still no business-*write* tools — the doctrine stands.

**Conversation layer (v2.2483** — RFI_LOOP_PLAN R3 + Wave 4.5**)**: `ask_question` (parks a question in `twin_questions` — the internal lane; optional bid resolves by number/uuid), `get_answers` (the twin's questions newest-first; `open_only`), and `heartbeat` (inserts a `twin_runs` row with bid_id/stage/state — the fleet console shows PULSE/BLOCKED chips). `get_work_state` grew `middle` coverage (takeoff mappings, rough part lines, labor estimates, price-book copies), `rfis` statuses, `open_questions_here`, and `latest_heartbeat`. These are twin-self-scoped writes to twin infrastructure tables, not business data — the fence applier gained a `twin_questions` INSERT-as-self branch.

**Robot-ready train (v2.2503)**: `get_ct_guide` (the CountTooling completing-a-bid brief, bundled from `docs/twins/COUNTTOOLING_BID_GUIDE.md`); `get_work_state` gains **`ct_takeoff`** — the twin's CountTooling projects with review status + reviewer note, fetched over the CT bridge (`manage-user` verb `twin_projects`, fail-soft); the CT `mint_session` path now mirrors the per-twin token hash to CT (`set_twin_credential`, best-effort) and mints with **`X-Twin-Token`** (CT verifies locally — CT-4 credential parity), falling back to the fleet secret on 401. **Placement protocols bundled (v2.2512)**: new tool `get_placement_guide` serves PLACEMENT.md + CALIBRATION.md + EXTRACTOR.md from the briefs bundle so cloud twins read the takeoff doctrine without repo access. **Notes-ledger loop (v2.2511)**: `ct_takeoff` also carries **`notes_ledger`** — the newest CT project's note ledger (CT bridge verb `twin_rfis`: every note with kind rfi/note, `detail`, `resolved`, and the reviewer's `answer`, plus `open_rfis`/`answered_rfis` counts) so an answered RFI reaches the twin without a human relaying it; fail-soft like the rest of the block.

**Backtest + ledger verbs (v2.2523** — BT-3 gap-closure**)**: `open_backtest(reference_bid, due_in_days?)` — creates a `ZZ Twin <PROJECT> (backtest)` bid owned by + assigned to the calling twin, copying ONLY the reference's logistics (name/address/customer/service-type/distance/plans link; **counts, pricing, `bid_value`, and `outcome` are never selected**, so the blind protocol is structural), idempotent per reference, STG-0 ledger note stamped, and returns a blind-safe `reference_grade` (v2.2545 / v1.3.2 — A/B/C/D/X from field PRESENCE only; quality flags like round-value and weak-loss stay unseal-time — see FEEDBACK_LOOP.md "Reference grading"); and `add_bid_note(bid, note)` — one `bids_submission_entries` entry on the twin's own/assigned bid (the pipeline flight recorder; notes never move the chase clock). Both are twin-attributed writes inside the assignment-is-the-grant fence — they replace the dev-seat SQL that BT-3 needed. The repo's `.mcp.json` can register this server as a native Claude Code connector (`X-Twin-Token` header via `${TWIN_ESTIMATOR_1_TOKEN}` env expansion).

**One-call STG-3 finisher (v2.2528)**: `ct_finish_takeoff(bid, name, takeoff, note?, self_assessment?, view_name?, skip_pdf?)` — `self_assessment` (v2.2553 / v1.3.3) is the twin's 2-3-sentence confession of where THIS draft is least sure; it lands on `bid_audits.self_assessment` (insert, or refreshed on a re-finish) and renders atop the audit card as "🤖 Where I'm least sure" — twins should always send it. Otherwise: — the whole CountTooling finish chain server-side, replacing the user-run curl script every backtest needed: fence-checks the bid (own/assigned), mints the twin's CT session in-function (per-twin token first, fleet-secret fallback, then **walks the magic link itself** — the verify redirect's fragment carries the JWT, no browser), POSTs `import-takeoff` (idempotent by name; `external_ref` is ALWAYS stamped with the bid number and the plan set rides via `plan-fetch?bid=` with the caller's own token — both doctrines enforced by construction), flips `set_project_review_status → 'ready'`, mints a `create_view_link`, then stamps `bids.count_tooling_link` and ensures the `bid_audits` row on the PT side, logging a `ct-finish:<bid>` run. Returns project id, marker counts, pdf leg result, and the view URL. The CT anon (publishable) key is a compiled-in constant — it ships in CT's client `config.js` and is public by design.

**Shadow bidding (v2.2539** — fleet roadmap Phase 1**)**: four verbs make live bids the twin's backtest stream. `get_shadow_queue(days?)` — recent human bids with plans, **not yet sent** (unsent-ness is the blindness guarantee), un-shadowed, logistics only; **human-requested bids first** (v2.2543 / v1.3.1 — the Bid Board's green robot icon stamps `bids.robot_requested_at/_by`; requested entries carry `requested/requested_at/requested_by`, sort oldest-ask-first, and bypass the lookback window). `open_shadow(reference_bid, axis?)` — creates a `ZZ Shadow <PROJECT>` bid (logistics copy, same fence as open_backtest; stamps `twin_source_bid_id` so the board's robot icon turns colorful, v2.2543) + the `twin_shadow_runs` row; refused once the reference is sent (that's a backtest). `lock_shadow(bid, total)` — records the blind total pre-send; refused (contamination flag) if the reference was sent first. `score_shadows()` — the auto-scorecard: every locked run whose reference now carries `bid_value` + `bid_date_sent` gets its delta computed, the run marked scored, and the scorecard note stamped on BOTH ledgers; returns per-axis rolling stats (`mean_abs_pct`, `last5_in_8pct`, `gate_b_met`) — the confidence-scoreboard data. Table: `twin_shadow_runs` (20260831210000; staff read via RLS, writes service-role only).

**Round-2 backtests + the scoring door (v2.2800)**: `open_backtest(reference_bid, round?)` — `round: 2` (or higher) opens a NEW shell named `ZZ Twin <PROJECT> (backtest R2)` instead of handing back the first round's bid, whose ledger carries its scorecard (reference value, delta) and would unblind a re-run; the STG-0 note names the round and declares prior rounds off limits until the scorecard stamp. `score_backtest(bid, run_label, axis, locked_total, counts_note?, scope_verdict?, note?)` — the STG-6 unseal for backtests, mirroring `score_shadows`: **refused unless the twin bid's ledger already carries a LOCK note** (blind total on the record first), then the server reads the reference's value / outcome / loss category / sent date, computes `delta_pct`, the presence grade and the quality flags (`roundValue`, `weakLoss`, `lossUncategorized`, `stale` — same rules as `src/lib/bids/referenceGrade.ts`), derives `gate_eligible` (grade A/B, flags clear, scope not `fail`), inserts the `twin_run_scores` row the Scoreboard reads (previously hand-SQL), stamps `[STG-6 SCORECARD]` on the twin ledger, and returns the reference facts. Idempotent per `run_label`. Built for the 2026-09-05 round-2 re-bid of Wendi's decided bids (`docs/twins/kickoffs/`).

**Parallel rounds (v2.2806)**: `next_backtest(candidates, round?, axis?)` — the dispatcher: hand it the round's ordered candidate list (`[{bid, axis, label}]`, straight from the kickoff) and it opens the first reference that has no shell for this round, returning it as the caller's; the claim IS the shell (`openBacktestShell`, shared with `open_backtest`), and a same-instant duplicate deletes itself in favour of the earliest-created shell, so parallel agents never share a bid. `done: true` when the list is exhausted. Two blindness/flow fixes rode along: `get_work_state`'s `ct_takeoff` now returns only the CountTooling project(s) stamped with THIS bid (`external_ref` = bid tag, or the ZZ name) and that project's notes ledger — the R2-BT-1 run had received every twin project plus an unrelated bid's ledger; and `get_plan_brief` with no substrate now says plainly that STG-2 is the twin's own job (fetch, EXTRACTOR.md, insert `bids_plan_substrates`, call again) instead of pointing at an "extractor or operator" that does not exist.

**Round-2 batch fixes (v2.2816)**: `score_backtest` is **amendable** — the scope-match check needs the reference rows that only the first call unseals, so the protocol is two calls: score without a verdict, line-compare, then call again with the same `run_label` and `scope_verdict: 'pass'|'fail'` (+ `counts_note` / `note`); the row is patched, `gate_eligible` recomputed (grade + flags re-derived from the reference, verdict ≠ fail), and an `[STG-6 SCORECARD amended]` note stamped. Verdict parsing is lenient (`PASS (pre-unseal)` → pass); anything else records as `unknown` and the response says so. `stage_plan_pdf(bid, file_name?)` — for sets over CountTooling's 50 MB / 200-page cap: returns a one-time signed upload URL into the `twin-plans-tmp` bucket (service-role signed; no storage policy needed) plus the object's `public_url`; the twin trims locally, PUTs the file, and passes `public_url` as `ct_finish_takeoff(pdf_url)`, which now documents that argument and deletes the staged object after a successful import. `mint_session` answers JSON (`{ ok, app, email, action_link, note }`) instead of prose for both apps.

**STG-5 is structural (v2.2864 / v1.3.4)**: `paste_counts(bid, rows, expected_total?, replace?)` — the counts-into-PipeTooling verb that closes the "audit card reads draft $0" hole (seven BT-16..19 cards sat unjudgeable for four days because their estimates lived only in lock notes). Fence-checks the bid (own/assigned), resolves the global 🤖 Robot Default `price_book_versions` row for the bid's service type, matches every row's `book_entry` against the book's `fixture_types` names (unmatched names refuse the call — extend the book first, mirror sources in the ledger), then inserts `bids_count_rows` (unit vocabulary ea/ft/px/sqft; null infers from the name) + `bid_pricing_assignments` (with `unit_price_override` for lump/LOCK-stated prices) and stamps a `[pipeline STG-5]` note. **The step-0 invariant is enforced server-side**: pass `expected_total` (the LOCK total) and the call refuses when the priced rows differ by more than $1/0.1%. `replace: true` rewrites a bid's existing rows (clearing assignments/custom-prices/hides first); without it, existing rows refuse. And `score_backtest` now **refuses to unseal a bid with zero count rows** — no STG-5, no STG-6, so an unpriceable audit can no longer reach the queue.

**Blind-safe verbs (v2.2868 / v1.3.5)** — three fixes from the 2026-09-05 regression batch: **`get_answers` redacts for blindness** — any question/answer mentioning a reference the twin currently holds an UNSEALED shell against (twin-owned bid with `twin_source_bid_id`, no `twin_run_scores` row and no scored `twin_shadow_runs` row) comes back as `{redacted: true, note}` and reappears after that shell's scorecard; matching is by `bNNN` token or project-name substring, and over-redaction is deliberate (R2-BT-20 was value-exposed pre-lock by a parked answer that quoted the reference's won number). **`get_robot_book(bid?)`** — read-only entry names + prices for the 🤖 Robot Default book (the bid's service type, or all robot books), so agents price from the real book instead of mirrored guesses (the R2-BT-21 agent had to override every row when book-price reads were blocked client-side). **`extend_robot_book(bid, entries, mirror_note)`** — the doctrine's "extend when a tag is missing; mirror sources in the ledger" as a fenced verb: inserts fixture types + priced entries for the bid's service type, stamps `[book extend]` + the mandatory `mirror_note` on the bid's ledger; existing names are skipped, never repriced (re-mirrors stay a digest act).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and for CT minting **`CT_TWIN_LOGIN_URL`** + **`COUNTTOOLING_TWIN_LOGIN_SECRET`** (twin-login's own `TWIN_LOGIN_SECRET` is not needed here — the per-twin token is the credential).

---

### drive-intake

**Purpose**: Estimator-twin pipeline **STG-1 (file plans in Drive)** — v2.2486, Wave 4.4 of `docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md`. Finds-or-creates the bid's job folder (named after `project_name`) under the jobs root, optionally fetches the plan set from `plans_url` into it, stamps `drive_link` / `plans_link` on the bid (**set-if-empty**), and writes the `[pipeline STG-1]` audit note (method-less — never moves the chase clock). Idempotent: re-runs reuse the folder, and (v2.2501) reuse a non-trashed same-name file already in it instead of uploading a second copy of the plan set (reuse-or-refuse per the pipeline's cross-cutting rule) — the audit note says `plans uploaded` vs `plans reused`. Google auth is a **service account** (never a user credential); since the 2026-08-30 cutover the jobs root lives in the **"PipeTooling Jobs" Shared Drive**, which is what gives the SA upload quota (SAs cannot own bytes in My Drive) — setup + findings in `docs/DRIVE_INTAKE_SETUP.md`.

**Drive-source fetch (v2.2499)**: a `plans_url` pointing at a Drive file (`file/d/<id>`, `open?id=`, `uc?id=`) is fetched via the **Drive API with the SA's own token** — Drive files are rarely public, but the SA reads anything shared with it, so sharing the source folder with the SA (Viewer) makes plan intake a pure Drive-to-Drive copy that keeps the source's filename. Non-Drive URLs fetch unauthenticated as before. A failed upload never fails the call — the folder still lands and `upload_note` says what to do.

**Endpoint**: `POST /functions/v1/drive-intake` · **Auth**: `verify_jwt = false`, both paths validated in-function — `X-Twin-Token` (per-twin credential; bid must be the twin's own/assigned — assignment-is-the-grant) **or** staff JWT (dev/master/assistant/controller/estimator). Agents reach it as twin-mcp's `file_plans`.

**Body**: `{ "bid": "b403" | uuid, "plans_url"?: string, "plans_file_name"?: string }` (bid number accepts `b`/`bp` prefixes) → `{ success, folder_id, folder_link, folder_created, plans_link, plans_reused, upload_note, stamped }`. Drive secrets unset → **503** with a setup pointer.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, **`GOOGLE_SERVICE_ACCOUNT_JSON`**, **`DRIVE_JOBS_FOLDER_ID`** (the Jobs folder inside the Shared Drive). Optional `DRIVE_IMPERSONATE_USER` (domain-wide delegation) — leave unset unless the delegation grant actually exists; set-but-ungranted breaks every upload at token exchange.

---

### plan-fetch

**Purpose**: The pipeline's **plan-bytes door** (v2.2503, robot-ready train CT-1): streams a bid's plan set — the Drive file behind `bids.plans_link` — to an authorized caller using the service account's token (scope `drive.readonly`). Built so CountTooling's `import-takeoff` (`pdf_url` + `pdf_headers: {"X-Twin-Token": …}`) can pull the PDF server-side without holding any Google credential: a twin's takeoff import arrives WITH the plan set. Loud errors: no `plans_link` → file the plans first (drive-intake); non-Drive link → 422; Drive 4xx → "is the file shared with the service account?".

**Endpoint**: `GET /functions/v1/plan-fetch?bid=b403` (or `POST {"bid":"b403"}`) · **Auth**: `X-Twin-Token` (per-twin credential; the bid must be the twin's own/assigned — assignment-is-the-grant) **or** staff JWT (dev/master/assistant/controller/estimator). `verify_jwt = false` (in-function auth, drive-intake's model). Responds with raw PDF bytes (streamed, Content-Type/Length passed through).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, **`GOOGLE_SERVICE_ACCOUNT_JSON`**.

---

### ct-bridge

**Purpose**: The PT-side proxy of the **CT↔PT user bridge** (v2.2435; architecture in `docs/recent-features/v2.2434.md`). PipeTooling is the single system of record for people; this function is the app's only door to CountTooling's `manage-user` edge function. Forwards an allowlisted verb set — `create` (idempotent), `deactivate` / `reactivate` (CT auth ban), `set_twin_flag`, `update_email`, `lookup`, `roster` (drift audit) — with the bridge secret, which never reaches the browser. Call sites: twin mint + CT-seat retry (`DigitalTwinsPanel`), “Create CountTooling seat” + backfill (Active Accounts), the weekly drift audit. `archive-user` / `restore-user` forward deactivate/reactivate **server-side** via `_shared/ctBridge.ts` instead of calling this proxy, and report the outcome in a fail-soft `ct_bridge` response field — a CT-leg failure never blocks the PT action.

**Endpoint**: `POST /functions/v1/ct-bridge` · **Auth**: `verify_jwt = false`; JWT validated in-function via `getUser` — **devs only**. Every act is logged to the function log (no audit table in v1).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`CT_MANAGE_USER_URL`**, **`CT_MANAGE_USER_SECRET`** (readable copy: PT main-checkout `.env.twin.local`; rotating it on both projects severs the bridge).

---

### audit-finish

**Purpose**: Ends (or reopens) a robot bid's audit in **one human gesture** (audit loop v2, v2.2518; design in `docs/twins/FEEDBACK_LOOP.md`). `POST { audit_id, action: 'finish' | 'reopen' }`: on finish, sets `bid_audits.status = 'done'` (+ `completed_at/by`), stamps the bid's ledger with the note/answer count, and flips the twin's CountTooling project to `reviewed` via `manage-user set_twin_project_review` (bridge secret, `_shared/ctBridge.ts`); on reopen, back to `pending` and CT `ready`. The CT leg is **fail-soft** — the response's `ct_bridge` field reports `ok` / `skipped` / `failed`, and the PT finish stands regardless (the agent's digest sweep catches stragglers).

**Endpoint**: `POST /functions/v1/audit-finish` · **Auth**: `verify_jwt = false`; JWT validated in-function via `getUser` — estimator+ write roles only, **twins refused** (finishing is structurally human, matching the table's restrictive RLS).

**Required secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, **`CT_MANAGE_USER_URL`**, **`CT_MANAGE_USER_SECRET`**.

---

### ct-roster-audit

**Purpose**: The CT↔PT bridge's **weekly drift audit** (v2.2438; Phase 3 — drift is caught, not prevented). Cron-invoked Mondays 13:00 UTC (migration `20260828110000`): pulls the PT roster (service role) and the CT roster (`manage-user roster` via `_shared/ctBridge.ts`), diffs them with the pure `_shared/ctRosterDiff.ts` kernel (unit-tested from `src/lib/ctRosterDiff.test.ts` — one copy, no port), and emails every dev. Sections: only-in-CT, linked-but-gone, active mismatch (the offboarding hole), twin-flag mismatch, email changed under a linked uuid, backfill candidates. **The email always sends** — the all-clear note is the heartbeat; a missing Monday email means the audit broke. Twin fleet domains (`@twins.pipetooling.local` ↔ `@twins.counttooling.local`) are normalized before email comparison.

**Endpoint**: `POST /functions/v1/ct-roster-audit` · **Auth**: `X-Cron-Secret` vs `CRON_SECRET`; `verify_jwt = false`.

**Required secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `CT_MANAGE_USER_URL`, `CT_MANAGE_USER_SECRET`.

---

### address-autocomplete

**Purpose**: Google Places Autocomplete proxy for the Job Address field (v2.2345) — the browser never sees the Google key. `POST { input }` (min 3 chars server-side; the client waits for 5 + a 300ms debounce) → `{ suggestions: [{ main, mainMatchEnd, secondary, full }] }`, capped at 5. Requests are biased to a circle over the service area (center ~29.55, −98.2; radius 50km — the Places circle-bias maximum) and restricted to US addresses.

**Auth**: `verify_jwt = false` in `config.toml`; the function validates the JWT in-body via `getUser` (gateway verification has caused 401s for browser sessions). Any authenticated user.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`GOOGLE_MAPS_API_KEY`** (the existing key — the **Places API (New)** must be enabled on it). Key unset → **503** and the client silently degrades to a plain input; upstream errors → **502**, same client behavior.

**Client**: `src/hooks/useAddressSuggestions.ts` (debounce + stale-guard + the `prewarmAddressGeocode` fire-and-forget that follows a pick with a `geocode-address-batch` call), kernel `src/lib/addressAutocomplete.ts`, dropdown `src/components/jobs/JobAddressSuggestions.tsx` (carries the required "powered by Google" attribution).

---

### send-workflow-notification

**Purpose**: Send workflow stage email notifications via Resend; optionally send Web Push when **`recipient_user_id`** and VAPID keys are set.

**Endpoint**: `POST /functions/v1/send-workflow-notification`

**Required Role**: Authenticated user (any role); JWT validated in the function via **`auth.getUser(token)`**.

**Anchors** (v2.2819): a request names its subject with one of `step_id`, `labor_job_id` (v2.2785, Sub Labor sheet work orders), or `work_order_id` (job-anchored work orders from Jobs → Work Orders); the push tag follows the anchor.

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
  step_id?: string // real project step id when logging history; may be a placeholder when not inserting notification_history
  labor_job_id?: string // v2.2786: a Sub Labor sheet instead of a step (sheet work orders) — one of the two is required
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
- `work_order_offered`, `work_order_accepted`, `work_order_declined` (sub work orders; a sheet-anchored offer passes `labor_job_id` — no step lookup, `notification_history.step_id` stays NULL, push tag `workflow-<labor_job_id>`)

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

Devs: **Settings → Templates & testing → Workflow email (Edge Function)** (collapsible): one-shot invoke with placeholder data; omits **`recipient_user_id`** so **`notification_history`** is not written. See **[`RECENT_FEATURES.md`](./RECENT_FEATURES.md)** v2.186.

#### Implementation Details

1. **`getUser(JWT)`** from **`Authorization`** header
2. Load **`subject`/`body`** from **`public.email_templates`** by **`template_type`**
3. Replace **`{{variable}}`** from **`variables`**
4. POST to Resend
5. Optional Web Push to **`push_subscriptions`** for **`recipient_user_id`**
6. Optional **`notification_history`** insert when **`recipient_user_id`** and service role resolve **`step_id`** → workflow/project

**Deployment**: [`supabase/functions/send-workflow-notification/DEPLOY.md`](../supabase/functions/send-workflow-notification/DEPLOY.md)

---

### customer-portal

**Purpose**: Payload for the no-login customer/GC portal page (`/portal?t=<token>` and `/p/<slug>`, portal train PR 1 v2.1982; merged view + custom addresses v2.2008): resolves the capability token (raw-token lookup with sha256-hash fallback in `customer_portal_links`, revoked → 404) or a custom address slug (`customer_portal_slugs` → the customer's active `audience='all'` link; no mint-on-demand — a turned-off portal stays off; first public slug resolve sets `locked_at` + a `locked` event) and returns only that company's data — company letterhead block, open billed lines with amounts + Stripe `hosted_invoice_url` pay links (`billed` jobs without a line fall back to the job-level remainder), total due, and the non-paid jobs a visit request may reference.

**Which bills (v2.2839, journey-map J21-F1)**: an open bill is defined by **invoice** status, not job status — `status='billed'` invoices on jobs of **any non-paid status** (working, waiting, ready_to_bill, billed, collections…), the same rule as `get_gc_statement_email_payload` (migration `20260806232759`). The invoice-less shell fallback stays restricted to `billed` jobs so a working job with nothing billed never prints its revenue remainder as a bill. Both predicates live in [`_shared/portalBillMembership.ts`](../supabase/functions/_shared/portalBillMembership.ts) (`jobCarriesOpenBills` / `jobPrintsShellRemainder` / `openBillJobIds`), used by this function's fetch and by `buildPortalBills`, unit-tested from `src/lib/portal/portalBillMembership.test.ts`. Before v2.2839 the job itself had to be `billed`, which hid progress bills on in-progress jobs (~49% of the specimen customer's balance). Each rendered statement also logs one structured `portal_statement_rendered` line (`statement_total_cents`, `bill_count`) for reconciliation against the office AR figure.

**Sample** (v2.2760, What customers see): `token=sample` (homeowner) / `sample-gc` (the contractor's view) skips link and slug resolution — no sign-in (the data is invented; v2.2763 dropped the office-JWT gate) — and gets the fixture from `_shared/customerSampleFixtures.ts` over the live `PORTAL_COMPANY`. No `public_page_views` row, no slug lock.

**Audiences**: `all` (default since v2.2008) merges jobs where the company is the customer with jobs where it is the GC (deduped by job id; GC rows carry `asGc: true` + `ownerName` for the statement's AS GC tag); `customer` / `gc` remain the scoped "Separate views". Bill building lives in the shared pure module [`_shared/portalMergedBills.ts`](../supabase/functions/_shared/portalMergedBills.ts), unit-tested from `src/lib/portal/portalMergedBills.test.ts`. The payload also carries `requestToken` (the resolved link's token) so slug-opened pages can submit request forms — slug and token are the same capability — and `slug` (v2.2026, audience `all` only) powering the statement's footer QR / short-address card.

**Endpoint**: `GET /functions/v1/customer-portal?token=<opaque>` or `GET /functions/v1/customer-portal?slug=<address>`

**v2.2690 (Contract Desk PR 5)**: the payload gains `agreements[]` — the customer's `job_contracts` that are `sent` or `signed` (never drafts or voided): job label/address, template, frozen amount, signed stamp + signer, and `signUrl` (the same durable `/contract/sign?t=` link) so the portal's **Your agreements** card can offer *Review & sign* / *View signed copy*.

**Auth**: none (`verify_jwt = false` in `config.toml` — the link IS the capability, minted/rotated by `mint_customer_portal_link`). Service-role reads; never returns costs, notes, or other customers' data.

**View counting** (v2.2341, migration `20260826160132`): each validated load appends a `public_page_views` row (`surface='portal'`, `entity_id` = customer id, `via` token/slug) via the service role, fire-and-forget — measurement can never fail the statement. No anon-writable path; reads are dev-only RLS. (Estimate-accept views were already counted separately — see `get-estimate-for-customer` → Audit.)

**Who counts** (v2.2875, journey-map #37): the row is skipped when the request is an office peek — `?preview=1` (the globe modal's iframe / Preview as customer / Full screen / Edit-chips fetch add it; `CustomerPortal.tsx` forwards it) **or** an `Authorization` bearer that is a verifiable user access token (the page sends the browser's own session when it has one; `admin.auth.getUser` checks it — any valid account is staff, since customers never sign in). Shared decision: [`_shared/publicViewCounting.ts`](../supabase/functions/_shared/publicViewCounting.ts) `publicViewDecision(req, admin, anonKey)`, twin + tests in `src/lib/publicViewCounting*.ts`. Unverifiable tokens count as customers. **Staff-only payload block**: when the session verifies, the response also carries `officeViewStats: { opens, lastOpenedAt }` — the customer's own view rows, read with the service role — which feeds the globe gear's **Opened** row ("Opened 3 times · last Sep 3"). A customer's payload never includes it.

**Receipt landings** (v2.2878, journey-map J22-F3): the Stripe invoice footer's portal link carries `?paid=1`, and the page then calls `…customer-portal?token=…&return=stripe`; a refetch after a PAY ONLINE tab sends `return=refresh` (bounded: immediate, +6 s, +20 s). `return=stripe` logs one structured **`portal_return_from_stripe`** line (`customer_id`, `audience`, `via`) and `portal_statement_rendered` gains `return_from` — function-log telemetry like the statement line, because `public_page_views.via` is CHECK-limited to `token`/`slug`. Refetches still append a view row each; skipping `return=refresh` in the counter belongs to the view-counting work (#37). **Redeploy required.**

### submit-portal-request

**Purpose**: Portal form intake (portal train PR 2, v2.1986): validates a visit/bid request from `/portal` (honeypot, length caps, https-only plans link, job-in-scope check), rate-limits 5/hour per portal link, inserts a `dispatch_requests` row (details in `pending_payload.source = 'portal'`; `from_user_id` = `app_settings.portal_requests_from_user_id` → link minter → first dev), then triggers `notify-dispatch-request` and (v2.1988) emails the `portal_request_email_recipients_v1` app_settings list via Resend, best-effort.

**Endpoint**: `POST /functions/v1/submit-portal-request` — `{ token, kind: 'visit'|'bid', jobId?, description, availability?, phone?, plansLink?, website }` (`website` is the honeypot).

**Auth**: none (`verify_jwt = false`) — the portal token is the capability.

### sub-portal

**Purpose**: Payload for the no-login subcontractor "Work & pay" portal (`/sub?t=<token>` and `/s/<slug>`, sub-portal train — the customer portal's person-keyed sibling): resolves the capability token (raw lookup + sha256 fallback in `sub_portal_links`, revoked → 404) or a custom address slug (`sub_portal_slugs`; no mint-on-demand; first public resolve locks the slug) and returns only that person's statement — Sub Labor sheets with line items and agreed/paid/backcharges/open (junction-first via `people_labor_job_assignees`; legacy multi-name sheets stay office-only), the last-90-days payment ledger (**memos are sub-visible** unless `hidden_from_sub`; the amount always shows), all-time totals (open floors per sheet), open `step_commitments` offers with the frozen `offer_scope_snapshot`, paperwork **status only** from `person_contract_documents` (signed/on-file/expiring ≤60d/expired/needs-signature — never document contents), and pay-run settings (`app_settings.sub_pay_run_day` / `sub_pay_explainer` + the computed next run date). Statement shaping lives in the shared pure module [`_shared/subPortalStatement.ts`](../supabase/functions/_shared/subPortalStatement.ts), unit-tested from `src/lib/subPortal/subPortalStatement.test.ts`. Carries `requestToken` + `slug` like the customer payload. `/p/<slug>` dual-resolves client-side (customer first, sub fallback) — one printed `my.clickplumbing.com` namespace, uniqueness enforced across both slug tables by the set RPCs.

**Sheet work orders** (v2.2789): the offers query no longer requires a step — sheet-anchored `step_commitments` (`step_id IS NULL`, `labor_job_id` set) title from the snapshot's `sheetLabel` and carry `anchor`, `exclusions`, `references` (name + version date), `acknowledgements`, `bond`, `specialProvisions` (parsed by `parseScopeExtras`); signed sheet orders (accepted / approved / settled) attach to their sheet as `agreement` (`attachSheetAgreements`) — signed date, signer, amount, lines, references, and the acknowledgements actually ticked (`signer_acknowledgements`, falling back to the snapshot's list).

**Sample** (v2.2760, What customers see): `token=sample` skips link and slug resolution — no sign-in (v2.2763 dropped the office-JWT gate); returns Sam's Plumbing's fixture statement from `_shared/customerSampleFixtures.ts` with `payRun` from the live `sub_pay_run_day` / `sub_pay_explainer` settings. No person, no rows.

**Stages** (v2.2767): each sheet carries `stage` (`working` | `walkthrough` | `customer_pay`), `stageChangedOn` (YMD of the last move) and `stageSource` (`office` | `portal` | `auto`) — read from `people_labor_jobs.stage*`; unknown values normalize to `working`. The old `status` field is gone (paid sheets never appear: open = $0 leaves the list).

**Endpoint**: `GET /functions/v1/sub-portal?token=<opaque>` or `GET /functions/v1/sub-portal?slug=<address>`

**Dates** (v2.2703): the sheet window's "today" is the Central civil day (`todayYmdInAppTz()`).

**Auth**: none (`verify_jwt = false` — the link IS the capability, minted/rotated by `mint_sub_portal_link`). Service-role reads; never returns costs beyond the sub's own money, other people's data, or document contents.

**View counting**: each validated load appends a `public_page_views` row (`surface='sub_portal'`, `entity_id` = person id, `via` token/slug), fire-and-forget. **v2.2875**: skipped for office peeks — `?preview=1` (the sub globe's iframe / Preview add it; `SubPortal.tsx` forwards it) or a verifiable staff access token in `Authorization` — via the same `publicViewDecision` as `customer-portal`.

### submit-sub-portal

**Purpose**: Everything a sub can DO from the portal, token-authenticated like submit-portal-request. Five kinds (the fifth, `mark_work_done`, below): `availability` (rate-limited 5/hour per link → `dispatch_requests` with `pending_payload.source='sub_portal'` + `notify-dispatch-request` fan-out); `accept_offer` — **sign-to-accept**: validates the `offered` + unexpired commitment belongs to the link's person, validates/stores a drawn signature PNG (magic bytes, 512 KB cap, `contract-signer-signatures` bucket under `commitments/<id>/`, compensating delete on failure), transitions `offered → accepted` while stamping the full signature record of truth on the row (`signed_at`, `signer_printed_name`, `signer_signature_mode` type|draw, `signer_signature_storage_path`, `signer_consented_at`, `signer_ip`, `signer_user_agent`), then drops a "signed & accepted" dispatch note; `decline_offer` (`offered → declined` with the required reason + dispatch note); `sign_link` — mints a fresh 14-day `/contract/accept` token for one of the sub's own `unsent`/`sent` `person_contract_documents` (send-contract-for-signature mint pattern, no email; the newest link wins).

**Job-anchored orders create the sheet** (v2.2819): when the signed commitment has `job_id` but no `labor_job_id` (assembled on Jobs → Work Orders), `accept_offer` stamps the signature first, then calls `create_sheet_for_work_order(p_commitment_id)` as the service role — the sub's `people_labor_jobs` sheet with one fixed item at the agreed amount, assignee junction, and `labor_job_id` linked back. The dispatch payload carries `laborJobId` (the created sheet) and `jobId`.

**Acknowledgements** (v2.2789): `accept_offer` reads the commitment's `offer_scope_snapshot.acknowledgements`; the request's `acknowledgements: string[]` must contain every one (case-insensitive) or it returns 400 *Please tick every confirmation box before signing.* The ticked list is stamped into `step_commitments.signer_acknowledgements` as `[{text, acknowledgedAt}]` in the same update as the signature; the dispatch note title appends the sheet label for sheet work orders and the payload carries `laborJobId`.

**Endpoint**: `POST /functions/v1/submit-sub-portal` — `{ token, kind, ... }` (`website` is the honeypot on availability).

**`mark_work_done`** (v2.2767): `{ token, kind: 'mark_work_done', laborJobId, note? }` — the sub's "My work here is done" button. The sheet must be one of the link's person's (`people_labor_job_assignees`) and at `working` (404 / 409 otherwise); moves it to `walkthrough` with `stage_source = 'portal'`, `stage_changed_by = NULL` and the trimmed note (≤300 chars) — the `people_labor_jobs_stage_to_activity` trigger posts the job's Activity line — then drops a **"Ready to walk — <sub> · <job> <address>"** dispatch note (`pending_payload.kind = 'sub_work_done'`, same `notify-dispatch-request` fan-out as availability). Returns `{ ok, stage: 'walkthrough', stageChangedOn }`.

**Dates** (v2.2703): offer expiry compares against the Central civil day (`todayYmdInAppTz()`), not the UTC date.

**Auth**: none (`verify_jwt = false`) — the sub portal token is the capability; every kind re-validates ownership server-side.

### get-estimate-for-customer

**Purpose**: Public read of a **sent** estimate for the customer acceptance page (no JWT).

**Endpoint**: `GET /functions/v1/get-estimate-for-customer?token=<opaque>[&preview=1]`

**Expiry** (v2.2703): an estimate is valid through the end of its `valid_until` day in Central time (it used to expire at 7 PM Central).

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**Sample** (v2.2758, What customers see): `token=sample` / `sample-done` skips the row lookup — no sign-in (the data is invented; v2.2763 dropped the office-JWT gate) — and gets the fixture from `_shared/customerSampleFixtures.ts` laid over the live `app_settings` (estimate copy, `estimate_public_terms_body`); `sample-done` answers the 409 `already_accepted` shape so the page shows the thank-you. No view is logged.

**Behavior**: SHA-256 hash of `token`; load row by `public_token_hash` where `status = sent`; enforce `public_token_expires_at` and `valid_until`. Returns estimate fields plus **`customer_experience`**: public UI strings (accept, thank-you, document labels — omits email subject/body). Uses **`customer_experience_sent`** when set, else merges **`app_settings`** + **`customer_experience_overrides`**. If **`status = customer_accepted`**, responds **409** with `code: already_accepted` and **`customer_experience`** for the thank-you page.

**200 response**: Includes **`for_line`** (`string | null`): staff **For:** line — trimmed **`for_address`** if set, else trimmed linked **`customers.address`**, else `null` (UI may show em dash). Since v2.2460 also includes **`options`** — `estimates.options_snapshot` normalized by [`_shared/estimateOptions.ts`](../supabase/functions/_shared/estimateOptions.ts) (`[]` = single-option estimate); the acceptance page renders the picker from exactly what `accept-estimate` will validate against.

**Audit**: On each successful **200** for **`status = sent`**, calls Postgres **`record_estimate_public_link_view`** via **`service_role`** **`rpc`** to append **`estimate_customer_events`** with **`event_type = public_link_view`** and **`client_ip` / `user_agent`** from the request ( **`SECURITY DEFINER`** in-db insert; failures are **`console.error`**’d and do not change the response). See migration [`20260406034514_record_estimate_public_link_view_rpc.sql`](../supabase/archive/migrations-pre-baseline/20260406034514_record_estimate_public_link_view_rpc.sql) (pre-baseline archive; the live schema comes from the baseline). **Dedupe**: [`20260412184127_dedupe_record_estimate_public_link_view.sql`](../supabase/archive/migrations-pre-baseline/20260412184127_dedupe_record_estimate_public_link_view.sql) skips a second **`public_link_view`** for the same estimate, IP, and user-agent within **5 seconds** (Strict Mode double-fetch, etc.). **Office previews don't count** (v2.2873, journey-map #34/#37): when the query carries **`preview=1`** the view RPC is skipped entirely. The page adds the marker itself ([`src/lib/estimateViewPreview.ts`](../src/lib/estimateViewPreview.ts)) when the URL already carries `?preview=1` — which is how the office's **Open customer link** opens it — or when a signed-in staff session is on the page. The marker can only under-count, so it needs no server-side proof (a customer forging it would hide only their own open). The Pipeline's "opened / never opened" chip reads these rows.

---

### log-estimate-option-view

**Purpose**: Option-browsing telemetry for the acceptance page (Estimate Options Phase 3, v2.2462) — the staff activity feed's "Viewed option — Tankless upgrade" rows.

**Endpoint**: `POST /functions/v1/log-estimate-option-view`

**Body**: `{ "token": string, "optionKey": string }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**Behavior**: Validates exactly like `get-estimate-for-customer` — token hash must match a live `sent` estimate, unexpired — and the `optionKey` must exist in that estimate's own `options_snapshot`; passes the [`_shared/publicEventThrottle.ts`](../supabase/functions/_shared/publicEventThrottle.ts) gate (v2.2697: identical event within 30 s or >60 from one IP in 10 min is dropped, still 200); then appends an `estimate_customer_events` row (v2.2476 fixed the shared logger's bare-`req` ReferenceError that silently dropped every event) (`event_type = option_viewed`, `source = log-estimate-option-view`, `metadata.option_key/option_name`) via [`_shared/logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts). **Always returns 200** — invalid/unknown input is dropped silently (this endpoint must prove nothing to callers, and browsing must never break on it). Requires migration `20260828193012` (CHECK constraints widened).

---

### get-bid-proposal-room

**Purpose**: Public fetch for the **Bid Room** (Signable Bids, v2.2468) — the durable per-GC proposal link at `/bid-room?t=…`.

**Endpoint**: `GET /functions/v1/get-bid-proposal-room?t=<token>` · `POST` `{ token, event: 'option_viewed', optionKey }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`; the plaintext room token (portal-links precedent) is the credential.

**Sample** (v2.2758, What customers see): `t=sample` / `sample-done` skips the room lookup — no sign-in (v2.2763 dropped the office-JWT gate) — and gets the fixture room (two options, one pending change order; `sample-done` = signed with the CO accepted) with `terms` / `exclusions` read live from the bid cover-letter defaults. No `room_view` is logged.

**Behavior**: GET loads the room by `public_token`, 410 `closed` when withdrawn, 404 `empty` before the first publish; returns the **latest revision** (`rev_number`, note, published_at) with its payload parsed by [`_shared/bidRoomPayload.ts`](../supabase/functions/_shared/bidRoomPayload.ts), the room's attachment (the Google Docs letter), the latest **proposal** signed/declined event (CO answers, `metadata.kind='change_order'`, never decide the proposal's state), and `documents` — the change orders published into the room (v2.2472, `estimates.bid_room_id`); logs a `room_view` event with IP/UA. POST logs `option_viewed` — since v2.2697 the key is validated against the room's current revision and the write passes the shared throttle (30 s dedupe, 60/10 min per IP); always 200, invalid or throttled input dropped — browsing must never break. Requires migration `20260828215717`.

**Staff opens don't count** (v2.2875, journey-map J35-F3): `room_view` (GET) and `option_viewed` (POST) are skipped when the request carries `?preview=1` or a verifiable user access token in `Authorization` — `BidRoom.tsx` now sends the browser's own session when it has one (an estimator checking their own link), the anon key otherwise. Decision shared with the portals: [`_shared/publicViewCounting.ts`](../supabase/functions/_shared/publicViewCounting.ts). Anonymous GC opens log exactly as before; signed / declined never depend on it.

---

### get-rfq-quote-page

**Purpose**: Public fetch for the **supply house quote page** (RFQ Phase 2, v2.2631) — the `/q/<token>` link a "Copy with quote link" paste carries (`docs/SUPPLY_HOUSE_RFQ_PLAN.md`).

**Endpoint**: `GET /functions/v1/get-rfq-quote-page?t=<token>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`; the RFQ token is the credential (Bid Room precedent).

**Behavior**: Loads the `bid_rfqs` row by token; 404 unknown; returns `{ status: 'closed' }` when the RFQ is closed or its bid's outcome is `lost` (token hygiene — dead links go quiet). Otherwise returns the scope snapshot's lines (fixture, count, unit — names and counts only, prices never leave), the bid label (`bid_number · project_name`), the supply house name, and `needed_by`.

---

### submit-rfq-quote

**Purpose**: Public submit for the supply house quote page — the vendor's typed prices become a structured quote on the bid.

**Endpoint**: `POST /functions/v1/submit-rfq-quote` — `{ token, quotedBy?, validUntil?, freightCents?, note?, lines: [{ fixture, unitPriceEachCents?, cantSupply?, note? }] }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`; the RFQ token is the credential.

**Behavior**: 404 unknown token, 410 when closed (or the bid is lost). Lines are validated against the RFQ's **own scope snapshot** — fixture names the RFQ never asked about are dropped (the token can't write arbitrary rows), prices sanity-capped, notes/name length-capped. Inserts `bid_quotes` (source `link`, `rfq_id`, the RFQ's supply house/bid version) + `bid_quote_lines`, flips the RFQ to `quoted`, and upserts the `supply_house_fixture_prices` memory (deduped by generated `fixture_key`). Re-submits allowed until closed — compare shows the latest per house; earlier quotes stay as history. Requires migration `20260902030531`.

---

### send-rfq-email

**Purpose**: The **RFQ Desk** sender (lane B, v2.2636) — system-sent supply-house price requests with tracking, nudges, and previews (`docs/SUPPLY_HOUSE_RFQ_PLAN.md`).

**Endpoint**: `POST /functions/v1/send-rfq-email` — `{ mode: 'send'|'remind'|'resend'|'preview', … }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

**Gateway**: `verify_jwt = false`; JWT + Pricing-staff role validated in-function (send-bid-pricing-package pattern).

**Behavior**: `send` takes `{bidId, bidVersionId?, neededBy?, vendorNote?, scope: {lines, text}, requests: [{supplyHouseId, email}]}` (≤10 houses) and mints one `bid_rfqs` row + token + email per house — the grouped no-prices list in the body, the `/q/<token>` button, `reply_to` = the sender, Resend message id stored on the rfq so the existing [resend-webhook](#resend-webhook) rail reports delivered/bounced. `remind` re-sends with a 24h server-side throttle (429 inside it) and an opener that varies by `viewed_at`; bumps `reminder_count`. `resend` fixes a bounced address on the same token. **`preview` returns the exact email any of those would produce — same builder, no writes, nothing sent** — and the UI requires it before every send and every nudge. Requires migration `20260902151658`.

---

### send-bid-room-link

**Purpose**: Email a GC their bid-room link with the option ladder (every option's price, ★ on the proposed — owner decision 5's estimate-email precedent).

**Endpoint**: `POST /functions/v1/send-bid-room-link` — `{ room_id, email, public_origin? }`

**Email** (v2.2729): the "Letterhead" design from `_shared/bidRoomLinkEmail.ts` — fileable subject (trade · project · proposed amount · company), brand banner, meta line, option table with *Our recommendation*, bulletproof button + plain-URL fallback, validity from the terms, the sender's signature block with Reply-To, revision note on revised sends.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional — returns the link un-emailed when missing), `APP_ORIGIN` fallback for the link base.

**Gateway**: `verify_jwt = false`; staff JWT validated in-body (`auth.getUser`), and the caller's own RLS must see the room (403 otherwise).

**Behavior**: Requires a published revision (400 otherwise); sends via Resend, stamps `recipient_email` on the room, logs a `link_sent` event with the revision number. The client stamps `bid_version_sends` on the first send (same as Mark sent today).

---

### sign-bid-room

**Purpose**: Record a GC's signature or decline on a bid-room proposal (Signable Bids Phase 2, v2.2470) — the signature-time freeze.

**Endpoint**: `POST /functions/v1/sign-bid-room` — `{ token, revision_id, action: 'sign'|'decline', … }` (sign: `optionKey`, `printedName`, `agreedTerms`, optional `signaturePngBase64`; decline: `category`?, `note`?)

**Staff notice** (v2.2743): a signed proposal goes through `notifySignedAgreement` (auto-create when `signed_agreements_auto_create_job_bids` is on; "Signed — …" letter to the stream list). Declines and change orders keep the short plain-text notice to the room's master + creator. Since v2.2838 the auto-create runs behind the `_shared/autoCreateJobGuard.ts` decision (already-linked / same-bid / same-customer-name-value twin → skip; see [accept-estimate](#accept-estimate)); a `bid_proposal` is treated like an estimate.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional staff notify), `APP_ORIGIN`

**Gateway**: `verify_jwt = false`; the room token is the credential.

**Behavior**: Only the room's **latest revision** may be answered (409 `stale_revision` — the page refreshes), and only once (409 `already_answered`). Since v2.2697 the `signed` event carries `metadata.auto_lost_gcs` (the GC names the win auto-marked Lost) and `bid_outcome_set`, and the staff email names them. With `documentId` (v2.2472) the answer applies to that **change order** instead: sign sets the CO row `customer_accepted` with acceptor fields + optional signature PNG, decline sets `declined` with the note in the event — neither touches the proposal's outcome or the bid's won/lost. **Sign** mints an `estimates` row born `customer_accepted` (`doc_kind='bid_proposal'`, `bid_id`, the room's GC as `customer_id`; chosen option frozen into `line_items_snapshot`/`total_cents`/`accepted_option_key`, all options in `options_snapshot`; acceptor fields + optional PNG in `estimate-acceptor-signatures`), then applies [`_shared/bidRoomOutcome.ts`](../supabase/functions/_shared/bidRoomOutcome.ts): packet Won, other sent unanswered packets auto-Lost, conservative `bids.outcome` roll-up. **Decline** marks the packet Lost with the GC's own loss category/note (Why-we-lost feed). Both log room events and email the room's creator + master.

---

### send-job-contract

**Purpose**: The office sends a job contract for signature (Contract Desk PR 2, v2.2681) — by email, or by minting the link to copy / text / sign in person.

**Endpoint**: `POST /functions/v1/send-job-contract` — `{ contract_id, mode: 'email'|'link', recipient_email?, recipient_name?, cc_emails?, public_origin?, message? }` with the staff user JWT in `Authorization`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional — without it the link is returned un-emailed), `APP_ORIGIN`

**Gateway**: `verify_jwt = false` (the JWT is validated in-body so the row is read through the caller's RLS).

**Behavior**: Reads `job_contracts` as the caller (403 when RLS hides it); refuses voided / signed rows and rows without terms. Mints the durable plaintext `public_token` on the first send, reuses it after; refreshes `public_token_expires_at` (+90 days); sets `status = 'sent'`, `sent_at` (first), `last_sent_at`, `send_count + 1`, the recipient block, `next_reminder_at` (+3 days when reminders are on); logs a `sent` event (`metadata.channel` email|link). `mode: 'email'` sends the Resend email (Review & sign button, reply-to = the sender, CC list) and returns `{ ok, emailed, sign_url }`; `mode: 'link'` returns the URL without emailing. The `job_contracts_to_activity()` trigger writes `contract_sent` on every send.

---

### get-job-contract

**Purpose**: Payload for the customer's contract page `/contract/sign?t=<token>` (Contract Desk PR 2, v2.2681).

**Endpoint**: `GET /functions/v1/get-job-contract?t=<token>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false`; the token is the credential, service role behind it.

**Behavior**: Resolves `job_contracts.public_token`; 404 unknown, 410 `voided` (withdrawn page), 410 `expired` (sent rows past `public_token_expires_at`), 404 `empty` (draft). Returns the contract's public fields (heading, job number/address/customer, recipient, `fields`, terms body + format, template name, sent/signed stamps, a 1-hour signed URL for a drawn signature) plus `signed_pdf_url` (v2.2696, 1-hour signed URL for the stored PDF), the invoice-issuer letterhead block (`app_settings` `physical_invoice_issuer_v1`), and the brand. While the row is `sent` it bumps `view_count` / `first_viewed_at` / `last_viewed_at` and logs a `viewed` event (first view → `contract_viewed` on the job's activity feed). Signed rows serve forever — the link is the customer's copy.

---

### sign-job-contract

**Purpose**: Record the customer's e-signature on a job contract (Contract Desk PR 2, v2.2681).

**Endpoint**: `POST /functions/v1/sign-job-contract` — `{ token, revision, printedName, agreedTerms: true, signaturePngBase64?, mode?: 'in_person', public_origin? }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional confirmations), `APP_ORIGIN`

**Gateway**: `verify_jwt = false`; the token is the credential.

**Behavior**: Only a `sent` row at the CURRENT `revision` can be signed — 409 `stale_revision` / `already_signed` (the page refreshes to the current version), 410 `voided` / `expired`. Validates the drawn PNG (magic bytes, ≤512 KiB) and stores it in the private `job-contract-documents` bucket at `<contract_id>/<uuid>.png` (upload failure degrades to a typed record). Conditional update (`status = 'sent'` and the revision) writes `status = 'signed'`, `signed_at`, `signer_printed_name`, `signer_mode` (type | draw | in_person), `signer_consented_at`, `signer_ip`, `signer_user_agent`, `signer_signature_storage_path`, clears `next_reminder_at`; logs a `signed` event; the bridge trigger writes `contract_signed`. Best-effort emails: the customer a confirmation carrying the same durable link (CC list honored), the contract's creator + the job's master a notice linking to the job. **v2.2696**: after the commit it builds the signed PDF (`_shared/jobContractPdf.ts`, pdf-lib via esm.sh — letterhead, scope, price, terms, signature + audit line), stores it at `<contract_id>/signed.pdf` (`signed_pdf_path`), and attaches it to the customer's confirmation; a PDF failure never fails the signature.

---

### remind-job-contracts

**Purpose**: The reminder lane for contracts out for signature (Contract Desk PR 5, v2.2690).

**Endpoint**: `POST /functions/v1/remind-job-contracts` — `{}` (optional `dry_run: true`); `X-Cron-Secret` header (or `cron_secret` in the body) must match.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `APP_ORIGIN`

**Gateway**: `verify_jwt = false`; the cron secret is the credential. Scheduled hourly (`:23`) by pg_cron job `job-contract-reminders` (migration `20260903154024`).

**Behavior**: Kill switch `app_settings` `job_contract_reminders_disabled_v1 = '1'` → `{ skipped: 'disabled' }`. Otherwise drains up to 50 `job_contracts` rows that are `sent`, `reminders_enabled`, not voided, `next_reminder_at <= now()` and `reminder_count < 3`. Rows with no token, an invalid email, or an expired link get `next_reminder_at` cleared (never re-queue). Each remaining row gets a Resend email ("Reminder: please sign — …", the durable link, reply-to = the contract's creator, CC list honored; the third says it is the last automatic reminder), then `reminder_count + 1` and `next_reminder_at` +3 days (null after the third), and a `reminded` event. An email failure leaves the row untouched to retry next hour.

---

### share-job-contract

**Purpose**: Share a signed agreement — the stored signed PDF — by email, or hand back a download URL (Signed agreement view PR B, v2.2712).

**Endpoint**: `POST /functions/v1/share-job-contract` — `{ contract_id } | { estimate_id, job_id? }`, `mode: 'email' | 'pdf_url'`, `to?: string[]` (≤10; first To, rest CC), `note?`, `public_origin?`; staff user JWT in `Authorization`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `APP_ORIGIN`

**Gateway**: `verify_jwt = false` (JWT validated in-body; rows read as the caller).

**Behavior**: Contracts must be `signed`; the PDF is `signed_pdf_path` from `job-contract-documents` (rebuilt once with `_shared/jobContractPdf.ts` and stored when missing; paper records send `paper_upload_path`). Estimates must be `customer_accepted` with a consent stamp; their PDF is built once from the frozen line items / option / terms / acceptor fields and cached at `estimates/<id>/signed.pdf`. `pdf_url` → 1-hour signed URL. `email` → Resend with the attachment, reply-to = the sender, the durable link for contracts, optional note; then a `shared` `job_contract_events` row (contracts) and a `contract_shared` `job_activity_events` row (both, when a job is known) carrying `to`.

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

**Staff notice** (v2.2743): after the acceptance is saved, `notifySignedAgreement` (`_shared/signedAgreementNotify.ts`) runs — optional auto-create via `auto_create_job_from_signed_estimate` when `signed_agreements_auto_create_job_estimates` is on, then the "Signed — …" letter to `signed_agreement_notify_recipients` ∪ the estimate's own picks. Replaces the old per-estimate + org-wide notify. **Auto-create guard** (v2.2838): before the RPC, the pure kernel `_shared/autoCreateJobGuard.ts` decides against a bounded candidate set (jobs on the bid + the customer's jobs from the last 90 days) — skip when the estimate is already linked, is a `change_order` (never auto-created; the letter's Create the job opens Apply-to-job), a job carries the bid (linked, not duplicated), or a same-customer/name/value twin exists (`duplicate_by_name_value`, no write); otherwise create. One structured log line per decision: `signed_agreement_auto_create_decision {outcome, skipped_reason, matched_job_id, via}`. The SQL function enforces the CO and twin rules too (migration `20260905110000`).

**Expiry** (v2.2703): same end-of-Central-day rule as `get-estimate-for-customer`.

**Body**: `{ "token": string, "printedName": string, "agreedTerms": true, "optionKey"?: string }` — `optionKey` is **required when the estimate offers 2+ options** (400 `option_required` / `option_unknown` otherwise).

**Decline** (v2.2873, journey-map J17-F6 / Tier-2 #34): `{ "token": string, "action": "decline", "declineReason"?: string }` — the customer's **No thanks** on the acceptance page. No name, signature, or terms. Same token lookup; the `sent → declined` update is status-gated (`.eq('status','sent')`) so a race with an acceptance answers **409**; then `insertEstimateCustomerEvent` appends `event_type = declined`, `source = accept-estimate`, `metadata { by: 'customer', note }` (reason trimmed/collapsed to ≤ 280 by [`_shared/estimateDecline.ts`](../supabase/functions/_shared/estimateDecline.ts)). Responses: **200** `{ ok, declined: true }`; **200** `{ ok, alreadyDeclined: true }` on a repeat; **409** `already_accepted`; **410** `expired` on a dead token; **404** for drafts/superseded. No staff email (the Pipeline's **Declined** bucket and the "Declined by customer" activity line are the notice). One structured log line `estimate_declined {by, estimateId, hasReason}`. Requires migration `20260905170000` (event_type CHECK widened; **push it before deploying** — without it the status still flips but the best-effort audit row is dropped). The **staff** decline ("Record a decline (phone / in person)" on the sent detail) is not this function — it is the authenticated RPC `record_estimate_decline` from the same migration.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional; staff notify skipped if missing)

**Gateway**: `verify_jwt = false`

**Behavior**: Idempotent if already `customer_accepted` (returns **`200`** + **`alreadyAccepted: true`**). Captures **`acceptor_ip`** from **`x-forwarded-for`** (first hop) and **`user-agent`** on the real **`sent` → `customer_accepted`** update. **Estimate Options (v2.2460)**: when `options_snapshot` holds 2+ options, the validated choice is **frozen** in the same update — the chosen option's lines into `line_items_snapshot`, its sum into `total_cents`, its key into `accepted_option_key` — which is what keeps every downstream reader (accepted document, `create_job_from_estimate`, Pipeline) unchanged. The staff notify email appends `— chose "<name>" · $<total>`.

**Staff email** (after successful **`sent` → `customer_accepted`**): recipients are the **union** of (a) **`estimates.accept_notify_user_ids`** — this estimate's own picks (nullable before first save; empty array = no per-estimate extras) — and (b) the org-wide **always-notify** list in **`app_settings`** key **`estimate_accepted_notify_recipients_v1`** (v2.991; JSON array of `users.id` in `value_text`, dev-write, edited via the ⚙ **Accepted notifications** on Estimates; a missing/malformed row parses to **`[]`**, so behavior matches pre-v2.991). The union is deduped, then calls **`estimate_accept_notify_filter_eligible_user_ids`** and emails each resolved **`users.email`** via Resend (same From as customer estimate mail). Link uses **`ESTIMATE_PUBLIC_ORIGIN`** (or fallback **https://pipetooling.github.io**) to **`/estimates/{estimate_number}`**. Failures are **`console.error`** only; HTTP **`200`** is still returned if the DB update succeeded.

**Draft app default (not Edge)**: When the column is **`NULL`**, [`Estimates.tsx`](../src/pages/Estimates.tsx) pre-selects the signed-in user and every **`master_technician`** on estimate detail load (Supabase **`users`** query; dedupe; on failure, self only)—until staff save the draft, which persists the array. **`[]`** remains explicitly no recipients.

**Audit**:
- **First acceptance** (**`sent` → `customer_accepted`**): the **`estimate_customer_events`** row (**`public_accept_submitted`**, IP/UA, **`metadata.had_signature`**) is written by the **database trigger** [`estimates_audit_customer_accepted_trigger`](../supabase/archive/migrations-pre-baseline/20260406033952_estimates_audit_customer_accepted_trigger.sql) in the **same transaction** as the **`estimates`** update (Edge does not insert that row on the success path).
- **`alreadyAccepted: true`** (repeat **POST** while already accepted): best-effort **`insertEstimateCustomerEvent`** via **`log_estimate_customer_event`** / insert fallback in [`_shared/logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts), with **`metadata.repeat_after_accepted`** (does not change **`200`** success).

**Related (Postgres, not Edge)**: Staff create **`jobs_ledger`** and set **`estimates.job_ledger_id`** via authenticated RPC **`create_job_from_estimate`** — see [`20260405072854_estimate_create_job_rpc.sql`](../supabase/archive/migrations-pre-baseline/20260405072854_estimate_create_job_rpc.sql) and [`Estimates.tsx`](../src/pages/Estimates.tsx).

---

### send-estimate-to-customer

**Purpose**: Verify JWT, ensure caller can read draft estimate, generate token hash, set `sent`, persist resolved **`customer_experience_sent`**, email Resend link to `{public_origin}/estimate/accept?t=…`.

**Endpoint**: `POST /functions/v1/send-estimate-to-customer`

**Body**: `{ "estimate_id": string, "customer_email": string, "public_origin"?: string, "mode"?: "send" | "resend" }` (`public_origin` should be `window.location.origin` from the app; `mode` defaults to `send`.)

**Response**: `{ ok: true, emailed: boolean, resent: boolean, sent_to: string, accept_url: string, warning?, email_error? }` — `accept_url` is the only place the raw token ever leaves the server; the app keeps it in the sending tab's `sessionStorage`.

**Resend mode** (v2.2856, journey-map J17-F2/N3 — "a lost estimate link cannot be resent"): `mode: "resend"` re-mints the customer link on an estimate that is already **`sent`**. Gate: [`canResendEstimateLink`](../supabase/functions/_shared/estimateLinkResend.ts) (`status = sent` with a `sent_at`; not in a bid room; `valid_until` not before today in `APP_CALENDAR_TZ` — a past good-through date would land the fresh link on the accept page's 410, so the office starts a new estimate instead). Token expiry is **not** a blocker — an expired 14-day token is what a resend fixes. Refusals answer **400** `{ error: <office sentence>, code: <reason> }` with `reason ∈ draft | accepted | declined | superseded | never_sent | pricing_expired | bid_room | unknown_status`. `customer_email` is optional in this mode (defaults to the row's `customer_email`; a supplied address replaces it). Behaviour: a new random token → `public_token_hash` + a fresh 14-day `public_token_expires_at` (**overwriting the hash retires the old link** — `get-estimate-for-customer` looks up by hash and 404s the old one); the email is rebuilt from the stored **`customer_experience_sent`** snapshot — the copy the customer already saw — with every old accept URL in `emailBody` swapped for the new one by `rewriteEstimateAcceptUrl` (never a rebuild from today's templates; rows with no parseable snapshot fall back to resolving from current settings like a first send); the snapshot is re-saved with the new URL. **Untouched on resend:** `status`, `sent_at` (the Sent chip's age keeps telling the truth), `line_items_snapshot`, `terms_snapshot`, `total_cents`, `customer_attachment_sent`. No `resent_at` column and no `estimate_customer_events` row (its `event_type` CHECK would need a migration); the app records `ui_nav_clicks` `control = 'estimate_link_resent'` instead. The UPDATE is gated `.eq('status','sent')`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional; returns `accept_url` if missing)

**Gateway**: `verify_jwt = false`; JWT validated with `auth.getUser` in function.

**Optional**: `ESTIMATE_PUBLIC_ORIGIN` if link base should not come from the client.

**Email** (v2.2747): the "Letterhead" design from [`_shared/estimateEmailLetterhead.ts`](../supabase/functions/_shared/estimateEmailLetterhead.ts) (dependency-free; the app's Email preview and `src/lib/estimateEmailLetterhead.test.ts` import the same file) — subject `Estimate #N — title — $total · company` (change orders `Change order #N — …`; the subject template setting/override is no longer read), brand banner, heading + meta line (number · `for_address` · send date in `APP_CALENDAR_TZ`), the body template's first paragraph as the opener and the rest as the sign-off (a paragraph holding the accept link is dropped), a total box with *Pricing is good through* from `valid_until` — or, with 2+ options, the option table (*Our recommendation* / *Alternate*) — a bulletproof `bgcolor` button + plain-URL fallback, the acceptance-page footer lines, and *Reply to this email to reach <sender>*. **Reply-To** = the sending user's email; **From** keeps `EMAIL_FROM`'s address with the brand's company as display name.

**Copy**: The body comes from **`resolveEstimateCustomerExperience`** (`supabase/functions/_shared/estimateCustomerExperience.ts`, keep in sync with `src/lib/estimateCustomerExperience.ts`) using **`app_settings`** + row **`customer_experience_overrides`** and template vars **`{{accept_url}}`**, **`{{title}}`**, **`{{estimate_number}}`**. The resolved object — with `emailSubject` replaced by the subject actually sent — is stored as **`customer_experience_sent`** on **`sent`**.

---

### get-contract-for-signer

**Purpose**: Public read of a **sent** person contract document for the signing page (no JWT).

**Endpoint**: `GET /functions/v1/get-contract-for-signer?token=<opaque>`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Gateway**: `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml).

**Sample** (v2.2760, What customers see): `token=sample` / `sample-done` skips the row lookup — no sign-in (v2.2763 dropped the office-JWT gate); returns the sample agreement (`SAMPLE_CONTRACT`, HTML body) or the 409 `already_signed` shape. No `signer_last_viewed_at` stamp.

**Forms** (v2.2797, Contract Forms): when the row has `form_template_id`, the response also carries `form: { schema, templateUrl, revisionLabel, person: { name, email, phone }, todayLabel }` — the FormSchema, a 15-minute signed URL into the private `contract-form-templates` bucket, roster prefill from `people` (by `person_id`, else the row's `person_name`), and today's label in the company calendar. 503 if the template URL cannot be minted. `signing_body_html` is null for form rows.

**Behavior**: SHA-256 hash of `token`; load row by **`public_token_hash`** where **`status = sent`**; enforce **`public_token_expires_at`**. Returns **`signing_body_html`**, **`canonical_document_url`** (canonical column, else legacy **`url`**), **`document_name`**, **`person_name`** (still used for staff/email context; the public signing page in [`ContractAccept.tsx`](../src/pages/ContractAccept.tsx) does **not** display **For:** **`person_name`**). If **`status = signed`**, responds **409** with **`code: already_signed`** and optional thank-you strings (the app thank-you may use title-only copy; see **`RECENT_FEATURES.md`** v2.368). Since v2.1407, every successful fetch of a viewable `sent` document also stamps **`signer_last_viewed_at = now()`** (best-effort — an update error never blocks the page) for the People → Contracts Agreements compliance panel; requires migration `20260805120000`.

---

### accept-contract

**Purpose**: Record contract signature (typed or drawn PNG); sets **`status = signed`**, clears token, stores signature in **`contract-signer-signatures`** when drawn. **Two-party forms (v2.2802):** the signer's boxes only are validated and filled (`schemaForParty(schema, 'signer')`); when the template has office boxes the PDF is filed unflattened with the filled fields read-only, and `complete-contract-form-office` finishes it. The success response is `{ ok, documentId, officeSectionPending }` (v2.2803) so the thank-you page can offer the office step to a signed-in staff member on the same device.

**Endpoint**: `POST /functions/v1/accept-contract`

**Dates** (v2.2703): `signed_at` is the Central civil day via `todayYmdInAppTz()` — evening signatures used to be dated tomorrow.

**Body**: `{ "token": string, "printedName": string, "signaturePngBase64"?: string, "agreedTerms": true, "formValues"?: Record<string, string | boolean>, "formLang"?: "en" | "es" }`

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; optional `APP_ORIGIN` (where `/fonts/GreatVibes-Regular.ttf` is fetched for typed signatures; default `https://clicktooling.com`)

**Gateway**: `verify_jwt = false`

**Forms** (v2.2797, Contract Forms): when the row has `form_template_id`, `formValues` are validated against the template's schema (`validateFormValues`; 400 `code: form_invalid` with `problems`), the template PDF is downloaded from `contract-form-templates`, filled by `buildFillPlan` + `fillFormPdf` (bound fields by name, unbound boxes drawn, typed signature in Great Vibes or the drawn PNG, then flattened), uploaded to `contract-form-pdfs/<docId>/signed.pdf`, and the row gets `form_values` (sensitive boxes removed), `form_hints` (last four per sensitive box), `form_pdf_storage_path`, `form_source = 'portal'` with the usual signed fields. Failures after the signature PNG upload remove the PNG (and the PDF if filed). Imports `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1` from esm.sh.

**Behavior**: Same PNG validation/size limits as **`accept-estimate`**. Idempotent if already **`signed`** (**`200`** + **`alreadySigned: true`**). Captures IP from **`x-forwarded-for`** (first hop) and **`user-agent`**.

---

### send-contract-for-signature

**Purpose**: Verify JWT, ensure caller can read the **`person_contract_documents`** row, require at least one of **`signing_body_html`**, **`canonical_document_url`**, **`url`**, or **`form_template_id`** (v2.2797: a form row needs no body), mint a 14-day token, set **`status = sent`**, email the Resend link to **`{public_origin}/contract/accept?t=…`**.

**Endpoint**: `POST /functions/v1/send-contract-for-signature`

**Body**: `{ "person_contract_document_id": string, "signer_email": string, "public_origin"?: string, "email_subject"?: string, "email_intro_plain"?: string }`

- **`email_subject`** (optional): Plain-text subject after trim; max **200** characters (server clamps). If empty, default is **`Please sign: {document_name} · Click Plumbing and Electrical`** (v2.2773 — the signer's name is no longer in the subject).
- **`email_intro_plain`** (optional): Opening message only (plain text; control characters stripped; max **4000** characters, server clamps; blank-line paragraphs, single newlines become `<br>`). If empty, the default opening line is used.

**The email** (v2.2773, "Paper"): built by the shared, dependency-free **`_shared/contractSigningEmail.ts`** (`buildContractSigningEmail`), which the app re-exports for the send dialog's preview — one builder, no mirror. The sub portal's identity: CLICK. letterhead, the document name, "Sent to you by <sender>", the opening message, three signing steps, an ink **Read and sign** button, the raw link + expiry date, a note band naming the signer's portal address when they have one, one Spanish line, and a reach line. **From** is `Click Plumbing and Electrical <EMAIL_FROM's address>`; **Reply-To** is the sender (their `users.email`, else the auth email). Logged to `email_send_log` as `contract_for_signature`.

**Portal lookup** (read-only, service role): exactly one non-archived **`people`** row whose `name` equals `person_name`, a **`sub_portal_slugs`** row, and an unrevoked **`sub_portal_links`** row → `https://my.clickplumbing.com/<slug>`; otherwise the band uses the no-portal wording. Nothing is minted to send an email.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional), `EMAIL_FROM` (address only; the display name is the company)

**Gateway**: `verify_jwt = false`; JWT validated with **`auth.getUser`** in function.

**Optional**: `ESTIMATE_PUBLIC_ORIGIN` if link base should not come from the client.

---

### open-contract-form-pdf

**Purpose**: Mint a short-lived link to a **signed form PDF** (Contract Forms, v2.2798) — the flattened copy in the private `contract-form-pdfs` bucket, the only place a form's sensitive answers exist — for a staff member allowed to see it, and log the open.

**Endpoint**: `POST /functions/v1/open-contract-form-pdf` — body `{ person_contract_document_id, which?: 'pdf' | 'scan' }`; `scan` (v2.2801) opens the paper scan of an *Enter from paper* filing instead of the flattened PDF, same gate, same log, download name suffixed "(paper)".

**Body**: `{ "person_contract_document_id": string }`

**Gate**: JWT validated in the body (`auth.getUser`; `verify_jwt = false` in `config.toml`). Caller must be `dev`, `controller`, or a `master_technician` with a `pay_approved_masters` row → else **403** `code: forbidden`. The row is then read through the caller's own client (contracts RLS) → **404** when unreadable, unsigned, or without `form_pdf_storage_path`.

**Success** (**200**): `{ "ok": true, "url": string, "expires_in": 300 }` — a 5-minute signed URL with a download filename `<document_name> - <person_name>.pdf`. Inserts `contract_form_pdf_opens (person_contract_document_id, opened_by)`; a logging failure is logged, not fatal.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`


### contract-form-paper-entry

**Purpose** (v2.2801, Contract Forms PR 6 — *Enter from paper*): a staff member keys a sub's hand-filled form into the same boxes the signing page shows, attaches the scan, and files it as signed on paper. Two actions in one function.

**Endpoint**: `POST /functions/v1/contract-form-paper-entry` (`verify_jwt = false`; JWT validated with `auth.getUser` in the body).

**Gate**: `users.role` in dev · master_technician · assistant · controller (the roles that may insert person copies). Others → **403** `forbidden`.

**Body**:
- `{ "action": "prepare", "book_entry_id": uuid }` → `{ ok, schema, templateUrl (15-min signed URL into contract-form-templates), documentName, docType, revisionLabel }`. 404 when the entry is not a form.
- `{ "action": "file", "book_entry_id", "person_name", "person_id"?, "formValues", "signer_printed_name", "signed_on_ymd", "attested": true, "skip_boxes", "scan"?: { base64, mime, filename } }` → `{ ok, id, filed_pdf, filed_scan }`. Validates known keys only, scan type (JPG / PNG / WEBP / HEIC / PDF) and size (8 MB), the attestation, and the date; `skip_boxes` requires a scan. Missing required boxes never block. Fills + flattens the template with **no signature drawn** (the date box gets the date on the paper), uploads `<id>/signed.pdf` (unless boxes were skipped) and `<id>/source.<ext>` to `contract-form-pdfs`, then inserts the `person_contract_documents` row: `status = signed`, `signed_at` = the paper's date, `signer_printed_name`, `applied_contract_template_document_id` (the resolver trigger stamps `form_template_id` + `doc_type`), `form_values` (non-sensitive) / `form_hints` (last four), `form_pdf_storage_path`, `form_scan_storage_path`, `form_source = 'paper'`, `form_keyed_by_user_id`, and a `note` when the boxes were skipped. Uploaded objects are removed if the insert fails.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `APP_ORIGIN` for the cursive font (unused here in practice since no signature is drawn).


### complete-contract-form-office

**Purpose** (v2.2802, Contract Forms PR 7 — two-party forms): the office's half of a form whose template has `party: 'office'` boxes (the I-9's Section 2). Such forms are filed by `accept-contract` / `contract-form-paper-entry` **unflattened** (signer fields read-only) so the office can still fill its fields; this function finishes them.

**Endpoint**: `POST /functions/v1/complete-contract-form-office` (`verify_jwt = false`; JWT validated with `auth.getUser` in the body).

**Gate**: `users.role` in dev · master_technician · assistant · controller, and the row must be readable under the caller's own contracts RLS (read through their client).

**Body**:
- `{ "action": "prepare", "person_contract_document_id": uuid }` → `{ ok, schema (office boxes only, via schemaForParty), pdfUrl (15-min signed URL of the current filed PDF), officeValues, completed: { at, by, printedName, attestedAt } | null, signer: { printedName, signedAt, source }, signerRegions (the signer's half as padded page rects, shaded as locked — v2.2803), documentName, personName }`. 400 when the form has no office section; 409 when the signer has not completed their part.
- `{ "action": "complete", "person_contract_document_id", "officeValues", "office_signer_printed_name", "attested": true }` → **400** `not_attested` without the attestation (v2.2803; stamps `office_attested_at`); validates the office half (`validateFormValues` on the office schema; unknown keys dropped), downloads the filed PDF, fills the office boxes (office signature typed in cursive, office `today` dates = today), **flattens**, overwrites `<id>/signed.pdf` in `contract-form-pdfs`, and stores `office_values` (non-sensitive) + `office_completed_at` + `office_completed_by_user_id` + `office_signer_printed_name`. One-shot: **409** `already_completed` afterwards. → `{ ok }`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `APP_ORIGIN` for the cursive font.

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

### job-share

**Purpose**: **Public** resolver for tokenized job share links (Share-a-job Phase 2, v2.1453) so a texted link unfurls as a **rich iMessage/OG card** — title = job # + name, description = address · status, image = Street View of the address — then **redirects** human taps into the app at `/jobs?jobDetail=<job id>` (behind the recipient's own login).

> **Served through the branded share domain since v2.1770** — Supabase neutralizes HTML responses on the shared `functions.supabase.co` domain (forced `content-type: text/plain` + `Content-Security-Policy: sandbox`, an anti-phishing measure), which briefly made texted links render as a "Text Document" blob (v2.1767 shipped deep links as a stopgap). A **Cloudflare Worker** (`job-share-preview`) fronts this function: it proxies `?t=`/`?img=1` upstream, restores `text/html`, strips the injected sandbox CSP, and rewrites upstream origin references in the HTML (og:url/og:image) to the request's own origin. Since the clicktooling cutover (v2.2494) the Worker carries **two custom domains**: `share.clicktooling.com` (clicktooling.com zone — what the client mints: `https://share.clicktooling.com/?t=<token>`) and `share.pipetooling.com` (pipetooling.com zone — kept forever so links already texted keep unfurling). The Worker lives in the Cloudflare dashboard (account Robert@douglasmining.com), not this repo — its full source is quoted in the v2.1770 `RECENT_FEATURES.md` entry.

**Endpoint**:

- **HTML** (**200**): `GET /functions/v1/job-share?t=<raw token>` — OG meta tags + meta-refresh/JS redirect; **404** HTML ("no longer active") for missing/unknown/revoked tokens.
- **Image** (**200** binary): `GET /functions/v1/job-share?t=<raw token>&img=1` — proxied Google Street View JPEG (600×314); **404** when no key/address/coverage.

**Headers**: none — link-preview fetchers send no auth.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY` (image + coverage check; card degrades to text-only without it). Optional `APP_ORIGIN` overrides the redirect origin (default `https://pipetooling.com`).

**Gateway**: `verify_jwt = false` — access is gated by the unguessable 128-bit token, matched via sha256 against `job_share_links.token_hash` (raw token only ever lives in the URL; `revoked_at` is the per-link kill switch). The OG card exposes **only** job #, name, address, status.

**Validation**: `t` required, trimmed, max length 128; Street View coverage checked via the metadata endpoint before advertising `og:image` (so cards never unfurl Google's grey placeholder).

**Deploy**: `supabase functions deploy job-share`

**Implementation**: [`supabase/functions/job-share/index.ts`](../supabase/functions/job-share/index.ts); table: `job_share_links` (`20260807201349`); client mint + share: [`src/lib/jobShare.ts`](../src/lib/jobShare.ts) (token URL swap ships in the follow-up client PR).

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

### driving-distance

**Purpose**: Driven distance between two coordinate pairs via the **Google Routes API** (`computeRoutes`, DRIVE mode). Powers the bid form's **Distance to Office auto-fill** ([`bidDistanceToOffice.ts`](../src/lib/bidDistanceToOffice.ts)): the client geocodes the project address with **`geocode-one`**, resolves the office anchor (Settings → **Office address**, falling back to the Map default view center), then calls this for real driven miles. **Every `ok: false` degrades cleanly** — the client falls back to a straight-line × road-winding estimate — so a missing key or a not-yet-enabled Routes API never breaks the form.

**Endpoint**: `POST /functions/v1/driving-distance`

**Body** (JSON): `{ "origin": { "lat": number, "lng": number }, "destination": { "lat": number, "lng": number } }`

**Response** (**200** JSON):

- Success: `{ "ok": true, "meters": number }`
- Failure (client falls back to estimate): `{ "ok": false, "error": "no_key" | "routes_error" | "no_route" | "routes_fetch_failed", "detail"?: string }`
- Auth / validation: **401** / **403** / **400** with `{ "ok": false, "error": string }`.

**Headers**: `Authorization: Bearer <user_jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`.

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`GOOGLE_MAPS_API_KEY`** — the **Routes API** must be enabled on that key in Google Cloud (separate from the Geocoding API); until it is, calls return `ok: false` → the client shows the ≈ estimate.

**Gateway**: `verify_jwt = false`; **`auth.getUser()`** + **`users.role` in `('dev','master_technician','assistant','controller','estimator')`** in the function (**403** otherwise).

**Implementation**: [`supabase/functions/driving-distance/index.ts`](../supabase/functions/driving-distance/index.ts).

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

> **v2.2132:** count rows are loaded for the scenario's `bid_version_id` (`price_book_versions.bid_version_id`; NULL = the unsplit bid's rows) — versions own their counts since `20260823034820`. Redeploy after that migration is applied.

**Purpose**: Resend-backed delivery of a bid's **external Pricing package** — job address as a tap-to-open Google Maps link (v2.1791, omitted when the bid has none), Job Plans link (+ optional CountTooling plans link), and the 4-column external pricing table (Fixture/Tie-in, Count, Unit price, Revenue). The server **re-computes pricing rows from the database** (count rows + `bid_pricing_assignments` + `bid_count_row_custom_prices` + `bid_count_row_submission_hides` + `price_book_entries`) instead of trusting client-built HTML, so the email always matches the live Pricing tab. Subject/heading use the Bids-tab label shape `{prefix}{n} project name`.

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

**Purpose**: Send reminders for incomplete checklist tasks at configured times (CST) — Web Push first, **email fallback via Resend** (v2.2096) for users with no push device, so a reminder never silently vanishes. Invoked by pg_cron every 15 minutes. Since v2.2351 the **day-before** and **escalate-after-N-days** buckets key on the *effective due date* (`checklist_items.due_date` when set, else the instance's `scheduled_date`) — for windowed tasks the nudge lands the day before the deadline and escalation means N days *late*; items without a due date behave exactly as before. Since v2.2371 escalated titles carry a **pushed-back rider** — "(pushed ×2, +5d)" from the `checklist_item_due_changes` ledger (inline mirror of `src/lib/checklistDuePushes.ts`; keep in sync) — so escalation can't be quietly dodged by nudging the due date. Since v2.2056 the 03:00 CST run also performs the **weekly materialization top-up**: every active `day_of_week` item is stocked with occurrence rows 35 days ahead (mirrors `src/lib/checklistMaterialize.ts` — keep the Deno copy in sync; upserts against the `(checklist_item_id, scheduled_date)` unique index; new instances copy the item's current assignees). Pass `{"materialize": true}` in the body (with the cron secret) to force the top-up outside the 03:00 slot — the response then carries a `materialized` count.

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
  "email_fallbacks": 1,
  "users_notified": 2
}
```

#### Implementation Details

1. Validates CRON_SECRET (header or body)
2. Gets current time in America/Chicago, rounded to 15-minute boundary
3. Queries `checklist_items` where `reminder_time` matches current time
4. For each item, builds per-user **buckets** (v2.2096):
   - **due/overdue** — incomplete `checklist_instances` per `reminder_scope` (today_only or today_and_overdue), to the assignees
   - **due tomorrow** — items with `remind_day_before`, instances due tomorrow, to the assignees
   - **escalated** — items with `escalate_after_days`, instances ≥ that many days past due, to the item's `created_by_user_id`
5. One grouped message per user joining the non-empty buckets; push to every `push_subscriptions` device
6. **Email fallback** (v2.2096): users with zero push devices (or all pushes failing) get the same body via Resend from the `EMAIL_FROM` sender (needs `RESEND_API_KEY`; skipped silently without it)
7. Logs to `notification_history` with `template_type: 'scheduled_reminder'`, `channel: 'push' | 'email'`

**Prerequisites**:
- pg_cron and pg_net enabled (Supabase Dashboard > Database > Extensions)
- Vault secrets: `project_url`, `cron_secret` (same value as CRON_SECRET)
- Anyone who can create checklist tasks configures reminders in the Add/Edit modals (v2.2096; was dev-only)

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

### billed-report-email

**Purpose**: Share the Stages **Billed Awaiting Payment** report by email (v2.1315) — the print report re-rendered email-safe: customer groups A→Z with **tel:/mailto: contact links**, HCP / Job·Address / Detail / Days past / Amount due columns, subtotals + grand total, the board's 30–90/90+ aging chips, and **every job cell deep-links to `https://pipetooling.com/jobs?jobDetail=<id>`** (opens Job Detail in the app). Numbers come from the service-role RPC **`get_billed_report_email_payload()`** (migration `20260803100000`), rebuilt **at send time** — a scheduled send shows send-time numbers, never a stale snapshot. Renderers in [`billed-report-email/render.ts`](../supabase/functions/billed-report-email/render.ts).

**Endpoint**: `POST /functions/v1/billed-report-email`

**Modes** (JSON body; sender gate = dev / master_technician / assistant / controller, non-archived):
- `{ "mode": "preview" }` — Bearer JWT + sender gate; returns `{ "html": "..." }`. No writes, no send.
- `{ "mode": "test_send" }` — sender gate; emails the report to the **caller's own address**, subject prefixed **`[TEST]`**. No request row.
- `{ "mode": "send_now", "recipient_user_id": "<uuid>" }` — sender gate; recipient must be active, office-capable (dev/master_technician/assistant/controller/**primary** — the report carries AR dollars), with an email. Inserts an audit row in `billed_report_email_requests`, sends via Resend with a *"Sent by {caller}"* footer, stamps `sent_at`.
- cron (no `mode` or `{ "mode": "dispatch" }`) — **`X-Cron-Secret`** must equal **`CRON_SECRET`**. Drains due rows (`send_at <= now()`, unsent, `attempts < 5`, limit 10); payload rebuilt **once per batch**; unavailable recipients (archived / no email) are stamped sent with an explanatory error so rows never retry forever. **Weekly chains (v2.1323)**: a successfully-sent row with `repeat_weekly = true` enqueues next week's row (+7 days, same recipient/requester/flag) in the same dispatch — duplicate-guarded against retries; cancelling the pending row ends the chain.

**Success (cron)**: `{ "ok": true, "processed": n, "sent": k, "errors": [] }`

**Verify JWT**: `false` in `supabase/config.toml` (in-function JWT/role or cron-secret validation).

**Cron**: [`20260803100000_billed_report_email.sql`](../supabase/migrations/20260803100000_billed_report_email.sql) registers pg_cron **`billed-report-email`** with vault **`PROJECT_URL`** + **`CRON_SECRET`**; [`20260821010000_stagger_email_dispatch_crons.sql`](../supabase/migrations/20260821010000_stagger_email_dispatch_crons.sql) moved it to **`1-56/5 * * * *`** (v2.1919 stagger — each email dispatcher gets its own minute lane).

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `CRON_SECRET`

**Used by**: Jobs → Pipeline → Billed Awaiting Payment header → **⇪ Share / Print** → `BilledReportShareModal` (v2.1316: recipient picker, Send now / Schedule, Preview / Email me a test / Print instead, scheduled-sends list with cancel).

---

### paid-job-email

**Purpose**: "Customer paid" notifications (v2.965) — when a `jobs_ledger` row hits **`status = 'paid'`**, the `enqueue_paid_job_email()` DB trigger queues a `paid_job_email_queue` row; this function drains the queue and emails the configured recipients. **dev / master_technician** recipients get the **DETAILED** financial review (PAID IN FULL badge, Job Start / Last Work dates, Revenue / Payments / Costs / Profit scoreboard with per-person team-labor rows, monthly labor/parts/payments timeline); everyone else gets the **STERILIZED** summary — job identity + dates, **the exact paid amount/time (v2.969) but no cost or profit figures**. Money math comes from the service-role-only RPC **`get_paid_job_email_payload(p_job_id)`**. Renderers live in [`paid-job-email/render.ts`](../supabase/functions/paid-job-email/render.ts).

**Three streams since v2.1836** (migration `20260819230000`): **ready_to_bill** rows (new AFTER UPDATE trigger `enqueue_ready_to_bill_notification_au` on `jobs_ledger`, fires on every transition INTO `status='ready_to_bill'` — send-backs from Billed included) are the first stream with **delivery channels, per person since v2.1844** (migration `20260820020000`): recipients live in **`ready_to_bill_notify_recipients_v2`** as `[{ id, email, push }]` — each person's own channel picks; ≥1 channel = recipient (the v1 list+org-wide-channels pair remains the read fallback until v2 exists; the migration converts it). Email goes to the `email:true` set via the light renderers in [`paid-job-email/readyToBillRender.ts`](../supabase/functions/paid-job-email/readyToBillRender.ts) (detailed = billable dollars for dev/master; sterilized summary otherwise; money-free subject `Ready to bill — …`); web push goes to the `push:true` set via `npm:web-push` to their `push_subscriptions` devices (push bodies follow the same detailed/summary split; 404/410 subscriptions are pruned; push failures are noted on the queue row but never retried — a retry would re-email every recipient). Same-job ready_to_bill rows coalesce to the newest pending one; they are independent of the paid kinds. Payload RPC: service-role-only **`get_ready_to_bill_email_payload(p_job_id)`**. Test modes (dev/master gate, `[TEST]`-prefixed): `{ "mode": "test_push", "job_id", "recipient_user_id"? }` pushes to the caller's (default) or the chosen user's devices; `preview`/`test_send` accept `"kind": "ready_to_bill"`, and `test_send` accepts `recipient_user_id` (the RECIPIENT's role picks the variant).

**Two streams since v2.1310** (payload v5, migration `20260803000000`): `paid_job_email_queue.kind` splits the rail — **paid_in_full** (the v2.965 status trigger) keeps `paid_job_email_recipients_v1`; **payment** rows (new AFTER INSERT trigger `enqueue_payment_made_email_ai` on `jobs_ledger_payments`, positive amounts only — every payment writer flows through it) go to the separate **`payment_made_email_recipients_v1`** list. Dispatch collapses same-job rows before sending: a pending paid_in_full row **supersedes** that job's payment rows (the completing payment fires both triggers in one transaction — one email, not two), and multiple payment rows for one job coalesce into the newest (superseded rows are stamped sent with `superseded (coalesced with a same-job row)`). Payload v5 also adds **`invoices`** — the Edit Job Invoices table mirrored (drafts first; Draft/Billed/Paid chips; sent date with the "(+N)" created→sent offset; channel + memo/note detail; bill-to override label; hazmat flag; per-invoice paid vs open + totals row) — rendered by `renderInvoices` in both variants (detailed shows dollars, summary redacts them per the v2.1103 rule). Pre-v5 payloads and pre-migration queue rows degrade cleanly in either deploy order.

**Status-aware since v2.1103** (payload v3, migration `20260730031702`): the banner reflects reality — green **PAID IN FULL** only when the job is actually paid (or the payload predates v3), amber **"$X (Y%) OF $Z PAID"** when partially paid (subject becomes `Payment progress — …`; the paid line becomes "Last payment …"), gray **NOT PAID** at zero payments — so ad-hoc `send_to`/preview on unpaid jobs is a progress email, not a false claim. Both variants also render a **Line items** section (fixtures + per-item invoice-status chip PAID/BILLED/DRAFT/UNBILLED via `jobs_ledger_fixtures.invoice_id`): detailed shows amounts, summary shows names + status only. The "Paid <date>" header line renders only for paid jobs (the RPC stamps `paid_at = now()`). Renderer guards every new payload key, so it works against a pre-v3 payload in either deploy order.

**Cost timeline since v2.1107** (payload v4, migration `20260730050329`): the detailed variant's "Month by month" table is replaced by a **Cost & payment timeline** — the Edit Job Cost Timeline retold email-safe (no SVG: table cells as bars). Month header rows carry a center-$0 running-net bar (payments in − costs out, dated events only; bar widths scaled to the largest |running net|); beneath each month are its events with source icons (👷🔧💳🧾📦🧱, payments 💵 green-tinted): team labor folded to one row per person per week, each month capped at ~6 rows with the remainder folded into one reconciling "…and N smaller charges" line — capping trims rows, never the bars. Undated events (e.g. sub-labor books without dates) land in a barless "No date" group; the "Job end" row ties to scoreboard payments − costs. The scoreboard itself gains **Supply house invoices / Tally parts / Other job charges** rows and `profit` now spans **all six** cost streams (was labor + sub + card — the emailed profit figure became more complete at v4). Falls back to the old monthly table on a pre-v4 payload.

**Endpoint**: `POST /functions/v1/paid-job-email`

**Three modes** (JSON body):
- `{ "mode": "preview", "job_id": "<uuid>", "variant": "detailed" | "summary" }` — Bearer JWT, role **dev/master_technician** (non-archived); returns `{ "html": "..." }`. No DB writes, no send.
- `{ "mode": "test_send", "job_id": "<uuid>" }` — same role gate; sends the **detailed** variant via Resend to the **caller's own `users.email` only**, subject prefixed **`[TEST]`**.
- `{ "mode": "send_to", "job_id": "<uuid>", "recipient_user_id": "<uuid>" }` (v2.970) — same role gate; sends the **real** email (no `[TEST]`) to the chosen **active** user; the **recipient's role** picks detailed vs sterilized, and both variants carry a *"Sent manually by {sender}"* footer. Driven by the Job Detail ✉ modal.
- cron (no `mode` or `{ "mode": "dispatch" }`) — **`X-Cron-Secret`** (or body `cron_secret`) must equal **`CRON_SECRET`**. Loads pending queue rows (`sent_at IS NULL`, `attempts < 5`, limit 20); per row fetches the payload, loads recipients from `app_settings` key **`paid_job_email_recipients_v1`** (JSON array of user ids) joined to non-archived `users`, sends detailed vs summary by role, stamps `sent_at` on success or bumps `error`/`attempts`. **Empty recipient list stamps `sent_at` with `no recipients configured`** so rows never retry forever.

**Success (cron)**: `{ "ok": true, "processed": n, "sent": k, "errors": [] }`

**Verify JWT**: `false` in `supabase/config.toml` (in-function JWT/role or cron-secret validation).

**Cron**: [`20260722260000_paid_job_email.sql`](../supabase/migrations/20260722260000_paid_job_email.sql) registers pg_cron job **`paid-job-email`** with vault **`PROJECT_URL`** + **`CRON_SECRET`** (same pattern as `recurring-job-report-dispatch`); [`20260821010000_stagger_email_dispatch_crons.sql`](../supabase/migrations/20260821010000_stagger_email_dispatch_crons.sql) moved it to **`7-52/15 * * * *`** (v2.1919 stagger).

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (ready_to_bill push)

**Used by**: Jobs → Stages → the **⚙ Paid In Full notifications** button across from the Paid in Full header, the **⚙ Paid notifications** button in the Billed Awaiting Payment header (v2.1310), and the **⚙ Ready to Bill notifications** button in the Ready to Bill header (v2.1836) → [`PaidInFullEmailSettingsModal.tsx`](../src/components/jobs/PaidInFullEmailSettingsModal.tsx) (`variant` prop picks the stream; recipient config + Preview detailed / Preview summary / Email me a test, plus Delivery channels + Push me a test on the ready_to_bill variant). Dev preview harness: `scripts/preview-paid-emails.ts` renders the real templates to HTML.

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
- [`supabase/functions/test-email/README.md`](../supabase/functions/test-email/README.md)

**Deployment**: See [`supabase/functions/test-email/DEPLOY.md`](../supabase/functions/test-email/DEPLOY.md)

---

### create-stripe-invoice

> **v2.2878 — the receipt points back to the portal** (journey-map J22-F3 / Tier-2 #38): Stripe Invoice objects take no `return_url` (that is a Checkout / Payment Link field — verified against the `2024-06-20` reference) and the hosted page has no post-payment redirect, so the portal link rides the invoice **`footer`**. After the customer row loads — and only when the invoice has **no `bill_to_email`** (an alternate payer is not the portal holder) — `loadPortalReturnUrl(admin, customer_id, APP_ORIGIN)` ([`customerPortalReturnUrl.ts`](../supabase/functions/_shared/customerPortalReturnUrl.ts)) resolves the customer's active `all` link (short `my.clickplumbing.com/<slug>` when saved, else token URL), falling back to a GC-scoped link, else `null`; every URL carries `?paid=1`. `stripeInvoiceFooter(footer, portalUrl)` ([`stripeInvoiceFooterPortalLink.ts`](../supabase/functions/_shared/stripeInvoiceFooterPortalLink.ts)) appends `See your updated statement any time at <url>` after the body's `footer` (custom text keeps priority; appended only while the total stays ≤ 5000 chars, else the custom footer wins untouched; alone when no footer was sent). The result goes to `invoices.create` **and** `jobs_ledger_invoices.stripe_invoice_footer`. No portal link → footer behaviour unchanged. **Redeploy required.**

> **v2.2846 — never bill a paid job twice** (journey-map J3-1): after the job row loads, `shouldBlockBillOnPaidJob({ jobStatus: jobRow.status, allowRebill })` from the shared [`paidJobBillGuard.ts`](../supabase/functions/_shared/paidJobBillGuard.ts) refuses with **409** `{ error: "This job is already paid in full — nothing to bill.", code: "job_already_paid" }` when `jobs_ledger.status = 'paid'` and the body did not send **`allow_rebill: true`** (the Bill Customer modal's "Bill this job again anyway" checkbox). The existing `Invoice must be Ready to Bill` check, the idempotent-retry branch and the v2.2045 conversion branch run first and are unchanged. Each refusal writes a `job_activity_events` row `event_type = 'rtb_paid_job_blocked'` (service role, best-effort). **Redeploy required.**

> **v2.2045 — convert a billed non-Stripe line** (`convert_billed: true`): relaxes the ready_to_bill gate for a row already `billed` with no `stripe_invoice_id` and **zero payments applied** (checked via the caller's RLS client) — the one-button "Make Stripe bill" on Edit Job → Bill. `billed_at` is never written by this function (and the DB trigger COALESCEs), so the original billed date survives conversion by construction. Full flow: `docs/BILLING_FLOWS.md` → "Converting a non-Stripe bill to Stripe". Redeploy required.

> **v2.1133 — segment invoices bill only their own line items**: the fixtures query now selects `invoice_id` and both this function and `preview-stripe-invoice` pass the rows through `scopeFixturesToInvoice` ([`stripeInvoiceItemsFromFixtures.ts`](../supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts)): rows linked to the invoice when any exist (an invoice created from selected segments lists exactly those lines at their real amounts), else all rows (dollar break-off invoices keep the historical whole-job proration). Before this, a $454 change-order invoice rendered with every job stage on it, each carrying a prorated sliver. Client mirror: `src/lib/invoiceScopedFixtures.ts` (physical PDFs + previews + line-edit refs). Redeploy both functions.
>
> **v2.2469 — the unlinked primary remainder composes from uncovered segments**: the invoice select adds `is_primary_rtb_bundle`, and `scopeFixturesToInvoice` takes `{isPrimaryRtbBundle, targetAmountCents: fixtureTargetCents}` — with no linked rows, a primary bundle bills the still-unlinked billable segments at their real prices when their per-row cents sum EXACTLY to the target (any payment, unlinked dollar carve, rider, or extra breaks the equality → historical proration). Same client mirror. Redeploy both functions.

> **v2.1117 — per-mode customer ids (A4)**: the non-bill-to path reads/clears/persists the **mode-appropriate** `customers` column (`stripe_customer_id` for live, `stripe_customer_id_test` for test; helper `stripeCustomerIdColumnForMode`) — a cross-mode stale id no longer wipes the other mode's link. `preview-stripe-invoice` reads the same per-mode column. Redeploy both.

> **v2.1114 — mode stamping (A1)**: the post-finalize DB patch now also writes **`jobs_ledger_invoices.stripe_mode`** (`'live' | 'test'`, the mode the request resolved to; migration `20260730165312`). Later plan steps make the row authoritative for row-bound operations (void/send/details/OOB/write-down) so a caller's `stripe_mode` can never act cross-mode. Redeploy required.

> **v2.1085 — Bill-to override**: the invoice row is authoritative for the recipient. When `jobs_ledger_invoices.bill_to_email` is set, the Stripe invoice bills that alternate payer (name from `bill_to_name`, falling back to the email): the function uses/creates the invoice's **own** Stripe customer, persisted in `bill_to_stripe_customer_id` for idempotency, and **never touches** the job customer's `customers.stripe_customer_id`. The body's `customer_email`/`customer_name` are ignored for recipient purposes in that branch. NULL `bill_to_email` = unchanged behavior.

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
  /** v2.2846: explicit re-bill of a job whose `jobs_ledger.status` is `paid`; without `true` the request is refused (409 `job_already_paid`). */
  allow_rebill?: boolean
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
  /** Optional (v2.1520): Unix ms for the invoice number's HHmm suffix; ignored unless within ±48h of server now. Split-bill parts stagger this a minute apart so same-due-date parts get distinct `<digits>-YYMMDDHHmm` numbers. */
  issued_at_ms?: number
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

- **409 `This job is already paid in full — nothing to bill.`** (`code: job_already_paid`, v2.2846) — the invoice's job is `paid` and the body lacks `allow_rebill: true`.
- **`Job must be linked to a customer before creating a Stripe invoice.`** — **`jobs_ledger.customer_id`** is null.
- **`Customer must match the job linked customer.`** — body **`customer_id`** does not equal the job’s **`customer_id`**.
- **`Line description too long (max 500 characters)`** — **`line_description`** exceeds the limit.
- **`Invoice footer too long (max 5000 characters)`** — **`footer`** exceeds the limit.

#### Implementation notes

1. Loads job and customer with **service role**; requires **`jobs_ledger.customer_id`** and matches body **`customer_id`** to it; ensures **`customers.master_user_id`** matches **`jobs_ledger.master_user_id`**.
2. Creates or reuses **`customers.stripe_customer_id`** on Stripe; updates Stripe customer email/name.
3. Stripe invoice **`number`** is the **digits-only effective job number** (**HCP, else Click** — same rule the app displays everywhere; **v2.1027**, both share one global sequence), a hyphen, **`YYMMDD`** from bill due date, then **`HHmm`** (24-hour) in **`America/Chicago`** at finalize time (e.g. `11-2605140020`; customer email may show a **`#`** prefix). Jobs with neither number are rejected. **`preview-stripe-invoice`** uses the same rule at preview time (and since **v2.1034** accepts the same **`extra_line_items`** as create — fixtures allocate to `amount − extras`, extras render as their own preview lines); if the user waits between preview and create, the time suffix may differ.
4. Creates draft invoice + one or more invoice line items (see below), **finalize**s, then **UPDATE** **`jobs_ledger_invoices`** (**`status = 'billed'`**) and Stripe columns, plus **`external_send_channel = 'stripe'`**, **`stripe_invoice_memo`** (from **`memo`** → Stripe **`description`**), and **`stripe_invoice_footer`** (from optional **`footer`** → Stripe **`footer`**; **`null`** when omitted). **`sent_to_customer_at`** is **not** set here; it is recorded when **[send-stripe-invoice](#send-stripe-invoice)** successfully calls Stripe **`invoices.sendInvoice`** (customer email from Stripe).
5. **Line items from Specific Work**: Loads **`jobs_ledger_fixtures`** for the invoice’s job. When there are **billable** rows (trimmed **`name`**, **`count × line_unit_price`** in dollars **> 0**) and **`line_description`** is omitted or blank, creates **one** Stripe line per row (ordered by **`sequence_order`**; description from name + optional scope text), with cent amounts **scaled proportionally** to **`amount_dollars`** when the bill is less than the fixture subtotal so the lines sum exactly. A non-empty **`line_description`** keeps the legacy behavior: **one** line for the full amount using that description (or the default **`Customer · Job · HCP`** string when not overridden). Stripe **`invoice_items`** follow **`sequence_order`** ascending (**no** post-build **`reverse`** — **v2.527**, shared **[`stripeInvoiceItemsFromFixtures.ts`](../supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts)**).
6. **Staff-visible `lines` vs hosted invoice**: **`invoice_preview.lines`** from **`invoices.retrieve`** / line-item expansion uses **`stripeInvoiceLinesDataForFixtureOrderDisplay`** (**v2.528**, **[`stripeInvoiceLinesForFixtureOrderDisplay.ts`](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)**) when **multi-line**, because Stripe **`lines.data`** / **`listLineItems`** arrays can disagree with **invoice.stripe.com** top-to-bottom order.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) sets **`verify_jwt = false`**. Deploy with **`supabase functions deploy create-stripe-invoice --no-verify-jwt`** when the hosted gateway still enforces JWT.

**extra_line_items** (v2.1002): optional `Array<{amount_cents, description}>` — validated (positive cents, description clamped 500); fixture lines allocate to `amount − extras` and each extra is appended as its own labeled invoice item (`source.kind: extra_line`). Used by the Bill Customer hazmat roll-in.

**Service address** (v2.998): the invoice is created with a `custom_fields` entry `Service address` from `jobs_ledger.job_address` (trimmed, capped 140 chars; omitted when blank) — renders in the header of the hosted page and PDF. Not shown by `preview-stripe-invoice` (`createPreview` lacks `custom_fields`).

---

### send-lien-release-email

**Purpose** (v2.2621, the lien-signing loop's send leg): email a **signed** lien release to the job's customer with the PDF attached, then stamp the release row **sent** (`sent_to_customer_at`, `sent_channel: 'email'`, `sent_by`). The PDF arrives from the client — the stored `signed.pdf` bytes from the `lien-release-documents` bucket when present, else a regeneration from the row snapshot with the typed signature. Client helper: [`sendLienReleaseEmail.ts`](../src/lib/sendLienReleaseEmail.ts); the send surface is the "Signed — ready to send" inbox lane ([`LienSignatureInboxSection`](../src/components/jobs/LienSignatureInboxSection.tsx)).

**Endpoint**: `POST /functions/v1/send-lien-release-email` · **Authentication**: Bearer JWT, `auth.getUser` in-body, user-scoped client (RLS applies), `verify_jwt = false` on the gateway (send-physical-invoice-email pattern). **Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`.

Body: `{ release_id, job_id, customer_email, subject?, email_text?, email_html?, pdf_base64, pdf_filename? }`. Guards: release must belong to the job, be `status = 'signed'`, and not voided; `customer_email` must match `jobs_ledger.customer_email` (case-insensitive); PDF ≤ 6M base64 chars. Success: `{ success: true }`; if the Resend send succeeds but the sent-stamp UPDATE fails, returns 500 with "mark it sent manually" (email already went out).

### send-lien-filing-email

**Purpose** (v2.2645, Lien Instruments phase 3): email a **lien-instrument PDF** — today the § 53.056 notice of claim — to a named recipient (the owner of record or the original contractor) as a **courtesy channel** beside the recorded certified-mail send. The caller records the send on its `job_lien_filings` row afterward (`sends` jsonb, method `email`, tracking `resend:<id> → <address>`); the statutory path stays traceable physical delivery. Client caller: the § 53.056 tab of [`LienFilingTabs`](../src/components/jobs/LienFilingTabs.tsx).

**Endpoint**: `POST /functions/v1/send-lien-filing-email` · **Authentication**: Bearer JWT, `auth.getUser` in-body, user-scoped client — the access check is an RLS read of the `jobs_ledger` row (office/master only). `verify_jwt = false` on the gateway (send-physical-invoice-email pattern). **Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`.

Body: `{ job_id, to_email, recipient_label?, subject?, email_text?, pdf_base64, pdf_filename? }`. Guards: job must be readable by the caller; valid `to_email`; PDF ≤ 6M base64 chars. Success: `{ success: true, resend_email_id }` — the function writes nothing; the client persists the send record. Sends are logged with `email_type: 'lien_filing_notice'` (v2.2664), the row's id in the Settings email catalog.

### send-physical-invoice-email

> **v2.2846 — never bill a paid job twice** (journey-map J3-1): the `jobs_ledger` select adds `status`; a **first send** (not `resend`) on a job whose status is `paid` is refused with **409** `{ error: "This job is already paid in full — nothing to bill.", code: "job_already_paid" }` unless the body carries **`allow_rebill: true`** — same shared predicate as `create-stripe-invoice` ([`paidJobBillGuard.ts`](../supabase/functions/_shared/paidJobBillGuard.ts)). The refusal writes `job_activity_events` `rtb_paid_job_blocked` with a service-role client when `SUPABASE_SERVICE_ROLE_KEY` is set (best-effort; the function otherwise stays user-client only). `resend: true` is unaffected — re-emailing an already-billed invoice is not a new bill. **Redeploy required.**

> **v2.2605 — Resend mode**: `resend: true` re-emails an already-**billed** invoice (the Who-owes-what cards' "Email again — PDF attached", client helper [`resendPhysicalInvoiceEmail.ts`](../src/lib/resendPhysicalInvoiceEmail.ts)): the status gate flips to require `status = 'billed'` and the function **writes nothing** — no status change, no `sent_to_customer_at` bump (the bill keeps its first-send evidence; the send is still captured by the shared email log). Without the flag, first-send behavior is unchanged.

> **v2.1085 — Bill-to override**: when the invoice row has `bill_to_email`, the target `customer_email` may match **either** that address or `jobs_ledger.customer_email` (a blank job customer email is fine in that case). Without the override, the job-customer-email match requirement is unchanged.

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
  /** v2.2605: re-email a billed invoice — requires `status = 'billed'`, records nothing on the row. */
  resend?: boolean
  /** v2.2846: explicit re-bill of a `paid` job; without `true` a first send on a paid job is refused (409 `job_already_paid`). */
  allow_rebill?: boolean
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
- **409** — Job is `paid` and `allow_rebill` is not `true` (`code: job_already_paid`, v2.2846).
- **502** — Resend API error.

**Client**: [`SendRecordInvoiceModal.tsx`](../src/components/jobs/SendRecordInvoiceModal.tsx) (**Physical invoice** tab) invokes this Edge Function, then **`maybePromoteJobToBilledAfterCustomerInvoice`** on success. **`subject`** is **[`physicalInvoiceEmailSubject`](../src/lib/physicalInvoiceDocument.ts)** (**`Click Plumbing Invoice [#…]`**). **`email_text`** / **`email_html`** are built by **[`buildPhysicalInvoiceEmailBodies`](../src/lib/physicalInvoiceDocument.ts)** (HTML summary: bold issuer **tagline** under the intro; no **Service date** or **Issuer** block—PDF is authoritative).

**Deploy**: `supabase functions deploy send-physical-invoice-email --no-verify-jwt` if the hosted gateway still enforces JWT.

---

### send-gc-statement-email

**Purpose** (v2.1418): Email a **GC statement** (job addresses, bill-sent dates, amounts owed — built client-side by [`gcStatementEmail.ts`](../src/lib/jobsDocuments/gcStatementEmail.ts)) from GC Review's **Email…** dialog, then audit into **`gc_statement_emails`** via the **service-role** client (the table has no client write policies) and best-effort log to `email_send_log`. Since v2.1420 it also carries GC Review's **Share all** email — the whole report (every GC/development section + grand total) as `group_by: 'all'`.

**CC** (v2.2160): optional `cc_emails: string[]` — re-validated server-side (lower-cased, unique, never the To, ≤ 10), passed as Resend `cc`, audited on `gc_statement_emails.cc_emails`.

**Endpoint**: `POST /functions/v1/send-gc-statement-email`

**Authentication**: Bearer JWT; **`auth.getUser`** in the function; caller's `users.role` must be dev / master_technician / assistant / controller / primary (the GC Review cohort). For `group_by: 'gc'` the `gc_customer_id` must be readable through the caller's **RLS** (blocks cross-tenant sends); the recipient address itself is office-chosen — statements often go to an AP inbox not on file. `'development'` and `'all'` sends carry no customer id, so they have no per-row RLS probe — the role gate is the whole check. **`verify_jwt = false`** on the gateway (same pattern as `send-physical-invoice-email`).

**Body**: `gc_customer_id` (null for development and Share-all sends), `gc_name` (`All GCs` / `All developments` for Share all), `group_by` (`gc`|`development`|`all`), `to_email`, `subject`, `email_html` (≤300k chars), `email_text`, `total`, `job_count`.

**Sends** via Resend from the `EMAIL_FROM` sender (secret; default `PipeTooling <team@noreply.pipetooling.com>`) with the **caller's email as reply-to** — replies land in a real inbox. Audit-insert failures never fail the request (the email is already out).

**Deploy**: `supabase functions deploy send-gc-statement-email --no-verify-jwt` if the hosted gateway still enforces JWT. Requires the `gc_statement_emails` table (migration `20260806202622`); Share-all audit rows additionally need the widened `group_by` CHECK (migration `20260806221045` — a not-yet-pushed CHECK only loses the audit row, never the send).

---

### gc-statement-email-dispatch

**Purpose** (v2.1426): Cron-only dispatcher for **scheduled** GC statement sends — Phase 2 of the `gc_statement` Report Subscriptions stream ([REPORT_SUBSCRIPTIONS.md](REPORT_SUBSCRIPTIONS.md)). Drains due `gc_statement_email_requests` rows (send_at ≤ now, unsent, attempts < 5, batch 10), rebuilds each statement **fresh at send time** via `get_gc_statement_email_payload` (v2.1425), renders HTML in-function ([`render.ts`](../supabase/functions/gc-statement-email-dispatch/render.ts) — keep in sync with `src/lib/jobsDocuments/gcStatementEmail.ts`; `src/lib/jobsDocuments/gcStatementEmailParity.test.ts` pins the two byte-for-byte since v2.2874; single-GC statements append the GC's portal card when `resolveGcPortalUrl` finds an active link — mirror of `src/lib/portal/gcPortalLink.ts`, v2.2151 — whose line reads **"Pay online any time at <portal> — this statement stays current there."** with `?src=gc-statement` on the href for attribution (v2.2874, journey-map #46); a job with no address prints its name once), sends via Resend with the **requester's email as reply-to**, audits into `gc_statement_emails` (single statements as `gc`/`development`, whole-report rows as `all`), best-effort logs to `email_send_log`, stamps `sent_at`, and re-enqueues `repeat_weekly` chains (+7 days, guarded against retry double-inserts; the row's `cc_emails` (v2.2160) rides along and is passed as Resend `cc` + audited).

**Subject** (v2.2131): per-GC statements go out as `Click Plumbing open balances: <date>` (`gcStatementSubject` in `render.ts`, mirrored by the client's `gcStatementEmailSubject`); whole-report sends keep `Open balances (all GCs|all developments) — … — <date>`. `emailLogStreamForSubject` maps both shapes to the `gc_statement` stream. **Footer** (v2.2133): "Questions about a bill? Reply to this email or call the office at <phone>." — the dispatcher reads `app_settings.physical_invoice_issuer_v1` (`phone`) once per run (`gcStatementFooterLine` in `render.ts`, mirror of the client's); no number configured → the bare line. **Wording** (v2.2660; v2.2874): the `gc_statement_scheduled` template row (Settings → Email templates → "GC statement (Draft Message + scheduled)") supplies the subject and an intro paragraph; since v2.2874 the intro is passed *into* `renderGcStatementHtml/Text` (`introText`) and rendered inside the styled statement block — the same template the client's Draft Message lane now reads, so both app-sent lanes are one email.

**Endpoint**: `POST /functions/v1/gc-statement-email-dispatch`

**Authentication**: `X-Cron-Secret` must equal `CRON_SECRET` — **no user-JWT modes**. Immediate sends stay on `send-gc-statement-email`; scheduling and cancelling are direct RLS-gated writes to `gc_statement_email_requests` from the client.

**Empty statements**: a single-entity request with nothing outstanding is stamped `skipped: nothing outstanding` and never emailed — but its weekly chain still advances.

**Deploy**: `supabase functions deploy gc-statement-email-dispatch --no-verify-jwt`. Requires migrations `20260806232759` (payload RPC) + `20260806233713` (requests table + pg_cron registration).

**Cron**: pg_cron **`gc-statement-email-dispatch`** at **`2-57/5 * * * *`** since [`20260821010000_stagger_email_dispatch_crons.sql`](../supabase/migrations/20260821010000_stagger_email_dispatch_crons.sql) (was `*/5`; v2.1919 stagger), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

---

### weekly-movement-email-dispatch

**Purpose** (v2.1437): Cron-only dispatcher for scheduled **Weekly movement** report sends (`weekly_movement` Report Subscriptions stream). Drains due `weekly_movement_email_requests` rows, rebuilds the report **once per batch** via `get_weekly_movement_email_payload(NULL)` — the **previous complete Central week** — renders in-function ([`render.ts`](../supabase/functions/weekly-movement-email-dispatch/render.ts), keep in sync with `stagesWeeklyMovement.ts`), sends via Resend with the requester's reply-to, stamps, re-enqueues `repeat_weekly` chains. Recipients are **internal office-capable users only** (`recipient_user_id`; role-checked at dispatch — the report names who moved what). A quiet week still sends ("no moves" is information for this stream, unlike GC statements).

**Endpoint**: `POST /functions/v1/weekly-movement-email-dispatch`

**Authentication**: `X-Cron-Secret` = `CRON_SECRET`; no user-JWT modes (scheduling/cancelling are direct RLS-gated writes).

**Deploy**: `supabase functions deploy weekly-movement-email-dispatch --no-verify-jwt`. Requires migration `20260807024222` (payload RPC + requests table + pg_cron).

**Cron**: pg_cron **`weekly-movement-email-dispatch`** at **`3-58/5 * * * *`** since [`20260821010000_stagger_email_dispatch_crons.sql`](../supabase/migrations/20260821010000_stagger_email_dispatch_crons.sql) (was `*/5`; v2.1919 stagger), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

---

### weekly-money-email-dispatch

**Purpose** (v2.1448): Cron-only dispatcher for scheduled **Weekly Money Movement** report sends (`weekly_money` Report Subscriptions stream — `docs/WEEKLY_MONEY_PLAN.md` Phase 5). Drains due `weekly_money_email_requests` rows, rebuilds the report **once per batch** via `get_weekly_money_movement_payload(NULL)` — the **previous complete Central week** — and, unlike weekly_movement, there is **no SQL mirror to keep faithful**: the RPC is the same source of truth the client modal reads. Renders in-function ([`render.ts`](../supabase/functions/weekly-money-email-dispatch/render.ts) ports `weeklyMoneyMovement.ts` row math — material bucketing, Δ% with the seed-bootstrap rule, earned nets; keep in sync), sends via Resend with the requester's reply-to, stamps, re-enqueues `repeat_weekly` chains. Recipients restricted to **dev/controller** (`recipient_user_id`, role-checked at dispatch AND at INSERT RLS — wage-derived job costs). A quiet week still sends.

**Endpoint**: `POST /functions/v1/weekly-money-email-dispatch`

**Authentication**: `X-Cron-Secret` = `CRON_SECRET`; no user-JWT modes (scheduling/cancelling are direct RLS-gated writes).

**Deploy**: `supabase functions deploy weekly-money-email-dispatch --no-verify-jwt`. Requires migrations `20260807053000`/`20260807060000` (payload RPC) and `20260807070000` (requests table + pg_cron).

**Cron**: pg_cron **`weekly-money-email-dispatch`** at **`4-59/5 * * * *`** since [`20260821010000_stagger_email_dispatch_crons.sql`](../supabase/migrations/20260821010000_stagger_email_dispatch_crons.sql) (was `*/5`; v2.1919 stagger), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

---

### payment-forecast-email-dispatch

**Purpose** (v2.2225): Share the Stages **Payment forecast** modal (v2.1925) by email — the `payment_forecast` Report Subscriptions stream. Renders the modal top-to-bottom: bucket tile strip (Past expected / This week / Next week / following two weeks / Later), pay-speeds line, then each bucket's bills **Past expected first** (the follow-up queue leads). Numbers come from the service-role RPC **`get_payment_forecast_email_payload()`** (migration `20260824133529` — open billed rows + pay-speed medians + promised dates), rebuilt **at send time**; the **bucketing** runs in-function via [`_shared/paymentForecastCore.ts`](../supabase/functions/_shared/paymentForecastCore.ts), a Deno port of the client kernels (`billedExpectedPay.ts` + `billedPaymentForecast.ts` — **source of truth; keep in sync**). Every job deep-links to `?jobDetail=`; the CTA opens `?tab=stages&forecast=1`. An **empty board still sends a one-liner** (a silent skip reads as a broken subscription) and weekly chains advance either way.

**Endpoint**: `POST /functions/v1/payment-forecast-email-dispatch`

**Modes** (billed-report-email skeleton): `preview` / `test_send` / `send_now` (caller JWT; sender roles dev/master_technician/assistant/controller; recipients office-capable incl. primary) · cron dispatch (`X-Cron-Secret` = `CRON_SECRET`) draining `payment_forecast_email_requests` (attempts < 5, batch 10, `repeat_weekly` +7d re-enqueue with double-insert guard).

**Deploy**: `supabase functions deploy payment-forecast-email-dispatch --no-verify-jwt`. Requires migration `20260824133529` (table + payload RPC + pg_cron).

### money-waiting-email-dispatch

**Purpose** (v2.2565): Share the Pay speeds **Money waiting** list by email — the `money_waiting` stream. Renders the list top-to-bottom: color legend, every off-pace customer slowest-first with their open-bills bar, then EVERY open bill beneath them (tone dot, job · full address with city, dollars, wait), long lists folded behind "+ N more jobs". Numbers come from the service-role RPC **`get_money_waiting_email_payload()`** (migration `20260901120000` — the forecast payload rows + `job_address`, pay-speed mirror upgraded to the v10 samples rules), rebuilt **at send time**; the grouping runs in-function via [`_shared/moneyWaitingCore.ts`](../supabase/functions/_shared/moneyWaitingCore.ts), a Deno port of `src/lib/jobs/moneyWaiting.ts` (**source of truth; keep in sync**). Jobs deep-link to `?jobDetail=`; the CTA opens `?tab=stages&forecast=1`. An all-on-pace week still sends a one-liner and weekly chains advance either way.

**Endpoint**: `POST /functions/v1/money-waiting-email-dispatch`

**Modes** (payment-forecast skeleton, verbatim): `preview` / `test_send` / `send_now` (caller JWT; sender roles dev/master_technician/assistant/controller; recipients office-capable incl. primary) · cron dispatch (`X-Cron-Secret` = `CRON_SECRET`) draining `money_waiting_email_requests` (attempts < 5, batch 10, `repeat_weekly` +7d re-enqueue with double-insert guard).

**Deploy**: `supabase functions deploy money-waiting-email-dispatch --no-verify-jwt`. Requires migration `20260901120000` (table + payload RPC + pg_cron).

**Cron**: pg_cron **`payment-forecast-email-dispatch`** at **`4-59/5 * * * *`** — co-rides the weekly-money lane (all five */5 lanes were taken by the v2.1919 stagger; both co-tenants no-op cheaply), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

---

### crew-day-email-dispatch

**Purpose** (v2.2603): The **Crew Day** end-of-day email — the `crew_day` stream. The Dashboard Crew Day section's day (v2.2602) regrouped **by job** so it reads like a site diary: each job with the people who worked it (clock spans + hours), field-report excerpts, % movement, and the section's three attention flags (no-report, scheduled-never-clocked, unscheduled work). The payload is **per-recipient**: `get_crew_day_payload_for_user(p_user_id, p_day)` (migration `20260901220804`, service-role only) computes the RECIPIENT's role scope — office roles company-wide, superintendents only their `project_superintendents` assignments (+ team-membership jobs) — rebuilt **at send time** for the send's Chicago calendar day. A quiet day still sends (a silent skip reads as a broken subscription). **Hours only, never wages.**

**Endpoint**: `POST /functions/v1/crew-day-email-dispatch`

**Modes** (money-waiting skeleton): `preview` / `test_send` (caller JWT; the caller's own scope) / `send_now` with `recipient_user_id` (recipient's scope) — sender AND recipient roles are **office-only since v2.2615** (dev/master_technician/assistant/controller; superintendents were removed from both sides — the Dashboard Crew Day section is their window, and the INSERT policy matches: migration `20260901232549`) · cron dispatch (`X-Cron-Secret` = `CRON_SECRET`) draining `crew_day_email_requests` (attempts < 5, batch 10, `repeat_weekly` +7d re-enqueue with double-insert guard; superintendent-addressed stragglers stamp "ineligible role" and never send).

**Deploy**: `supabase functions deploy crew-day-email-dispatch --no-verify-jwt`. Requires migrations `20260901215024` (section payload) + `20260901220804` (table + per-user payload RPC + pg_cron + schedule-surface branches).

**Cron**: pg_cron **`crew-day-email-dispatch`** at **`4-59/5 * * * *`** — co-rides the :04 lane (v2.1919 stagger; co-tenants no-op cheaply on empty ticks), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.

---

### statement-round-email-dispatch

**Purpose** (v2.2771; redesigned v2.2812 as the account man's own account — the standard, aging chips, AP contact, last word / temperature, deadline, held GCs, scoreboard): The **"Your statement round"** email — the `statement_round` stream. The GC Review personal round (v2.2072) as a morning note for its sender: every GC certified this week, assigned to the recipient, and not yet marked sent — amount, job count, age, certifier — with one **Start round →** link (`/jobs?tab=stages&round=1`, opens GC Review straight into the round overlay), plus the held-on-certification count. The payload is **per-recipient**: `get_statement_round_for_user(p_user_id)` (migration `20260904201238`, service-role only) mirrors `buildStatementRound` server-side (GC groups ≥ $10,000 from `get_gc_statement_email_payload`, cert status by snapshot diff, this week's marks, sender = standing sender else Account Man), rebuilt **at send time**. An empty round still sends a one-liner (a silent skip reads as a broken subscription).

**Endpoint**: `POST /functions/v1/statement-round-email-dispatch`

**Modes** (crew-day skeleton): `preview` / `test_send` (caller JWT; office roles dev/master_technician/assistant/controller; `preview` also takes `recipient_user_id` to render a colleague's round for the sender card, v2.2792 — `test_send` stays caller-only) · cron dispatch (`X-Cron-Secret` = `CRON_SECRET`) draining `statement_round_email_requests` (attempts < 5, batch 10, `repeat_weekly` +7d re-enqueue with double-insert guard; archived / email-less / ineligible recipients stamp and never send). No `send_now` — the round is the recipient's own work list, not something to push at someone.

**Deploy**: `supabase functions deploy statement-round-email-dispatch --no-verify-jwt`. Requires migration `20260904201238` (row_key on the statement payload, round RPCs, table, pg_cron, schedule-surface branches).

**Cron**: pg_cron **`statement-round-email-dispatch`** at **`2-57/5 * * * *`** — co-rides the :02 lane with `gc-statement-email-dispatch` (one tenant there vs four on :04 at the time; the stagger's goal is breaking the everyone-at-once volley), vault **`PROJECT_URL`** + **`CRON_SECRET`**.

**Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `APP_ORIGIN` (deep link; falls back to `https://clicktooling.com`).

---

### send-hazmat-notice-email

> **v2.1085 — Bill-to override**: when the incident's linked fee invoice (`job_hazmat_incidents.invoice_id` → `jobs_ledger_invoices.bill_to_email`) bills an alternate recipient, the notice `customer_email` may match **either** that address or the job customer email — the payer of the fee should receive the notice.

**Purpose** (v2.850; send-stamping v2.1039): Email the customer the **Biohazard Remediation Fee Notice PDF** as its own message — the **Stripe companion channel** (Stripe invoices cannot carry attachments) and the **re-send** path from Edit Job's **Riders** strip. The PDF is built client-side ([`hazmatFeeNoticePdf.ts`](../src/lib/jobsDocuments/hazmatFeeNoticePdf.ts)) from the persisted `job_hazmat_incidents` row; the function validates and attaches it. **After a successful Resend send** it stamps `job_hazmat_incidents.notice_emailed_at` / `notice_emailed_to` and inserts a `job_activity_events` row (`hazmat_notice_emailed`) via the **service-role** client — both tables have no client write policies, so this function is the single audited funnel. Stamp failures never fail the request (the email is already out). Safe to re-send any time (each send re-stamps and logs).

**Endpoint**: `POST /functions/v1/send-hazmat-notice-email`

**Authentication**: Bearer JWT; **`auth.getUser`** in the function; all reads via the **user-scoped** client (**RLS** applies — `job_hazmat_incidents` is readable by office/billing roles only). **`verify_jwt = false`** on the gateway (same pattern as **`send-physical-invoice-email`**).

**Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`RESEND_API_KEY`**, `SUPABASE_SERVICE_ROLE_KEY` (send-stamping, v2.1039).

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

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

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

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

**Purpose**: Let a **subcontractor** on **Collect Payment** step 3 correct the payer email before **Email invoice to customer**. Updates the Stripe **Customer** `email` via **`customers.update`**, then updates the **open** Stripe invoice’s **`customer_email`** via **`invoices.update`** (keeps invoice snapshot aligned; UI resolution still prefers expanded Customer in **[`customerEmailFromStripeInvoice`](../supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**), then syncs **`jobs_ledger.customer_email`** and merges **`customers.contact_info.email`** (preserving **`phone`**) with the service role so office data and **`get_collect_payment_certify_payload`** stay aligned with **`send-stripe-invoice`** / **`get-stripe-invoice-details`**.

**Endpoint**: `POST /functions/v1/update-collect-payment-stripe-customer-email`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Field roles only** (subcontractor/helpers; +superintendent v2.2637): same **service-role** gate as **`send-stripe-invoice`** — **`jobs_ledger_team_members`** for the invoice’s job **and** **`job_collect_payment_flows`** **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request. Non-subcontractors receive **403**.

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
- **403** — Not a field role (subcontractor/helpers/superintendent since v2.2637), or collect-payment gate failed (not on job team / flow not approved for this invoice).
- **502** — Stripe error (other than handled missing customer), **`invoices.update`** failure after **`customers.update`** (customer may be updated on Stripe; invoice email not synced — contact office), or partial DB failure after both Stripe updates.

**Client**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx) step 3 **Change email**.

**Gateway JWT**: Deploy with **`supabase functions deploy update-collect-payment-stripe-customer-email --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### get-stripe-invoice-details

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

**Purpose**: **`invoices.retrieve`** (with **`expand: ['customer']`**) + line items for a billed **`jobs_ledger_invoices`** row with **`stripe_invoice_id`**. Used by **Hosted bill** UI and **Collect Payment** step 3 (Stripe-resolved customer email). Response **`customer_email`** matches **`send-stripe-invoice`** resolution (**expanded Customer `email` first**, then **`invoice.customer_email`**) per **[`customerEmailFromStripeInvoice`](../supabase/functions/_shared/stripeInvoiceCustomerEmail.ts)**.

**Endpoint**: `POST /functions/v1/get-stripe-invoice-details`

**Authentication**: Bearer JWT (**`verify_jwt = false`** on the gateway). **Staff** (non–`subcontractor`): invoice row loaded with the user-scoped client (**RLS** **`SELECT`**). **field roles** (`subcontractor`/`helpers`; +`superintendent` v2.2637): invoice row loaded with **service role** only after **`jobs_ledger_team_members`** and **`job_collect_payment_flows`** **`approved_for_terminal`** with **`jobs_ledger_invoice_id`** matching the request (same gate as **`send-stripe-invoice`** for field email); memo/footer backfill uses **service role** on that path.

**Success body** (partial): includes **`memo`** (Stripe **`description`**) and **`footer`** (Stripe **`footer`**) as separate strings when present. May service-backfill **`stripe_invoice_memo`** / **`stripe_invoice_footer`** on the ledger row when empty. **v2.1641**: also returns **`oob_paid_on`** (YYYY-MM-DD | null) — the effective out-of-band pay date from invoice metadata `pt_paid_on`; the Hosted bill panel prefers it over `paid_at` for OOB-paid invoices (`amount_paid === 0`), since Stripe stamps `status_transitions.paid_at` at the API call and it cannot be backdated. Redeployed 2026-08-14.

Response **`lines`** (from Stripe **`listLineItems`**) pass through **`stripeInvoiceLinesDataForFixtureOrderDisplay`** ([**`stripeInvoiceLinesForFixtureOrderDisplay.ts`**](../supabase/functions/_shared/stripeInvoiceLinesForFixtureOrderDisplay.ts)): **multi-line** payloads are reversed so hosted bill UI matches **invoice.stripe.com** (**v2.528**; creation / **`invoice_items`** order: **v2.527**, **`RECENT_FEATURES.md`**).

**Gateway JWT**: Deploy with **`supabase functions deploy get-stripe-invoice-details --no-verify-jwt`** when the hosted gateway still enforces JWT.

---

### record-stripe-invoice-out-of-band-payment

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

> **v2.1639 — AR auto-close (`allow_app_paid`)**: the Accounts Receivable modal calls this after a full-balance Mercury allocation to close the Stripe invoice automatically. The new optional flag accepts app-status `paid` (classic callers keep the Billed-only guard). Deployed 2026-08-14.

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
  /**
   * v2.1639 (AR auto-close): accept an invoice already `paid` in the app. The AR
   * allocation records the payment and flips the invoice to paid FIRST, then calls
   * here to close the Stripe invoice — the webhook's paid handler no-ops on
   * already-paid rows, so no second payment row is created. Default false keeps
   * the classic Billed-only guard.
   */
  allow_app_paid?: boolean
}
```

**Stripe does not move money** in this flow; it only updates invoice state to **paid** to match an external receipt.

#### Errors (400)

- **`Amount must match the full open balance on the Stripe invoice`** — v1 requires **`amount_dollars`** (in cents when compared) to match Stripe **`amount_remaining`** exactly.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy record-stripe-invoice-out-of-band-payment --no-verify-jwt`** if the hosted gateway still enforces JWT.

---

### reverse-stripe-invoice-out-of-band-payment

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

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

- **400** — Invoice not **Paid** in ClickTooling, missing OOB metadata, invoice has a **charge**, Stripe invoice not **paid**, or neither **`amount_paid`** nor **`total`** yields a positive credit amount (**`Stripe invoice has no amount paid`**).
- **409** — Stripe credit note may have succeeded but RPC returned a business error (check both systems).
- **502** — Stripe API or RPC failure after credit note (partial state possible; message includes warning).

**Webhook**: Subscribe to **`credit_note.created`** so [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts) can **`invoices.retrieve`** and **`syncJobsLedgerStripeInvoiceStatus`**.

**Gateway JWT**: [`supabase/config.toml`](../supabase/config.toml) **`verify_jwt = false`**. Deploy with **`supabase functions deploy reverse-stripe-invoice-out-of-band-payment --no-verify-jwt`**.

---

### stripe-invoice-agreed-write-down

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

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

> **v2.1133 — segment invoices preview only their own line items**: mirrors `create-stripe-invoice` — the fixtures query selects `invoice_id` and passes rows through `scopeFixturesToInvoice`, so a segment invoice previews exactly its linked lines at their real amounts (dollar invoices keep the whole-job proration). Redeploy with `create-stripe-invoice`.
>
> **v2.2469 — primary-remainder composition mirrored**: invoice select adds `is_primary_rtb_bundle`; the scoping call moved BELOW the extras math so it matches against the same `fixtureTargetCents` as `create-stripe-invoice`. Redeploy with `create-stripe-invoice`.

> **v2.1085 — Bill-to override**: mirrors `create-stripe-invoice` — when the invoice row has `bill_to_email`, the preview renders against that recipient (using `bill_to_stripe_customer_id` when it exists for the active Stripe key, else an ephemeral customer with the bill-to identity) and returns the bill-to name/email in the response. No DB writes either way.

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

> **v2.1116 — row-authoritative Stripe mode (A3)**: the invoice row's `stripe_mode` (v2.1114) now decides which Stripe mode this function operates in; an explicitly requested `stripe_mode` that disagrees returns **409 `stripe_mode_mismatch`** with no side effects. NULL-mode legacy rows fall back to the requested/default mode. Redeploy required.

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

> **v2.1115 — livemode enforcement (A2)**: every event's mode (`event.livemode`, cross-checked against which signing secret verified — `stripeWebhookSecretsWithModes()`) is recorded into `stripe_webhook_events.livemode` and **must match `jobs_ledger_invoices.stripe_mode`** before any row is touched: mismatch → `200 {applied:false, reason:'mode_mismatch'}` with a warn log; NULL-mode legacy rows **self-heal** their `stripe_mode` from the verified event mode. `credit_note.created` now retrieves with the **event-mode** API key (previously test-first, silently failing live credit-note syncs when both keys were configured). Redeploy required.

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
- **Server-side label suggestion** — after the upsert, runs the **same accounting-rules matcher** as the Banking Accounting tab (pure copy in [`supabase/functions/_shared/accountingLabelRuleMatch.ts`](../supabase/functions/_shared/accountingLabelRuleMatch.ts)) and, on first match, inserts a **pending** `mercury_accounting_label_suggestions` row via the **service-role** RPC **`insert_accounting_label_suggestion_service`** (the existing `bulk_insert_accounting_label_suggestions` requires `auth.uid()`, which a service-role Edge call lacks). Best-effort — failures here never fail the webhook. Since **v2.2700** the upsert also selects `mercury_category` and the matcher supports a **`bankCategory`** clause (criteria v1), so a "FuelAndGas → Fuel / Gas" rule pre-tags fill-ups on sync. **v2.2714**: rules may instead carry a **`bankTag`** clause; the webhook reads `mercury_category_tag_members` for the tag ids in play and matches with live membership (falling back to the snapshot saved in the criteria if that read fails).
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

### sync-resend-emails

> **App-side logging (v2.1341)**: every sender function now writes its own `email_send_log` row at send time (source `'app'`) via [`_shared/logEmailSend.ts`](../supabase/functions/_shared/logEmailSend.ts) — best-effort, service-role PostgREST insert with `on_conflict=resend_email_id` ignore-duplicates so a faster webhook row wins. The shared [`resendSendEmail.ts`](../supabase/functions/_shared/resendSendEmail.ts) helper covers its 7 callers; the 6 direct-Resend functions (`send-workflow-notification`, `send-estimate-to-customer`, `send-contract-for-signature`, `send-physical-invoice-email`, `send-hazmat-notice-email`, `test-email`) call the logger inline. This sync (and the webhook) remain enrichment: delivery-status updates and history backfill.

**Purpose**: Pull Resend's recent-emails list (`GET https://api.resend.com/emails`) and upsert rows into **`email_send_log`** (keyed on `resend_email_id`). Powers the **Refresh from Resend** button on Settings → Notifications → "Most recent emails sent" — backfill and gap repair; `resend-webhook` keeps the table fresh between refreshes. A sync never downgrades a row's `last_event` to null.

**Endpoint**: `POST /functions/v1/sync-resend-emails` (empty JSON body)

**Authentication**: `verify_jwt = false`; in-handler JWT + **dev-only** role gate (the list is org-wide and includes customer-facing recipients/subjects).

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_READ_API_KEY` — a **full-access** Resend key; the shared `RESEND_API_KEY` is a sending-only restricted key that the list endpoint rejects with 401 `restricted_api_key` (the function falls back to it only if no read key is set). Set with `supabase secrets set RESEND_READ_API_KEY=re_…`.

**Response**: `{ ok: true, synced, listed }`

**Deploy**: `supabase functions deploy sync-resend-emails --no-verify-jwt`

---

### resend-webhook

**Purpose**: Receive Resend **email.\*** events (sent, delivered, delivery_delayed, bounced, complained, opened, clicked), verify the **Svix** signature, and upsert **`email_send_log`** rows — `last_event`/`last_event_at` update per event; identity fields (from/to/subject) fill in from whichever event carries them. Non-`email.*` event types return `200 { ignored }`.

**Endpoint**: `POST /functions/v1/resend-webhook`

**Authentication**: **Svix** headers (`svix-id`, `svix-timestamp`, `svix-signature`) + raw body HMAC-SHA256 against `RESEND_WEBHOOK_SECRET` (`whsec_…` base64 secret; 5-minute timestamp tolerance; multiple `v1,` candidates supported). No Bearer JWT; **`verify_jwt = false`**.

**Required Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_WEBHOOK_SECRET`

**Enable checklist (production)**:

1. **Deploy**: `supabase functions deploy resend-webhook --no-verify-jwt`
2. **Resend dashboard** → Webhooks → Add endpoint: URL `https://<project-ref>.supabase.co/functions/v1/resend-webhook`, subscribe to the **email.** events; copy the endpoint's **signing secret**.
3. **Secret**: `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_…`
4. **Verify**: send any app email; Edge logs show `200 { ok: true }` and a row appears in `email_send_log` (visible on Settings → Notifications as dev).

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

## Email Wording Overrides

**Since v2.2658–v2.2660** (email plan PRs 2–4; catalog + send-log typing in v2.2656): outbound-email *wording* is runtime-editable from **Settings → Email templates & testing** via the `email_templates` table — no deploy needed. Server-side senders resolve overrides through [`_shared/emailWordingServer.ts`](../supabase/functions/_shared/emailWordingServer.ts) (`resolveServerEmailWording(templateType, vars, fallbackSubject)`), which:

- fetches the row via PostgREST with the service key, **fail-soft** — an unreadable table or missing row means the built-in wording sends;
- substitutes only provided `{{var}}` keys (unknown tokens stay visible, so typos show themselves);
- offers `{{default_subject}}` as a free variable resolving to the built-in subject (dates/labels included);
- returns `{ subject, introText, introHtml, overridden }` — for digest-style senders the override edits **subject + an intro paragraph above the data**; the data tables themselves are still built here, in code.

**Adopters (digest style — subject + intro only)**: `paid-job-email` (types `paid_job` and `ready_to_bill`), `money-waiting-email-dispatch`, `billed-report-email`, `payment-forecast-email-dispatch`, `crew-day-email-dispatch`, `weekly-money-email-dispatch` (`{{week}}`), `weekly-movement-email-dispatch`, `schedule-day-email-dispatch` (`{{date}}`), `gc-statement-email-dispatch` (`{{date}}`).

**Client-composed customer emails** (`send-lien-release-email`, `send-hazmat-notice-email`) receive their subject/body pre-resolved by the browser via `src/lib/emailWording.ts` — same semantics, reading `email_templates` under the `email_templates_authenticated_read` policy (migration `20260902184612`). Wording only: attached documents (invoices, releases, notices) are never edited through this system.

**Send-log typing** (migration `20260902183356`): [`_shared/logEmailSend.ts`](../supabase/functions/_shared/logEmailSend.ts) accepts an optional `emailType` stamped into `email_send_log.email_type` — the id joins each row to its catalog entry in `src/lib/emailCatalog.ts`, powering the catalog's 30-day send counts. `sendResendHtmlEmail` in [`_shared/recurringJobReportCore.ts`](../supabase/functions/_shared/recurringJobReportCore.ts) logs best-effort after every successful send.

The full outbound-email registry (id, audience, attachment, sender, editability) lives in `src/lib/emailCatalog.ts` and renders in the same Settings section.

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

A few legacy functions carry a `DEPLOY.md` (some also a `DEPLOY_NOW.md`) with function-specific deployment instructions — currently `create-user`, `archive-user`, `restore-user`, `login-as-user`, `send-workflow-notification`, and `test-email`; the rest deploy with the standard `supabase functions deploy <name>`:

- [`create-user/DEPLOY.md`](../supabase/functions/create-user/DEPLOY.md)
- [`archive-user`](../supabase/functions/archive-user/) - Archive users (replaces delete-user)
- [`restore-user`](../supabase/functions/restore-user/) - Restore archived users
- [`login-as-user/DEPLOY.md`](../supabase/functions/login-as-user/DEPLOY.md)
- [`send-workflow-notification/DEPLOY.md`](../supabase/functions/send-workflow-notification/DEPLOY.md)
- [`test-email/DEPLOY.md`](../supabase/functions/test-email/DEPLOY.md)

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Overall architecture
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
