# Pipetooling Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Key Features](#key-features)
7. [File Structure](#file-structure)
8. [Development Workflow](#development-workflow)
9. [Deployment](#deployment)
10. [Common Patterns](#common-patterns)
11. [Known Issues & Gotchas](#known-issues--gotchas)
12. [Future Development Notes](#future-development-notes)

---

## Project Overview

**Pipetooling** is a web application designed for Master Plumbers to track plumbing work across multiple projects and crews. The key innovation is that it allows tracking work for crews that don't have direct access to the site.

### Core Use Case
A Master Plumber can:
- Manage customer information
- Create projects with custom workflow steps
- Assign work to crew members (even those without accounts)
- Track progress through workflow stages
- Inspect and approve/reject work
- Send bills upon approval
- Use templates to standardize workflows

### Key Differentiators
- **Plain text workflow steps**: Maximum flexibility - any step can be described in plain text
- **Crew tracking without accounts**: People can be assigned to work without having user accounts
- **Role-based access**: Owners, Masters, Assistants, and Subcontractors have different permissions
- **Template system**: Reusable workflow templates for common job types
- **Notification subscriptions**: Users can subscribe to stage notifications
- **Calendar view**: Visual calendar showing assigned work

---

## Tech Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.6.2** - Type safety
- **Vite 5.4.10** - Build tool and dev server
- **React Router DOM 6.28.0** - Client-side routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (email/password)
  - Row Level Security (RLS) policies
  - Edge Functions (Deno runtime)
  - Real-time subscriptions (not currently used)

### Hosting
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - CI/CD pipeline

### Key Dependencies
- `@supabase/supabase-js` - Supabase client library

---

## Architecture

### High-Level Architecture
```
┌─────────────────┐
│  GitHub Pages   │  (Static hosting)
│   (Frontend)    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Supabase      │
│  ┌───────────┐  │
│  │ PostgreSQL │  │  (Database with RLS)
│  └───────────┘  │
│  ┌───────────┐  │
│  │   Auth     │  │  (Email/password auth)
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Edge Fns  │  │  (Deno functions)
│  └───────────┘  │
└─────────────────┘
```

### Data Flow
1. User interacts with React frontend
2. Frontend calls Supabase client (`supabase.from()`, `supabase.auth`, `supabase.functions.invoke()`)
3. Supabase enforces RLS policies based on user role and relationships
4. Edge Functions handle privileged operations (user creation, deletion, impersonation)
5. Database stores all data with proper relationships and constraints

### Client-Side Routing
- All routes except `/sign-in` and `/sign-up` are protected
- `ProtectedRoute` component checks authentication
- Role-based navigation hiding (subcontractors see limited nav)
- Client-side redirects enforce role restrictions

---

## Database Schema

### Core Tables

#### `public.users`
- **Purpose**: User accounts with roles
- **Key Fields**:
  - `id` (uuid, PK) - Matches `auth.users.id`
  - `email` (text)
  - `name` (text, nullable)
  - `role` (enum: `'owner' | 'master_technician' | 'assistant' | 'subcontractor'`)
  - `last_sign_in_at` (timestamptz, nullable)
- **Relationships**: Referenced by `customers.master_user_id`, `people.master_user_id`
- **RLS**: Users can read their own record; owners can read all

#### `public.customers`
- **Purpose**: Customer information
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id`)
  - `name` (text)
  - `address` (text, nullable)
  - `contact_info` (jsonb, nullable)
- **RLS**: Users can only see customers where `master_user_id` matches their ID or they're in `master_assistants`

#### `public.projects`
- **Purpose**: Project records
- **Key Fields**:
  - `id` (uuid, PK)
  - `customer_id` (uuid, FK → `customers.id`)
  - `name` (text)
  - `description` (text, nullable)
  - `status` (enum: `'active' | 'completed' | 'on_hold'`)
  - `housecallpro_number` (text, nullable) - External system reference
  - `plans_link` (text, nullable) - URL to plans
- **RLS**: Users can see projects for customers they have access to

#### `public.project_workflows`
- **Purpose**: Workflow instances for projects
- **Key Fields**:
  - `id` (uuid, PK)
  - `project_id` (uuid, FK → `projects.id`)
  - `template_id` (uuid, FK → `workflow_templates.id`, nullable)
  - `name` (text)
  - `status` (enum: `'draft' | 'active' | 'completed'`)
- **RLS**: Users can see workflows for projects they have access to

#### `public.project_workflow_steps`
- **Purpose**: Individual steps in a workflow
- **Key Fields**:
  - `id` (uuid, PK)
  - `workflow_id` (uuid, FK → `project_workflows.id`)
  - `template_step_id` (uuid, FK → `workflow_template_steps.id`, nullable)
  - `sequence_order` (integer)
  - `name` (text) - **Plain text step description**
  - `step_type` (enum: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`)
  - `assigned_to_name` (text, nullable) - **Person assigned (may not be a user)**
  - `inspector_name` (text, nullable)
  - `scheduled_start_date` (timestamptz, nullable)
  - `scheduled_end_date` (timestamptz, nullable)
  - `started_at` (timestamptz, nullable)
  - `ended_at` (timestamptz, nullable)
  - `status` (enum: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`)
  - `inspection_notes` (text, nullable)
  - `rejection_reason` (text, nullable)
  - `assigned_skill` (text, nullable)
  - `notify_assigned_when_started` (boolean, default false)
  - `notify_assigned_when_complete` (boolean, default false)
  - `notify_assigned_when_reopened` (boolean, default false)
- **RLS**: Users can see steps for workflows they have access to

#### `public.workflow_templates`
- **Purpose**: Reusable workflow templates
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text)
  - `description` (text, nullable)
- **RLS**: Only owners can CRUD templates

#### `public.workflow_template_steps`
- **Purpose**: Steps within a template
- **Key Fields**:
  - `id` (uuid, PK)
  - `template_id` (uuid, FK → `workflow_templates.id`)
  - `sequence_order` (integer)
  - `name` (text)
- **RLS**: Only owners can CRUD template steps

#### `public.people`
- **Purpose**: Roster of people (may or may not have user accounts)
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id`)
  - `kind` (enum: `'assistant' | 'master_technician' | 'sub'`)
  - `name` (text)
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `notes` (text, nullable)
- **RLS**: Users can only see/manage their own roster entries

#### `public.step_subscriptions`
- **Purpose**: User subscriptions to step notifications
- **Key Fields**:
  - `id` (uuid, PK)
  - `step_id` (uuid, FK → `project_workflow_steps.id`)
  - `user_id` (uuid, FK → `users.id`)
  - `notify_when_started` (boolean, default false)
  - `notify_when_complete` (boolean, default false)
  - `notify_when_reopened` (boolean, default false)
- **Unique Constraint**: `(step_id, user_id)`
- **RLS**: Users can only manage their own subscriptions

### Database Functions

#### `public.handle_new_user()`
- **Trigger**: Fires on `auth.users` INSERT
- **Purpose**: Creates corresponding `public.users` record
- **Logic**: Checks `raw_user_meta_data.invited_role` to set initial role, defaults to `'assistant'`

#### `public.is_owner()`
- **Returns**: `boolean`
- **Purpose**: Checks if current user has `'owner'` role
- **Usage**: Used in RLS policies to avoid recursion

#### `public.claim_owner_with_code(code text)`
- **Returns**: `boolean`
- **Purpose**: Grants owner role if code matches `'admin1234'`
- **Usage**: Called from Settings page

#### `public.touch_last_sign_in()`
- **Trigger**: Fires on `auth.users` UPDATE when `last_sign_in_at` changes
- **Purpose**: Updates `public.users.last_sign_in_at`

### Foreign Key Relationships
```
users (id)
  ├── customers.master_user_id
  └── people.master_user_id

customers (id)
  └── projects.customer_id

projects (id)
  └── project_workflows.project_id

project_workflows (id)
  └── project_workflow_steps.workflow_id

workflow_templates (id)
  ├── project_workflows.template_id
  └── workflow_template_steps.template_id

workflow_template_steps (id)
  └── project_workflow_steps.template_step_id

users (id)
  └── step_subscriptions.user_id

project_workflow_steps (id)
  └── step_subscriptions.step_id
```

**Important**: When deleting, respect foreign key order:
1. `step_subscriptions` (references steps)
2. `project_workflow_steps` (references workflows)
3. `project_workflows` (references projects)
4. `projects` (references customers)
5. `customers` (references users)

---

## Authentication & Authorization

### Authentication Flow
1. User signs up or signs in via `SignIn.tsx` / `SignUp.tsx`
2. Supabase Auth handles email/password authentication
3. `handle_new_user()` trigger creates `public.users` record
4. `useAuth()` hook provides current user state
5. `ProtectedRoute` redirects unauthenticated users to `/sign-in`

### User Roles

#### `owner`
- **Full access**: All features
- **Special permissions**:
  - Manage user roles in Settings
  - Create/edit/delete workflow templates
  - Invite users with predefined roles
  - Manually create users
  - Delete users
  - Impersonate other users (via "Login as user")
  - Claim owner role with code `'admin1234'`

#### `master_technician`
- **Access**: Dashboard, Customers, Projects, People, Calendar, Settings
- **Can**: Create customers, projects, workflows, assign people
- **Cannot**: Manage user roles, templates, or other users

#### `assistant`
- **Access**: Dashboard, Customers, Projects, People, Calendar
- **Can**: View and update workflows, assign people
- **Cannot**: Create customers/projects, manage users, access Settings

#### `subcontractor`
- **Access**: Dashboard, Calendar only
- **Restrictions**:
  - Navigation links hidden (except Dashboard, Calendar)
  - Client-side redirects enforce path restrictions
  - Cannot access Customers, Projects, People, Settings, Templates

### Row Level Security (RLS) Patterns

#### Common Pattern: Master-Assistant Relationship
Many policies check:
```sql
master_user_id = auth.uid() 
OR EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = master_user_id 
  AND jsonb_extract_path_text(metadata, 'assistants')::jsonb ? auth.uid()::text
)
```

#### Owner-Only Operations
```sql
EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
```

#### User's Own Data
```sql
user_id = auth.uid()
```

### Impersonation Flow
1. Owner clicks "Login as user" in Settings
2. Frontend calls `login-as-user` Edge Function
3. Edge Function generates magic link for target user
4. Frontend stores original session in `sessionStorage` (key: `'impersonation_original'`)
5. User signs in with magic link
6. "Back to my account" button restores original session from `sessionStorage`

---

## Key Features

### 1. Customer Management
- **Page**: `Customers.tsx`, `CustomerForm.tsx`
- **Features**: List, create, edit customers
- **Data**: Name, address, contact info (JSONB)

### 2. Project Management
- **Page**: `Projects.tsx`, `ProjectForm.tsx`
- **Features**:
  - List projects with status, customer, active stage
  - Create/edit projects
  - Delete projects (with confirmation)
  - Link to HouseCallPro number
  - Link to plans
  - Create workflow from template
- **Data**: Name, description, status, customer, external references

### 3. Workflow Management
- **Page**: `Workflow.tsx`
- **Features**:
  - Visual workflow with step cards
  - Add/delete/reorder steps
  - Assign people to steps (from roster)
  - Mark steps as started/complete
  - Approve/reject steps (with notes)
  - Re-open completed/approved steps
  - Notification subscriptions (assigned person + current user)
  - Predefined phrase buttons for common steps
- **Step States**: `pending` → `in_progress` → `completed` / `rejected` / `approved`
- **Time Tracking**: `started_at`, `ended_at` (shows "unknown" if null)

### 4. Template System
- **Page**: `Templates.tsx` (owner-only)
- **Features**:
  - Create/edit/delete workflow templates
  - Manage template steps (add/edit/remove/reorder)
  - Use templates when creating projects
- **Data**: Template name, description, ordered steps

### 5. People Roster
- **Page**: `People.tsx`
- **Features**:
  - List people by kind (Assistant, Master, Subcontractor)
  - Add people without user accounts
  - Merge display of roster entries and signed-up users
  - Show active projects per person
  - Invite roster entries as users
- **Data**: Name, email, phone, notes, kind

### 6. Calendar View
- **Page**: `Calendar.tsx`
- **Features**:
  - Month-view calendar
  - Shows steps assigned to current user (by `assigned_to_name`)
  - Color-coded by status
  - Links to workflow pages
  - Navigation (prev/next month, "Today")

### 7. Dashboard
- **Page**: `Dashboard.tsx`
- **Features**:
  - Display user role
  - Show subscribed stages (with notification preferences)
  - Links to projects and workflows

### 8. Settings
- **Page**: `Settings.tsx` (owner-only)
- **Features**:
  - View all users with roles
  - Change user roles
  - Enter admin code to claim owner role
  - Invite users via email (with role)
  - Manually create users (with password)
  - Delete users (with confirmation)
  - Send magic link to user
  - Impersonate users ("Login as user")
  - Display last login time

### 9. Notifications
- **System**: `step_subscriptions` table
- **Features**:
  - Users can subscribe to step notifications
  - Two subscription types:
    - **Assigned person**: Notify when step started/complete/re-opened (stored on step)
    - **Current user**: Notify ME when step started/complete/re-opened (stored in `step_subscriptions`)
  - Subscribed stages shown in Dashboard
- **Note**: Notification delivery not yet implemented (subscription tracking only)

---

## File Structure

```
pipetooling.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── public/
│   ├── .nojekyll               # Prevents Jekyll processing
│   └── favicon.svg             # Site favicon
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Main layout with navigation
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication hook
│   ├── lib/
│   │   └── supabase.ts         # Supabase client initialization
│   ├── pages/
│   │   ├── Calendar.tsx        # Calendar view
│   │   ├── CustomerForm.tsx    # Create/edit customer
│   │   ├── Customers.tsx       # List customers
│   │   ├── Dashboard.tsx       # User dashboard
│   │   ├── People.tsx          # People roster
│   │   ├── ProjectForm.tsx     # Create/edit project
│   │   ├── Projects.tsx        # List projects
│   │   ├── Settings.tsx        # User management (owner)
│   │   ├── SignIn.tsx          # Sign in page
│   │   ├── SignUp.tsx          # Sign up page
│   │   ├── Templates.tsx     # Templates (owner)
│   │   └── Workflow.tsx        # Workflow management
│   ├── types/
│   │   └── database.ts         # TypeScript types for database
│   ├── App.tsx                 # Route definitions
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── index.html                  # HTML template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
└── vite.config.ts              # Vite config
```

### Key Files Explained

#### `src/lib/supabase.ts`
- Initializes Supabase client
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment
- Throws error if missing (prevents silent failures)

#### `src/hooks/useAuth.ts`
- Provides `{ user, loading }` from Supabase Auth
- Subscribes to auth state changes
- Used throughout app for authentication checks

#### `src/components/Layout.tsx`
- Main navigation bar
- Role-based link visibility
- Impersonation handling ("Back to my account")
- Sign out functionality

#### `src/types/database.ts`
- TypeScript types generated from database schema
- Used for type-safe database queries
- **Note**: Must be manually updated when schema changes

#### `src/pages/Workflow.tsx`
- Most complex page (475+ lines)
- Handles step CRUD, status updates, person assignment, notifications
- Character encoding fixes for special characters (Unicode escapes)

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start dev server (requires .env file)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Create `.env` file (not committed):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Migrations
- Migrations are managed via Supabase MCP (Model Context Protocol)
- Use `mcp_supabase_apply_migration` to create migrations
- Migration naming: `snake_case_description`
- Always test migrations on a branch first

### Type Generation
- `src/types/database.ts` is manually maintained
- When schema changes, update types to match
- Consider using Supabase CLI for type generation in future

### Code Style
- TypeScript strict mode enabled
- React functional components with hooks
- Inline styles (no CSS framework)
- Error handling: Display errors to user, log to console

---

## Deployment

### GitHub Pages Deployment

#### Prerequisites
1. Repository secrets must be set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### Deployment Process
1. Push to `main` branch triggers workflow
2. GitHub Actions:
   - Checks out code
   - Installs Node.js 20
   - Installs dependencies (`npm ci`)
   - **Validates environment variables** (fails early if missing)
   - Builds with environment variables
   - Uploads `dist/` as artifact
   - Deploys to GitHub Pages

#### Workflow File
`.github/workflows/deploy.yml`

#### Important Files for Deployment
- `public/.nojekyll` - Prevents Jekyll from processing `dist/`
- `CNAME` - Custom domain (if used)

### Edge Functions Deployment
Edge Functions are deployed via Supabase MCP:
- `invite-user` - Sends invitation emails
- `create-user` - Manually creates users
- `delete-user` - Deletes users
- `login-as-user` - Generates magic link for impersonation

**All Edge Functions**:
- Use `verify_jwt: false` (gateway validation disabled)
- Implement internal JWT validation
- Handle CORS explicitly
- Return structured error responses

---

## Common Patterns

### 1. Data Fetching Pattern
```typescript
const [data, setData] = useState<Type[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  if (!authUser?.id) {
    setLoading(false)
    return
  }
  ;(async () => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('master_user_id', authUser.id)
    if (error) setError(error.message)
    else setData(data ?? [])
    setLoading(false)
  })()
}, [authUser?.id])
```

### 2. Edge Function Call Pattern
```typescript
const { data, error: eFn } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ },
})

if (eFn) {
  let msg = eFn.message
  // Parse error from response body if available
  if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
    try {
      const b = (await eFn.context.json()) as { error?: string } | null
      if (b?.error) msg = b.error
    } catch { /* ignore */ }
  }
  setError(msg)
  return
}

// Check for error in response data
const err = (data as { error?: string } | null)?.error
if (err) {
  setError(err)
  return
}

// Success
```

### 3. Role Checking Pattern
```typescript
const [role, setRole] = useState<UserRole | null>(null)

useEffect(() => {
  if (!authUser?.id) {
    setRole(null)
    return
  }
  supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()
    .then(({ data }) => {
      setRole((data as { role: UserRole } | null)?.role ?? null)
    })
}, [authUser?.id])
```

### 4. Protected Route Pattern
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}
```

### 5. Form Submission Pattern
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError(null)
  setSubmitting(true)
  
  const { data, error } = await supabase
    .from('table')
    .insert({ /* data */ })
  
  setSubmitting(false)
  if (error) {
    setError(error.message)
    return
  }
  
  // Success: close modal, reload data, etc.
  closeModal()
  await loadData()
}
```

### 6. Character Encoding Fix
Special characters in JSX should use Unicode escapes:
```typescript
// Bad: ↓
// Good: {"\u2193"}
// Or use ASCII alternatives
```

---

## Known Issues & Gotchas

### 1. RLS Policy Recursion
- **Issue**: Policies that query `public.users` can cause infinite recursion
- **Solution**: Use `public.is_owner()` function instead of direct queries
- **Example**: `is_owner()` is used in template policies

### 2. Foreign Key Deletion Order
- **Issue**: Deleting parent records fails if children exist
- **Solution**: Always delete in dependency order:
  1. `step_subscriptions`
  2. `project_workflow_steps`
  3. `project_workflows`
  4. `projects`
  5. `customers`

### 3. Edge Function CORS
- **Issue**: Edge Functions can fail with CORS errors
- **Solution**: All Edge Functions explicitly set CORS headers:
  ```typescript
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  ```

### 4. Edge Function JWT Validation
- **Issue**: Gateway JWT validation can fail on GitHub Pages
- **Solution**: Use `verify_jwt: false` and validate internally:
  ```typescript
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  // Validate JWT and check permissions
  ```

### 5. Environment Variables in Build
- **Issue**: Missing env vars cause runtime errors
- **Solution**: GitHub Actions workflow validates secrets before build
- **Note**: Values must be set in repository secrets

### 6. Character Encoding in Workflow
- **Issue**: Special characters (↓, ·, …, ←, –) display as "?"
- **Solution**: Use Unicode escapes: `{"\u2193"}` or ASCII alternatives

### 7. People Deduplication
- **Issue**: Same person appears twice if they exist in both `people` and `users`
- **Solution**: Filter `people` entries where `email` matches a `user.email`

### 8. Impersonation Session Storage
- **Issue**: Original session lost during impersonation
- **Solution**: Store original session in `sessionStorage` before impersonating
- **Key**: `'impersonation_original'`

### 9. TypeScript Type Updates
- **Issue**: Database types can become out of sync
- **Solution**: Manually update `src/types/database.ts` when schema changes
- **Future**: Consider Supabase CLI type generation

### 10. GitHub Pages MIME Types
- **Issue**: Module scripts fail with wrong MIME type
- **Solution**: `public/.nojekyll` prevents Jekyll from interfering

---

## Future Development Notes

### Planned Features (from conversation history)
- Email notifications for subscribed stages (subscription tracking exists, delivery not implemented)
- More granular permissions (e.g., assistants can create projects)
- Workflow step dependencies visualization
- Export/import templates
- Project archiving (beyond status changes)

### Technical Debt
1. **Type Generation**: Manual type maintenance is error-prone
   - **Solution**: Use Supabase CLI `supabase gen types typescript`
2. **Error Handling**: Some errors are only logged to console
   - **Solution**: Centralized error handling/toast system
3. **Styling**: Inline styles make maintenance difficult
   - **Solution**: Consider CSS modules or Tailwind
4. **Testing**: No tests currently
   - **Solution**: Add unit tests for hooks, integration tests for pages
5. **Edge Function Error Messages**: Inconsistent error format
   - **Solution**: Standardize error response format

### Database Considerations
- **Indexes**: Review query patterns and add indexes for performance
- **Archiving**: Consider soft deletes or archive tables for historical data
- **Audit Trail**: No audit logging currently (who changed what, when)

### Security Considerations
- **Admin Code**: Hardcoded `'admin1234'` should be configurable
- **Rate Limiting**: No rate limiting on Edge Functions
- **Input Validation**: Some user inputs not validated (e.g., email format)
- **SQL Injection**: RLS policies use parameterized queries (safe), but be cautious with dynamic SQL

### Performance Optimizations
- **Data Fetching**: Some pages fetch all data upfront (consider pagination)
- **Real-time**: Supabase real-time not used (could enable for live updates)
- **Caching**: No client-side caching (consider React Query)

---

## Quick Reference

### User Roles
- **owner**: Full access, user management, templates
- **master_technician**: Create/manage projects, customers, workflows
- **assistant**: View/update workflows, no creation
- **subcontractor**: Dashboard and Calendar only

### Key Routes
- `/dashboard` - User dashboard
- `/customers` - Customer list
- `/projects` - Project list
- `/workflows/:projectId` - Workflow management
- `/people` - People roster
- `/calendar` - Calendar view
- `/templates` - Template management (owner)
- `/settings` - User management (owner)

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

### Edge Functions
- `invite-user` - Send invitation email
- `create-user` - Manually create user
- `delete-user` - Delete user
- `login-as-user` - Generate impersonation magic link

### Database Enums
- `user_role`: `'owner' | 'master_technician' | 'assistant' | 'subcontractor'`
- `project_status`: `'active' | 'completed' | 'on_hold'`
- `workflow_status`: `'draft' | 'active' | 'completed'`
- `step_status`: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`
- `step_type`: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`
- `person_kind`: `'assistant' | 'master_technician' | 'sub'`

---

## Getting Started for New Developers

1. **Clone repository**
2. **Set up Supabase**:
   - Create Supabase project
   - Run migrations (via MCP or Supabase CLI)
   - Set up Edge Functions
   - Configure RLS policies
3. **Set up local environment**:
   - Create `.env` with Supabase credentials
   - Run `npm install`
   - Run `npm run dev`
4. **Create first user**:
   - Sign up via UI
   - In Supabase dashboard, manually set role to `'owner'` OR
   - Use Settings page to enter admin code `'admin1234'`
5. **Explore features**:
   - Create customer
   - Create project
   - Add workflow steps
   - Assign people
   - Test role restrictions

---

## Contact & Support

For questions or issues:
1. Check this documentation
2. Review conversation history in agent transcripts
3. Check Supabase logs via MCP: `mcp_supabase_get_logs`
4. Review RLS policies via Supabase dashboard

---

**Last Updated**: 2026-01-17
**Documentation Version**: 1.0
