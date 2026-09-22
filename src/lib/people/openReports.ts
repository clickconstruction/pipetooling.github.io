/**
 * Balances → open reports (v2.3689).
 *
 * The Balances journal answers "where does this person stand" with a dated
 * running balance. It cannot answer the question the page is asked most —
 * "which reports are still owed, and how much on each" — even though every
 * payment is already recorded against one report (`pay_stub_payments.pay_stub_id`)
 * and `buildPersonLedger` already computes paid / partial / unpaid per stub.
 * This kernel turns that per-stub state into the open-reports table, the
 * settle-up line under it, the oldest-first split of one send across the open
 * weeks, and the plan for moving an overpayment to the next open week. Pure.
 *
 * Vocabulary matches Pay run's table: Period · Hours · Net Pay · Paid to date ·
 * Balance · Payment. Two states Pay run does not name:
 *   - residue  — the report is short of net by less than RESIDUE_UNDER. Cash App
 *                fees and rounding, not debt; the door is Mark settled, not pay.
 *   - overpaid — payments exceed net (a Less line added after paying, or a
 *                payment landed on the wrong week). The extra is real money the
 *                journal balance knows and no report shows; the door is Move.
 */
import { POSITIVE_OFFSET_TYPES } from '../partnerLedger/partnerLedgerJournal'
import type { LedgerOffset, LedgerStub, StubPayState } from './personLedger'

const round2 = (n: number) => Math.round(n * 100) / 100
const EPS = 0.005

/** Under this many dollars short, a partly paid report is residue, not debt. */
export const RESIDUE_UNDER = 5

export type OpenReportState = 'unpaid' | 'partial' | 'residue' | 'overpaid'

export type OpenReportPayment = { id: string; paid_at: string; amount: number; memo: string | null }

export type OpenReportRow = {
  stubId: string
  periodStart: string
  periodEnd: string
  hours: number
  net: number
  /** Σ payments on this report. */
  paid: number
  /** net − paid: > 0 still owed, < 0 overpaid. */
  balance: number
  state: OpenReportState
  /** Owed on every open report from the oldest through this one — what one send must be to clear to here. Null on an overpaid row. */
  payToHere: number | null
  /** Oldest first. */
  payments: OpenReportPayment[]
}

export function openReportState(net: number, paid: number, residueUnder = RESIDUE_UNDER): OpenReportState | 'paid' {
  const remaining = round2(net - paid)
  if (remaining < -EPS) return 'overpaid'
  if (remaining <= EPS) return 'paid'
  if (remaining < residueUnder) return 'residue'
  return paid > EPS ? 'partial' : 'unpaid'
}

/**
 * Every report that is not exactly settled, oldest first, with what is paid
 * on it, what is left, and the running cost of clearing through it.
 */
export function openReportRows(args: {
  stubs: readonly LedgerStub[]
  stubPay: ReadonlyMap<string, StubPayState>
  paymentsByStubId: Readonly<Record<string, readonly OpenReportPayment[] | undefined>>
  residueUnder?: number
}): OpenReportRow[] {
  const residueUnder = args.residueUnder ?? RESIDUE_UNDER
  const out: OpenReportRow[] = []
  const stubs = [...args.stubs].sort((a, b) => a.period_start.localeCompare(b.period_start) || a.id.localeCompare(b.id))
  let cum = 0
  for (const s of stubs) {
    const st = args.stubPay.get(s.id)
    if (!st) continue
    const state = openReportState(st.net, st.paid, residueUnder)
    if (state === 'paid') continue
    const balance = round2(st.net - st.paid)
    if (balance > 0) cum = round2(cum + balance)
    const payments = [...(args.paymentsByStubId[s.id] ?? [])]
      .map((p) => ({ id: p.id, paid_at: p.paid_at, amount: round2(Number(p.amount) || 0), memo: p.memo ?? null }))
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at) || a.id.localeCompare(b.id))
    out.push({
      stubId: s.id,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      hours: Number(s.hours_total) || 0,
      net: st.net,
      paid: st.paid,
      balance,
      state,
      payToHere: state === 'overpaid' ? null : cum,
      payments,
    })
  }
  return out
}

export type OpenReportCounts = Record<OpenReportState, number>
export function countOpenReports(rows: readonly OpenReportRow[]): OpenReportCounts {
  const c: OpenReportCounts = { unpaid: 0, partial: 0, residue: 0, overpaid: 0 }
  for (const r of rows) c[r.state]++
  return c
}

/** A charge or credit that never sat on a pay report (`person_offsets.pay_stub_id` is null). */
export type OffReportOffset = {
  id: string
  type: string
  kind: 'charge' | 'credit'
  amount: number
  occurred_date: string
  description: string | null
}

