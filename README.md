# Pipetooling

A web application for Master Plumbers to track plumbing work across multiple projects and crews.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Documentation

📖 **Main Documentation**:
- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Comprehensive project documentation
- **[RECENT_FEATURES.md](./RECENT_FEATURES.md)** - Summary of all recent features and updates
- **[WORKFLOW_FEATURES.md](./WORKFLOW_FEATURES.md)** - Detailed workflow features documentation

📋 **Feature-Specific Documentation**:
- **[PRIVATE_NOTES_SETUP.md](./PRIVATE_NOTES_SETUP.md)** - Private notes, line items, and projections setup
- **[EMAIL_TEMPLATES_SETUP.md](./EMAIL_TEMPLATES_SETUP.md)** - Email templates database setup
- **[EMAIL_TESTING.md](./EMAIL_TESTING.md)** - Email testing and integration status

The main documentation includes:
- Project overview and architecture
- Database schema and relationships
- **TypeScript types** (`src/types/database.ts`) and how to keep them in sync with the schema
- Authentication and authorization patterns
- Development workflow
- Deployment instructions
- Common code patterns
- Known issues and solutions
- Future development notes

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Hosting**: GitHub Pages

The app uses strict TypeScript (`strict`, `noUncheckedIndexedAccess`). Supabase table and RPC types are maintained in **`src/types/database.ts`**; update them when the database schema or RPCs change so `npm run build` stays clean. See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) for type-update patterns and known issues.

## Features

- Customer and project management
- Custom workflow steps (plain text)
- People roster (with or without user accounts)
- Workflow templates
- **Calendar view** (Central Time, two-line display)
- **Role-based access control** (Dev, Master, Assistant, Subcontractor, Estimator)
  - Assistants/subcontractors only see assigned stages
  - Estimators: Materials and Bids only; can see and add customers from Bids (no access to /customers or /projects)
- **Private notes and line items** (owners/masters only)
- **Projections and Ledger** (financial tracking)
- **Action Ledger** (complete stage history)
- **Set Start** with date/time picker
- Notification subscriptions
- **Email templates** (customizable notification content)
- User impersonation (devs)
- **Add new customer from Bids**: GC/Builder dropdown includes "+ Add new customer"; opens modal (same form as /customers/new without Quick Fill); new customer can be assigned to a master and is then selected as the bid's GC/Builder
- **New customer Quick Fill**: On /customers/new, Quick Fill is expandable (collapsed by default) with button next to the title
- **Bids Counts**: Fixture or Tie-in quick-select, number pad for count, Save / Save and Add; Project Name required; "Save and start Counts" in New Bid modal; Edit Bid button on Counts tab. Updating Counts refreshes Takeoff and Cost Estimate for the same bid; switching to Takeoff or Cost Estimate refetches so data stays current without a page refresh.
- **Bids Takeoff**: Map fixture or tie-in counts to material templates; multiple templates per fixture; template search; Create PO / Add to PO; "View purchase order" opens Materials with that PO
- **Bids Cost Estimate**: Combine material and labor by bid; link up to three POs (Rough In, Top Out, Trim Set) per stage; editable labor hours per fixture and labor rate; fixture labor matrix synced with Counts; total materials, labor, and grand total; Save and Print
- **Purchase Orders**: Grand Total and With Tax row (editable %); column headers use "Qty"; Materials page opens a specific PO when navigating from Bids (openPOId). PO items can have notes and a "From template" tag when added via a template

## Deployment

The project automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

**Required GitHub Secrets**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) for detailed deployment instructions.
