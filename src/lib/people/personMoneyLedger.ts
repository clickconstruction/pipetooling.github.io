/**
 * Person money ledger kernels (v2.1666, Offsets → Balances):
 * - per-person offset balances for the Balances summary board (pending =
 *   offsets not yet applied to a pay report; credits +, backcharges/damages −)
 * - the merged offset + payment timeline for the person ledger modal
 * - the shareable pay-statement build (payments with the period's job hours
 *   and applied offsets — hours and jobs only, no company revenue numbers)
 */

export type PersonOffsetLike = {
  id: string
  person_name: string
  type: string
  amount: number
  description: string | null
  occurred_date: string
  pay_stub_id: string | null
}

export type PayStubLike = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
  /** LEGACY paid marker — modern payments live in pay_stub_payments rows. */
  paid_at: string | null
}

/** A recorded payment installment against a pay report (pay_stub_payments). */
export type StubPaymentLike = {
  id: string
  pay_stub_id: string
  amount: number
  paid_at: string
  memo: string | null
}

const FULLY_PAID_TOLERANCE = 0.01

export const OFFSET_TYPE_LABELS: Record<string, string> = {
  backcharge: 'Backcharge',
  damage: 'Damage',
  employee_credit: 'Credit',
}

/** Credits count for the person; backcharges and damages count against them. */
export function offsetSignedAmount(type: string, amount: number): number {
  return type === 'employee_credit' ? amount : -amount
}

export type PersonBalanceRow = {
  personName: string
  /** Net of offsets NOT yet applied to a pay report — what hits the next check. */
  pendingNet: number
  pendingCount: number
  /** Net of every offset ever recorded. */
  lifetimeNet: number
}

/**
 * One row per person with any offset history, sorted most-negative pending
 * first; settled people (nothing pending) sort after, alphabetically.
 */
export function personOffsetBalances(offsets: PersonOffsetLike[]): PersonBalanceRow[] {
  const byName = new Map<string, PersonBalanceRow>()
  for (const o of offsets) {
    const name = o.person_name.trim()
    if (!name) continue
    const row = byName.get(name) ?? { personName: name, pendingNet: 0, pendingCount: 0, lifetimeNet: 0 }
    const signed = offsetSignedAmount(o.type, o.amount)
    row.lifetimeNet += signed
    if (o.pay_stub_id == null) {
      row.pendingNet += signed
      row.pendingCount++
    }
    byName.set(name, row)
  }
  const rows = [...byName.values()]
  rows.sort((a, b) => {
    const aSettled = a.pendingCount === 0 ? 1 : 0
    const bSettled = b.pendingCount === 0 ? 1 : 0
    if (aSettled !== bSettled) return aSettled - bSettled
    if (a.pendingNet !== b.pendingNet) return a.pendingNet - b.pendingNet
    return a.personName.localeCompare(b.personName)
  })
  return rows
}

export type PersonLedgerRow = {
  key: string
  kind: 'offset' | 'payment' | 'payment_pending' | 'unreported'
  dateYmd: string
  typeLabel: string
  label: string
  /** Signed: offsets carry their sign; payments are positive; unreported rows carry 0. */
  amount: number
  /** Offsets only: already applied to a pay report. */
  applied?: boolean
  /** Unreported rows: approved hours in the week with no pay report. */
  hours?: number
}

/** One approved-hours day from the Hours grid (people_hours). */
export type ApprovedDayHours = { workDate: string; hours: number }

export type UncoveredWeek = { weekStart: string; weekEnd: string; hours: number }

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** The Sunday on/before ymd (pay report periods run Sunday–Saturday). */
function weekStartSunday(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
  return ymdAddDays(ymd, -dow)
}

/**
 * Approved worked days covered by NO pay report period, grouped into
 * Sunday–Saturday weeks — the "worked but never rolled into a pay report"
 * state the office needs to see. Newest week first.
 */
