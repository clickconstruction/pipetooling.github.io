import type { UserRole } from '../hooks/useAuth'

/**
 * The one human label for a user role — the words GLOSSARY.md / ACCESS_CONTROL.md
 * already use in their headings ("master_technician (Master)", "helpers (Helper)",
 * "subcontractor (Subcontractor)"). Used by the Invite / Manually-add dialogs,
 * the Active Accounts row select, the Person Desk access row, and — via the Deno
 * twin `supabase/functions/_shared/roleLabels.ts` — the invitation email
 * ("You've been invited to join … as a Helper", never "as a Master_technician").
 *
 * Keep the two files identical; `roleLabels.test.ts` fails when they drift.
 */
export const HUMAN_ROLE_LABELS: Record<UserRole, string> = {
  dev: 'Dev',
  master_technician: 'Master',
  assistant: 'Assistant',
  controller: 'Controller',
  estimator: 'Estimator',
  primary: 'Primary',
  superintendent: 'Superintendent',
  subcontractor: 'Subcontractor',
  helpers: 'Helper',
}

/** Human label for a role slug; unknown slugs fall back to "Snake_case" → "Snake case". */
export function humanRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  const known = (HUMAN_ROLE_LABELS as Record<string, string>)[role]
  if (known) return known
  const spaced = role.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
