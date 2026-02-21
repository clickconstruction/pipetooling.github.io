# AI Context - Quick Project Overview

> **Purpose**: This file provides a 30-second overview of PipeTooling for AI agents and new developers. Read this first, then consult specialized documentation as needed.

---

## Project in 30 Seconds

**PipeTooling** is a workflow management system for master plumbers to track work across multiple projects and crews.

- **Domain**: Commercial/residential plumbing project management + bid estimation
- **Stack**: React + TypeScript + Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Deployment**: GitHub Pages (static hosting)
- **Users**: 5 roles with complex access control (dev, master, assistant, subcontractor, estimator)
- **4 Major Systems**: 
  1. Projects/Workflows (ongoing work tracking)
  2. Bids (estimation system: Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission)
  3. Materials (price book, templates, purchase orders, Supply Houses & External Subs with invoices and job payments)
  4. Checklist (recurring tasks, Today/History/Manage tabs, push notifications)

---

## Critical Concepts

### Access Control Patterns

**Master-Assistant Adoption** (many-to-many):
- Masters "adopt" assistants to grant access to their customers/projects
- One assistant can work for multiple masters
- Controlled via `master_assistants` table + RLS policies

**Master-Master Sharing**:
- Masters can share their data with other masters
- Shared masters get assistant-level access (view-only, no private notes/financials)
- Controlled via `master_shares` table

**Project Owner = Customer Owner**:
- Projects automatically inherit customer's owner
- Cannot be changed independently
- Enforced by database trigger `cascade_customer_master_to_projects()`

**RLS Everywhere**:
- Every table has Row Level Security policies
- Policies check: ownership, role, adoption, sharing
- Helper functions prevent timeout: `is_dev()`, `can_access_project_via_step()`

### Data Flow

```
Customer (has master_user_id) 
  → Project (master_user_id matches customer)
    → Workflow (one per project)
      → Steps/Stages (assigned to people)
        → Line Items (financial tracking)
        → Actions (status history ledger)
```

### Key Relationships

- **Adoption**: `master_assistants(master_id, assistant_id)` - grants data access
- **Sharing**: `master_shares(sharing_master_id, viewing_master_id)` - grants view access
- **Cost Matrix Shares**: `cost_matrix_teams_shares(shared_with_user_id)` - dev grants view-only Cost matrix and Teams to masters/assistants
- **Ownership**: Foreign keys to `users.id` as `master_user_id` or `created_by`
- **Cascading**: Customer master changes propagate to projects automatically

---

## Tech Stack Quick Reference

### Frontend
- **React 18**: Functional components with hooks
- **TypeScript**: Strict mode (`strict`, `noUncheckedIndexedAccess`)
- **Vite**: Build tool and dev server
- **React Router DOM**: Client-side routing
- **State**: React Context + local state (no Redux/Zustand)

### Backend
- **Supabase**: Backend-as-a-service
  - PostgreSQL 15 with Row Level Security (RLS)
  - Built-in authentication
  - Edge Functions (Deno runtime)
  - Real-time subscriptions (not heavily used)
- **Database**: ~50+ tables with complex RLS policies

### Deployment
- **Hosting**: GitHub Pages (static site)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Build**: `npm run build` → `dist/` → GitHub Pages

### Type Safety
- Types auto-generated from Supabase schema: `src/types/database.ts`
- Manual function types: `src/types/database-functions.ts`
- Update command: `supabase gen types typescript --local > src/types/database.ts`

---

## File Structure

```
pipetooling.github.io/
├── src/
│   ├── pages/              # Main UI pages (Customers, Projects, Workflow, People, Jobs, Bids, Materials, Checklist, etc.)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts (AuthContext, etc.)
│   ├── lib/               # Utilities (supabaseClient, errorHandling, etc.)
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Root component with routing
├── supabase/
│   ├── migrations/        # Database migrations (append-only)
│   └── functions/         # Edge Functions (Deno/TypeScript)
├── public/                # Static assets
└── [documentation].md     # 13+ markdown documentation files
```

---

## Most Important Files

