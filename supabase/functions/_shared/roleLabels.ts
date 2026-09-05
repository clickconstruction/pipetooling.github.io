/**
 * Deno twin of `src/lib/roleLabels.ts` — the one human label for a user role, so the
 * invitation email says "as a Helper" / "as a Master", never the raw enum
 * ("as a Master_technician"). Keep the map identical to the client file;
 * `src/lib/roleLabels.test.ts` imports both and fails when they drift.
 */
export const HUMAN_ROLE_LABELS: Record<string, string> = {
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
  const known = HUMAN_ROLE_LABELS[role]
  if (known) return known
  const spaced = role.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
