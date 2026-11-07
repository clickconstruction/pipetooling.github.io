/**
 * The signed hours statement (punch list #212, 2026-10-29): one worker's recorded hours on one job at one site for a
 * period, what the company paid for those weeks, the span the app never recorded said plainly, and the words the worker
 * signs under. The owner's calls of 2026-10-29, all taken as recommended: the paper carries the pay with a switch to leave
 * it off; an unpaid week prints as not yet paid and the attestation drops "paid as shown"; the office job is a job; a
 * period with no rows gets a block the worker fills in, marked stated; and nothing on the paper says how a row was
 * recorded (a punch, a typed day, a quick add, a sheet line) — the app keeps that and the window shows it.
 *
 * No imports, so the app's window (`src/lib/people/hoursStatement.ts` re-exports it) and the dev MCP's verb read one
 * kernel. Days are `YYYY-MM-DD` in the app's calendar; the caller formats a punch's wall-clock times into `inLabel` /
 * `outLabel`, since the kernel knows no time zone. Money is in dollars, rounded to the cent; hours to a hundredth.
 */

/** Where the rows come from: punches and typed days on the clock, a sub's sheet lines, or a salaried schedule. */
export type HoursStatementKind = 'clock' | 'sheet' | 'schedule'

/** The paper's basis (punch list #251): `paid` prices the days at the wage and carries the pay reports; `charged` prices every counted hour at the rate the customer is charged and carries no pay. */
export type HoursStatementBasis = 'paid' | 'charged'

export type HoursStatementRow = {
  /** `YYYY-MM-DD` in the app's calendar. */
  day: string
  hours: number
  /** What they were working on: the punch's note, or the sheet line's fixture words. */
  note: string
  inLabel?: string | null
  outLabel?: string | null
  /** Waiting for approval: named under its day, never counted. */
  pending?: boolean
  /** A sheet line's own rate and amount; a clock row's come from `dayRates`. */
  rate?: number | null
  amount?: number | null
  /** On the charged basis, this row's own rate: a crew-day priced by the rate card (punch list #254). Missing: the paper's one `chargeRate`. */
  chargeRate?: number | null
  /** The sheet kind groups rows by sheet; a clock row with no group lands in its company week. */
  group?: { key: string; label: string }
}

export type HoursStatementPayment = {
  /** `YYYY-MM-DD`. */
  on: string
  amount: number
  memo: string | null
  /** `cashapp` · `mercury` · `apple_pay` · `client_direct` · `other`, as `pay_stub_payments.source_kind`. */
  sourceKind: string | null
  sourceId: string | null
}

/** A pay report's week (every job that week) or a sub's sheet, with what was paid against it. */
export type HoursStatementPayGroup = {
  key: string
  /** `Week of June 1` or `Sheet 1042-A · agreed May 4`. */
  label: string
  from: string
  to: string
  /** The week's net pay, or the sheet's agreed total; null when there is no pay report for the week yet. */
  due: number | null
  payments: HoursStatementPayment[]
}

export type HoursStatementStatedDay = {
  day: string
  hours: number | null
  note: string
  /** `Worker, 2026-10-30` — who stated it and when; empty on a blank row to fill by hand. */
  statedBy: string
}

