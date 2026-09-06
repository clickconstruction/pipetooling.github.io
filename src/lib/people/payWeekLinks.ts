import { formatPayWeekLabel, previousCompletePayWeek, type PayWeek } from '../payWeekAnchor'

/**
 * Pay-week links (journey map Tier 5 X3 / J7-9).
 *
 * The pay week runs Hours → Draft Payroll → Tally, and nothing pointed across the two
 * seams: after approving hours nothing said "now draft payroll", and after generating
 * payroll nothing said "now mark the payroll transactions on Tally" — where "Mark
 * payroll" was dev-only besides. This kernel owns the two pointers and the widened gate.
 */

/** Who may mark a tally transaction as payroll: every payroll-access role (dev, controller,
 *  pay-approved master) — the DB side moved from `is_dev()` to `has_payroll_access()` in
 *  `20260906130000_tally_payroll_flag_payroll_access.sql`. Payroll RULES stay dev-only. */
export function canMarkTallyPayroll(input: { isDev: boolean; canAccessPay: boolean }): boolean {
  return input.isDev || input.canAccessPay
}

/** Where "Open Tally →" lands: the transactions view, where the payroll rows live. */
export const TALLY_PAYROLL_HREF = '/tally?tab=transactions'

export type HoursApprovedNudge = {
  /** Sessions approved since the chip last cleared; null when a surface could not count. */
  count: number | null
  /** The week Draft Payroll opens on (its default: the last complete Sun–Sat pay week). */
  week: PayWeek
}

/** Fold one more approval into the nudge (counts add; an uncounted approval keeps null). */
export function foldHoursApproved(prev: HoursApprovedNudge | null, approved: number | null, now: Date = new Date()): HoursApprovedNudge {
  const week = prev?.week ?? previousCompletePayWeek(now)
  if (approved === null) return { count: prev?.count ?? null, week }
  return { count: (prev?.count ?? 0) + approved, week }
}

/** The chip's copy: "6 sessions approved · Draft payroll for Aug 24 – 30 →". */
export function hoursApprovedChipCopy(nudge: HoursApprovedNudge): { lead: string; action: string } {
  const lead =
    nudge.count === null ? 'Hours approved' : `${nudge.count} session${nudge.count === 1 ? '' : 's'} approved`
  return { lead, action: `Draft payroll for ${formatPayWeekLabel(nudge.week)} →` }
}

/** After Generate on Draft Payroll: every person with hours has a report for the period. */
export function draftPayrollAllGenerated(input: { peopleCount: number; missingCount: number; stubsInPeriod: number }): boolean {
  return input.peopleCount > 0 && input.missingCount === 0 && input.stubsInPeriod > 0
}

export const DRAFT_PAYROLL_NEXT_TALLY_COPY =
  'Every report for this period is generated. Next: mark the payroll transactions on Tally so they resolve without touching job spend.'
