import {
  SALARIED_DAY_MAX_HOURS,
  SALARIED_DEFAULT_WEEK,
  formatDayHours,
  salariedWeekHours,
  salariedWeekWords,
  salariedWeeklyPay,
  wageForWeeklyPay,
  type SalariedWeek,
} from '../salariedEffectiveHours'

/**
 * The Pay & schedule card's one form (the owner's mockup, 2026-11-18): how a person is paid, by the hour or a set
 * week, the week's days, the weekly pay, the clock tick and the employment dates, saved once.
 *
 * Pure. `draftFromFacts` opens the form from what is stored, `paySetupPlan` reads what was typed and answers either
 * the one field to fix or what the save writes, what it comes to and the line that says what changes.
 *
 * A set week stores the wage and the week, never the weekly amount: the amount typed is divided by the week's hours
 * to the cent, and the plan says what that wage really comes to, so a week that does not divide evenly is shown as
 * it will be paid.
 */

export type PayKind = 'hourly' | 'salaried'

/** What is stored for a person, as the card reads it. */
export type PaySetupFacts = {
  exists: boolean
  hourlyWage: number | null
  officeWage: number | null
  isSalary: boolean
  recordHoursButSalary: boolean
  week: SalariedWeek
  startDate: string | null
  endDate: string | null
}

/** What the form holds while it is open: text as typed. `week` is seven boxes, Sunday first. */
export type PaySetupDraft = {
  kind: PayKind
  hourlyWage: string
  officeWage: string
  week: string[]
  weeklyPay: string
  recordHours: boolean
  startDate: string
  endDate: string
}

export type PaySetupField = 'hourlyWage' | 'officeWage' | 'week' | 'weeklyPay' | 'dates'

/** The pay row the save upserts. The office wage is left as stored for a set week, where it prices nothing. */
export type PaySetupWrite = {
  hourly_wage: number | null
  office_hourly_wage: number | null
  is_salary: boolean
  record_hours_but_salary: boolean
  salaried_week_hours: number[]
}

export type PaySetupPlan =
  | { ok: false; field: PaySetupField; error: string }
  | {
      ok: true
      write: PaySetupWrite
      dates: { start: string | null; end: string | null }
      payChanged: boolean
      datesChanged: boolean
      /** Salaried turned on or off: the save runs the schedule's side step. */
      becameSalaried: boolean
      stoppedSalaried: boolean
      /** A set week: its hours, its wage and what that wage pays in a week. Null by the hour. */
      comesTo: { weekHours: number; wage: number; weeklyPay: number; mondayCost: number } | null
      /** *Was by the hour at $10.00. Now $300.00 a week, 6 h Mon to Fri.* or *No change.* */
      summary: string
      /** Lines the card shows above Save: what the change does beyond the row. */
      warnings: string[]
    }

/** The week's presets, as the card offers them. */
export const WEEK_PRESETS: ReadonlyArray<{ label: string; week: SalariedWeek }> = [
  { label: '8 h, five days', week: [0, 8, 8, 8, 8, 8, 0] },
  { label: '6 h, five days', week: [0, 6, 6, 6, 6, 6, 0] },
  { label: 'Four tens', week: [0, 10, 10, 10, 10, 0, 0] },
  { label: 'Short Friday', week: [0, 8, 8, 8, 8, 4, 0] },
]

export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function numText(n: number | null): string {
  return n == null ? '' : String(n)
}

/** Open the form from what is stored. A set week opens on the weekly pay its wage comes to. */
export function draftFromFacts(f: PaySetupFacts): PaySetupDraft {
  const week = f.week.length === 7 ? f.week : SALARIED_DEFAULT_WEEK
  return {
    kind: f.isSalary ? 'salaried' : 'hourly',
    hourlyWage: numText(f.hourlyWage),
    officeWage: numText(f.officeWage),
    week: week.map((h) => formatDayHours(h)),
    weeklyPay: f.isSalary && f.hourlyWage != null && f.hourlyWage > 0 ? String(salariedWeeklyPay(f.hourlyWage, week)) : '',
    recordHours: f.isSalary ? f.recordHoursButSalary : true,
    startDate: f.startDate ?? '',
    endDate: f.endDate ?? '',
  }
}