export type HoursStatementInput = {
  kind: HoursStatementKind
  periodStart: string
  periodEnd: string
  rows: HoursStatementRow[]
  /** The rate, the amount and what was paid; off, the paper carries hours alone. */
  withPay: boolean
  /** Missing = `paid`. On `charged`, `withPay` is ignored and the days are priced at `chargeRate`. */
  basis?: HoursStatementBasis
  /** Dollars an hour the customer is charged (the job's own rate, else the company's), on the charged basis. */
  chargeRate?: number | null
  /** On the charged basis with the rows priced one by one (crew-days, punch list #254): how, for the words under the signature, e.g. `master with a helper throughout · $285.00 the crew’s hour`. */
  chargeWords?: string | null
  /** `YYYY-MM-DD` → the rate on the pay report for that day (`pay_stub_days.rate_at_time`, or the job or office rate). */
  dayRates?: Record<string, number>
  /** The person's current wage, for a day no pay report has snapshotted yet. */
  fallbackRate?: number | null
  payGroups?: HoursStatementPayGroup[]
  /** The first day any hours row exists in the app (`2026-03-12` on the live data); before it the paper is a gap. */
  firstRecordedDay?: string | null
  statedDays?: HoursStatementStatedDay[]
  /** The block the worker fills in, even when the period is inside the recorded span. */
  addStatedBlock?: boolean
  isOfficeJob?: boolean
  worker: { name: string; company?: string | null }
}

export type HoursStatementDay =
  | { pending: false; day: string; dayLabel: string; inLabel: string | null; outLabel: string | null; hours: number; note: string; rate: number | null; amount: number | null }
  | { pending: true; day: string; dayLabel: string; hours: number; words: string }

export type HoursStatementGroup = { key: string; label: string; days: HoursStatementDay[]; hours: number; amount: number | null }

export type HoursStatementPayState = 'paid' | 'partial' | 'unpaid' | 'no_report'

export type HoursStatementPayLine = {
  key: string
  label: string
  /** The first day the line covers; the lines print in this order. */
  from: string
  /** The hours above in this group's span at the rate on the pay report; null with the pay off or no rate at all. */
  jobShare: number | null
  due: number | null
  paid: number
  state: HoursStatementPayState
  /** The whole line as the paper prints it. */
  words: string
  payments: Array<{ on: string; amount: number; words: string }>
  rateSource: 'report' | 'current' | 'none'
}

export type HoursStatementChargedLine = { key: string; label: string; from: string; hours: number; amount: number | null; words: string }

export type HoursStatement = {
  kind: HoursStatementKind
  basis: HoursStatementBasis
  periodStart: string
  periodEnd: string
  periodLabel: string
  withPay: boolean
  groups: HoursStatementGroup[]
  totals: { hours: number; days: number; pendingCount: number; amount: number | null; label: string; daysWords: string }
  pay: { lines: HoursStatementPayLine[]; note: string; allPaid: boolean } | null
  /** The charged basis: one line per week or sheet, the hours at the rate, and the total; null on the paid basis. */
  charged: { rate: number | null; rateWords: string; lines: HoursStatementChargedLine[]; total: number | null; totalWords: string; note: string; leftOut: string[] } | null
  /** The company's own line under the signature: the records, and on the charged basis the rate. The print adds who prepared it. */
  preparedWords: string
  gap: { from: string; to: string; heading: string; words: string } | null
  stated: { rows: HoursStatementStatedDay[]; heading: string; words: string } | null
  attestation: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parts(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? '').trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** `ymd` moved by `n` days, on the calendar alone (no time zone: a day is a day). */
export function hoursStatementYmdAddDays(ymd: string, n: number): string {
  const p = parts(ymd)
  if (!p) return ymd
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

/** The Sunday that starts the company week holding `ymd`. */
export function hoursStatementWeekStart(ymd: string): string {
  const p = parts(ymd)
  if (!p) return ymd
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return hoursStatementYmdAddDays(ymd, -dow)
}

/** `June 1, 2026`. */
export function hoursStatementLongDate(ymd: string): string {
  const p = parts(ymd)
  if (!p) return ymd
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`
}

/** `Mon Jun 1`. */
export function hoursStatementDayLabel(ymd: string): string {
  const p = parts(ymd)
  if (!p) return ymd
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return `${WEEKDAYS_SHORT[dow]} ${MONTHS_SHORT[p.m - 1]} ${p.d}`
}

/** `Week of June 1`: the company week's label, the year left off. */
export function hoursStatementWeekLabel(weekStartYmd: string): string {
  return `Week of ${hoursStatementLongDate(weekStartYmd).replace(/, \d{4}$/, '')}`
}

/** `June 1 – June 28, 2026`, or `September 15, 2025 – March 11, 2026` across a year. */
export function hoursStatementPeriodLabel(from: string, to: string): string {
  const a = parts(from)
  const b = parts(to)
  if (!a || !b) return `${from} – ${to}`
  if (a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`
  return `${hoursStatementLongDate(from)} – ${hoursStatementLongDate(to)}`
}

export function hoursStatementRoundHours(h: number): number {
  return Math.round(h * 100) / 100
}

function cents(n: number): number {
  return Math.round(n * 100) / 100
}

/** `$1,234.50`. */
export function hoursStatementMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(cents(n))
  const whole = Math.floor(v)
  const frac = Math.round((v - whole) * 100)
  const digits = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}$${digits}.${pad2(frac)}`
}

/** `8.5`, `0.25`, `8`: hours as the paper prints them. */
export function hoursStatementHours(h: number): string {
  const r = hoursStatementRoundHours(h)
  return Number.isInteger(r) ? String(r) : String(r).replace(/0+$/, '')
}

/** The payment's reference as the paper prints it: the memo when there is one, else the source's own words. */
export function hoursStatementReference(p: HoursStatementPayment): string {
  const memo = (p.memo ?? '').trim()
  if (memo) return memo
  switch (p.sourceKind) {
    case 'cashapp':
      return p.sourceId ? `Cash App #${p.sourceId}` : 'Cash App'
    case 'mercury':
      return 'bank transfer'
    case 'apple_pay':
      return 'Apple Pay'
    case 'client_direct':
      return 'paid by the customer directly'
    default:
      return ''
  }
}

