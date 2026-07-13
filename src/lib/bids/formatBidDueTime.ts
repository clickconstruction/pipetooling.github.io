/**
 * Format a bids.bid_due_time value ('HH:MM' or Postgres 'HH:MM:SS') for display,
 * e.g. '14:00' → '2:00 PM'. Returns '' for empty/unparseable input.
 */
export function formatBidDueTime(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim())
  if (!m) return ''
  const h24 = parseInt(m[1]!, 10)
  if (h24 > 23) return ''
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m[2]} ${suffix}`
}
