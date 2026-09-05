import { computeSentWait, type SentWaitLevel } from './estimatePipelineRefresh'

/**
 * "Opened / never opened" for a Sent row on the Estimates Pipeline (journey-map
 * J17-F1 / Tier-2 #34, 2026-09-05). Every sent estimate used to wear the same
 * "sent 7d ago — nudge?" chip whether the customer opened it seven times or
 * never; the split sat in `estimate_customer_events` and was invisible on the
 * list. This kernel folds the row's events into one chip, keeping
 * `computeSentWait`'s numbers for the never-opened case.
 *
 *   never opened · sent 7d ago — nudge?
 *   opened Tue · quiet 5d
 *   opened today
 *
 * Scanner heuristic (J17-F3): link views from two or more distinct IPs inside
 * the first 60 s after `sent_at` are mail-gateway prefetches, not a person —
 * they are dropped before "opened" is decided.
 */

export type EstimateOpenEventLike = {
  event_type: string
  occurred_at: string
  client_ip?: string | null
}

export type EstimateOpenState = {
  opened: boolean
  /** Human-looking opens after the scanner filter (link views + option views). */
  openCount: number
  lastOpenedAt: string | null
  /** Whole days since the last open (0 = today); null when never opened. */
  quietDays: number | null
  level: SentWaitLevel
  label: string
}

const DAY_MS = 86_400_000
/** Views this soon after the send, from 2+ IPs, are scanners. */
const SCANNER_WINDOW_MS = 60_000
/** Amber after a week of silence — same threshold as computeSentWait. */
const QUIET_WARN_DAYS = 7

/** Events that mean a person was on the page. */
const OPEN_EVENT_TYPES = new Set(['public_link_view', 'option_viewed'])

/**
 * Drop the mail-gateway burst: `public_link_view` rows inside the first minute
 * after the send when they come from two or more distinct IPs. A single IP in
 * that window is a customer who clicked straight away and stays.
 */
export function filterScannerViews<T extends EstimateOpenEventLike>(events: T[], sentAt: string | null | undefined): T[] {
  const sentMs = sentAt ? Date.parse(sentAt) : NaN
  if (!Number.isFinite(sentMs)) return events
  const burst = events.filter((e) => {
    if (e.event_type !== 'public_link_view') return false
    const t = Date.parse(e.occurred_at)
    return Number.isFinite(t) && t >= sentMs && t - sentMs <= SCANNER_WINDOW_MS
  })
  const ips = new Set(burst.map((e) => (e.client_ip ?? '').trim()))
  if (ips.size < 2) return events
  const burstSet = new Set(burst)
  return events.filter((e) => !burstSet.has(e))
}

function weekdayShort(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short' })
}

function monthDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * The chip for a Sent row. `null` when the row has no usable `sent_at` (same
 * contract as `computeSentWait`, whose numbers this keeps).
 */
export function estimateOpenState(
  events: EstimateOpenEventLike[],
  row: { sent_at?: string | null; change_order_fields?: unknown },
  nowMs: number,
): EstimateOpenState | null {
  const wait = computeSentWait(row, nowMs)
  if (!wait) return null

  const opens = filterScannerViews(events, row.sent_at).filter((e) => OPEN_EVENT_TYPES.has(e.event_type))
  let lastMs = NaN
  for (const e of opens) {
    const t = Date.parse(e.occurred_at)
    if (Number.isFinite(t) && (!Number.isFinite(lastMs) || t > lastMs)) lastMs = t
  }

  if (!Number.isFinite(lastMs)) {
    return {
      opened: false,
      openCount: 0,
      lastOpenedAt: null,
      quietDays: null,
      level: wait.level,
      label: `never opened · ${wait.label}`,
    }
  }

  const quietDays = Math.max(0, Math.floor((nowMs - lastMs) / DAY_MS))
  const openedWord = quietDays === 0 ? 'opened today' : `opened ${quietDays < 7 ? weekdayShort(lastMs) : monthDay(lastMs)}`
  let level: SentWaitLevel = 'ok'
  let tail = ''
  if (wait.level === 'overdue') {
    level = 'overdue'
    tail = ` · ${wait.label}`
  } else if (quietDays >= QUIET_WARN_DAYS) {
    level = 'warn'
    tail = ` · quiet ${quietDays}d — nudge?`
  } else if (quietDays > 0) {
    tail = ` · quiet ${quietDays}d`
  }
  return {
    opened: true,
    openCount: opens.length,
    lastOpenedAt: new Date(lastMs).toISOString(),
    quietDays,
    level,
    label: `${openedWord}${tail}`,
  }
}

/** Group a flat events fetch by estimate id — the list loads all sent rows' events in one chunked query. */
export function groupEventsByEstimateId<T extends { estimate_id: string }>(events: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const e of events) {
    ;(out[e.estimate_id] ??= []).push(e)
  }
  return out
}