export function offReportOffsets(offsets: readonly LedgerOffset[]): OffReportOffset[] {
  return offsets
    .filter((o) => o.pay_stub_id == null)
    .map((o) => ({
      id: o.id,
      type: o.type,
      kind: POSITIVE_OFFSET_TYPES.has(o.type) ? ('credit' as const) : ('charge' as const),
      amount: round2(Math.abs(Number(o.amount) || 0)),
      occurred_date: o.occurred_date,
      description: o.description,
    }))
    .sort((a, b) => a.occurred_date.localeCompare(b.occurred_date) || a.id.localeCompare(b.id))
}

/**
 * The settle-up line. `after` is the journal balance once the recommended
 * action is done (+ we still owe, − they still owe): nonzero only for residue
 * left to mark and overpayment left to move.
 */
export type SettleUp = {
  mode: 'even' | 'residue' | 'send' | 'charges'
  /** Owed on unpaid + partial reports (residue excluded). */
  owed: number
  residue: number
  residueCount: number
  overpaid: number
  unreported: number
  charges: number
  credits: number
  /** Cash to send now (mode send); 0 otherwise. */
  toSend: number
  /** Charges to take out of the open weeks as deductions (mode charges); 0 otherwise. */
  chargesToApply: number
  after: number
}

export function settleUp(args: { rows: readonly OpenReportRow[]; offsets: readonly OffReportOffset[]; unreportedEstimate: number; balance: number }): SettleUp {
  let owed = 0
  let residue = 0
  let residueCount = 0
  let overpaid = 0
  for (const r of args.rows) {
    if (r.state === 'overpaid') overpaid = round2(overpaid - r.balance)
    else if (r.state === 'residue') {
      residue = round2(residue + r.balance)
      residueCount++
    } else owed = round2(owed + r.balance)
  }
  const charges = round2(args.offsets.filter((o) => o.kind === 'charge').reduce((s, o) => s + o.amount, 0))
  const credits = round2(args.offsets.filter((o) => o.kind === 'credit').reduce((s, o) => s + o.amount, 0))
  const unreported = round2(Math.max(0, args.unreportedEstimate))
  const base = { owed, residue, residueCount, overpaid, unreported, charges, credits, toSend: 0, chargesToApply: 0 }
  const net = round2(owed + unreported - charges + credits)
  if (owed + unreported <= EPS) {
    if (residue > EPS) return { mode: 'residue', ...base, after: round2(args.balance + unreported) }
    return { mode: 'even', ...base, after: round2(args.balance + unreported) }
  }
  if (net > EPS) return { mode: 'send', ...base, toSend: net, after: round2(args.balance + unreported - net) }
  // Charges cover every open week: nothing to send; the open weeks absorb owed-worth of charges.
  return { mode: 'charges', ...base, chargesToApply: round2(owed + unreported), after: round2(args.balance + unreported) }
}

/** The settle-up line in words. `money` formats a positive number. */
export function settleUpSentence(s: SettleUp, name: string, money: (n: number) => string): string {
  const tail = (): string => {
    if (s.after > EPS) return `we still owe ${money(s.after)}`
    if (s.after < -EPS) return `${name} still owes ${money(-s.after)}`
    return 'even'
  }
  switch (s.mode) {
    case 'even':
      return s.overpaid > EPS ? `Nothing to send. ${money(s.overpaid)} overpaid on one week → move it → ${tail()}` : 'Nothing open — even.'
    case 'residue':
      return `Nothing to send. ${money(s.residue)} of residue on ${s.residueCount} week${s.residueCount === 1 ? '' : 's'} → mark ${s.residueCount === 1 ? 'it' : 'them'} settled → ${tail()}`
    case 'send': {
      const parts = [`open reports ${money(s.owed)}`]
      if (s.unreported > EPS) parts.push(`+ unreported weeks est. ${money(s.unreported)}`)
      if (s.charges > EPS) parts.push(`− charges ${money(s.charges)}`)
      if (s.credits > EPS) parts.push(`+ credits ${money(s.credits)}`)
      const over = s.overpaid > EPS ? ` · ${money(s.overpaid)} already overpaid on one week — move it first` : ''
      return `Send ${money(s.toSend)} = ${parts.join(' ')}${over} → ${tail()}`
    }
    case 'charges':
      return `Send nothing. Charges ${money(s.charges)} cover the open reports ${money(s.chargesToApply)} → take them out of the open weeks → ${tail()}`
  }
}

