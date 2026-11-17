/**
 * How the Prospects page writes a moment (moved out of `src/pages/Prospects.tsx`, where it was a module-level
 * helper with no test). A missing time reads as a dash.
 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}
