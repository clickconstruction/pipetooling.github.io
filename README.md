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

## Features

- Customer and project management
- Custom workflow steps (plain text)
- People roster (with or without user accounts)
- Workflow templates
- **Calendar view** (Central Time, two-line display)
- **Role-based access control** (Owner, Master, Assistant, Subcontractor)
  - Assistants/subcontractors only see assigned stages
- **Private notes and line items** (owners/masters only)
- **Projections and Ledger** (financial tracking)
- **Action Ledger** (complete stage history)
- **Set Start** with date/time picker
- Notification subscriptions
- **Email templates** (customizable notification content)
- User impersonation (owners)

## Deployment

The project automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

**Required GitHub Secrets**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) for detailed deployment instructions.
