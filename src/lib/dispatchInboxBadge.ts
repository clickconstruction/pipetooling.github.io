/**
 * Pure kernels for the Dispatch Mode footer's Inbox badge (journey-map Tier-2
 * #24, J19-F1/F6/N1).
 *
 * The badge used to be `dispatchRequests.length + estimatorRequests.length`,
 * and both arrays exclude only the *viewer's own* dismissals — so it counted
 * every closed row nobody had dismissed yet ("7 unread" = 3 open + 3 closed +
 * 1), and because `dispatch_request_dismissals` is per viewer, each closed row
 * had to be dismissed once per group member or it inflated five badges. Its
 * aria label said "unread" although nothing in the model is read/unread.
 *
 * The badge now counts OPEN rows only, independent of who dismissed what.
 * Dismissal keeps its one real job — hiding a closed row from *your* list —
 * and no longer has a side effect on the signal everyone shares.
 *
 * Since v2.6462 a stopped crew's stage check (`pending_action = 'stage_check'`) sits among the high rows, so the
 * badge pulses for it; its words count the crew apart (v2.6487), since nobody calls a stage check and "1 customer
 * waiting" sent the office looking for a customer.
 */
import { waitsOnTheBanner } from './customerWaiting'

export type DispatchBadgeRow = {
  id: string
  status: string | null
  /** v2.3247: open + 'high' rows are customers waiting — the badge turns urgent. */
  priority?: string | null
  /** v2.6462: a high row with `'stage_check'` here is a crew's, not a customer's. */
  pending_action?: string | null
}

export type DispatchBadgeCounts = {
  /** Open rows, regardless of any viewer's dismissals (open rows can't be dismissed anyway). */
  open: number
  /**
   * Closed rows this viewer has NOT dismissed — exactly what the old badge
   * over-counted. Recorded in telemetry so the size of the retired "dismiss
   * five times" ritual stays measurable; never shown.
   */
  closed: number
  /** Open rows at priority 'high' (Customer Waiting, v2.3247) — a subset of `open`; the pulse. */
  high: number
  /** The high rows that are a crew's stage check (v2.6462) — a subset of `high`; the words count them apart. */
  crew: number
}

/** The badge number: open rows only. */
export function dispatchBadgeCount(rows: ReadonlyArray<{ status: string | null }>): number {
  let n = 0
  for (const r of rows) if (r.status === 'open') n++
  return n
}

/**
 * Open + not-yet-dismissed-closed counts from the raw (undismissed) row list.
 * `dismissedIds` only affects `closed`; `open` ignores it by design.
 */
export function dispatchBadgeCounts(
  rows: ReadonlyArray<DispatchBadgeRow>,
  dismissedIds: ReadonlySet<string> = new Set(),
): DispatchBadgeCounts {
  let open = 0
  let closed = 0
  let high = 0
  let crew = 0
  for (const r of rows) {
    if (r.status === 'open') {
      open++
      if (r.priority === 'high') {
        high++
        if (!waitsOnTheBanner({ pending_action: r.pending_action ?? null })) crew++
      }
    } else if (r.status === 'closed' && !dismissedIds.has(r.id)) closed++
  }
  return { open, closed, high, crew }
}

export const EMPTY_DISPATCH_BADGE_COUNTS: DispatchBadgeCounts = { open: 0, closed: 0, high: 0, crew: 0 }

export function addDispatchBadgeCounts(a: DispatchBadgeCounts, b: DispatchBadgeCounts): DispatchBadgeCounts {
  return { open: a.open + b.open, closed: a.closed + b.closed, high: a.high + b.high, crew: a.crew + b.crew }
}

/**
 * Screen-reader label for the badge — "N open", never "unread"; names the customers waiting when there are any, and
 * since v2.6487 a crew's stage checks apart from them: "4 open · 2 customers waiting · 1 crew waiting".
 */
export function dispatchBadgeAriaLabel(open: number, high: number = 0, crew: number = 0): string {
  const crews = Math.min(Math.max(crew, 0), Math.max(high, 0))
  const customers = Math.max(high, 0) - crews
  const parts = [`${open} open`]
  if (customers > 0) parts.push(`${customers} customer${customers === 1 ? '' : 's'} waiting`)
  if (crews > 0) parts.push(`${crews} crew${crews === 1 ? '' : 's'} waiting`)
  return parts.join(' · ')
}

/** `ui_nav_clicks.control` for the once-per-change badge telemetry. */
export const DISPATCH_BADGE_SHOWN_CONTROL = 'dispatch_badge_shown'

/** Pure: the `target` string — `#open=<n>&closed=<n>`, parseable by the Usage panel later. */
export function dispatchBadgeShownTarget(counts: DispatchBadgeCounts): string {
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
  return `#open=${clamp(counts.open)}&closed=${clamp(counts.closed)}`
}
