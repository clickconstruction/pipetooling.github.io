/**
 * People → Payroll → Ledger kernel (v2.2168).
 *
 * One dated money journal per person on payroll — labor (pay stubs), additional
 * lines, deductions, payouts, and person_offsets (back-charges, damage,
 * credits) — with a running balance, plus a roster that ranks everyone by
 * what we owe them / what they owe us. Built on the partnership journal kernel
 * (`buildPartnerJournal`), which is person-agnostic; the only convention that
 * differs from the partner card is that EVERY offset books at its occurred
 * date here (credits too — employee credits never attach to a stub, so the
 * partner rule "credits wait for a statement" would lose them).
 *
 * Sign: + means the company owes the person; − means the person owes the
 * company. Same as the partner card ("Click owes you" / "you owe Click").
 *
 * Identity: payroll is name-keyed (PERSON_IDENTITY_PLAN.md); `personKey` is
 * the trimmed name. `person_id` is carried when present but not relied on.
 */
import { POSITIVE_OFFSET_TYPES, buildPartnerJournal, type JournalRow } from '../partnerLedger/partnerLedgerJournal'

export type LedgerStub = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
}
export type LedgerPayment = { pay_stub_id: string; amount: number; paid_at: string; memo: string | null }
export type LedgerDeduction = { pay_stub_id: string; description: string; amount: number; person_offset_id?: string | null }
export type LedgerAddition = { pay_stub_id: string; description: string; line_total: number }
export type LedgerOffset = {
  id: string
  person_name: string
  type: string
  amount: number
  occurred_date: string
  description: string | null
  pay_stub_id?: string | null
}

export const personKey = (name: string): string => name.trim()

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Human label for an offset type — the journal's kind pill. */
export function offsetTypeLabel(type: string): string {
  switch (type) {
    case 'backcharge':
    case 'back_charge':
      return 'Back-charge'
    case 'damage':
      return 'Damage'
    case 'employee_credit':
      return 'Credit'
    case 'profit_share':
      return 'Profit share'
    case 'utility_overage':
      return 'Utility'
    default:
      return type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  }
}

export type StubPayState = { stubId: string; net: number; paid: number; remaining: number; state: 'paid' | 'partial' | 'unpaid' }

export type PersonLedger = {
  key: string
  name: string
  rows: JournalRow[]
  /** running balance after the newest row; + = we owe them */
  balance: number
  totals: { earned: number; additions: number; deductions: number; paidOut: number; charges: number; credits: number }
  unpaid: {
    count: number
    amount: number
    oldestPeriodStart: string | null
    partialCount: number
    partialRemaining: number
  }
  counts: { stubs: number; offsets: number; charges: number; credits: number }
  firstPeriodStart: string | null
  lastPeriodStart: string | null
  /** date of the newest journal row, or null */
  lastPostingDate: string | null
  /** per-stub pay state, keyed by stub id — the journal's labor rows read it for their paid/unpaid tag */
  stubPay: Map<string, StubPayState>
  /** journal row → the offset behind it (for drill-ins), keyed by offset id */
  offsetsById: Map<string, LedgerOffset>
}

