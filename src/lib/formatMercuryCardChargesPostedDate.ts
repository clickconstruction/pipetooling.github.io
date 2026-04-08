/** Short US date for Materials Card charges (e.g. 4/7/26). */
export function formatMercuryCardChargesPostedDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
  } catch {
    return '—'
  }
}
