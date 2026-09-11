/**
 * Cash App payments ↔ payments recorded on pay reports. Rules, in order, and every result says
 * which one fired so a person (or an agent) can trust it:
 *
 *  a. `id`      — the Cash App Transaction ID appears in a recorded payment's memo. Exact.
 *  b. `amount`  — same person, same amount, paid within `windowDays` of the Cash App date.
 *  c. `split`   — one Cash App payment equals the sum of 2–3 recorded payments for that person
 *                 within the window (one send covering several reports).
 *  e. `memo`    — a number written in a recorded payment's memo equals the send ("Cashapp 500",
 *                 "CashApp in 300 and 100", "-500 for motorcycle 1809.20 paid via cashapp"): the
 *                 owner recorded the report's figure and noted how the cash was actually split.
 *                 Each memo number backs one send; the payment itself is not consumed, so a
 *                 memo listing two amounts can back two sends.
 *  d. otherwise — unmatched; `before_records` when the payment predates the first pay report
 *                 the app has for that person — or, for an unknown name, the company's first
 *                 report (money that went out before we started counting) — else the note lane
 *                 (pay / advance / expense) says which queue it joins.
 *
 * Recorded payments are consumed at most once. Pure; the caller supplies both sides.
 */

import { classifyCashAppNote, type CashAppNoteKind } from './cashAppLane'

export type CashAppTxForMatch = {
  id: string
  occurredDate: string // YYYY-MM-DD
  /** Positive: dollars sent. */
  amountSent: number
  note: string
  /** Resolved app person, or null when unknown / not staff. */
  personName: string | null
  /** Other people this send could belong to (a proxy account) — tried after `personName`. */
  altPersonNames?: readonly string[]
}

export type RecordedPaymentForMatch = {
  id: string
  personName: string
  amount: number
  paidAt: string // YYYY-MM-DD
  memo: string | null
}

export type CashAppMatchRule = 'id' | 'amount' | 'split' | 'memo'

export type CashAppMatchResult =
  | { txId: string; outcome: 'matched'; rule: CashAppMatchRule; paymentIds: string[]; personName: string }
  | { txId: string; outcome: 'before_records'; personName: string | null; firstReportStart: string; noteKind: CashAppNoteKind }
  | { txId: string; outcome: 'unmatched'; personName: string | null; noteKind: CashAppNoteKind }

export type MatchCashAppOptions = {
  windowDays?: number
  /** Window for the memo rule — memos are written when the report is paid, often days after the send. */
  memoWindowDays?: number
  /** Earliest pay-report period_start per person; a send before it is `before_records`. */
  firstReportStartByPerson?: Readonly<Record<string, string>>
  /** Company-wide floor when a person has no reports at all (defaults to none). */
  recordsBeginYmd?: string
}

const DAY_MS = 86_400_000
function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / DAY_MS)
}
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol

/**
 * Dollar-looking numbers in a memo: "1,809.20", "500", "300 and 100" → [1809.2, 500, 300, 100].
 * A number with a minus in front ("-500 for motorcycle") is money withheld, not sent, and is
 * skipped. Cash App ids (#D-…) are removed first.
 */