### Core Application
- **`src/pages/Workflow.tsx`** (~1500 lines) - Most complex component, manages project workflow
- **`src/pages/Bids.tsx`** (~12k lines) - Bids: Bid Board, Builder Review (PIA per customer), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission
- **`src/pages/Materials.tsx`** (~1000 lines) - Price book, templates, purchase orders
- **`src/pages/Checklist.tsx`** - Recurring checklist (Today, History, Manage tabs)
- **`src/pages/Jobs.tsx`** - Jobs (Labor, HCP Jobs, Sub Sheet Ledger, Upcoming, Teams Summary tabs)
- **`src/contexts/AuthContext.tsx`** - Authentication state and user role
- **`src/lib/supabaseClient.ts`** - Supabase client configuration
- **`src/lib/errorHandling.ts`** - Retry wrappers and error utilities

### Documentation (Start Here)
- **`README.md`** - Quick start and documentation index
- **`AI_CONTEXT.md`** - This file (quick overview)
- **`PROJECT_DOCUMENTATION.md`** - Complete technical reference (3000+ lines)
- **`BIDS_SYSTEM.md`** - Bids system documentation (all tabs)
- **`ACCESS_CONTROL.md`** - Complete role permissions matrix
- **`EDGE_FUNCTIONS.md`** - Edge Functions API reference
- **`RECENT_FEATURES.md`** - Chronological feature log

---

## Common Tasks

### Adding a New Database Table

1. **Create migration**: `cd supabase && supabase migration new add_my_table`
2. **Write SQL**: CREATE TABLE + RLS policies + constraints + foreign keys
3. **Apply locally**: `supabase migration up`
4. **Update types**: `supabase gen types typescript --local > src/types/database.ts`
5. **Test RLS**: Verify policies work for all 5 roles
6. **Document**: Add to `PROJECT_DOCUMENTATION.md` and `MIGRATIONS.md`

### Adding a New Page/Route

1. **Create component**: `src/pages/MyPage.tsx`
2. **Add route**: Update `src/App.tsx` with new `<Route>`
3. **Add navigation**: Update `src/components/Layout.tsx` if needed
4. **Add RLS**: Ensure backend data is accessible to intended roles

### Debugging RLS Issues

1. **Check role**: Verify user's role in `public.users` table
2. **Review policies**: Check table's RLS policies in latest migrations
3. **Test query**: Run query manually with `SET LOCAL ROLE` to test policy
4. **Check adoptions**: Verify `master_assistants` or `master_shares` relationships
5. **Consult**: See `ACCESS_CONTROL.md` for expected permissions

### Fixing TypeScript Errors

1. **Update types**: After schema changes, regenerate types
2. **Check nulls**: Use optional chaining `?.` and nullish coalescing `??`
3. **Array access**: Always check `array[0]` could be undefined
4. **Build test**: Run `npm run build` to catch all type errors

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All 6 functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Email templates | `EMAIL_TEMPLATES_SETUP.md`, `EMAIL_TESTING.md` |
| Database improvements | `DATABASE_IMPROVEMENTS_SUMMARY.md` → v2.22 enhancements |
| Supabase disk IO / Materials performance | `RECENT_FEATURES.md` → v2.46; `PROJECT_DOCUMENTATION.md` → Materials Disk IO Optimizations |

---

## Key Patterns

### Error Handling
```typescript
import { withSupabaseRetry } from '@/lib/errorHandling'

// Wraps Supabase calls with retry logic
const { data, error } = await withSupabaseRetry(() => 
  supabase.from('table').select()
)
```

### RLS Helper Functions
```sql
-- Prevent recursion and timeout in complex policies
CREATE FUNCTION is_dev() RETURNS boolean
  SECURITY DEFINER  -- Runs with creator's permissions
  AS $$ SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dev'
  ) $$;
```

### Atomic Transaction Functions
```sql
-- Multi-step operations with automatic rollback
CREATE FUNCTION create_project_with_template(...)
  RETURNS project_workflows
  AS $$ 
    -- Multiple INSERTs in single transaction
    -- Returns result or rolls back on error
  $$;
```

### State Management
- **Global**: React Context (`AuthContext`)
- **Page-level**: `useState`, `useEffect` hooks
- **No global state library**: No Redux, MobX, or Zustand
- **Server state**: Direct Supabase queries (no React Query)

### Type Safety
```typescript
// Auto-generated types
import { Database } from '@/types/database'
type Customer = Database['public']['Tables']['customers']['Row']

// Function types (manual)
import { createProjectWithTemplate } from '@/types/database-functions'
```

---

## Domain Glossary

