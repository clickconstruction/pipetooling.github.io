/**
 * Pushed-back markers kernel (v2.2371, Tier A): derive the commitment story
 * from the checklist_item_due_changes ledger. The ORIGINAL due never moves —
 * it's the first date ever committed (the first row's from_due when the item
 * was dated before the ledger existed, else the first non-null to_due). A
 * task is "pushed back" only while its current due sits later than that
 * original; pulling a date earlier is recorded but never wears a marker,
 * and clearing the due date clears the markers (the abandonment lives in
 * the activity spine, not a permanent badge).
 */

export type DueChangeRow = {
  changed_at: string
  changed_by: string | null
  from_due: string | null
  to_due: string | null
}

export type DuePushSummary = {
  /** First date ever committed; null when the item has never had a due date. */
  originalDue: string | null
  /** Ledger rows that moved an existing due date later. */
  pushCount: number
  /** current − original in days; 0 when not pushed (never negative). */
  netSlipDays: number
  /** True while the current due is later than the original commitment. */
  pushedBack: boolean
}

function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = new Date(fromYmd + 'T00:00:00')
  const b = new Date(toYmd + 'T00:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function dayLabel(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  if (isNaN(d.getTime())) return ymd
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Rows must be chronological (the ledger index order: changed_at ascending). */
export function summarizeDuePushes(rows: ReadonlyArray<DueChangeRow>, currentDue: string | null): DuePushSummary {
  let originalDue: string | null = null
  for (const r of rows) {
    if (r.from_due) {
      originalDue = r.from_due
      break
    }
    if (r.to_due) {
      originalDue = r.to_due
      break
    }
  }
  // No ledger rows: the item's current due (set at creation) IS the original.
  if (originalDue == null) originalDue = currentDue
  const pushCount = rows.filter((r) => r.from_due != null && r.to_due != null && r.to_due > r.from_due).length
  const slip = originalDue != null && currentDue != null ? (daysBetween(originalDue, currentDue) ?? 0) : 0
  const pushedBack = currentDue != null && originalDue != null && slip > 0
  return { originalDue, pushCount, netSlipDays: pushedBack ? slip : 0, pushedBack }
}

/** Manage chip: "pushed ×2"; '' while not pushed back. */
export function pushedChipLabel(s: DuePushSummary): string {
  if (!s.pushedBack) return ''
  return `pushed ×${Math.max(s.pushCount, 1)}`
}

/** Edit-modal line: "Originally due Fri, Aug 29 — pushed ×2, +5 days so far."; '' while not pushed back. */
export function originallyDueLine(s: DuePushSummary): string {
  if (!s.pushedBack || s.originalDue == null) return ''
  const days = s.netSlipDays === 1 ? '+1 day' : `+${s.netSlipDays} days`
  return `Originally due ${dayLabel(s.originalDue)} — pushed ×${Math.max(s.pushCount, 1)}, ${days} so far.`
}

/** Escalation-message rider: " (pushed ×2, +5d)"; '' while not pushed back. */
export function pushedEscalationSuffix(s: DuePushSummary): string {
  if (!s.pushedBack) return ''
  return ` (pushed ×${Math.max(s.pushCount, 1)}, +${s.netSlipDays}d)`
}

/**
 * Activity-spine sentence for one ledger row (actor name prepended by the
 * renderer): "pushed the due date Fri, Aug 29 → Mon, Sep 1" / "moved the due
 * date up …" / "set the due date to …" / "removed the due date".
 */
export function dueChangeEntryText(row: DueChangeRow): string {
  if (row.from_due == null && row.to_due != null) return `set the due date to ${dayLabel(row.to_due)}`
  if (row.from_due != null && row.to_due == null) return `removed the due date (was ${dayLabel(row.from_due)})`
  if (row.from_due != null && row.to_due != null) {
    const arrow = `${dayLabel(row.from_due)} → ${dayLabel(row.to_due)}`
    return row.to_due > row.from_due ? `pushed the due date ${arrow}` : `moved the due date up ${arrow}`
  }
  return 'changed the due date'
}
