/**
 * Glue between the Pay run tab's data and the Cash App kernels: the recorded-payment side of the
 * match, each person's first report (the "before records began" floor), the lane a match result
 * lands in, the person-name choices for the alias step, and the plain-text summary an agent reads.
 * Pure.
 */

import type { CashAppLane } from './cashAppLane'
import type { CashAppMatchResult, RecordedPaymentForMatch } from './matchCashAppTransactions'
import { CASHAPP_LANE_LABEL } from './cashAppLane'

export type StubForInputs = { id: string; person_name: string; period_start: string }
export type PaymentForInputs = { id: string; pay_stub_id: string; amount: number; paid_at: string; memo: string | null }

/** Every recorded payment with its person, dated by calendar day. */
export function recordedPaymentsForMatch(stubs: readonly StubForInputs[], paymentsByStubId: Readonly<Record<string, readonly PaymentForInputs[]>>): RecordedPaymentForMatch[] {
  const personByStub = new Map(stubs.map((s) => [s.id, s.person_name.trim()]))
  const out: RecordedPaymentForMatch[] = []
  for (const [stubId, rows] of Object.entries(paymentsByStubId)) {
    const person = personByStub.get(stubId)
    if (!person) continue
    for (const p of rows) out.push({ id: p.id, personName: person, amount: Number(p.amount) || 0, paidAt: p.paid_at.slice(0, 10), memo: p.memo })
  }
  return out
}

/** Earliest pay-report period start per person, and the company-wide earliest. */
export function firstReportStarts(stubs: readonly StubForInputs[]): { byPerson: Record<string, string>; earliest: string | null } {
  const byPerson: Record<string, string> = {}
  let earliest: string | null = null
  for (const s of stubs) {
    const n = s.person_name.trim()
    const cur = byPerson[n]
    if (!cur || s.period_start < cur) byPerson[n] = s.period_start
    if (earliest === null || s.period_start < earliest) earliest = s.period_start
  }
  return { byPerson, earliest }
}

/** Where a match result files the transaction. Advances and pay stay in review until a person decides. */
export function laneForMatchResult(r: CashAppMatchResult): { lane: CashAppLane; matchRule: 'id' | 'amount' | 'split' | null; paymentId: string | null } {
  if (r.outcome === 'matched') return { lane: 'recorded', matchRule: r.rule, paymentId: r.paymentIds[0] ?? null }
  if (r.outcome === 'before_records') return { lane: 'before_records', matchRule: null, paymentId: null }
  if (r.noteKind === 'expense') return { lane: 'expense', matchRule: null, paymentId: null }
  return { lane: 'review', matchRule: null, paymentId: null }
}

/** Names the alias step can pick from: anyone with a pay config, a report, or a user row. */
export function personNameOptions(args: { users: readonly { name: string | null }[]; payConfigNames: readonly string[]; stubs: readonly StubForInputs[] }): string[] {
  const set = new Set<string>()
  for (const n of args.payConfigNames) if (n.trim()) set.add(n.trim())
  for (const s of args.stubs) if (s.person_name.trim()) set.add(s.person_name.trim())
  for (const u of args.users) {
    const n = (u.name ?? '').trim()
    if (n && !/^(test|delete|merge test|training helper|twin )/i.test(n)) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type LaneCounts = Record<CashAppLane, { count: number; amount: number }>

export function emptyLaneCounts(): LaneCounts {
  return { review: { count: 0, amount: 0 }, recorded: { count: 0, amount: 0 }, advance: { count: 0, amount: 0 }, expense: { count: 0, amount: 0 }, before_records: { count: 0, amount: 0 }, not_staff: { count: 0, amount: 0 }, ignored: { count: 0, amount: 0 } }
}

export function countLanes(rows: readonly { lane: CashAppLane; amount: number }[]): LaneCounts {
  const c = emptyLaneCounts()
  for (const r of rows) {
    c[r.lane].count += 1
    c[r.lane].amount += Math.abs(Number(r.amount) || 0)
  }
  return c
}

const money = (v: number) => '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * The reconcile state as text — what an agent reads instead of a screenshot. Review rows are
 * grouped by person so the next action is obvious.
 */
export function buildAgentSummary(args: {
  counts: LaneCounts
  review: readonly { id: string; occurredDate: string; personName: string | null; counterparty: string; amount: number; note: string }[]
  unknownNames: readonly { counterparty: string; count: number; total: number }[]
  latestImportDate: string | null
}): string {
  const lines: string[] = []
  lines.push(`Cash App reconcile${args.latestImportDate ? ` · export through ${args.latestImportDate}` : ''}`)
  for (const lane of ['recorded', 'review', 'advance', 'expense', 'before_records', 'not_staff', 'ignored'] as const) {
    const c = args.counts[lane]
    if (c.count) lines.push(`  ${CASHAPP_LANE_LABEL[lane]}: ${c.count} · ${money(c.amount)}`)
  }
  if (args.unknownNames.length) {
    lines.push('', 'Unknown Cash App names (tie to a person or mark not staff):')
    for (const u of args.unknownNames) lines.push(`  ${u.counterparty} · ${u.count} payment${u.count === 1 ? '' : 's'} · ${money(u.total)}`)
  }
  const byPerson = new Map<string, typeof args.review>()
  for (const r of args.review) {
    const k = r.personName ?? `? ${r.counterparty}`
    byPerson.set(k, [...(byPerson.get(k) ?? []), r])
  }
  if (byPerson.size) {
    lines.push('', 'To review (Cash App id · date · amount · note):')
    for (const [person, rows] of [...byPerson.entries()].sort((a, b) => b[1].reduce((s, r) => s + Math.abs(r.amount), 0) - a[1].reduce((s, r) => s + Math.abs(r.amount), 0))) {
      lines.push(`  ${person} · ${rows.length} · ${money(rows.reduce((s, r) => s + Math.abs(r.amount), 0))}`)
      for (const r of [...rows].sort((a, b) => a.occurredDate.localeCompare(b.occurredDate))) lines.push(`    ${r.id} · ${r.occurredDate} · ${money(Math.abs(r.amount))}${r.note ? ` · "${r.note}"` : ''}`)
    }
  }
  return lines.join('\n')
}