function paymentWords(p: HoursStatementPayment): string {
  const ref = hoursStatementReference(p)
  return `${hoursStatementMoney(p.amount)} on ${hoursStatementLongDate(p.on)}${ref ? ` · ${ref}` : ''}`
}

function totalsLabel(kind: HoursStatementKind, isOfficeJob: boolean): string {
  if (kind === 'sheet') return 'On the sheets, this job'
  if (kind === 'schedule') return isOfficeJob ? 'On the schedule, the Office job' : 'On the schedule, this job'
  return isOfficeJob ? 'Recorded in the app, the Office job' : 'Recorded in the app, this job'
}

function payNote(kind: HoursStatementKind): string {
  if (kind === 'sheet') return 'A sub’s payment is recorded against the sheet, so it is the job’s alone. The app keeps the amount, the day and the memo; the method is whatever the memo says.'
  if (kind === 'schedule') return 'A salaried person’s pay is the salary, so the weeks below show what was paid and no share for this job.'
  return 'A week’s pay covers every job that week. The share for this job is the hours above at the rate on the pay report.'
}

/** The standing the paper prints after the worker's name, from the login's role (since v2.6414 here, so the dev MCP's read names it the same way). */
export function hoursStatementStanding(role: string, salaried: boolean): string {
  const words: Record<string, string> = {
    helpers: 'helper',
    master_technician: 'master plumber',
    subcontractor: 'subcontractor',
    assistant: 'assistant',
    controller: 'controller',
    estimator: 'estimator',
    dev: 'developer',
    primary: 'primary',
    superintendent: 'superintendent',
  }
  const w = words[role] ?? 'employee'
  return salaried ? `${w}, salaried` : w
}

/** The gap: the part of the period before the app's first row, or null when the app recorded the whole period. */
export function hoursStatementGap(periodStart: string, periodEnd: string, firstRecordedDay: string | null | undefined): { from: string; to: string } | null {
  if (!firstRecordedDay || !parts(firstRecordedDay) || !parts(periodStart) || !parts(periodEnd)) return null
  if (periodStart >= firstRecordedDay) return null
  const to = periodEnd < firstRecordedDay ? periodEnd : hoursStatementYmdAddDays(firstRecordedDay, -1)
  return { from: periodStart, to }
}

