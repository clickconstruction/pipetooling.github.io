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

📖 **For comprehensive project documentation, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**

The documentation includes:
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
- Calendar view
- Role-based access control (Owner, Master, Assistant, Subcontractor)
- Notification subscriptions
- User impersonation (owners)

## Deployment

The project automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

**Required GitHub Secrets**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) for detailed deployment instructions.
