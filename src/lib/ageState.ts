/**
 * One age convention (journey-map Tier-2 #40 / cluster C60).
 *
 * Before this, every waiting list rendered age as gray text — a dispatch
 * request open 46 days looked exactly like one from this morning, HR reports
 * and one-offs sorted newest-first so the stalest item sank to the bottom, and
 * the field-approval queue ran an unbounded stopwatch ("Waiting 282:59:39").
 * The only escalation anywhere was `HOURS_APPROVALS_MIN_AGE_DAYS = 3`
 * (v2.2671), the Needs-You card's min-age gate for the hours queue.
 *
 * This module is that precedent generalised: every surface that shows a
 * waiting item gets the same three states — `fresh` (routine), `amber`
 * (aging), `red` (late) — at per-surface thresholds declared here as named
 * constants, one label shape ("3 days waiting"), one oldest-first comparator,
 * and one telemetry target for "someone opened an aging item".
 */

export type AgeState = 'fresh' | 'amber' | 'red'

export type AgeThresholds = {
  /** Whole days at which the item turns amber (inclusive). */
  amberDays: number
  /** Whole days at which the item turns red (inclusive). */
  redDays: number
}

// ─── Per-surface thresholds ────────────────────────────────────────────────
// The hours-approvals precedent (`HOURS_APPROVALS_MIN_AGE_DAYS = 3`) lives in
// `hooks/usePendingHoursApprovalsNudge.ts`; these sit beside it in spirit.

/** Open dispatch requests: a tech is blocked on an answer — three days is long. */
export const DISPATCH_REQUEST_AGE: AgeThresholds = { amberDays: 3, redDays: 7 }
/** HR field reports waiting to be filed on a person's record. */
export const HR_PENDING_REPORT_AGE: AgeThresholds = { amberDays: 3, redDays: 7 }
/** One-off checklist tasks — keeps the v2.2012 scale (week / month). */
export const ONE_OFF_TASK_AGE: AgeThresholds = { amberDays: 7, redDays: 31 }
/** Field "Collect Payment" waiting on office approval — same-day is the norm. */
export const FIELD_APPROVAL_WAIT_AGE: AgeThresholds = { amberDays: 1, redDays: 3 }

/** Needs-You min ages (the v2.2671 shape): the card only nags once the OLDEST item is this old. */
export const DISPATCH_REQUESTS_MIN_AGE_DAYS = 3
export const HR_REPORTS_MIN_AGE_DAYS = 3

const DAY_MS = 86_400_000

function nowMs(now: Date | number | undefined): number {
  if (now == null) return Date.now()
  return typeof now === 'number' ? now : now.getTime()
}

/** Whole days since `createdAt` (floor, never negative); null when missing/invalid. */
export function ageDays(createdAt: string | null | undefined, now?: Date | number): number | null {
  if (createdAt == null || createdAt === '') return null
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs(now) - t) / DAY_MS))
}