/** The words the worker signs under, by kind, by the pay switch, and by whether every week read paid. */
export function hoursStatementAttestation(input: { kind: HoursStatementKind; withPay: boolean; allPaid: boolean; hasStated: boolean; worker: { name: string; company?: string | null } }): string {
  const { kind, withPay, allPaid, hasStated, worker } = input
  const stated = hasStated ? ', that the days marked stated are true to the best of my memory' : ''
  const paid = withPay && allPaid ? ', and that I was paid for this work as shown' : ''
  const rely = ' I understand the company may rely on this statement and give it to its attorney or a court.'
  if (kind === 'sheet') {
    const company = (worker.company ?? '').trim()
    const forCompany = company ? `, for ${company},` : ','
    const we = withPay && allPaid ? ', and that we were paid for it as shown' : ''
    return `I, ${worker.name}${forCompany} state that we did the work above on this job at this site in the periods shown${stated}${we}.${rely}`
  }
  if (kind === 'schedule') {
    return `I, ${worker.name}, state that I worked on the days shown above on this job at this site${stated}${paid}.${rely}`
  }
  return `I, ${worker.name}, state that I worked the hours shown above on this job at this site${stated}${paid}.${rely}`
}

/** Build the statement from the rows as read. Pure. */
export function buildHoursStatement(input: HoursStatementInput): HoursStatement {
  const { kind, periodStart, periodEnd } = input
  const basis: HoursStatementBasis = input.basis === 'charged' ? 'charged' : 'paid'
  const chargeRate = basis === 'charged' && typeof input.chargeRate === 'number' && input.chargeRate > 0 ? cents(input.chargeRate) : null
  // The charged paper carries no pay: the switch is ignored and every counted hour is priced at the charge rate.
  const withPay = basis === 'charged' ? false : input.withPay
  const rowRated = basis === 'charged' && input.rows.some((r) => typeof r.chargeRate === 'number' && r.chargeRate > 0)
  const priced = basis === 'charged' ? chargeRate != null || rowRated : withPay
  const leftOut: string[] = []
  const isOfficeJob = input.isOfficeJob === true
  const dayRates = input.dayRates ?? {}
  const fallbackRate = typeof input.fallbackRate === 'number' && input.fallbackRate > 0 ? input.fallbackRate : null
  const inPeriod = (d: string) => d >= periodStart && d <= periodEnd
  const rows = input.rows.filter((r) => parts(r.day) && inPeriod(r.day)).slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.inLabel ?? '') < (b.inLabel ?? '') ? -1 : 0))

  const groupMap = new Map<string, HoursStatementGroup>()
  const groupOrder: string[] = []
  let rateUsedCurrent = false
  let rateMissing = false
  for (const r of rows) {
    const g = r.group ?? { key: hoursStatementWeekStart(r.day), label: hoursStatementWeekLabel(hoursStatementWeekStart(r.day)) }
    // A sub's flat line has no hours to price on the charged basis: it is named, not counted.
    if (basis === 'charged' && kind === 'sheet' && !r.pending && hoursStatementRoundHours(r.hours) <= 0) {
      leftOut.push(`${g.label}: ${(r.note ?? '').trim() || 'a line'} is a flat line with no hours, left off`)
      continue
    }
    let group = groupMap.get(g.key)
    if (!group) {
      group = { key: g.key, label: g.label, days: [], hours: 0, amount: priced ? 0 : null }
      groupMap.set(g.key, group)
      groupOrder.push(g.key)
    }
    const hours = hoursStatementRoundHours(r.hours)
    if (r.pending) {
      group.days.push({ pending: true, day: r.day, dayLabel: hoursStatementDayLabel(r.day), hours, words: `1 session of ${hoursStatementHours(hours)} h waiting for approval · not counted` })
      continue
    }
    let rate: number | null = null
    let amount: number | null = null
    if (basis === 'charged') {
      // A row may carry its own rate (a crew-day priced by the rate card, punch list #254); else the paper's one rate.
      const rowRate = typeof r.chargeRate === 'number' && r.chargeRate > 0 ? cents(r.chargeRate) : chargeRate
      if (rowRate != null) {
        rate = rowRate
        amount = cents(hours * rowRate)
      }
    } else if (withPay && kind !== 'schedule') {
      if (typeof r.rate === 'number' && r.rate > 0) rate = r.rate
      else if (typeof dayRates[r.day] === 'number' && (dayRates[r.day] ?? 0) > 0) rate = dayRates[r.day] ?? null
      else if (fallbackRate != null) {
        rate = fallbackRate
        rateUsedCurrent = true
      } else rateMissing = true
      if (typeof r.amount === 'number') amount = cents(r.amount)
      else if (rate != null) amount = cents(hours * rate)
    }
    group.days.push({ pending: false, day: r.day, dayLabel: hoursStatementDayLabel(r.day), inLabel: r.inLabel ?? null, outLabel: r.outLabel ?? null, hours, note: (r.note ?? '').trim(), rate, amount })
    group.hours = hoursStatementRoundHours(group.hours + hours)
    if (group.amount != null) group.amount = amount == null ? group.amount : cents(group.amount + amount)
  }
  const groups = groupOrder.map((k) => groupMap.get(k) as HoursStatementGroup)

  const countedDays = new Set<string>()
  let pendingCount = 0
  let totalHours = 0
  let totalAmount = 0
  let anyAmount = false
  for (const g of groups) {
    for (const d of g.days) {
      if (d.pending) {
        pendingCount += 1
        continue
      }
      countedDays.add(d.day)
      totalHours = hoursStatementRoundHours(totalHours + d.hours)
      if (d.amount != null) {
        anyAmount = true
        totalAmount = cents(totalAmount + d.amount)
      }
    }
  }
  const daysWords = `${countedDays.size} ${countedDays.size === 1 ? 'day' : 'days'}${pendingCount > 0 ? ` · ${pendingCount} waiting for approval, not counted` : ''}`
  const totals = { hours: totalHours, days: countedDays.size, pendingCount, amount: priced && anyAmount ? totalAmount : null, label: totalsLabel(kind, isOfficeJob), daysWords }

  let pay: HoursStatement['pay'] = null
  if (withPay) {
    const lines: HoursStatementPayLine[] = []
    const payGroups = (input.payGroups ?? []).filter((pg) => pg.to >= periodStart && pg.from <= periodEnd).slice().sort((a, b) => (a.from < b.from ? -1 : 1))
    for (const pg of payGroups) {
      let share: number | null = null
      let shareHours = 0
      for (const g of groups) {
        for (const d of g.days) {
          if (d.pending || d.day < pg.from || d.day > pg.to) continue
          shareHours += d.hours
          if (d.amount != null) share = cents((share ?? 0) + d.amount)
        }
      }
      if (kind === 'schedule') share = null
      const paid = cents(pg.payments.reduce((s, p) => s + p.amount, 0))
      const due = pg.due == null ? null : cents(pg.due)
      const state: HoursStatementPayState = due == null ? 'no_report' : paid <= 0 ? 'unpaid' : paid + 0.005 >= due ? 'paid' : 'partial'
      const payments = pg.payments.slice().sort((a, b) => (a.on < b.on ? -1 : 1)).map((p) => ({ on: p.on, amount: cents(p.amount), words: paymentWords(p) }))
      const shareWords = kind === 'sheet' ? (due != null ? hoursStatementMoney(due) : share != null ? hoursStatementMoney(share) : '') : share != null && due != null ? `${hoursStatementMoney(share)} earned on this job of ${hoursStatementMoney(due)} for the week` : share != null ? `${hoursStatementMoney(share)} earned on this job` : shareHours > 0 ? `${hoursStatementHours(shareHours)} h on this job` : ''
      let paidWords: string
      if (state === 'no_report') paidWords = kind === 'sheet' ? 'nothing agreed on the sheet yet' : 'no pay report for this week yet'
      else if (state === 'unpaid') paidWords = 'not yet paid'
      else if (state === 'paid') paidWords = payments.length === 1 ? `paid in full ${payments[0]?.words ?? ''}` : `paid in full: ${payments.map((p) => p.words).join(', ')}`
      else paidWords = `paid ${hoursStatementMoney(paid)} of ${hoursStatementMoney(due ?? 0)}: ${payments.map((p) => p.words).join(', ')}`
      const words = [pg.label, shareWords, paidWords].filter((w) => w).join(' · ')
      lines.push({ key: pg.key, label: pg.label, from: pg.from, jobShare: share, due, paid, state, words, payments, rateSource: rateMissing ? 'none' : rateUsedCurrent ? 'current' : 'report' })
    }
    const weeksTouched = new Set<string>()
    for (const g of groups) for (const d of g.days) if (!d.pending) weeksTouched.add(hoursStatementWeekStart(d.day))
    // A week with hours and no pay report at all reads as such, after the reports.
    if (kind !== 'sheet') {
      for (const wk of Array.from(weeksTouched).sort()) {
        const to = hoursStatementYmdAddDays(wk, 6)
        if (payGroups.some((pg) => pg.from <= to && pg.to >= wk)) continue
        const label = hoursStatementWeekLabel(wk)
        let hoursHere = 0
        for (const g of groups) for (const d of g.days) if (!d.pending && d.day >= wk && d.day <= to) hoursHere += d.hours
        lines.push({ key: `week:${wk}`, label, from: wk, jobShare: null, due: null, paid: 0, state: 'no_report', words: `${label} · ${hoursStatementHours(hoursHere)} h on this job · no pay report for this week yet`, payments: [], rateSource: 'none' })
      }
      lines.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    }
    const allPaid = lines.length > 0 && lines.every((l) => l.state === 'paid')
    pay = { lines, note: payNote(kind), allPaid }
  }

  let charged: HoursStatement['charged'] = null
  if (basis === 'charged') {
    // One rate for the paper, or the rows' own rates (crew-days, punch list #254): the words say which.
    const rateWords = chargeRate != null ? `at ${hoursStatementMoney(chargeRate)} an hour` : rowRated ? (input.chargeWords ? `as ${input.chargeWords}` : 'at the rate card’s rates for the crew on each day') : ''
    const lines: HoursStatementChargedLine[] = groups.map((g) => {
      const first = g.days.find((d) => !d.pending)?.day ?? g.days[0]?.day ?? periodStart
      const amount = priced ? g.amount : null
      const groupRates = Array.from(new Set(g.days.filter((d): d is Extract<HoursStatementDay, { pending: false }> => !d.pending && d.rate != null).map((d) => d.rate as number)))
      const oneRate = groupRates.length === 1 ? groupRates[0]! : null
      const unpriced = g.days.filter((d) => !d.pending && d.amount == null).length
      const words =
        !priced
          ? `${g.label} · ${hoursStatementHours(g.hours)} h · no rate given`
          : oneRate != null && unpriced === 0
            ? `${g.label} · ${hoursStatementHours(g.hours)} h at ${hoursStatementMoney(oneRate)} = ${hoursStatementMoney(amount ?? 0)}`
            : `${g.label} · ${hoursStatementHours(g.hours)} h = ${hoursStatementMoney(amount ?? 0)}${unpriced ? ` · ${unpriced} ${unpriced === 1 ? 'day' : 'days'} not priced` : ''}`
      return { key: g.key, label: g.label, from: first, hours: g.hours, amount, words }
    })
    const total = priced ? totals.amount : null
    const totalWords = !priced
      ? `${hoursStatementHours(totalHours)} h · no rate given, so the paper carries hours alone`
      : chargeRate != null
        ? `${hoursStatementHours(totalHours)} h at ${hoursStatementMoney(chargeRate)} an hour = ${hoursStatementMoney(total ?? 0)}`
        : `${hoursStatementHours(totalHours)} h ${rateWords} = ${hoursStatementMoney(total ?? 0)}`
    const note = !priced
      ? 'No rate was given, so the paper carries hours alone.'
      : chargeRate != null
        ? 'The amounts are the hours above at the rate the company charges for an hour of this work. Nothing on this paper is what the worker was paid.'
        : 'Each day is the crew’s hour at the rate the company charges for that crew, the people out together priced once. Nothing on this paper is what the worker was paid.'
    charged = { rate: chargeRate, rateWords, lines, total, totalWords, note, leftOut }
  }
  const preparedWords = charged && priced ? `Prepared from the company’s records, charged ${charged.rateWords}` : 'Prepared from the company’s records'

  const gapSpan = hoursStatementGap(periodStart, periodEnd, input.firstRecordedDay)
  const gap = gapSpan
    ? {
        ...gapSpan,
        heading: `Days the company’s records do not show (${hoursStatementPeriodLabel(gapSpan.from, gapSpan.to)})`,
        words: `The company kept no clock before ${hoursStatementLongDate(input.firstRecordedDay as string)}. The days below are as the worker states them, not as the company recorded them. Blank rows are left blank.`,
      }
    : null
  const statedRows = (input.statedDays ?? []).filter((s) => parts(s.day)).slice().sort((a, b) => (a.day < b.day ? -1 : 1))
  // A gap always draws the block (the span the company's records do not show, with blank rows); inside the recorded
  // span the block comes with the switch, or with days already stated.
  const wantStated = gap != null || input.addStatedBlock === true || statedRows.length > 0
  const stated = wantStated
    ? gap
      ? { rows: statedRows, heading: gap.heading, words: gap.words }
      : { rows: statedRows, heading: 'Days the worker adds', words: 'The days below are as the worker states them, not as the company recorded them. Blank rows are left blank.' }
    : null

  const attestation = hoursStatementAttestation({ kind, withPay, allPaid: pay?.allPaid ?? false, hasStated: stated != null, worker: input.worker })

  return { kind, basis, periodStart, periodEnd, periodLabel: hoursStatementPeriodLabel(periodStart, periodEnd), withPay, groups, totals, pay, charged, preparedWords, gap, stated, attestation }
}