/** The seven boxes as hours: a blank box is a day off. Null with the reason when a box cannot be read. */
export function parseWeekBoxes(boxes: readonly string[]): { week: number[] } | { error: string } {
  if (boxes.length !== 7) return { error: 'The week needs seven days' }
  const week: number[] = []
  for (const raw of boxes) {
    const t = raw.trim()
    if (t === '') {
      week.push(0)
      continue
    }
    const h = Number(t)
    if (!Number.isFinite(h) || h < 0) return { error: 'A day’s hours must be a number, 0 or more' }
    if (h > SALARIED_DAY_MAX_HOURS) return { error: `A day holds at most ${SALARIED_DAY_MAX_HOURS} hours` }
    if (Math.round(h * 4) !== h * 4) return { error: 'A day’s hours go by the quarter hour' }
    week.push(h)
  }
  return { week }
}

/** A typed amount: blank is null, anything else must be a number, 0 or more. */
function parseAmount(raw: string): { value: number | null } | { error: true } {
  const t = raw.trim()
  if (t === '') return { value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return { error: true }
  return { value: Math.round(n * 100) / 100 }
}

function sameWeek(a: SalariedWeek, b: SalariedWeek): boolean {
  return a.length === b.length && a.every((h, i) => h === b[i])
}

/** How a person is paid, in a few words: *by the hour at $10.00*, *$300.00 a week, 6 h Mon to Fri*, *no pay setup*. */
export function payWords(f: { exists: boolean; isSalary: boolean; hourlyWage: number | null; week: SalariedWeek }): string {
  if (!f.exists) return 'no pay setup'
  if (f.isSalary) {
    if (f.hourlyWage == null || !(f.hourlyWage > 0)) return `a set week with no pay, ${salariedWeekWords(f.week)}`
    return `${money(salariedWeeklyPay(f.hourlyWage, f.week))} a week, ${salariedWeekWords(f.week)}`
  }
  return f.hourlyWage != null ? `by the hour at ${money(f.hourlyWage)}` : 'by the hour with no wage'
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The pay weeks since a person's last pay report that have no report, counted whole: what payroll catch-up would
 * show as owed for a set week with no start date. 0 with no report on file, where there is nothing to count from.
 */
export function wholeWeeksSince(lastReportEndYmd: string | null, todayYmd: string): number {
  if (!lastReportEndYmd) return 0
  const days = Math.floor((Date.parse(todayYmd + 'T12:00:00Z') - Date.parse(lastReportEndYmd + 'T12:00:00Z')) / 86_400_000)
  return days > 0 ? Math.floor(days / 7) : 0
}

export function paySetupPlan(facts: PaySetupFacts, draft: PaySetupDraft, ctx: { todayYmd: string; lastReportEndYmd: string | null }): PaySetupPlan {
  const start = draft.startDate || null
  const end = draft.endDate || null
  if (start && end && end < start) return { ok: false, field: 'dates', error: 'The end date must be on or after the start date' }

  let write: PaySetupWrite
  let comesTo: { weekHours: number; wage: number; weeklyPay: number; mondayCost: number } | null = null

  if (draft.kind === 'salaried') {
    const parsed = parseWeekBoxes(draft.week)
    if ('error' in parsed) return { ok: false, field: 'week', error: parsed.error }
    const weekHours = salariedWeekHours(parsed.week)
    if (!(weekHours > 0)) return { ok: false, field: 'week', error: 'Give at least one day its hours' }
    const pay = parseAmount(draft.weeklyPay)
    if ('error' in pay || pay.value == null || !(pay.value > 0)) return { ok: false, field: 'weeklyPay', error: 'Enter the weekly pay' }
    const wage = wageForWeeklyPay(pay.value, parsed.week)
    if (wage == null || !(wage > 0)) return { ok: false, field: 'weeklyPay', error: 'That weekly pay comes to less than a cent an hour' }
    write = { hourly_wage: wage, office_hourly_wage: facts.officeWage, is_salary: true, record_hours_but_salary: draft.recordHours, salaried_week_hours: parsed.week }
    comesTo = { weekHours, wage, weeklyPay: salariedWeeklyPay(wage, parsed.week), mondayCost: Math.round(wage * (parsed.week[1] ?? 0) * 100) / 100 }
  } else {
    const wage = parseAmount(draft.hourlyWage)
    if ('error' in wage) return { ok: false, field: 'hourlyWage', error: 'The wage must be a number, 0 or more' }
    const office = parseAmount(draft.officeWage)
    if ('error' in office) return { ok: false, field: 'officeWage', error: 'The office wage must be a number, 0 or more' }
    // The week is kept as stored: it means nothing by the hour, and it is there if the person goes back to a set week.
    write = { hourly_wage: wage.value, office_hourly_wage: office.value, is_salary: false, record_hours_but_salary: facts.recordHoursButSalary, salaried_week_hours: [...facts.week] }
  }

  const payChanged =
    !facts.exists ||
    write.hourly_wage !== facts.hourlyWage ||
    write.office_hourly_wage !== facts.officeWage ||
    write.is_salary !== facts.isSalary ||
    write.record_hours_but_salary !== facts.recordHoursButSalary ||
    !sameWeek(write.salaried_week_hours, facts.week)
  const datesChanged = start !== (facts.startDate ?? null) || end !== (facts.endDate ?? null)

  const was = payWords(facts)
  const now = payWords({ exists: true, isSalary: write.is_salary, hourlyWage: write.hourly_wage, week: write.salaried_week_hours })
  const moneyChanged = was !== now
  const parts: string[] = []
  if (moneyChanged) parts.push(`Was ${was}. Now ${now}.`)
  if (datesChanged) parts.push(start ? `Employment from ${start}${end ? ` to ${end}` : ''}.` : end ? `Employment to ${end}.` : 'No employment dates.')
  if (!moneyChanged && payChanged && write.is_salary && write.record_hours_but_salary !== facts.recordHoursButSalary) {
    parts.push(write.record_hours_but_salary ? 'Still clocks in and out.' : 'No longer clocks in and out.')
  }
  const summary = parts.length ? parts.join(' ') : 'No change.'

  const warnings: string[] = []
  if (comesTo) {
    const typed = Number(draft.weeklyPay)
    if (Number.isFinite(typed) && Math.abs(comesTo.weeklyPay - typed) >= 0.005) {
      warnings.push(`${money(comesTo.wage)} an hour over ${formatDayHours(comesTo.weekHours)} hours comes to ${money(comesTo.weeklyPay)} a week, not ${money(typed)}. A wage is kept to the cent.`)
    }
    if (!start) {
      const weeks = wholeWeeksSince(ctx.lastReportEndYmd, ctx.todayYmd)
      warnings.push(
        weeks > 0
          ? `No start date. Payroll will show ${weeks} earlier week${weeks === 1 ? '' : 's'} with no pay report as owed. Set the day the set week starts.`
          : 'No start date. Payroll will pay every week it is asked for. Set the day the set week starts.',
      )
    }
  }
  if (moneyChanged && facts.exists) warnings.push('Past days on jobs are priced again at the new setup. Pay reports already made keep their amounts.')

  return {
    ok: true,
    write,
    dates: { start, end },
    payChanged,
    datesChanged,
    becameSalaried: write.is_salary && !facts.isSalary,
    stoppedSalaried: !write.is_salary && facts.isSalary,
    comesTo,
    summary: capital(summary),
    warnings,
  }
}
