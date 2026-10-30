/**
 * Move cost (Banking → Cost batches): the rows a job carries, and the operations that move them.
 *
 * A job's cost sits in four streams the batch RPC can reach — bank-transaction allocations,
 * supply-house invoice allocations, clock sessions, Other job charges — and this kernel is the
 * one place that says which of them a batch can move and how each becomes an op:
 *   bank row    → `allocate` onto the target with `from_job_id` = the job the row is on now
 *   supply row  → `supply_repoint`
 *   clock row   → `clock_repoint` (a rejected session is not moved; its hours are not cost)
 *   other row   → listed, never moved: `cost_batch_apply` has no op that moves an Other charge
 * The database function stays the authority; `costBatchPayload.ts` mirrors its shape rules, this
 * file the screen's rules over live rows. Pure: no reads, no dates of its own.
 */
import type { CostBatchOp } from './costBatchPayload'

export type CostMoveSource = 'bank' | 'supply' | 'clock' | 'other'

export const COST_MOVE_SOURCES: readonly CostMoveSource[] = ['bank', 'supply', 'clock', 'other']

export const COST_MOVE_SOURCE_LABELS: Record<CostMoveSource, string> = {
  bank: 'Bank allocations',
  supply: 'Supply-house invoices',
  clock: 'Clock sessions',
  other: 'Other job charges',
}

/** The noun a counted press uses per source: `Tick 3 bank rows`, `Untick 1 invoice`, `Tick 81 sessions`. */
export const COST_MOVE_SOURCE_NOUNS: Record<CostMoveSource, readonly [one: string, many: string]> = {
  bank: ['bank row', 'bank rows'],
  supply: ['invoice', 'invoices'],
  clock: ['session', 'sessions'],
  other: ['charge', 'charges'],
}

export type CostMoveBankRow = {
  source: 'bank'
  /** `mercury_transaction_job_allocations.id` */
  allocationId: string
  txId: string
  /** `YYYY-MM-DD` in company time, or null when the transaction has no posted_at. */
  postedYmd: string | null
  counterparty: string | null
  /** Lower-cased Mercury debit card id from the transaction's raw JSON, when it was a card. */
  cardId: string | null
  cardNickname: string | null
  category: string | null
  /** The whole transaction, signed as the bank stores it (outflows negative). */
  txAmount: number
  /** This job's slice, signed like the transaction. */
  allocationAmount: number
  note: string | null
}

export type CostMoveSupplyRow = {
  source: 'supply'
  invoiceId: string
  supplyHouse: string | null
  invoiceNumber: string
  invoiceYmd: string
  /** The invoice's whole amount. */
  amount: number
  /** This job's share, 0–100. */
  pct: number
  isPaid: boolean
  purchaseOrder: string | null
}

export type CostMoveClockRow = {
  source: 'clock'
  sessionId: string
  userId: string
  personName: string | null
  workYmd: string
  minutes: number
  approved: boolean
  rejected: boolean
  /** Bid time carries a bid id; the RPC refuses to repoint it and so does this kernel. */
  bidId: string | null
}

export type CostMoveOtherRow = {
  source: 'other'
  chargeId: string
  description: string
  amount: number
}

export type CostMoveRow = CostMoveBankRow | CostMoveSupplyRow | CostMoveClockRow | CostMoveOtherRow

/** One stable key per row, across sources — the selection set holds these. */
export function costMoveRowKey(row: CostMoveRow): string {
  switch (row.source) {
    case 'bank':
      return `bank:${row.allocationId}`
    case 'supply':
      return `supply:${row.invoiceId}`
    case 'clock':
      return `clock:${row.sessionId}`
    case 'other':
      return `other:${row.chargeId}`
  }
}

export type CostMoveHold = { movable: true } | { movable: false; why: string }

export const OTHER_CHARGE_HOLD = 'Other job charges cannot be moved by a cost batch: the RPC has no op for them. Re-enter the charge on the other job by hand.'
export const REJECTED_SESSION_HOLD = 'A rejected clock session is not cost; it stays where it is.'
export const BID_TIME_HOLD = 'Bid time cannot be repointed onto a job.'

/** Whether a batch can move the row, and if not, the sentence the screen shows beside it. */
export function costMoveHold(row: CostMoveRow): CostMoveHold {
  switch (row.source) {
    case 'other':
      return { movable: false, why: OTHER_CHARGE_HOLD }
    case 'clock':
      if (row.rejected) return { movable: false, why: REJECTED_SESSION_HOLD }
      if (row.bidId) return { movable: false, why: BID_TIME_HOLD }
      return { movable: true }
    case 'bank':
    case 'supply':
      return { movable: true }
  }
}