// ---------------------------------------------------------------------------
// The paper's shape, shared by the print (`buildHoursStatementHtml`) and the signed PDF (`hoursStatementPdf.ts`) since
// v2.6629, so the paper a worker signs is the paper the office printed.
// ---------------------------------------------------------------------------

/** Characters of a note that sit on one line in the note column; past it the note takes its own line under the day. */
export const HOURS_STATEMENT_NOTE_FITS = 68
/** The same with the Rate column drawn, which narrows the note column. */
export const HOURS_STATEMENT_NOTE_FITS_WITH_RATE = 58

/** `8.00`, `2.17`, `26.17`: hours on the paper, always to two decimals. */
export function hoursStatementHours2(h: number): string {
  return hoursStatementRoundHours(h).toFixed(2)
}

/** The rate every counted row shares, or null when the rows carry none or differ (then the Rate column is drawn). */
export function hoursStatementUniformRate(statement: Pick<HoursStatement, 'withPay' | 'kind' | 'groups'>): number | null {
  if (!statement.withPay || statement.kind === 'schedule') return null
  let rate: number | null = null
  let any = false
  for (const g of statement.groups) {
    for (const d of g.days) {
      if (d.pending) continue
      if (d.rate == null) return null
      if (!any) {
        rate = d.rate
        any = true
      } else if (d.rate !== rate) return null
    }
  }
  return any ? rate : null
}