### User Roles
- **dev**: System administrator, full access to everything
- **master_technician** (Master): Project owner/manager, creates customers/projects
- **assistant**: Support staff, works under masters (must be adopted)
- **subcontractor** (Sub): External worker, sees only assigned stages
- **estimator**: Bid specialist, access to Bids and Materials only (no projects). Optional **estimator service type restriction**: devs can limit an estimator to specific service types (e.g., Electrical only); NULL/empty = all types

### Project Management
- **Customer**: Client or General Contractor (GC)
- **Project**: Job site or construction project
- **Workflow**: Sequence of stages for a project (one per project)
- **Stage/Step**: Individual work phase (e.g., "Rough In", "Top Out", "Trim Set")
- **Action**: Status change event (started, completed, approved, rejected, reopened)
- **Line Item**: Financial entry (material, labor, or expense)
- **Projection**: Forward-looking financial estimate
- **Ledger**: Complete financial history (line items + projections)
- **Private Note**: Owner-only note on a stage (not visible to assistants/subs)

### Access Control
- **Adoption**: Master grants assistant access to their data (many-to-many)
- **Sharing**: Master grants another master assistant-level access
- **Estimator service type restriction**: Limits estimators to specific service types (Plumbing, Electrical, HVAC); set via `estimator_service_type_ids` on users; NULL/empty = all types
- **RLS**: Row Level Security (PostgreSQL security policies)
- **SECURITY DEFINER**: Function runs with creator's permissions (bypasses RLS)

### Bids System
- **Bid Board**: Main bid list and management
- **Counts**: Fixture/tie-in quantity entry
- **Takeoff**: Map counts to material templates → create POs
- **Cost Estimate**: Calculate material + labor + driving costs
- **Pricing**: Compare costs to price book, analyze margins
- **Cover Letter**: Generate proposal documents
- **Submission & Followup**: Track bid submissions and outcomes

### Bids Concepts
- **Fixture**: Plumbing fixture (toilet, sink, faucet, etc.)
- **Tie-in**: Connection point in plumbing system
- **Rough In**: Initial plumbing installation (in-wall piping)
- **Top Out**: Mid-stage plumbing work
- **Trim Set**: Final fixture installation (visible fixtures)
- **Takeoff**: Process of calculating material quantities from fixture counts
- **Book** (Takeoff/Labor/Price): Template library for standardizing estimates
  - **Takeoff Book**: Maps fixtures to material templates
  - **Labor Book**: Maps fixtures to labor hours per stage
  - **Price Book**: Maps fixtures to pricing per stage
- **GC/Builder**: General Contractor (customer in bids context)
- **Margin**: Profitability percentage `(revenue - cost) / revenue`

### Materials System
- **PO**: Purchase Order (draft or finalized)
- **Supply House**: Vendor or supplier (e.g., Ferguson, HD Supply)
- **Price Book**: Catalog of parts with prices per supply house
- **Template**: Reusable part list (can contain nested templates)
- **Finalized PO**: Locked purchase order (add-only notes allowed)
- **Price Confirmation**: Assistant verification of prices before ordering

### Database Concepts
- **Migration**: SQL file defining schema changes (append-only, never edit)
- **Trigger**: Automatic database function on INSERT/UPDATE/DELETE
- **Cascade**: Automatic update/delete propagation via foreign keys
- **CHECK Constraint**: Database-level data validation
- **UNIQUE Constraint**: Enforces uniqueness of column values
- **Index**: Performance optimization for queries

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Projects  │  │    Bids    │  │ Materials  │        │
│  │ Workflows  │  │  6 Tabs    │  │ Price Book │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│         │                │                │              │
│         └────────────────┴────────────────┘              │
│                          │                               │
│                   AuthContext                            │
└──────────────────────────┼──────────────────────────────┘
                           │
                  Supabase Client
                           │
┌──────────────────────────┼──────────────────────────────┐
│                 Supabase Backend                         │
│  ┌────────────────────────────────────────────┐         │
│  │         PostgreSQL Database                │         │
│  │  • 50+ tables with RLS policies            │         │
│  │  • Triggers for timestamps, cascading      │         │
│  │  • Transaction functions for atomicity     │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │         Supabase Auth                      │         │
│  │  • Email/password authentication           │         │
│  │  • JWT tokens with role metadata           │         │
│  │  • Magic links for impersonation           │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │      Edge Functions (Deno)                 │         │
│  │  • create-user, delete-user                │         │
│  │  • login-as-user (impersonation)           │         │
│  │  • send-workflow-notification (Resend)     │         │
│  │  • set-user-password, test-email           │         │
│  └────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
                           │
                    Resend Email API