/** Whole calendar days from a `YYYY-MM-DD` to today's `YYYY-MM-DD` (floor, never negative); null when invalid. */
export function ymdAgeDays(ymd: string | null | undefined, todayYmd: string): number | null {
  if (!ymd || !todayYmd) return null
  const a = Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${todayYmd.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

export function ageStateForDays(days: number | null, thresholds: AgeThresholds): AgeState {
  if (days == null) return 'fresh'
  if (days >= thresholds.redDays) return 'red'
  if (days >= thresholds.amberDays) return 'amber'
  return 'fresh'
}

export function ageState(createdAt: string | null | undefined, now: Date | number | undefined, thresholds: AgeThresholds): AgeState {
  return ageStateForDays(ageDays(createdAt, now), thresholds)
}

/** "today" · "1 day waiting" · "12 days waiting" (noun swappable: "late", "open"). */
export function ageLabel(days: number, noun: string = 'waiting'): string {
  if (days <= 0) return 'today'
  return `${days} ${days === 1 ? 'day' : 'days'} ${noun}`
}

export type AgeDescription = { days: number; state: AgeState; label: string }

/** Everything a chip needs in one call; null when the timestamp is missing/invalid. */
export function describeAge(
  createdAt: string | null | undefined,
  now: Date | number | undefined,
  thresholds: AgeThresholds,
  noun: string = 'waiting',
): AgeDescription | null {
  const days = ageDays(createdAt, now)
  if (days == null) return null
  return { days, state: ageStateForDays(days, thresholds), label: ageLabel(days, noun) }
}

/**
 * Oldest-first comparator on ISO timestamps (lexicographic — ISO-8601 UTC
 * sorts as text). Missing timestamps sink to the end so an unstamped row can
 * never masquerade as the stalest.
 */
export function compareOldestFirst(a: string | null | undefined, b: string | null | undefined): number {
  const aa = a ?? ''
  const bb = b ?? ''
  if (aa === bb) return 0
  if (aa === '') return 1
  if (bb === '') return -1
  return aa < bb ? -1 : 1
}

// ─── Due dates (expected/planned end) ──────────────────────────────────────

export type DueDescription = { state: AgeState; daysLate: number; label: string }

/**
 * A planned window against today: past the end → red "N days late"; ending
 * today → amber "due today"; started but not ended and the start has slipped
 * past (nothing began) → amber "start N days past"; otherwise fresh with no
 * label. Pure on `YYYY-MM-DD` strings so the caller picks the calendar.
 */
export function dueState(
  endYmd: string | null | undefined,
  todayYmd: string,
  opts: { startYmd?: string | null; started?: boolean } = {},
): DueDescription {
  const end = endYmd ? endYmd.slice(0, 10) : ''
  if (end) {
    const late = ymdAgeDays(end, todayYmd) ?? 0
    if (end < todayYmd.slice(0, 10) && late > 0) return { state: 'red', daysLate: late, label: ageLabel(late, 'late') }
    if (end === todayYmd.slice(0, 10)) return { state: 'amber', daysLate: 0, label: 'due today' }
  }
  const start = opts.startYmd ? opts.startYmd.slice(0, 10) : ''
  if (start && !opts.started && start < todayYmd.slice(0, 10)) {
    const slipped = ymdAgeDays(start, todayYmd) ?? 0
    if (slipped > 0) return { state: 'amber', daysLate: 0, label: `start ${slipped} ${slipped === 1 ? 'day' : 'days'} past` }
  }
  return { state: 'fresh', daysLate: 0, label: '' }
}

// ─── Telemetry ─────────────────────────────────────────────────────────────

/** `ui_nav_clicks.control` for "someone opened an amber/red item". */
export const AGING_ITEM_OPENED_CONTROL = 'aging_item_opened'

export type AgingSurface =
  | 'dispatch-request'
  | 'hr-pending-report'
  | 'one-off-task'
  | 'workflow-expected-date'
  | 'field-approval'

/** Pure: `#surface=<s>&age_days=<n>&state=<amber|red>` — parseable by the Usage panel later. */
export function agingItemOpenedTarget(surface: AgingSurface, days: number, state: AgeState): string {
  const n = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0
  return `#surface=${surface}&age_days=${n}&state=${state}`
}

/** Only aging items are worth a row — fresh opens are the normal rhythm, not a signal. */
export function shouldRecordAgingOpen(state: AgeState): boolean {
  return state !== 'fresh'
}

// ─── Chip palette ──────────────────────────────────────────────────────────

/**
 * Inline-style palette per state — theme tokens for the neutrals, literal
 * status colours for the amber/red borders (CLAUDE.md: saturated status
 * colours stay literal). Matches the Checklist one-off chips (v2.2346/51).
 */
export function ageChipStyle(state: AgeState): { background: string; border: string; color: string } {
  if (state === 'red') return { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
  if (state === 'amber') return { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
  return { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }
}