/** The dollars a row puts on the job: a bank slice as the bank signs it, an invoice's share of its amount, nothing for time. */
export function costMoveRowDollars(row: CostMoveRow): number {
  switch (row.source) {
    case 'bank':
      return round2(row.allocationAmount)
    case 'supply':
      return round2((row.amount * row.pct) / 100)
    case 'other':
      return round2(row.amount)
    case 'clock':
      return 0
  }
}

export type CostMoveSourceTotals = {
  rows: number
  /** Signed dollars (bank outflows are negative, as the ledger shows them). */
  dollars: number
  /** Clock minutes; 0 for the other sources. */
  minutes: number
}

export type CostMoveTotals = {
  bySource: Record<CostMoveSource, CostMoveSourceTotals>
  all: CostMoveSourceTotals
}

export function costMoveTotals(rows: readonly CostMoveRow[]): CostMoveTotals {
  const empty = (): CostMoveSourceTotals => ({ rows: 0, dollars: 0, minutes: 0 })
  const bySource: Record<CostMoveSource, CostMoveSourceTotals> = { bank: empty(), supply: empty(), clock: empty(), other: empty() }
  const all = empty()
  for (const row of rows) {
    const t = bySource[row.source]
    t.rows += 1
    all.rows += 1
    const d = costMoveRowDollars(row)
    t.dollars += d
    all.dollars += d
    // A rejected session's hours are not cost: counted as a row, left out of the hours.
    if (row.source === 'clock' && !row.rejected) {
      t.minutes += row.minutes
      all.minutes += row.minutes
    }
  }
  for (const t of [...Object.values(bySource), all]) t.dollars = round2(t.dollars)
  return { bySource, all }
}

/**
 * The totals in one line, each source by its own measure so bank outflows and invoice dollars are never
 * added together: `421 bank rows (-$38,865.64) · 10 invoices ($9,433.39) · 83 sessions (676.6 h) · 2 Other charges ($240.00)`.
 */
export function costMoveTotalsWords(t: CostMoveTotals): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return [
    `${n(t.bySource.bank.rows, 'bank row', 'bank rows')} (${usdWords(t.bySource.bank.dollars)})`,
    `${n(t.bySource.supply.rows, 'invoice', 'invoices')} (${usdWords(t.bySource.supply.dollars)})`,
    `${n(t.bySource.clock.rows, 'session', 'sessions')} (${costMoveHoursWords(t.bySource.clock.minutes)})`,
    `${n(t.bySource.other.rows, 'Other charge', 'Other charges')} (${usdWords(t.bySource.other.dollars)})`,
  ].join(' · ')
}

