/**
 * Quickfill "Close week" chip (journey-map Tier-2 #18, C3 / J7 stumble #8).
 *
 * Quickfill's marks are org-wide DAILY stamps ("checked today"); Moneyfill's
 * only "done" is a queue at zero for a specific Mon–Sun close week. The same
 * work lives on both hosts under two freshness systems that never saw each
 * other — Supply Houses could be marked green all week while the close still
 * showed two uncovered invoices for that week.
 *
 * This kernel puts the close's number ON the station, from the SAME counts
 * Moneyfill and the report use (`fetchWeekCloseCounts`). It is explicitly NOT
 * a second mark system: nothing here is written, the chip only reads.
 *
 * Roles: Moneyfill itself redirects everyone but dev / controller to the
 * dashboard, so only those two get a live chip that links there. Every other
 * station viewer (master, assistant) gets one inert line of copy that says
 * what the daily mark is and is not — never a link into a page that would
 * bounce them.
 */
import { formatCloseWeekLabel, moneyfillHref } from '../closeWeekAnchor'
import type { MoneyfillQueueCount, MoneyfillQueueKey } from '../moneyfillWeekClose'

/** Which Moneyfill queues each Quickfill station feeds. Stations not listed get no chip. */
export const CLOSE_WEEK_STATION_QUEUES: Readonly<Record<string, readonly MoneyfillQueueKey[]>> = {
  /** Banking sorting splits card charges to jobs; bank transfers are labeled from the same Mercury feed. */
  'banking-sorting': ['card-charges', 'bank-transfers'],
  /** People Hours approves the sessions Moneyfill's "Pending approval" queue counts (Sun–Sat pay week inside the close week). */
  'people-hours-new': ['pending-approval'],
  /** Unassigned field time IS the "Time w/o job" queue, at a 0.01 h threshold. */
  'unassigned-field-time': ['time-no-job'],
  /** Supply Houses invoices need job allocations covering the amount. */
  'supply-houses': ['supply-invoices'],
}

export function isCloseWeekStation(sectionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CLOSE_WEEK_STATION_QUEUES, sectionId)
}

/** Mirrors Moneyfill's route gate (`role !== 'dev' && role !== 'controller'` → redirect). */
export function canOpenMoneyfill(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}

export type CloseWeekChipModel =
  | {
      /** Non-money roles: one inert line, no link, no number. */
      kind: 'inert'
      text: string
      title: string
    }
  | {
      kind: 'loading' | 'unknown' | 'clear' | 'open'
      /** "Close week: $239 open" / "Close week: 3 open" / "Close week: clear" / "Close week: —". */
      text: string
      title: string
      /** `/moneyfill?week=<monday>` — opens the picker on the week the chip quotes. */
      href: string
      weekMonday: string
    }

export const CLOSE_WEEK_INERT_TEXT = 'Feeds the weekly close'
export const CLOSE_WEEK_INERT_TITLE =
  "Marking here is today's check, not the week's close. A controller closes each week on Moneyfill; this station is one of its queues."

function money(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/**
 * Sum the station's queues. `counts` null = still loading; a queue missing
 * from the registry or reporting `count: null` makes the chip "unknown"
 * (never a false "clear").
 */
export function closeWeekChipModel(
  sectionId: string,
  counts: MoneyfillQueueCount[] | null,
  weekMonday: string,
  role: string | null | undefined,
): CloseWeekChipModel | null {
  const keys = CLOSE_WEEK_STATION_QUEUES[sectionId]
  if (!keys) return null
  if (!canOpenMoneyfill(role)) {
    return { kind: 'inert', text: CLOSE_WEEK_INERT_TEXT, title: CLOSE_WEEK_INERT_TITLE }
  }
  const href = moneyfillHref(weekMonday)
  const weekText = formatCloseWeekLabel(weekMonday)
  const titleBase = `Week of ${weekText} — what this station still owes the weekly close. Today's mark is a daily check; the week closes on Moneyfill.`
  if (counts == null) {
    return { kind: 'loading', text: 'Close week: …', title: titleBase, href, weekMonday }
  }
  let count = 0
  let dollars = 0
  let anyDollars = false
  for (const key of keys) {
    const q = counts.find((c) => c.key === key)
    if (!q || q.count == null) {
      return { kind: 'unknown', text: 'Close week: —', title: `${titleBase} (Some of its counts could not load.)`, href, weekMonday }
    }
    count += q.count
    if (q.dollars != null) {
      anyDollars = true
      dollars += Math.abs(q.dollars)
    }
  }
  if (count === 0) {
    return { kind: 'clear', text: 'Close week: clear', title: titleBase, href, weekMonday }
  }
  const amount = anyDollars && dollars > 0 ? money(dollars) : `${count}`
  const detail = anyDollars && dollars > 0 ? ` (${count} item${count === 1 ? '' : 's'})` : ''
  return { kind: 'open', text: `Close week: ${amount} open`, title: `${titleBase}${detail}`, href, weekMonday }
}

/**
 * `ui_nav_clicks` row for `week_close_opened`: the target names the week so
 * Usage can count opens per close week (and per door — Moneyfill's report
 * button vs a station chip — via `from_path`).
 */
export const WEEK_CLOSE_OPENED_CONTROL = 'week_close_opened'

export function weekCloseOpenedTarget(door: 'moneyfill-report' | 'station-chip', weekMonday: string, sectionId?: string): string {
  return door === 'station-chip' ? `#${sectionId ?? 'station'} ${weekMonday}` : `report ${weekMonday}`
}
