/**
 * One pay report for one person and one period (People spine PR 2, v2.3700).
 *
 * Lifted out of `People.tsx`'s `generatePayStub` closure so the Person desk's Leave flow can
 * generate the final report without the Payroll tab: the page keeps the preview (crew rows,
 * vehicles, offsets, the printable HTML) and calls `generatePayStubRecord` for the part that
 * decides money and writes rows. Same math as before, line for line:
 *
 *   - hourly: the day's `people_hours`, priced at the wage;
 *   - dual rate (opt-in, hourly only, needs one login user for the name): the day's approved clock
 *     sessions split office vs job hours and each bucket is priced (`officeJobRateSplit.ts`);
 *   - salaried: the flat 8 h weekday credit, less unpaid time off and outside the employment
 *     window (`salariedPayrollDays.ts`).
 *
 * `buildPayStubDayRows` is the pure part (tested); `generatePayStubRecord` does the reads and the
 * two inserts (`pay_stubs`, `pay_stub_days`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { ymdAddDays } from '../../utils/dateUtils'
import {
  buildDayRateSplitsForPeriod,
  shouldUseDualRate,
  summarizeRateSplits,
  type DayRateSplit,
  type RateSplitSessionRow,
  type RateSplitSummary,
} from '../officeJobRateSplit'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { EMPTY_SALARIED_PAYROLL_WINDOW, fetchSalariedPayrollWindows, salariedHoursForDay, type SalariedPayrollWindow } from '../salariedPayrollDays'

export type PayStubPayConfig = {
  hourly_wage?: number | null
  office_hourly_wage?: number | null
  is_salary?: boolean | null
  record_hours_but_salary?: boolean | null
}

export type PayStubDayRow = {
  work_date: string
  hours: number
  paid_amount: number
  rate_at_time: number
  office_hours: number | null
  office_rate: number | null
  job_hours: number | null
  job_rate: number | null
}

/** Every calendar day from `start` to `end` inclusive, as YYYY-MM-DD. */
export function payStubDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  if (!start || !end || start > end) return days
  for (let d = start; d <= end; d = ymdAddDays(d, 1)) days.push(d)
  return days
}

/** The pure part: one row per day of the period, priced. */
export function buildPayStubDayRows(args: {
  daysInRange: readonly string[]
  hoursByDate: ReadonlyMap<string, number>
  wage: number
  officeWage: number | null
  /** Set for a salaried person (flat credit); null for hourly. */
  salaryWindow: SalariedPayrollWindow | null
  /** Set when the dual-rate split ran; null otherwise. */
  splitByDate: ReadonlyMap<string, DayRateSplit> | null
}): PayStubDayRow[] {
  const rows: PayStubDayRow[] = []
  for (const d of args.daysInRange) {
    const hrs = args.salaryWindow ? salariedHoursForDay(d, args.salaryWindow) : (args.hoursByDate.get(d) ?? 0)
    const sp = args.splitByDate?.get(d) ?? null
    if (sp) {
      rows.push({
        work_date: d,
        hours: hrs,
        paid_amount: sp.paidAmount,
        rate_at_time: sp.blendedRate,
        office_hours: sp.officeHours,
        office_rate: args.officeWage,
        job_hours: sp.jobHours,
        job_rate: args.wage,
      })
    } else {
      rows.push({ work_date: d, hours: hrs, paid_amount: hrs * args.wage, rate_at_time: args.wage, office_hours: null, office_rate: null, job_hours: null, job_rate: null })
    }
  }
  return rows
}

export type PayStubTotals = { hoursTotal: number; grossPay: number }

export function payStubTotals(rows: readonly PayStubDayRow[]): PayStubTotals {
  return {
    hoursTotal: rows.reduce((s, r) => s + r.hours, 0),
    grossPay: rows.reduce((s, r) => s + r.paid_amount, 0),
  }
}

export type GeneratePayStubResult = {
  payStubId: string
  dayRows: PayStubDayRow[]
  hoursTotal: number
  grossPay: number
  rateSplitSummary: RateSplitSummary | null
  /** Things the caller may want to say (the page toasts them); never fatal. */
  warnings: string[]
}

/**
 * Read the period's hours (and sessions, and the salary window), price the days, insert the
 * `pay_stubs` row and its `pay_stub_days`. Throws with a plain message on a failed write.
 */
export async function generatePayStubRecord(
  supabase: SupabaseClient<Database>,
  args: {
    personName: string
    periodStart: string
    periodEnd: string
    payConfig: PayStubPayConfig | undefined
    /** The person's one login user, when the name resolves to exactly one — dual rate needs it. */
    userId: string | null
    createdBy: string
  },
): Promise<GeneratePayStubResult> {
  const personName = args.personName.trim()
  const { periodStart: start, periodEnd: end, payConfig: cfg } = args
  const warnings: string[] = []

  const { data: hoursData } = await supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end)
  const hoursByDate = new Map<string, number>()
  for (const r of (hoursData ?? []) as { work_date: string; hours: number }[]) hoursByDate.set(r.work_date, r.hours)

  const wage = cfg?.hourly_wage ?? 0
  const isSalary = cfg?.is_salary ?? false
  const officeWage = cfg?.office_hourly_wage ?? null
  const daysInRange = payStubDaysInRange(start, end)

  let splitByDate: Map<string, DayRateSplit> | null = null
  let rateSplitSummary: RateSplitSummary | null = null
  if (shouldUseDualRate(cfg) && officeWage != null) {
    if (args.userId) {
      const officeJobId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
      const { data: sessData } = await supabase
        .from('clock_sessions')
        .select('work_date, job_ledger_id, bid_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
        .eq('user_id', args.userId)
        .gte('work_date', start)
        .lte('work_date', end)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .not('approved_at', 'is', null)
      splitByDate = buildDayRateSplitsForPeriod({
        daysInRange,
        hoursByDate,
        sessions: (sessData ?? []) as RateSplitSessionRow[],
        officeJobLedgerId: officeJobId,
        officeWage,
        jobWage: wage,
      })
      rateSplitSummary = summarizeRateSplits(splitByDate.values(), officeWage, wage)
    } else {
      warnings.push('Office rate is set but no unique login user matches this name — paid at base rate.')
    }
  }

  const salaryWindow = isSalary ? ((await fetchSalariedPayrollWindows(supabase, [personName], start, end))[personName] ?? EMPTY_SALARIED_PAYROLL_WINDOW) : null

  const dayRows = buildPayStubDayRows({ daysInRange, hoursByDate, wage, officeWage, salaryWindow, splitByDate })
  const { hoursTotal, grossPay } = payStubTotals(dayRows)

  const { data: stubData, error: stubErr } = await supabase
    .from('pay_stubs')
    .insert({ person_name: personName, period_start: start, period_end: end, hours_total: hoursTotal, gross_pay: grossPay, created_by: args.createdBy })
    .select('id')
    .single()
  if (stubErr || !stubData) throw new Error(stubErr?.message ?? 'Failed to create pay report')
  const payStubId = stubData.id as string

  const { error: daysErr } = await supabase.from('pay_stub_days').insert(
    dayRows.map((r) => ({
      pay_stub_id: payStubId,
      person_name: personName,
      work_date: r.work_date,
      hours_at_time: r.hours,
      rate_at_time: r.rate_at_time,
      paid_amount: r.paid_amount,
      office_hours: r.office_hours,
      office_rate: r.office_rate,
      job_hours: r.job_hours,
      job_rate: r.job_rate,
    })),
  )
  if (daysErr) throw new Error(daysErr.message)

  return { payStubId, dayRows, hoursTotal, grossPay, rateSplitSummary, warnings }
}