function usdWords(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** `9.5 h` — clock minutes as hours with one decimal, the way the Move cost tables read them. */
export function costMoveHoursWords(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`
}

// ── selection helpers ──────────────────────────────────────────────────────────

/** The keys of every movable row from one source. */
export function costMoveKeysBySource(rows: readonly CostMoveRow[], source: CostMoveSource): string[] {
  return rows.filter((r) => r.source === source && costMoveHold(r).movable).map(costMoveRowKey)
}

/** The keys of every bank row swiped on one card (`cardId` lower-cased; `null` picks the rows with no card). */
export function costMoveKeysByCard(rows: readonly CostMoveRow[], cardId: string | null): string[] {
  const want = cardId === null ? null : cardId.toLowerCase()
  return rows.filter((r): r is CostMoveBankRow => r.source === 'bank' && r.cardId === want).map(costMoveRowKey)
}

/** The day a row happened: a bank row's posting day, an invoice's date, a session's work date; an Other charge has none. */
export function costMoveRowYmd(row: CostMoveRow): string | null {
  switch (row.source) {
    case 'bank':
      return row.postedYmd
    case 'supply':
      return row.invoiceYmd
    case 'clock':
      return row.workYmd
    case 'other':
      return null
  }
}

/**
 * The keys of every movable row whose day falls inside `[fromYmd, toYmd]` (either end open when
 * empty). A row with no day is never picked by a date range.
 */
export function costMoveKeysByDateRange(rows: readonly CostMoveRow[], fromYmd: string, toYmd: string): string[] {
  const from = fromYmd.trim()
  const to = toYmd.trim()
  return rows
    .filter((r) => {
      if (!costMoveHold(r).movable) return false
      const ymd = costMoveRowYmd(r)
      if (!ymd) return false
      if (from && ymd < from) return false
      if (to && ymd > to) return false
      return true
    })
    .map(costMoveRowKey)
}

/** The distinct cards among the bank rows, most rows first, each with its nickname when one is known. */
export function costMoveCardsPresent(rows: readonly CostMoveRow[]): { cardId: string | null; nickname: string | null; rows: number }[] {
  const seen = new Map<string | null, { cardId: string | null; nickname: string | null; rows: number }>()
  for (const r of rows) {
    if (r.source !== 'bank') continue
    const cur = seen.get(r.cardId)
    if (cur) {
      cur.rows += 1
      if (!cur.nickname && r.cardNickname) cur.nickname = r.cardNickname
    } else seen.set(r.cardId, { cardId: r.cardId, nickname: r.cardNickname, rows: 1 })
  }
  return [...seen.values()].sort((a, b) => b.rows - a.rows || String(a.cardId).localeCompare(String(b.cardId)))
}

/** Clock rows grouped by person, each group's rows by work date, the groups by name. */
export function groupClockRowsByPerson(rows: readonly CostMoveRow[]): { userId: string; personName: string; rows: CostMoveClockRow[]; minutes: number }[] {
  const groups = new Map<string, { userId: string; personName: string; rows: CostMoveClockRow[]; minutes: number }>()
  for (const r of rows) {
    if (r.source !== 'clock') continue
    const g = groups.get(r.userId) ?? { userId: r.userId, personName: r.personName ?? 'Unnamed', rows: [], minutes: 0 }
    g.rows.push(r)
    if (!r.rejected) g.minutes += r.minutes
    groups.set(r.userId, g)
  }
  const out = [...groups.values()]
  for (const g of out) g.rows.sort((a, b) => a.workYmd.localeCompare(b.workYmd) || a.sessionId.localeCompare(b.sessionId))
  return out.sort((a, b) => a.personName.localeCompare(b.personName) || a.userId.localeCompare(b.userId))
}

// ── ops ────────────────────────────────────────────────────────────────────────

export type CostMoveOpsInput = {
  /** The job the rows sit on now — every `allocate` carries it as `from_job_id`. */
  sourceJobId: string
  targetJobId: string
  rows: readonly CostMoveRow[]
  /** Written on each moved bank allocation (`allocate.note`); the house form is `Move cost <date>`. */
  allocationNote?: string
}

export type CostMoveSkipped = { row: CostMoveRow; why: string }

export type CostMoveOps = {
  ops: CostBatchOp[]
  /** Rows the plan leaves where they are, each with its reason — the screen lists them under the button. */
  skipped: CostMoveSkipped[]
  /** Movable rows by source, for the note bodies and the button's count. */
  moved: Record<CostMoveSource, number>
  /** Dollars the bank allocations carry, positive, to the cent (what `by_job.allocated` will read). */
  allocatedDollars: number
}

/**
 * The ops that move `rows` from the source job to the target, in row order. A bank row becomes an
 * `allocate` of its slice (positive dollars; the function signs it like the transaction) with
 * `from_job_id` = the source job, so the catch-all's allocation is removed in the same op. Rows the
 * kernel holds (`costMoveHold`) are returned under `skipped`, never silently dropped.
 */
export function buildCostMoveOps(input: CostMoveOpsInput): CostMoveOps {
  const ops: CostBatchOp[] = []
  const skipped: CostMoveSkipped[] = []
  const moved: Record<CostMoveSource, number> = { bank: 0, supply: 0, clock: 0, other: 0 }
  let allocated = 0
  const note = input.allocationNote?.trim() || undefined
  for (const row of input.rows) {
    const hold = costMoveHold(row)
    if (!hold.movable) {
      skipped.push({ row, why: hold.why })
      continue
    }
    switch (row.source) {
      case 'bank': {
        const amount = round2(Math.abs(row.allocationAmount))
        if (amount <= 0) {
          skipped.push({ row, why: 'A zero allocation has nothing to move.' })
          continue
        }
        ops.push({
          op: 'allocate',
          tx_id: row.txId,
          job_id: input.targetJobId,
          amount,
          ...(note ? { note } : {}),
          from_job_id: input.sourceJobId,
        })
        allocated += amount
        moved.bank += 1
        break
      }
      case 'supply':
        ops.push({ op: 'supply_repoint', invoice_id: row.invoiceId, from_job_id: input.sourceJobId, to_job_id: input.targetJobId })
        moved.supply += 1
        break
      case 'clock':
        ops.push({ op: 'clock_repoint', session_id: row.sessionId, to_job_id: input.targetJobId })
        moved.clock += 1
        break
      case 'other':
        // unreachable: costMoveHold holds every Other charge
        skipped.push({ row, why: OTHER_CHARGE_HOLD })
        break
    }
  }
  return { ops, skipped, moved, allocatedDollars: round2(allocated) }
}