export function buildPersonLedger(input: {
  name: string
  stubs: LedgerStub[]
  payments: LedgerPayment[]
  deductions: LedgerDeduction[]
  additional: LedgerAddition[]
  offsets: LedgerOffset[]
}): PersonLedger {
  const key = personKey(input.name)
  const stubs = input.stubs.filter((s) => personKey(s.person_name) === key)
  const stubIds = new Set(stubs.map((s) => s.id))
  const payments = input.payments.filter((p) => stubIds.has(p.pay_stub_id))
  const deductions = input.deductions.filter((d) => stubIds.has(d.pay_stub_id))
  const additional = input.additional.filter((a) => stubIds.has(a.pay_stub_id))
  const offsets = input.offsets.filter((o) => personKey(o.person_name) === key)

  // A statement deduction that mirrors a charge-type offset is the same money
  // as the offset (which books at its own date) — skip it so nothing counts
  // twice. Same rule as the partner ledger.
  const chargeOffsetIds = new Set(offsets.filter((o) => !POSITIVE_OFFSET_TYPES.has(o.type)).map((o) => o.id))
  const journalDeductions = deductions.filter((d) => d.person_offset_id == null || !chargeOffsetIds.has(d.person_offset_id))

  const { rows, balance } = buildPartnerJournal({
    stubs: stubs.map((s) => ({ id: s.id, period_start: s.period_start, period_end: s.period_end, hours_total: num(s.hours_total), gross_pay: num(s.gross_pay) })),
    additional: additional.map((a) => ({ pay_stub_id: a.pay_stub_id, description: a.description, line_total: num(a.line_total) })),
    deductions: journalDeductions.map((d) => ({ pay_stub_id: d.pay_stub_id, description: d.description, amount: num(d.amount) })),
    payments: payments.map((p) => ({ pay_stub_id: p.pay_stub_id, amount: num(p.amount), paid_at: p.paid_at, memo: p.memo })),
    charges: offsets.map((o) => ({
      date: o.occurred_date,
      label: (o.description ?? '').trim() || offsetTypeLabel(o.type),
      amount: POSITIVE_OFFSET_TYPES.has(o.type) ? num(o.amount) : -num(o.amount),
      offset_id: o.id,
    })),
  })

  const totals = { earned: 0, additions: 0, deductions: 0, paidOut: 0, charges: 0, credits: 0 }
  for (const s of stubs) totals.earned += num(s.gross_pay)
  for (const a of additional) totals.additions += num(a.line_total)
  for (const d of journalDeductions) totals.deductions += num(d.amount)
  for (const p of payments) totals.paidOut += num(p.amount)
  for (const o of offsets) {
    if (POSITIVE_OFFSET_TYPES.has(o.type)) totals.credits += num(o.amount)
    else totals.charges += num(o.amount)
  }
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = round2(totals[k])

  // Per-stub pay state (net = gross + additions − deductions; paid = Σ payments).
  const stubPay = new Map<string, StubPayState>()
  const unpaid = { count: 0, amount: 0, oldestPeriodStart: null as string | null, partialCount: 0, partialRemaining: 0 }
  for (const s of stubs) {
    const net = round2(
      num(s.gross_pay) +
        additional.filter((a) => a.pay_stub_id === s.id).reduce((a, x) => a + num(x.line_total), 0) -
        deductions.filter((d) => d.pay_stub_id === s.id).reduce((a, x) => a + num(x.amount), 0),
    )
    const paid = round2(payments.filter((p) => p.pay_stub_id === s.id).reduce((a, x) => a + num(x.amount), 0))
    const remaining = round2(net - paid)
    const state: StubPayState['state'] = paid <= 0 && net > 0 ? 'unpaid' : remaining > 0.005 ? 'partial' : 'paid'
    stubPay.set(s.id, { stubId: s.id, net, paid, remaining, state })
    if (state === 'unpaid') {
      unpaid.count++
      unpaid.amount = round2(unpaid.amount + net)
    } else if (state === 'partial') {
      unpaid.partialCount++
      unpaid.partialRemaining = round2(unpaid.partialRemaining + remaining)
    }
    if (state !== 'paid' && (unpaid.oldestPeriodStart == null || s.period_start < unpaid.oldestPeriodStart)) unpaid.oldestPeriodStart = s.period_start
  }

  const periods = stubs.map((s) => s.period_start).sort()
  return {
    key,
    name: input.name.trim(),
    rows,
    balance: round2(balance),
    totals,
    unpaid,
    counts: {
      stubs: stubs.length,
      offsets: offsets.length,
      charges: offsets.filter((o) => !POSITIVE_OFFSET_TYPES.has(o.type)).length,
      credits: offsets.filter((o) => POSITIVE_OFFSET_TYPES.has(o.type)).length,
    },
    firstPeriodStart: periods[0] ?? null,
    lastPeriodStart: periods[periods.length - 1] ?? null,
    lastPostingDate: rows.length > 0 ? rows[rows.length - 1]!.date : null,
    stubPay,
    offsetsById: new Map(offsets.map((o) => [o.id, o])),
  }
}

/** Every person who has a stub or an offset, as ledgers. */
export function buildAllPersonLedgers(input: {
  stubs: LedgerStub[]
  payments: LedgerPayment[]
  deductions: LedgerDeduction[]
  additional: LedgerAddition[]
  offsets: LedgerOffset[]
}): PersonLedger[] {
  const names = new Map<string, string>()
  for (const s of input.stubs) if (!names.has(personKey(s.person_name))) names.set(personKey(s.person_name), s.person_name.trim())
  for (const o of input.offsets) if (!names.has(personKey(o.person_name))) names.set(personKey(o.person_name), o.person_name.trim())
  return [...names.values()].map((name) => buildPersonLedger({ name, ...input }))
}