export function uncoveredApprovedWeeks(args: {
  dayHours: ApprovedDayHours[]
  payStubs: Array<Pick<PayStubLike, 'period_start' | 'period_end'>>
}): UncoveredWeek[] {
  const byWeek = new Map<string, number>()
  for (const d of args.dayHours) {
    const hours = Number(d.hours)
    if (!Number.isFinite(hours) || hours <= 0) continue
    const covered = args.payStubs.some((s) => d.workDate >= s.period_start && d.workDate <= s.period_end)
    if (covered) continue
    const ws = weekStartSunday(d.workDate)
    byWeek.set(ws, (byWeek.get(ws) ?? 0) + hours)
  }
  return [...byWeek.entries()]
    .map(([weekStart, hours]) => ({ weekStart, weekEnd: ymdAddDays(weekStart, 6), hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

/**
 * The person ledger's date-interleaved timeline: every offset (signed), every
 * RECORDED payment (pay_stub_payments — one row per installment, dated by its
 * actual paid date), a remaining-balance pending row for partially paid
 * reports, legacy stub.paid_at-only reports as paid, and reports with no
 * payment at all as pending (dated period end). Newest first.
 */
export function buildOffsetPaymentTimeline(args: {
  offsets: PersonOffsetLike[]
  payStubs: PayStubLike[]
  stubPayments?: StubPaymentLike[]
  /** Weeks of approved hours with no pay report (uncoveredApprovedWeeks). */
  uncoveredWeeks?: UncoveredWeek[]
}): PersonLedgerRow[] {
  const rows: PersonLedgerRow[] = []
  for (const o of args.offsets) {
    rows.push({
      key: `offset-${o.id}`,
      kind: 'offset',
      dateYmd: o.occurred_date,
      typeLabel: OFFSET_TYPE_LABELS[o.type] ?? o.type,
      label: (o.description ?? '').trim() || (OFFSET_TYPE_LABELS[o.type] ?? o.type),
      amount: offsetSignedAmount(o.type, o.amount),
      applied: o.pay_stub_id != null,
    })
  }
  const paymentsByStub = new Map<string, StubPaymentLike[]>()
  for (const p of args.stubPayments ?? []) {
    const arr = paymentsByStub.get(p.pay_stub_id) ?? []
    arr.push(p)
    paymentsByStub.set(p.pay_stub_id, arr)
  }
  for (const s of args.payStubs) {
    const stubLabel = `Pay report ${s.period_start} – ${s.period_end} · ${s.hours_total} h`
    const payments = paymentsByStub.get(s.id) ?? []
    if (payments.length > 0) {
      let paidSum = 0
      for (const p of payments) {
        paidSum += Number(p.amount)
        const memo = (p.memo ?? '').trim()
        rows.push({
          key: `stubpay-${p.id}`,
          kind: 'payment',
          dateYmd: p.paid_at.slice(0, 10),
          typeLabel: 'Paid',
          label: memo ? `${stubLabel} · ${memo}` : stubLabel,
          amount: p.amount,
        })
      }
      const remaining = Math.round((s.gross_pay - paidSum) * 100) / 100
      if (remaining > FULLY_PAID_TOLERANCE) {
        rows.push({
          key: `stub-remaining-${s.id}`,
          kind: 'payment_pending',
          dateYmd: s.period_end,
          typeLabel: 'Pending',
          label: `Balance remaining · ${stubLabel}`,
          amount: remaining,
        })
      }
    } else if (s.paid_at != null) {
      // Legacy: marked paid before per-payment rows existed.
      rows.push({
        key: `stub-${s.id}`,
        kind: 'payment',
        dateYmd: s.paid_at.slice(0, 10),
        typeLabel: 'Paid',
        label: stubLabel,
        amount: s.gross_pay,
      })
    } else {
      rows.push({
        key: `stub-${s.id}`,
        kind: 'payment_pending',
        dateYmd: s.period_end,
        typeLabel: 'Pending',
        label: stubLabel,
        amount: s.gross_pay,
      })
    }
  }
  for (const w of args.uncoveredWeeks ?? []) {
    rows.push({
      key: `unreported-${w.weekStart}`,
      kind: 'unreported',
      dateYmd: w.weekEnd,
      typeLabel: 'No report',
      label: `No pay report yet · ${w.weekStart} – ${w.weekEnd} · ${w.hours} h approved`,
      amount: 0,
      hours: w.hours,
    })
  }
  rows.sort((a, b) => (a.dateYmd !== b.dateYmd ? b.dateYmd.localeCompare(a.dateYmd) : a.key.localeCompare(b.key)))
  return rows
}

export type PricedWeek = UncoveredWeek & { estAmount: number | null }

/** Price unreported weeks at the person's hourly wage; null when no usable wage. */
export function priceUncoveredWeeks(weeks: UncoveredWeek[], hourlyWage: number | null | undefined): PricedWeek[] {
  const wage = hourlyWage != null && hourlyWage > 0 ? hourlyWage : null
  return weeks.map((w) => ({ ...w, estAmount: wage == null ? null : Math.round(w.hours * wage * 100) / 100 }))
}

export type PersonSettleUp = {
  /** Sum of what's still owed on existing reports (gross − recorded payments; legacy paid_at = fully paid). */
  unpaidRemaining: number
  unpaidCount: number
  unreportedHours: number
  unreportedWeeks: number
  /** Priced value of unreported hours; null when hours exist but no wage is known. */
  unreportedEst: number | null
  /** Pending offsets only (not yet applied to a report). */
  credits: number
  charges: number
  /** unpaidRemaining + (unreportedEst ?? 0) + credits − charges. Positive = pay them. */
  net: number
  /** True when unreported hours exist but could not be priced into net. */
  netMissingUnpricedHours: boolean
}

/** The settle-up equation: everything owed each way, priced where possible. */
export function personSettleUp(args: {
  payStubs: PayStubLike[]
  stubPayments: StubPaymentLike[]
  offsets: PersonOffsetLike[]
  pricedWeeks: PricedWeek[]
}): PersonSettleUp {
  const paymentsByStub = new Map<string, number>()
  for (const p of args.stubPayments) {
    paymentsByStub.set(p.pay_stub_id, (paymentsByStub.get(p.pay_stub_id) ?? 0) + Number(p.amount))
  }
  let unpaidRemaining = 0
  let unpaidCount = 0
  for (const s of args.payStubs) {
    const paid = paymentsByStub.get(s.id)
    if (paid == null && s.paid_at != null) continue
    const remaining = Math.round((s.gross_pay - (paid ?? 0)) * 100) / 100
    if (remaining > FULLY_PAID_TOLERANCE) {
      unpaidRemaining += remaining
      unpaidCount++
    }
  }
  unpaidRemaining = Math.round(unpaidRemaining * 100) / 100
  let credits = 0
  let charges = 0
  for (const o of args.offsets) {
    if (o.pay_stub_id != null) continue
    const signed = offsetSignedAmount(o.type, o.amount)
    if (signed >= 0) credits += signed
    else charges += -signed
  }
  credits = Math.round(credits * 100) / 100
  charges = Math.round(charges * 100) / 100
  let unreportedHours = 0
  let unreportedEst: number | null = 0
  for (const w of args.pricedWeeks) {
    unreportedHours += w.hours
    if (unreportedEst != null) unreportedEst = w.estAmount == null ? null : unreportedEst + w.estAmount
  }
  unreportedHours = Math.round(unreportedHours * 100) / 100
  if (unreportedEst != null) unreportedEst = Math.round(unreportedEst * 100) / 100
  if (args.pricedWeeks.length === 0) unreportedEst = 0
  const net = Math.round((unpaidRemaining + (unreportedEst ?? 0) + credits - charges) * 100) / 100
  return {
    unpaidRemaining,
    unpaidCount,
    unreportedHours,
    unreportedWeeks: args.pricedWeeks.length,
    unreportedEst,
    credits,
    charges,
    net,
    netMissingUnpricedHours: unreportedHours > 0 && unreportedEst == null,
  }
}

export type SettleUpRow = PersonSettleUp & { personName: string }

/**
 * The board: one settle-up row per person appearing in offsets, reports, or
 * uncovered approved hours. Action rows first (most negative net upward),
 * fully settled people last, alphabetically.
 */
export function buildSettleUpBoard(args: {
  offsets: PersonOffsetLike[]
  payStubs: PayStubLike[]
  stubPayments: StubPaymentLike[]
  dayHours: Array<{ personName: string; workDate: string; hours: number }>
  wageForPerson: (name: string) => number | null
}): SettleUpRow[] {
  const names = new Set<string>()
  for (const o of args.offsets) if (o.person_name.trim()) names.add(o.person_name.trim())
  for (const s of args.payStubs) if (s.person_name.trim()) names.add(s.person_name.trim())
  for (const d of args.dayHours) if (d.personName.trim()) names.add(d.personName.trim())
  const stubIdsByPerson = new Map<string, Set<string>>()
  for (const s of args.payStubs) {
    const key = s.person_name.trim().toLowerCase()
    const set = stubIdsByPerson.get(key) ?? new Set()
    set.add(s.id)
    stubIdsByPerson.set(key, set)
  }
  const rows: SettleUpRow[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    const personStubs = args.payStubs.filter((s) => s.person_name.trim().toLowerCase() === key)
    const stubIds = stubIdsByPerson.get(key) ?? new Set()
    const personPayments = args.stubPayments.filter((p) => stubIds.has(p.pay_stub_id))
    const personOffsets = args.offsets.filter((o) => o.person_name.trim().toLowerCase() === key)
    const personDays = args.dayHours
      .filter((d) => d.personName.trim().toLowerCase() === key)
      .map((d) => ({ workDate: d.workDate, hours: d.hours }))
    const weeks = uncoveredApprovedWeeks({ dayHours: personDays, payStubs: personStubs })
    const priced = priceUncoveredWeeks(weeks, args.wageForPerson(name))
    rows.push({ personName: name, ...personSettleUp({ payStubs: personStubs, stubPayments: personPayments, offsets: personOffsets, pricedWeeks: priced }) })
  }
  const settled = (r: SettleUpRow) => r.net === 0 && r.unpaidCount === 0 && r.unreportedWeeks === 0 && r.credits === 0 && r.charges === 0
  rows.sort((a, b) => {
    const aS = settled(a) ? 1 : 0
    const bS = settled(b) ? 1 : 0
    if (aS !== bS) return aS - bS
    if (aS === 1) return a.personName.localeCompare(b.personName)
    if (a.net !== b.net) return a.net - b.net
    return a.personName.localeCompare(b.personName)
  })
  return rows
}

export type WeeklyHistoryGroup = {
  weekStart: string
  weekEnd: string
  /** Report totals for the week; null when the week has offsets only. */
  reportGross: number | null
  reportHours: number | null
  payments: Array<{ dateYmd: string; amount: number; memo: string | null }>
  offsets: Array<{ dateYmd: string; label: string; amount: number; applied: boolean; typeLabel: string }>
  /** Still owed on the week's report(s); null when no report. */
  remaining: number | null
  legacyPaid: boolean
}

/**
 * History grouped by Sunday week: the week's report(s), their recorded
 * payments, and any offsets dated inside the week — one block per week so a
 * report and its companion weekly credit read as a single story.
 */
export function buildWeeklyHistoryGroups(args: {
  payStubs: PayStubLike[]
  stubPayments: StubPaymentLike[]
  offsets: PersonOffsetLike[]
}): WeeklyHistoryGroup[] {
  const groups = new Map<string, WeeklyHistoryGroup>()
  const groupFor = (weekStart: string): WeeklyHistoryGroup => {
    const existing = groups.get(weekStart)
    if (existing) return existing
    const g: WeeklyHistoryGroup = {
      weekStart,
      weekEnd: ymdAddDays(weekStart, 6),
      reportGross: null,
      reportHours: null,
      payments: [],
      offsets: [],
      remaining: null,
      legacyPaid: false,
    }
    groups.set(weekStart, g)
    return g
  }
  const paymentsByStub = new Map<string, StubPaymentLike[]>()
  for (const p of args.stubPayments) {
    const arr = paymentsByStub.get(p.pay_stub_id) ?? []
    arr.push(p)
    paymentsByStub.set(p.pay_stub_id, arr)
  }
  for (const s of args.payStubs) {
    const g = groupFor(weekStartSunday(s.period_start))
    g.reportGross = Math.round(((g.reportGross ?? 0) + s.gross_pay) * 100) / 100
    g.reportHours = Math.round(((g.reportHours ?? 0) + s.hours_total) * 100) / 100
    const payments = paymentsByStub.get(s.id) ?? []
    let paidSum = 0
    for (const p of payments) {
      paidSum += Number(p.amount)
      g.payments.push({ dateYmd: p.paid_at.slice(0, 10), amount: p.amount, memo: p.memo })
    }
    if (payments.length === 0 && s.paid_at != null) {
      g.legacyPaid = true
      paidSum = s.gross_pay
    }
    const remaining = Math.max(0, Math.round((s.gross_pay - paidSum) * 100) / 100)
    g.remaining = Math.round(((g.remaining ?? 0) + remaining) * 100) / 100
  }
  for (const o of args.offsets) {
    const g = groupFor(weekStartSunday(o.occurred_date))
    g.offsets.push({
      dateYmd: o.occurred_date,
      label: (o.description ?? '').trim() || (OFFSET_TYPE_LABELS[o.type] ?? o.type),
      amount: offsetSignedAmount(o.type, o.amount),
      applied: o.pay_stub_id != null,
      typeLabel: OFFSET_TYPE_LABELS[o.type] ?? o.type,
    })
  }
  for (const g of groups.values()) {
    g.payments.sort((a, b) => b.dateYmd.localeCompare(a.dateYmd))
    g.offsets.sort((a, b) => b.dateYmd.localeCompare(a.dateYmd))
  }
  return [...groups.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

/** Sum of recorded payments (plus legacy paid_at-only stub grosses) inside a range. */
export function paidTotalInRange(args: {
  payStubs: PayStubLike[]
  stubPayments: StubPaymentLike[]
  rangeStart: string | null
  rangeEnd: string | null
}): number {
  const inRange = (ymd: string) => (args.rangeStart == null || ymd >= args.rangeStart) && (args.rangeEnd == null || ymd <= args.rangeEnd)
  const stubsWithPayments = new Set(args.stubPayments.map((p) => p.pay_stub_id))
  let total = 0
  for (const p of args.stubPayments) {
    if (inRange(p.paid_at.slice(0, 10))) total += Number(p.amount)
  }
  for (const s of args.payStubs) {
    if (s.paid_at != null && !stubsWithPayments.has(s.id) && inRange(s.paid_at.slice(0, 10))) total += s.gross_pay
  }
  return Math.round(total * 100) / 100
}

export type PersonWorkDay = { workDate: string; hours: number; jobLabel: string }

export type PayStatementJobLine = { label: string; hours: number }

export type PayStatementPayment = {
  paidAtYmd: string
  gross: number
  periodStart: string
  periodEnd: string
  hoursTotal: number
  jobLines: PayStatementJobLine[]
  offsets: Array<{ label: string; amount: number }>
}

/**
 * Statement content: every RECORDED payment in range (pay_stub_payments,
 * dated by its actual paid date; legacy paid_at-only reports count whole),
 * each carrying its report period's job hours (from the person's per-day
 * labor allocation) and the report's applied offsets (listed once, on the
 * newest payment of that report).
 */
export function buildPayStatementPayments(args: {
  payStubs: PayStubLike[]
  offsets: PersonOffsetLike[]
  workDays: PersonWorkDay[]
  stubPayments?: StubPaymentLike[]
  rangeStart: string | null
  rangeEnd: string | null
}): PayStatementPayment[] {
  const inRange = (ymd: string) => (args.rangeStart == null || ymd >= args.rangeStart) && (args.rangeEnd == null || ymd <= args.rangeEnd)
  const stubById = new Map(args.payStubs.map((s) => [s.id, s]))
  const stubsWithPayments = new Set((args.stubPayments ?? []).map((p) => p.pay_stub_id))

  type Entry = { paidAtYmd: string; amount: number; stub: PayStubLike; sortKey: string }
  const entries: Entry[] = []
  for (const p of args.stubPayments ?? []) {
    const stub = stubById.get(p.pay_stub_id)
    if (!stub) continue
    const ymd = p.paid_at.slice(0, 10)
    if (!inRange(ymd)) continue
    entries.push({ paidAtYmd: ymd, amount: p.amount, stub, sortKey: p.paid_at })
  }
  for (const s of args.payStubs) {
    if (s.paid_at == null || stubsWithPayments.has(s.id)) continue
    const ymd = s.paid_at.slice(0, 10)
    if (!inRange(ymd)) continue
    entries.push({ paidAtYmd: ymd, amount: s.gross_pay, stub: s, sortKey: s.paid_at })
  }
  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const offsetsListed = new Set<string>()
  return entries.map((e) => {
    const s = e.stub
    const byJob = new Map<string, number>()
    for (const d of args.workDays) {
      if (d.workDate < s.period_start || d.workDate > s.period_end) continue
      byJob.set(d.jobLabel, (byJob.get(d.jobLabel) ?? 0) + d.hours)
    }
    const jobLines = [...byJob.entries()]
      .map(([label, hours]) => ({ label, hours: Math.round(hours * 100) / 100 }))
      .filter((l) => l.hours > 0)
      .sort((a, b) => b.hours - a.hours)
    // The report's offsets appear once — on its newest payment in the list.
    const offsets = offsetsListed.has(s.id)
      ? []
      : args.offsets
          .filter((o) => o.pay_stub_id === s.id)
          .map((o) => ({
            label: (o.description ?? '').trim() || (OFFSET_TYPE_LABELS[o.type] ?? o.type),
            amount: offsetSignedAmount(o.type, o.amount),
          }))
    offsetsListed.add(s.id)
    return {
      paidAtYmd: e.paidAtYmd,
      gross: e.amount,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      hoursTotal: s.hours_total,
      jobLines,
      offsets,
    }
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * The shareable statement document: payments with their paid dates, the job
 * hours that earned each one, and applied offsets. Deliberately shows hours
 * and job names only — never company revenue. Print-ready standalone HTML.
 */
export function buildPayStatementHtml(args: {
  personName: string
  companyName: string
  rangeLabel: string
  payments: PayStatementPayment[]
  generatedYmd: string
}): string {
  const totalPaid = args.payments.reduce((s, p) => s + p.gross, 0)
  const paymentsHtml = args.payments
    .map((p) => {
      const jobRows = p.jobLines
        .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="num">${l.hours.toLocaleString()} h</td></tr>`)
        .join('')
      const offsetRows = p.offsets
        .map(
          (o) =>
            `<tr class="offset"><td>${o.amount < 0 ? 'Less' : 'Plus'}: ${escapeHtml(o.label)}</td><td class="num">${o.amount < 0 ? '−' : '+'}$${fmtMoney(Math.abs(o.amount))}</td></tr>`,
        )
        .join('')
      return `<section>
  <h2>Paid ${fmtDateLong(p.paidAtYmd)} — $${fmtMoney(p.gross)}</h2>
  <p class="muted">Period ${fmtDateLong(p.periodStart)} – ${fmtDateLong(p.periodEnd)} · ${p.hoursTotal.toLocaleString()} hours</p>
  <table>${jobRows || '<tr><td class="muted">No job-day detail recorded for this period</td><td></td></tr>'}${offsetRows}</table>
</section>`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pay statement — ${escapeHtml(args.personName)}</title><style>
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 2rem auto; max-width: 640px; padding: 0 1rem; }
header { border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: baseline; }
h1 { font-size: 1.15rem; margin: 0; } h2 { font-size: 0.95rem; margin: 1rem 0 2px; }
.muted { color: #6b7280; font-size: 0.8rem; margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
td { padding: 3px 0; border-bottom: 1px solid #f3f4f6; }
td.num { text-align: right; white-space: nowrap; }
tr.offset td { color: #991b1b; }
footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 0.75rem; }
@media print { body { margin: 0.5rem auto; } }
</style></head><body>
<header>
  <div><h1>Pay statement — ${escapeHtml(args.personName)}</h1><p class="muted">${escapeHtml(args.companyName)} · ${escapeHtml(args.rangeLabel)}</p></div>
  <div class="muted">${args.payments.length} payment${args.payments.length === 1 ? '' : 's'} · $${fmtMoney(totalPaid)}</div>
</header>
${paymentsHtml || '<p class="muted">No payments in this range.</p>'}
<footer>Questions about a line? Talk to the office. This statement reflects recorded clock time, job assignments, and agreed offsets. Generated ${fmtDateLong(args.generatedYmd)}.</footer>
</body></html>`
}
