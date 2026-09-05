/**
 * "Opened N times · last <date>" — the customer portal globe's answer to the first question
 * after sharing a link: has the customer even looked? (journey-map Tier-2 #37, J21-F4.)
 *
 * Fed by the `officeViewStats` block the `customer-portal` edge function adds to its payload
 * when the request carries a verified staff session: the count and latest timestamp of the
 * customer's `public_page_views` rows (`surface='portal'`) — office previews and staff opens
 * are no longer written, so the figure means customer opens.
 */

export type OfficeViewStats = { opens: number; lastOpenedAt: string | null }

export function parseOfficeViewStats(raw: unknown): OfficeViewStats | null {
  if (raw == null || typeof raw !== 'object') return null
  const block = (raw as { officeViewStats?: unknown }).officeViewStats
  if (block == null || typeof block !== 'object') return null
  const b = block as { opens?: unknown; lastOpenedAt?: unknown }
  const opens = typeof b.opens === 'number' && Number.isFinite(b.opens) && b.opens >= 0 ? Math.floor(b.opens) : 0
  const lastOpenedAt = typeof b.lastOpenedAt === 'string' && !Number.isNaN(Date.parse(b.lastOpenedAt)) ? b.lastOpenedAt : null
  return { opens, lastOpenedAt }
}

/** "today" / "yesterday" as words, otherwise "last Sep 3" (with the year when it differs). */
function whenPhrase(iso: string, now: Date): string {
  const d = new Date(iso)
  if (d.toDateString() === now.toDateString()) return 'today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday'
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  return `last ${d.toLocaleDateString('en-US', opts)}`
}

/**
 * `null` stats (the payload had no block — an old function build, or the request was not
 * recognised as staff) → the line is omitted; the caller renders nothing rather than a zero
 * it cannot vouch for.
 */
export function portalOpenedLabel(stats: OfficeViewStats | null, now: Date = new Date()): string | null {
  if (!stats) return null
  if (stats.opens <= 0 || !stats.lastOpenedAt) return 'Not opened yet'
  const times = stats.opens === 1 ? 'once' : stats.opens === 2 ? 'twice' : `${stats.opens} times`
  return `Opened ${times} · ${whenPhrase(stats.lastOpenedAt, now)}`
}
