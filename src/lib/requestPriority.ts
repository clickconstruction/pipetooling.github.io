/**
 * Customer Waiting (v2.3247) — priority on Dispatch / Estimator inbox requests.
 *
 * A request a customer sends from their portal lands `priority = 'high'`
 * (migration 20260910220000). High open rows sort first, wear the red rail,
 * and light the app-wide banner until someone lowers or closes them. These
 * are the pure rules every surface shares: what counts as "waiting", how the
 * wait reads, how a call on the request reads, and the reasons a lowering
 * can carry into the thread.
 */

export type RequestPriority = 'normal' | 'high'
export type RequestInbox = 'dispatch' | 'estimator'

export type PriorityRow = {
  status: 'open' | 'closed' | string | null
  priority?: RequestPriority | string | null
}

/** Open AND high — the row the banner and the red rail are about. */
export function isCustomerWaiting(row: PriorityRow): boolean {
  return row.status === 'open' && row.priority === 'high'
}

/**
 * Sort helper: waiting rows before everything else; ties fall through to the
 * caller's own comparator (oldest-first for dispatch, newest-first for the
 * estimator inbox — each keeps its habit inside the tiers).
 */
export function compareCustomerWaitingFirst(a: PriorityRow, b: PriorityRow): number {
  const aw = isCustomerWaiting(a)
  const bw = isCustomerWaiting(b)
  if (aw === bw) return 0
  return aw ? -1 : 1
}

/** Reasons for lowering — one tap; the label goes into the thread note. */
export const LOWER_PRIORITY_REASONS = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'not_urgent', label: 'Not urgent' },
  { key: 'spam', label: 'Spam or duplicate' },
  { key: 'other', label: 'Other' },
] as const
export type LowerPriorityReasonKey = (typeof LOWER_PRIORITY_REASONS)[number]['key']

/**
 * The note text `set_request_priority` appends after "Priority lowered — ".
 * "Scheduled: Thu 9/12, 8–10 am" · "Scheduled" · "some free text" · null.
 */
export function formatPriorityChangeNote(reasonLabel: string | null, note: string): string | null {
  const n = note.trim()
  const r = (reasonLabel ?? '').trim()
  if (r && n) return `${r}: ${n}`
  if (r) return r
  if (n) return n
  return null
}

/** Past this many minutes the wait chip goes red. Nothing else escalates. */
export const CUSTOMER_WAITING_RED_MINUTES = 30

export type WaitDescription = {
  minutes: number
  /** "waiting 14 min" · "waiting 1 h 12 min" · "waiting 2 days" */
  label: string
  /** Short form for chips: "14 min" · "1 h 12 min" · "2 days" */
  short: string
  red: boolean
}

export function describeWait(createdAt: string | null | undefined, now: Date | number = Date.now()): WaitDescription | null {
  if (!createdAt) return null
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return null
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const minutes = Math.max(0, Math.floor((nowMs - t) / 60_000))
  let short: string
  if (minutes < 60) short = `${minutes} min`
  else if (minutes < 48 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    short = m === 0 ? `${h} h` : `${h} h ${m} min`
  } else short = `${Math.floor(minutes / (24 * 60))} days`
  return { minutes, label: `waiting ${short}`, short, red: minutes >= CUSTOMER_WAITING_RED_MINUTES }
}

/**
 * "Sam called 2:14 pm" (today) · "Sam called Tue 2:14 pm" (another day).
 * Null when nobody has called. `firstName` keeps the banner short.
 */
export function describeCalled(
  lastCalledAt: string | null | undefined,
  byName: string | null | undefined,
  now: Date | number = Date.now(),
  timeZone?: string,
): string | null {
  if (!lastCalledAt) return null
  const t = Date.parse(lastCalledAt)
  if (!Number.isFinite(t)) return null
  const who = firstName(byName) ?? 'Someone'
  const d = new Date(t)
  const nowD = new Date(typeof now === 'number' ? now : now.getTime())
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {}
  const sameDay = d.toLocaleDateString('en-US', opts) === nowD.toLocaleDateString('en-US', opts)
  const time = d.toLocaleTimeString('en-US', { ...opts, hour: 'numeric', minute: '2-digit' }).toLowerCase()
  if (sameDay) return `${who} called ${time}`
  const day = d.toLocaleDateString('en-US', { ...opts, weekday: 'short' })
  return `${who} called ${day} ${time}`
}

export function firstName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim()
  if (!n) return null
  return n.split(/\s+/)[0] ?? null
}

/** The kind word the row and banner use: "asks for a visit" etc. */
export function portalKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case 'visit':
      return 'asks for a visit'
    case 'bid':
      return 'asks for a bid'
    case 'gc_stage_ask':
    case 'stage_window':
      return 'asks for other dates'
    default:
      return 'sent a request'
  }
}
