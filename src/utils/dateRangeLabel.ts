/** Short range label for en-US calendar dates (YYYY-MM-DD). */
export function formatDateRangeLabel(startIso: string, endIso: string): string {
  const d0 = new Date(startIso + 'T12:00:00')
  const d1 = new Date(endIso + 'T12:00:00')
  const a = d0.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const b = d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${a} – ${b}`
}
