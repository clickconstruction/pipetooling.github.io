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
 */

export type DispatchBadgeRow = {
  id: string
  status: string | null
  /** v2.3247: open + 'high' rows are customers waiting — the badge turns urgent. */
  priority?: string | null
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
  /** Open rows at priority 'high' (Customer Waiting, v2.3247) — a subset of `open`. */
  high: number
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
  for (const r of rows) {
    if (r.status === 'open') {
      open++
      if (r.priority === 'high') high++
    } else if (r.status === 'closed' && !dismissedIds.has(r.id)) closed++
  }
  return { open, closed, high }
}

export const EMPTY_DISPATCH_BADGE_COUNTS: DispatchBadgeCounts = { open: 0, closed: 0, high: 0 }

export function addDispatchBadgeCounts(a: DispatchBadgeCounts, b: DispatchBadgeCounts): DispatchBadgeCounts {
  return { open: a.open + b.open, closed: a.closed + b.closed, high: a.high + b.high }
}

/** Screen-reader label for the badge — "N open", never "unread"; names the customers waiting when there are any. */
export function dispatchBadgeAriaLabel(open: number, high: number = 0): string {
  if (high > 0) return `${open} open · ${high} customer${high === 1 ? '' : 's'} waiting`
  return `${open} open`
}

/** `ui_nav_clicks.control` for the once-per-change badge telemetry. */
export const DISPATCH_BADGE_SHOWN_CONTROL = 'dispatch_badge_shown'

/** Pure: the `target` string — `#open=<n>&closed=<n>`, parseable by the Usage panel later. */
export function dispatchBadgeShownTarget(counts: DispatchBadgeCounts): string {
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
  return `#open=${clamp(counts.open)}&closed=${clamp(counts.closed)}`
}
