import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Salaried payroll day credit — the single source for "how many hours does a
 * salaried person get paid for on date D".
 *
 * Baseline is the app-wide flat rule (8 h Mon–Fri, 0 weekends). This kernel
 * layers the two payroll-only adjustments on top (2026-07-13 product decision):
 *   - UNPAID `user_time_off` weekdays pay 0; PAID time off keeps the 8 h
 *     (paid kind is salaried-only).
 *   - The employment window (`people.start_date` / `end_date`, inclusive)
 *     clamps the credit — no pay before the start date or after the end date.
 *
 * Cost/display surfaces (Hours grid, cost matrix, teamLabor, man-hours RPC)
 * intentionally still use the plain flat 8/0 rule.
 */

export type SalariedTimeOffRange = { start_date: string; end_date: string; kind: string }

export type SalariedPayrollWindow = {
  timeOff: SalariedTimeOffRange[]
  /** people.start_date — inclusive; null = no clamp. */
  employmentStart: string | null
  /** people.end_date — inclusive; null = still employed. */
  employmentEnd: string | null
}

export const EMPTY_SALARIED_PAYROLL_WINDOW: SalariedPayrollWindow = {
  timeOff: [],
  employmentStart: null,
  employmentEnd: null,
}

export type SalariedDayCreditReason =
  | 'workday'
  | 'weekend'
  | 'unpaid_time_off'
  | 'paid_time_off'
  | 'before_start'
  | 'after_end'

export type SalariedDayCredit = { hours: number; reason: SalariedDayCreditReason }

export function isWeekendYmd(ymd: string): boolean {
  const day = new Date(ymd + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

/** Unpaid wins over paid when ranges overlap (never pay on ambiguity). */
export function salariedDayCredit(ymd: string, w: SalariedPayrollWindow): SalariedDayCredit {
  if (isWeekendYmd(ymd)) return { hours: 0, reason: 'weekend' }
  if (w.employmentStart != null && ymd < w.employmentStart) return { hours: 0, reason: 'before_start' }
  if (w.employmentEnd != null && ymd > w.employmentEnd) return { hours: 0, reason: 'after_end' }
  const overlapping = w.timeOff.filter((r) => ymd >= r.start_date && ymd <= r.end_date)
  if (overlapping.some((r) => r.kind !== 'paid')) return { hours: 0, reason: 'unpaid_time_off' }
  if (overlapping.length > 0) return { hours: 8, reason: 'paid_time_off' }
  return { hours: 8, reason: 'workday' }
}

export function salariedHoursForDay(ymd: string, w: SalariedPayrollWindow): number {
  return salariedDayCredit(ymd, w).hours
}

/** Human label for a zero/paid day annotation on payroll drill-downs. */
export function salariedDayCreditReasonLabel(reason: SalariedDayCreditReason): string | null {
  switch (reason) {
    case 'unpaid_time_off':
      return 'unpaid time off'
    case 'paid_time_off':
      return 'paid time off'
    case 'before_start':
      return 'before employment start'
    case 'after_end':
      return 'after employment end'
    default:
      return null
  }
}

/**
 * Fetch each person's payroll window for a period: employment dates from the
 * roster row (trimmed-name match, non-archived row preferred) and time-off
 * ranges from `user_time_off` via the person's login user (trimmed-name match,
 * unique). People with no matching login user still get their employment
 * window; their time off is empty.
 */
export async function fetchSalariedPayrollWindows(
  supabase: SupabaseClient,
  personNames: string[],
  periodStart: string,
  periodEnd: string,
): Promise<Record<string, SalariedPayrollWindow>> {
  const names = [...new Set(personNames.map((n) => n.trim()).filter(Boolean))]
  const out: Record<string, SalariedPayrollWindow> = {}
  if (names.length === 0) return out
  for (const n of names) out[n] = { timeOff: [], employmentStart: null, employmentEnd: null }

  const [usersData, peopleData] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('users').select('id, name'), 'salaried payroll windows users'),
    withSupabaseRetry(
      async () => supabase.from('people').select('name, start_date, end_date, archived_at').in('name', names),
      'salaried payroll windows people',
    ),
  ])

  const peopleRows = (peopleData ?? []) as Array<{
    name: string
    start_date: string | null
    end_date: string | null
    archived_at: string | null
  }>
  for (const n of names) {
    const rows = peopleRows.filter((p) => p.name.trim() === n)
    const row = rows.find((p) => !p.archived_at) ?? rows[0]
    if (row) {
      out[n]!.employmentStart = row.start_date
      out[n]!.employmentEnd = row.end_date
    }
  }

  const userRows = (usersData ?? []) as Array<{ id: string; name: string | null }>
  const uidByName = new Map<string, string | null>()
  for (const n of names) {
    const matches = userRows.filter((u) => (u.name ?? '').trim() === n)
    uidByName.set(n, matches.length === 1 ? matches[0]!.id : null)
  }
  const uids = [...uidByName.values()].filter((v): v is string => v != null)
  if (uids.length === 0) return out

  const timeOffData = await withSupabaseRetry(
    async () =>
      supabase
        .from('user_time_off')
        .select('user_id, start_date, end_date, kind')
        .in('user_id', uids)
        .lte('start_date', periodEnd)
        .gte('end_date', periodStart),
    'salaried payroll windows time off',
  )
  const timeOffRows = (timeOffData ?? []) as Array<{ user_id: string; start_date: string; end_date: string; kind: string }>
  for (const n of names) {
    const uid = uidByName.get(n)
    if (!uid) continue
    out[n]!.timeOff = timeOffRows
      .filter((r) => r.user_id === uid)
      .map((r) => ({ start_date: r.start_date, end_date: r.end_date, kind: r.kind }))
  }
  return out
}
