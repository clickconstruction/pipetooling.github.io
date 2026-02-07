# Edge Functions API Reference

---
file: EDGE_FUNCTIONS.md
type: API Reference
purpose: Complete API documentation for all 6 Supabase Edge Functions
audience: Developers, DevOps, AI Agents
last_updated: 2026-02-07
estimated_read_time: 20-25 minutes
difficulty: Intermediate

runtime: "Deno (TypeScript)"
authentication: "Manual JWT validation"
total_functions: 6

key_sections:
  - name: "create-user"
    line: ~55
    anchor: "#create-user"
    description: "Create users with roles (dev-only)"
  - name: "delete-user"
    line: ~181
    anchor: "#delete-user"
    description: "Delete users by email/name (dev-only)"
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
   - [delete-user](#delete-user)
   - [login-as-user](#login-as-user)
   - [send-workflow-notification](#send-workflow-notification)
   - [set-user-password](#set-user-password)
   - [test-email](#test-email)
4. [Error Handling](#error-handling)
5. [Deployment](#deployment)

---

## Overview

Pipetooling uses Supabase Edge Functions (Deno runtime) for privileged server-side operations that require elevated permissions or external API access. All functions use manual JWT validation with gateway verification disabled.

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

### delete-user

**Purpose**: Delete users by email or name (dev-only operation)

**Endpoint**: `POST /functions/v1/delete-user`

**Required Role**: `dev`

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Request Parameters

```typescript
interface DeleteUserRequest {
  email?: string  // Find user by email
  name?: string   // Find user by name (if email not provided)
}
```

**Note**: Must provide either `email` or `name` (email takes precedence if both provided)

#### Example Request

```typescript
// Delete by email
const response = await supabase.functions.invoke('delete-user', {
  body: {
    email: 'user@example.com'
  }
})

// Delete by name
const response = await supabase.functions.invoke('delete-user', {
  body: {
    name: 'John Doe'
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "User deleted successfully",
  "deleted_user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: email or name"
}
```

**403 Forbidden** - Self-deletion attempt:
```json
{
  "error": "Cannot delete yourself"
}
```

**404 Not Found** - User not found:
```json
{
  "error": "User not found with email: user@example.com"
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
2. Finds user by email or name in `public.users` table
3. Prevents self-deletion (cannot delete calling user)
4. Deletes from `auth.users` using `supabase.auth.admin.deleteUser()`
5. Cascading deletes handled by database foreign keys:
   - `master_assistants` records
   - `customers` owned by user
   - `projects` owned by user
   - `purchase_orders` created by user
   - Other related records with FK constraints

**Deployment**: See [`supabase/functions/delete-user/DEPLOY.md`](supabase/functions/delete-user/DEPLOY.md)

---

### login-as-user

**Purpose**: Generate magic link for user impersonation (dev and master access)

**Endpoint**: `POST /functions/v1/login-as-user`

**Required Role**: `dev` or `master_technician`

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
const response = await supabase.functions.invoke('login-as-user', {
  body: {
    email: 'target@example.com',
    redirectTo: `${window.location.origin}/dashboard`
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

1. Validates caller is `dev` or `master_technician` role
2. Validates email format
3. Finds target user in `public.users` table
4. Uses `supabase.auth.admin.generateLink()` to create magic link
5. Returns magic link URL for frontend to redirect to
6. Frontend workflow:
   - Stores original session in `sessionStorage`
   - Redirects to magic link
   - `AuthHandler` component processes tokens
   - User impersonated successfully

**Use Cases**:
- Debugging user-specific issues
- Assisting users with their accounts
- Testing permissions and access control

**Deployment**: See [`supabase/functions/login-as-user/DEPLOY.md`](supabase/functions/login-as-user/DEPLOY.md)

---

### send-workflow-notification

**Purpose**: Send email notifications for workflow events via Resend API

**Endpoint**: `POST /functions/v1/send-workflow-notification`

**Required Role**: Authenticated user (any role)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY` - API key for Resend email service

#### Request Parameters

```typescript
interface SendNotificationRequest {
  template_type: string      // Email template type
  to_email: string          // Recipient email
  variables: Record<string, string>  // Template variables
}
```

**Template Types**:
- `'invitation'` - User invitation
- `'sign_in'` - Sign-in notification
- `'login_as'` - Impersonation notification
- `'stage_assigned'` - Stage assignment
- `'stage_started'` - Stage started
- `'stage_complete'` - Stage completed
- `'stage_approved'` - Stage approved
- `'stage_rejected'` - Stage rejected
- `'stage_reopened'` - Stage reopened

#### Example Request

```typescript
const response = await supabase.functions.invoke('send-workflow-notification', {
  body: {
    template_type: 'stage_assigned',
    to_email: 'worker@example.com',
    variables: {
      name: 'John Doe',
      project_name: 'Smith Residence Remodel',
      stage_name: 'Rough In',
      assigned_by: 'Master Technician'
    }
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Email sent successfully",
  "email_id": "resend_email_id"
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: template_type, to_email, and variables"
}
```

**404 Not Found** - Template not found:
```json
{
  "error": "Email template not found for type: stage_assigned"
}
```

**500 Internal Server Error** - Resend API error:
```json
{
  "error": "Failed to send email: <resend error message>"
}
```

#### Implementation Details

1. Validates authenticated user (any role)
2. Fetches email template from `public.email_templates` table
3. Replaces variables in template subject and body:
   - Format: `{{variable_name}}`
   - Example: `Hello {{name}}` → `Hello John Doe`
4. Sends email via Resend API
5. Returns success with Resend email ID

**Variable Substitution**:
```typescript
// Template body: "Hello {{name}}, you've been assigned to {{stage_name}}"
// Variables: { name: "John", stage_name: "Rough In" }
// Result: "Hello John, you've been assigned to Rough In"
```

**See Also**: 
- [EMAIL_TEMPLATES_SETUP.md](./EMAIL_TEMPLATES_SETUP.md)
- [EMAIL_TESTING.md](./EMAIL_TESTING.md)

**Deployment**: See [`supabase/functions/send-workflow-notification/DEPLOY.md`](supabase/functions/send-workflow-notification/DEPLOY.md)

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

### test-email

**Purpose**: Test email templates with Resend API integration

**Endpoint**: `POST /functions/v1/test-email`

**Required Role**: Authenticated user (any role, but typically dev)

**Required Secrets**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`

#### Request Parameters

```typescript
interface TestEmailRequest {
  template_type: string              // Email template to test
  test_email: string                 // Recipient email for test
  variables?: Record<string, string> // Test variable values
}
```

#### Example Request

```typescript
const response = await supabase.functions.invoke('test-email', {
  body: {
    template_type: 'stage_assigned',
    test_email: 'test@example.com',
    variables: {
      name: 'Test User',
      project_name: 'Test Project',
      stage_name: 'Test Stage'
    }
  }
})
```

#### Success Response

**Status**: 200 OK

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "template_type": "stage_assigned",
  "to": "test@example.com",
  "resend_id": "resend_email_id"
}
```

#### Error Responses

**400 Bad Request** - Missing fields:
```json
{
  "error": "Missing required fields: template_type and test_email"
}
```

**404 Not Found** - Template not found:
```json
{
  "error": "Email template not found: stage_assigned"
}
```

**500 Internal Server Error** - Resend error:
```json
{
  "error": "Failed to send email via Resend: <error details>"
}
```

#### Implementation Details

1. Fetches email template from `public.email_templates`
2. Substitutes variables in subject and body
3. Uses default placeholder values if variables not provided
4. Sends via Resend API
5. Returns Resend email ID for tracking

**Default Variables** (used if not provided):
```typescript
{
  name: '[Test Name]',
  email: '[test@example.com]',
  project_name: '[Test Project]',
  stage_name: '[Test Stage]',
  link: '[Test Link]',
  // ... other template-specific variables
}
```

**See Also**: 
- [EMAIL_TESTING.md](./EMAIL_TESTING.md) - Complete testing documentation
- [`supabase/functions/test-email/README.md`](supabase/functions/test-email/README.md)

**Deployment**: See [`supabase/functions/test-email/DEPLOY.md`](supabase/functions/test-email/DEPLOY.md)

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
supabase functions deploy delete-user
supabase functions deploy login-as-user
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
- [`delete-user/DEPLOY.md`](supabase/functions/delete-user/DEPLOY.md)
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