export type RosterGroup = 'owe' | 'owed' | 'even'
export type RosterRow = {
  key: string
  name: string
  balance: number
  group: RosterGroup
  /** the "why" under the name — unpaid stubs · charges · credits */
  caption: string
  lastPostingDate: string | null
}
export type Roster = {
  rows: RosterRow[]
  totals: { oweAmount: number; oweCount: number; owedAmount: number; owedCount: number; evenCount: number }
}

/** One short line under the name — the "why" behind the balance. `money` is
 * the caller's formatter (the roster passes a whole-dollar one: captions are
 * a glance, the journal has the cents). */
export function rosterCaption(l: PersonLedger, money: (n: number) => string): string {
  const parts: string[] = []
  if (l.unpaid.count > 0) parts.push(`${l.unpaid.count} unpaid · ${money(l.unpaid.amount)}`)
  if (l.unpaid.partialCount > 0) parts.push(`${l.unpaid.partialCount} partial · ${money(l.unpaid.partialRemaining)} left`)
  if (l.counts.charges > 0) parts.push(`${l.counts.charges} charge${l.counts.charges === 1 ? '' : 's'}`)
  if (l.counts.credits > 0) parts.push(`${l.counts.credits} credit${l.counts.credits === 1 ? '' : 's'}`)
  if (parts.length === 0) parts.push(l.counts.stubs > 0 ? `${l.counts.stubs} stub${l.counts.stubs === 1 ? '' : 's'} · all paid` : 'no stubs')
  return parts.join(' · ')
}

/**
 * Rank everyone: we-owe first (largest first), then owes-us (largest first),
 * then even (most recent first). Balances within a cent of zero are even.
 */
export function buildPeopleLedgerRoster(ledgers: PersonLedger[], money: (n: number) => string): Roster {
  const group = (b: number): RosterGroup => (b > 0.005 ? 'owe' : b < -0.005 ? 'owed' : 'even')
  const rows: RosterRow[] = ledgers.map((l) => ({
    key: l.key,
    name: l.name,
    balance: l.balance,
    group: group(l.balance),
    caption: rosterCaption(l, money),
    lastPostingDate: l.lastPostingDate,
  }))
  const order: Record<RosterGroup, number> = { owe: 0, owed: 1, even: 2 }
  rows.sort((a, b) => {
    if (order[a.group] !== order[b.group]) return order[a.group] - order[b.group]
    if (a.group === 'even') return (b.lastPostingDate ?? '').localeCompare(a.lastPostingDate ?? '') || a.name.localeCompare(b.name)
    return Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name)
  })
  const totals = { oweAmount: 0, oweCount: 0, owedAmount: 0, owedCount: 0, evenCount: 0 }
  for (const r of rows) {
    if (r.group === 'owe') {
      totals.oweAmount = round2(totals.oweAmount + r.balance)
      totals.oweCount++
    } else if (r.group === 'owed') {
      totals.owedAmount = round2(totals.owedAmount + Math.abs(r.balance))
      totals.owedCount++
    } else totals.evenCount++
  }
  return { rows, totals }
}

/** The header equation, zero terms dropped: "earned $X − paid out $Y − charges $Z = −$B". */
export function ledgerEquationTerms(l: PersonLedger): { sign: '+' | '−'; label: string; amount: number }[] {
  const t = l.totals
  const out: { sign: '+' | '−'; label: string; amount: number }[] = []
  if (t.earned) out.push({ sign: '+', label: 'earned', amount: t.earned })
  if (t.additions) out.push({ sign: '+', label: 'additions', amount: t.additions })
  if (t.deductions) out.push({ sign: '−', label: 'deductions', amount: t.deductions })
  if (t.paidOut) out.push({ sign: '−', label: 'paid out', amount: t.paidOut })
  if (t.charges) out.push({ sign: '−', label: 'charges', amount: t.charges })
  if (t.credits) out.push({ sign: '+', label: 'credits', amount: t.credits })
  return out
}