export function memoAmounts(memo: string | null | undefined): number[] {
  if (!memo) return []
  const out: number[] = []
  for (const m of memo.replace(/#D-[A-Z0-9]+/gi, ' ').matchAll(/(-\s*)?(?<![A-Za-z0-9])\$?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![A-Za-z0-9])/g)) {
    if (m[1]) continue
    const n = Number((m[2] ?? '').replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) out.push(n)
  }
  return out
}

export function matchCashAppTransactions(
  txs: readonly CashAppTxForMatch[],
  payments: readonly RecordedPaymentForMatch[],
  options: MatchCashAppOptions = {},
): { results: CashAppMatchResult[]; unmatchedPaymentIds: string[] } {
  const windowDays = options.windowDays ?? 7
  const memoWindowDays = options.memoWindowDays ?? 10
  const used = new Set<string>()
  // rule (e): memo numbers, each consumable once, keyed by payment id
  const memoNumbers = new Map<string, number[]>(payments.map((p) => [p.id, memoAmounts(p.memo)]))
  const results: CashAppMatchResult[] = []
  const byId = new Map(payments.map((p) => [p.id, p]))

  // (a) id in memo — independent of person/amount, so it runs for every tx first.
  const memoIndex: Array<{ id: string; memo: string }> = payments.filter((p) => p.memo).map((p) => ({ id: p.id, memo: (p.memo ?? '').toUpperCase() }))
  const pending: CashAppTxForMatch[] = []
  for (const tx of [...txs].sort((x, y) => x.occurredDate.localeCompare(y.occurredDate))) {
    const hit = memoIndex.find((m) => !used.has(m.id) && m.memo.includes(tx.id.toUpperCase()))
    if (hit) {
      used.add(hit.id)
      results.push({ txId: tx.id, outcome: 'matched', rule: 'id', paymentIds: [hit.id], personName: byId.get(hit.id)?.personName ?? tx.personName ?? '' })
    } else pending.push(tx)
  }

  for (const tx of pending) {
    const noteKind = classifyCashAppNote(tx.note)
    const people = tx.personName ? [tx.personName, ...(tx.altPersonNames ?? [])] : []
    let matched: CashAppMatchResult | null = null
    for (const person of people) {
      const cands = payments.filter((p) => !used.has(p.id) && p.personName === person && daysBetween(p.paidAt, tx.occurredDate) <= windowDays)
      // (b) exact amount, nearest date wins
      const exact = cands.filter((p) => near(p.amount, tx.amountSent)).sort((x, y) => daysBetween(x.paidAt, tx.occurredDate) - daysBetween(y.paidAt, tx.occurredDate))[0]
      if (exact) {
        matched = { txId: tx.id, outcome: 'matched', rule: 'amount', paymentIds: [exact.id], personName: person }
        break
      }
      // (c) sum of 2–3
      const combo = findSplit(cands, tx.amountSent)
      if (combo) {
        matched = { txId: tx.id, outcome: 'matched', rule: 'split', paymentIds: combo.map((p) => p.id), personName: person }
        break
      }
    }
    if (!matched) {
      // (e) a number in a recorded payment's memo equals the send
      for (const person of people) {
        const hit = payments
          .filter((p) => p.personName === person && daysBetween(p.paidAt, tx.occurredDate) <= memoWindowDays)
          .map((p) => ({ p, nums: memoNumbers.get(p.id) ?? [] }))
          .find(({ nums }) => nums.some((n) => near(n, tx.amountSent)))
        if (hit) {
          const nums = memoNumbers.get(hit.p.id) ?? []
          nums.splice(nums.findIndex((n) => near(n, tx.amountSent)), 1)
          matched = { txId: tx.id, outcome: 'matched', rule: 'memo', paymentIds: [hit.p.id], personName: person }
          break
        }
      }
    }
    if (matched) {
      // Rules a–c consume the payment; rule e consumed a memo number instead (one memo can back two sends).
      if (matched.rule !== 'memo') for (const id of matched.paymentIds) used.add(id)
      results.push(matched)
      continue
    }
    const person = tx.personName
    const first = person ? options.firstReportStartByPerson?.[person] : undefined
    const floor = first ?? options.recordsBeginYmd
    if (floor && tx.occurredDate < floor) {
      results.push({ txId: tx.id, outcome: 'before_records', personName: person, firstReportStart: floor, noteKind })
      continue
    }
    results.push({ txId: tx.id, outcome: 'unmatched', personName: person, noteKind })
  }

  // Matching walked the sends oldest-first (so an early send claims an early payment); hand the
  // results back in the caller's order.
  const order = new Map(txs.map((t, i) => [t.id, i]))
  results.sort((a, b) => (order.get(a.txId) ?? 0) - (order.get(b.txId) ?? 0))
  return { results, unmatchedPaymentIds: payments.filter((p) => !used.has(p.id)).map((p) => p.id) }
}

function findSplit(cands: readonly RecordedPaymentForMatch[], target: number): RecordedPaymentForMatch[] | null {
  const n = cands.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = cands[i]!, b = cands[j]!
      if (near(a.amount + b.amount, target, 0.021)) return [a, b]
      for (let k = j + 1; k < n; k++) {
        const c = cands[k]!
        if (near(a.amount + b.amount + c.amount, target, 0.031)) return [a, b, c]
      }
    }
  }
  return null
}

/** Summary counts for a batch, the numbers the modal header and the agent summary show. */
export function summarizeCashAppMatches(results: readonly CashAppMatchResult[]): {
  matched: number
  byRule: Record<CashAppMatchRule, number>
  beforeRecords: number
  unmatched: number
  unmatchedByKind: Record<CashAppNoteKind, number>
  unknownPerson: number
} {
  const s = { matched: 0, byRule: { id: 0, amount: 0, split: 0, memo: 0 }, beforeRecords: 0, unmatched: 0, unmatchedByKind: { pay: 0, advance: 0, expense: 0 }, unknownPerson: 0 }
  for (const r of results) {
    if (r.outcome === 'matched') {
      s.matched++
      s.byRule[r.rule]++
    } else if (r.outcome === 'before_records') s.beforeRecords++
    else {
      s.unmatched++
      s.unmatchedByKind[r.noteKind]++
      if (!r.personName) s.unknownPerson++
    }
  }
  return s
}