/**
 * One send split across the open weeks, oldest first. Every positive balance
 * takes its fill in order (residue included — it is owed); overpaid rows take
 * nothing. `leftover` is what the send exceeds the open weeks by.
 */
export function allocateOldestFirst(amount: number, rows: readonly OpenReportRow[]): { splits: { stubId: string; amount: number }[]; leftover: number } {
  const splits: { stubId: string; amount: number }[] = []
  let remain = round2(Math.max(0, Number(amount) || 0))
  for (const r of rows) {
    if (remain <= EPS) break
    if (r.balance <= EPS) continue
    const take = round2(Math.min(r.balance, remain))
    splits.push({ stubId: r.stubId, amount: take })
    remain = round2(remain - take)
  }
  return { splits, leftover: remain }
}

/**
 * Move an overpayment off a report: shrink its newest payments by the extra
 * (newest first, never below zero — a payment that would reach zero is deleted)
 * and add one payment for the extra on the oldest open week. `to` is null when
 * nothing is open — the caller offers a credit instead.
 */
export type MovePlan = {
  from: string
  amount: number
  to: string | null
  ops: Array<{ kind: 'update'; paymentId: string; amount: number } | { kind: 'delete'; paymentId: string }>
  /** The payment to insert on `to`; carries the newest shrunk payment's date and memo. */
  insert: { pay_stub_id: string; amount: number; paid_at: string; memo: string } | null
}

export function moveOverpaymentPlan(row: OpenReportRow, rows: readonly OpenReportRow[], weekLabel: (r: OpenReportRow) => string): MovePlan | null {
  if (row.state !== 'overpaid') return null
  const extra = round2(-row.balance)
  const to = rows.find((r) => r.stubId !== row.stubId && r.balance > EPS) ?? null
  const ops: MovePlan['ops'] = []
  let left = extra
  let source: OpenReportPayment | null = null
  for (const p of [...row.payments].reverse()) {
    if (left <= EPS) break
    const cut = round2(Math.min(p.amount, left))
    const keep = round2(p.amount - cut)
    ops.push(keep > EPS ? { kind: 'update', paymentId: p.id, amount: keep } : { kind: 'delete', paymentId: p.id })
    if (!source) source = p
    left = round2(left - cut)
  }
  if (left > EPS || !source) return null
  const memoBase = (source.memo ?? '').trim()
  const insert = to
    ? { pay_stub_id: to.stubId, amount: extra, paid_at: source.paid_at, memo: `${memoBase ? memoBase + ' · ' : ''}moved from week of ${weekLabel(row)}` }
    : null
  return { from: row.stubId, amount: extra, to: to?.stubId ?? null, ops, insert }
}

/**
 * The line under a name on the Balances roster. `money` is the caller's
 * whole-dollar formatter (a caption is a glance; the table has the cents).
 */
export function openReportsCaption(args: {
  rows: readonly OpenReportRow[]
  offsets: readonly OffReportOffset[]
  unreportedCount: number
  stubCount: number
  money: (n: number) => string
}): string {
  const c = countOpenReports(args.rows)
  const open = args.rows.length
  const charges = args.offsets.filter((o) => o.kind === 'charge')
  const credits = args.offsets.filter((o) => o.kind === 'credit')
  const parts: string[] = []
  if (open > 0) {
    const owed = args.rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
    if (c.unpaid + c.partial === 0 && c.residue > 0 && c.overpaid === 0) parts.push(`${open} open · ${args.money(owed)} residue`)
    else {
      parts.push(`${open} open · ${args.money(owed)}`)
      if (c.unpaid > 0 && c.unpaid < open) parts.push(`${c.unpaid} unpaid`)
      if (c.partial > 0) parts.push(`${c.partial} partial`)
      if (c.residue > 0) parts.push(`${c.residue} residue`)
      if (c.overpaid > 0) parts.push(`${c.overpaid} overpaid`)
    }
  }
  if (args.unreportedCount > 0) parts.push(`${args.unreportedCount} week${args.unreportedCount === 1 ? '' : 's'} unreported`)
  if (charges.length > 0) parts.push(`${charges.length} charge${charges.length === 1 ? '' : 's'} −${args.money(charges.reduce((s, o) => s + o.amount, 0))}`)
  if (credits.length > 0) parts.push(`${credits.length} credit${credits.length === 1 ? '' : 's'} +${args.money(credits.reduce((s, o) => s + o.amount, 0))}`)
  if (parts.length === 0) return args.stubCount > 0 ? `${args.stubCount} report${args.stubCount === 1 ? '' : 's'} · all paid` : 'no reports'
  if (open === 0 && args.unreportedCount === 0) parts.unshift('nothing open')
  return parts.join(' · ')
}