```

---

## Critical Constraints

### Development Rules

1. **Never edit existing migrations**: Migrations are append-only. Create new migration to change schema.
2. **Always add RLS policies**: Every new table needs SELECT/INSERT/UPDATE/DELETE policies for all roles.
3. **Update types after schema changes**: Run `supabase gen types typescript --local > src/types/database.ts`
4. **No `any` types**: TypeScript strict mode enforced. Use proper types or `unknown`.
5. **Test all 5 roles**: Verify RLS works for dev, master, assistant, subcontractor, estimator.
6. **Foreign keys need CASCADE behavior**: Decide ON DELETE CASCADE vs SET NULL vs RESTRICT.
7. **Use transaction functions**: For multi-step operations, create atomic database functions.

### Code Style

- **Functional components**: Use hooks (useState, useEffect, useContext)
- **Error handling**: Wrap Supabase calls with `withSupabaseRetry()`
- **Null safety**: Use optional chaining `?.` and nullish coalescing `??`
- **Async/await**: Preferred over `.then()` chains
- **No inline styles**: Use className and CSS files
- **Component size**: Break down files over 500 lines

### Database Patterns

- **Helper functions for RLS**: Use `is_dev()`, `can_access_project_via_step()` to prevent timeouts
- **SECURITY DEFINER carefully**: Only use when absolutely necessary (bypasses RLS)
- **Triggers for timestamps**: Use `update_updated_at_column()` trigger on all tables
- **CHECK constraints**: Add data validation at database level
- **Unique constraints**: Prevent duplicates (e.g., `(bid_id, count_row_id)`)

---

## Testing Focus Areas

### Role-Based Access
- [ ] Dev can access everything
- [ ] Master can access own data + shared data
- [ ] Assistant can access adopted masters' data
- [ ] Subcontractor only sees assigned stages
- [ ] Estimator can access Bids + Materials, but not Projects

### Data Integrity
- [ ] Foreign key cascading works correctly
- [ ] CHECK constraints prevent invalid data
- [ ] Unique constraints enforced
- [ ] Triggers fire on INSERT/UPDATE

### Concurrent Operations
- [ ] Multiple users editing same project
- [ ] Race conditions in workflow creation
- [ ] Mutex pattern in frontend prevents duplicate creates

### Type Safety
- [ ] `npm run build` succeeds with no errors
- [ ] No `any` types in new code
- [ ] Proper null/undefined handling

---

## Quick Troubleshooting

### "403 Forbidden" Error
- **Cause**: RLS policy blocking access
- **Fix**: Check user's role, adoption/sharing relationships, table RLS policies

### "Row not found" / Empty Results
- **Cause**: RLS filtering out data user shouldn't see
- **Fix**: Verify user has proper access (adoption, ownership, role)

### TypeScript Build Errors
- **Cause**: Types out of sync with database schema
- **Fix**: Regenerate types with `supabase gen types typescript --local`

### Workflow Not Creating
- **Cause**: Race condition with concurrent calls
- **Fix**: Check mutex pattern in `ensureWorkflow()` function

### Email Not Sending
- **Cause**: Resend API key not configured or domain not verified
- **Fix**: Check Supabase Dashboard → Edge Functions → Secrets

### Price Book Loading Slow
- **Cause**: Large dataset, pagination needed
- **Fix**: Use "Load All" mode for bulk editing, or infinite scroll for browsing

---

## Next Steps

**For AI Agents starting work**:
1. Read this file (you're done! ✓)
2. Consult specific documentation for your task (see "Where to Look For..." table)
3. Review relevant code files in `src/pages/` or `supabase/`
4. Check recent changes in `RECENT_FEATURES.md` for context
5. Ask clarifying questions before making changes

**For new developers**:
1. Read `README.md` for setup instructions
2. Read this file for project overview
3. Explore `PROJECT_DOCUMENTATION.md` for deep technical details
4. Try running the app locally: `npm install && npm run dev`
5. Browse the UI to understand user workflows

---

**Last Updated**: 2026-02-07

**Maintained By**: Documentation generated during comprehensive documentation update project

**Related Files**: See `README.md` "Documentation" section for complete file list
