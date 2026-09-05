/**
 * Approve-surface chips (journey-map Tier-1 #15, J7-3 / J7-N2).
 *
 * The bulk-approve modal and the approvals queue sum raw session durations,
 * while payroll credits salaried people a flat 8/0 (`salariedEffectiveHours`)
 * and the 11:59 PM auto-cap (`auto_clock_out_open_sessions_eod`) turns a
 * forgotten clock-out into a full-length "session". The totals stay as they
 * are — the cost side already uses flat hours — but the rows say so:
 *
 *   salary — counts as flat hours      any is_salary person (either flavour)
 *   still clocked in at midnight       clocked_out_at is the EOD auto-cap
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { SalariedPayConfigFlags } from '../salariedEffectiveHours'

export const SALARY_FLAT_HOURS_CHIP = 'salary — counts as flat hours'
export const MIDNIGHT_CAPPED_CHIP = 'still clocked in at midnight'

export const SALARY_FLAT_HOURS_TITLE =
  'Salaried: payroll credits the flat salary hours for this day, not this session’s length. Approving records the session; it does not change what they are paid.'
export const MIDNIGHT_CAPPED_TITLE =
  'Nobody clocked out — the system closed this session at 11:59 PM. Check the real end time (Edit) before approving.'

/** True for anyone paid a salary — record_hours_but_salary people log hours that display, but cost stays flat. */
export function isSalaryFlatHoursPerson(cfg: SalariedPayConfigFlags | null | undefined): boolean {
  return cfg?.is_salary === true
}

const wallClockFmt = new Map<string, Intl.DateTimeFormat>()
function wallClockHm(iso: string, tz: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  let fmt = wallClockFmt.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    wallClockFmt.set(tz, fmt)
  }
  const parts = fmt.formatToParts(new Date(ms))
  const h = parts.find((p) => p.type === 'hour')?.value
  const m = parts.find((p) => p.type === 'minute')?.value
  if (!h || !m) return null
  return `${h}:${m}`
}

/**
 * The EOD cron sets `clocked_out_at` to the last microsecond of the work
 * date's Central day, so a capped session always reads 23:59 on the company
 * wall clock. A real 11:59 PM clock-out is indistinguishable and equally
 * worth a look.
 */
export function isMidnightCappedClockOut(clockedOutAt: string | null | undefined, tz: string = APP_CALENDAR_TZ): boolean {
  if (!clockedOutAt) return false
  return wallClockHm(clockedOutAt, tz) === '23:59'
}

export type ApprovalChip = { label: string; title: string }

/** Chips for one session row, in display order; empty when there is nothing to say. */
export function sessionApprovalChips(args: {
  payConfig: SalariedPayConfigFlags | null | undefined
  clockedOutAt: string | null | undefined
  tz?: string
}): ApprovalChip[] {
  const out: ApprovalChip[] = []
  if (isSalaryFlatHoursPerson(args.payConfig)) out.push({ label: SALARY_FLAT_HOURS_CHIP, title: SALARY_FLAT_HOURS_TITLE })
  if (isMidnightCappedClockOut(args.clockedOutAt, args.tz)) out.push({ label: MIDNIGHT_CAPPED_CHIP, title: MIDNIGHT_CAPPED_TITLE })
  return out
}

/** Chips for a person+day cell (the bulk modal row): salary once, midnight if ANY session in the cell was capped. */
export function cellApprovalChips(args: {
  payConfig: SalariedPayConfigFlags | null | undefined
  sessions: ReadonlyArray<{ clocked_out_at: string | null }>
  tz?: string
}): ApprovalChip[] {
  const out: ApprovalChip[] = []
  if (isSalaryFlatHoursPerson(args.payConfig)) out.push({ label: SALARY_FLAT_HOURS_CHIP, title: SALARY_FLAT_HOURS_TITLE })
  if (args.sessions.some((s) => isMidnightCappedClockOut(s.clocked_out_at, args.tz))) {
    out.push({ label: MIDNIGHT_CAPPED_CHIP, title: MIDNIGHT_CAPPED_TITLE })
  }
  return out
}
