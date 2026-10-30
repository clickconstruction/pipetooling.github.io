import { describe, expect, it } from 'vitest'
import {
  BID_TIME_HOLD,
  OTHER_CHARGE_HOLD,
  REJECTED_SESSION_HOLD,
  buildCostMoveOps,
  costMoveCardsPresent,
  costMoveHold,
  costMoveKeysByCard,
  costMoveKeysByDateRange,
  costMoveKeysBySource,
  costMoveRowDollars,
  costMoveRowKey,
  costMoveTotals,
  costMoveTotalsWords,
  groupClockRowsByPerson,
  type CostMoveBankRow,
  type CostMoveClockRow,
  type CostMoveOtherRow,
  type CostMoveRow,
  type CostMoveSupplyRow,
} from './costMoveRows'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const TX1 = '33333333-3333-4333-8333-333333333331'
const TX2 = '33333333-3333-4333-8333-333333333332'
const INV = '44444444-4444-4444-8444-444444444444'
const S1 = '55555555-5555-4555-8555-555555555551'
const S2 = '55555555-5555-4555-8555-555555555552'
const S3 = '55555555-5555-4555-8555-555555555553'

function bank(p: Partial<CostMoveBankRow> = {}): CostMoveBankRow {
  return {
    source: 'bank',
    allocationId: 'a1',
    txId: TX1,
    postedYmd: '2026-09-10',
    counterparty: 'Shell',
    cardId: 'card-aaaa',
    cardNickname: 'Truck 2',
    category: 'Fuel',
    txAmount: -84.1,
    allocationAmount: -84.1,
    note: null,
    ...p,
  }
}
function supply(p: Partial<CostMoveSupplyRow> = {}): CostMoveSupplyRow {
  return { source: 'supply', invoiceId: INV, supplyHouse: 'Reece', invoiceNumber: '4471', invoiceYmd: '2026-10-08', amount: 507.8, pct: 100, isPaid: false, purchaseOrder: 'Gun Dog', ...p }
}
function clock(p: Partial<CostMoveClockRow> = {}): CostMoveClockRow {
  return { source: 'clock', sessionId: S1, userId: 'u1', personName: 'Malachi', workYmd: '2026-10-26', minutes: 570, approved: true, rejected: false, bidId: null, ...p }
}
function other(p: Partial<CostMoveOtherRow> = {}): CostMoveOtherRow {
  return { source: 'other', chargeId: 'o1', description: 'ESTIMATE — mobilization', amount: 2500, ...p }
}

describe('costMoveRowKey / costMoveHold', () => {
  it('keys each source by its own id', () => {
    expect(costMoveRowKey(bank())).toBe('bank:a1')
    expect(costMoveRowKey(supply())).toBe(`supply:${INV}`)
    expect(costMoveRowKey(clock())).toBe(`clock:${S1}`)
    expect(costMoveRowKey(other())).toBe('other:o1')
  })

  it('holds Other charges, rejected sessions and bid time; moves the rest', () => {
    expect(costMoveHold(bank())).toEqual({ movable: true })
    expect(costMoveHold(supply())).toEqual({ movable: true })
    expect(costMoveHold(clock())).toEqual({ movable: true })
    expect(costMoveHold(clock({ approved: false }))).toEqual({ movable: true })
    expect(costMoveHold(other())).toEqual({ movable: false, why: OTHER_CHARGE_HOLD })
    expect(costMoveHold(clock({ rejected: true }))).toEqual({ movable: false, why: REJECTED_SESSION_HOLD })
    expect(costMoveHold(clock({ bidId: 'b1' }))).toEqual({ movable: false, why: BID_TIME_HOLD })
  })
})

describe('costMoveRowDollars / costMoveTotals', () => {
  it('reads a bank slice signed, an invoice by its share, a charge whole and time as nothing', () => {
    expect(costMoveRowDollars(bank())).toBe(-84.1)
    expect(costMoveRowDollars(supply({ amount: 1000, pct: 33.333 }))).toBe(333.33)
    expect(costMoveRowDollars(other())).toBe(2500)
    expect(costMoveRowDollars(clock())).toBe(0)
  })

  it('totals per source and overall, to the cent, with clock minutes', () => {
    const rows: CostMoveRow[] = [bank(), bank({ allocationId: 'a2', txId: TX2, allocationAmount: -0.1, txAmount: -0.1 }), supply(), clock(), clock({ sessionId: S2, minutes: 30 }), other()]
    const t = costMoveTotals(rows)
    expect(t.bySource.bank).toEqual({ rows: 2, dollars: -84.2, minutes: 0 })
    expect(t.bySource.supply).toEqual({ rows: 1, dollars: 507.8, minutes: 0 })
    expect(t.bySource.clock).toEqual({ rows: 2, dollars: 0, minutes: 600 })
    expect(t.bySource.other).toEqual({ rows: 1, dollars: 2500, minutes: 0 })
    expect(t.all).toEqual({ rows: 6, dollars: 2923.6, minutes: 600 })
  })

  it('counts a rejected session as a row but leaves its hours out', () => {
    const t = costMoveTotals([clock(), clock({ sessionId: S2, minutes: 60, rejected: true })])
    expect(t.bySource.clock).toEqual({ rows: 2, dollars: 0, minutes: 570 })
  })

  it('says the totals source by source, never adding bank outflows to invoice dollars', () => {
    const rows: CostMoveRow[] = [bank(), bank({ allocationId: 'a2', txId: TX2, allocationAmount: -0.1, txAmount: -0.1 }), supply(), clock(), other()]
    expect(costMoveTotalsWords(costMoveTotals(rows))).toBe('2 bank rows (-$84.20) · 1 invoice ($507.80) · 1 session (9.5 h) · 1 Other charge ($2,500.00)')
    expect(costMoveTotalsWords(costMoveTotals([]))).toBe('0 bank rows ($0.00) · 0 invoices ($0.00) · 0 sessions (0.0 h) · 0 Other charges ($0.00)')
  })
})

describe('selection helpers', () => {
  const rows: CostMoveRow[] = [
    bank(),
    bank({ allocationId: 'a2', txId: TX2, cardId: 'card-bbbb', cardNickname: null, postedYmd: '2026-10-02' }),
    bank({ allocationId: 'a3', cardId: null, cardNickname: null, postedYmd: null }),
    supply(),
    clock(),
    clock({ sessionId: S2, rejected: true, workYmd: '2026-10-27' }),
    other(),
  ]

  it('picks a source, movable rows only', () => {
    expect(costMoveKeysBySource(rows, 'bank')).toEqual(['bank:a1', 'bank:a2', 'bank:a3'])
    expect(costMoveKeysBySource(rows, 'clock')).toEqual([`clock:${S1}`])
    expect(costMoveKeysBySource(rows, 'other')).toEqual([])
  })

  it('picks a card, lower-cased, and the rows with no card for null', () => {
    expect(costMoveKeysByCard(rows, 'CARD-AAAA')).toEqual(['bank:a1'])
    expect(costMoveKeysByCard(rows, null)).toEqual(['bank:a3'])
  })

  it('picks a date range over every dated, movable row; an open end is open', () => {
    expect(costMoveKeysByDateRange(rows, '2026-10-01', '2026-10-31')).toEqual(['bank:a2', `supply:${INV}`, `clock:${S1}`])
    expect(costMoveKeysByDateRange(rows, '', '2026-09-30')).toEqual(['bank:a1'])
    expect(costMoveKeysByDateRange(rows, '2026-10-27', '')).toEqual([])
  })

  it('lists the cards present, most rows first, with a nickname when one is known', () => {
    expect(costMoveCardsPresent(rows)).toEqual([
      { cardId: 'card-aaaa', nickname: 'Truck 2', rows: 1 },
      { cardId: 'card-bbbb', nickname: null, rows: 1 },
      { cardId: null, nickname: null, rows: 1 },
    ])
  })

  it('groups clock rows by person, minutes without the rejected ones', () => {
    const groups = groupClockRowsByPerson([...rows, clock({ sessionId: S3, userId: 'u0', personName: 'Aaron', minutes: 60 })])
    expect(groups.map((g) => g.personName)).toEqual(['Aaron', 'Malachi'])
    expect(groups[1]!.rows.map((r) => r.sessionId)).toEqual([S1, S2])
    expect(groups[1]!.minutes).toBe(570)
  })
})

describe('buildCostMoveOps', () => {
  it('turns bank rows into allocate ops with from_job_id, positive dollars and the note', () => {
    const out = buildCostMoveOps({ sourceJobId: SOURCE, targetJobId: TARGET, rows: [bank(), bank({ allocationId: 'a2', txId: TX2, allocationAmount: 12.345, txAmount: 50 })], allocationNote: ' Move cost 2026-10-29 ' })
    expect(out.ops).toEqual([
      { op: 'allocate', tx_id: TX1, job_id: TARGET, amount: 84.1, note: 'Move cost 2026-10-29', from_job_id: SOURCE },
      { op: 'allocate', tx_id: TX2, job_id: TARGET, amount: 12.35, note: 'Move cost 2026-10-29', from_job_id: SOURCE },
    ])
    expect(out.allocatedDollars).toBe(96.45)
    expect(out.moved).toEqual({ bank: 2, supply: 0, clock: 0, other: 0 })
    expect(out.skipped).toEqual([])
  })

  it('repoints invoices and sessions, skips the holds with their reason, never drops a row silently', () => {
    const rejected = clock({ sessionId: S2, rejected: true })
    const charge = other()
    const out = buildCostMoveOps({ sourceJobId: SOURCE, targetJobId: TARGET, rows: [supply(), clock(), rejected, charge] })
    expect(out.ops).toEqual([
      { op: 'supply_repoint', invoice_id: INV, from_job_id: SOURCE, to_job_id: TARGET },
      { op: 'clock_repoint', session_id: S1, to_job_id: TARGET },
    ])
    expect(out.skipped).toEqual([
      { row: rejected, why: REJECTED_SESSION_HOLD },
      { row: charge, why: OTHER_CHARGE_HOLD },
    ])
    expect(out.moved).toEqual({ bank: 0, supply: 1, clock: 1, other: 0 })
  })

  it('skips a zero allocation and leaves the note off when blank', () => {
    const zero = bank({ allocationAmount: 0 })
    const out = buildCostMoveOps({ sourceJobId: SOURCE, targetJobId: TARGET, rows: [zero, bank({ allocationId: 'a2', txId: TX2 })], allocationNote: '   ' })
    expect(out.skipped).toEqual([{ row: zero, why: 'A zero allocation has nothing to move.' }])
    expect(out.ops).toEqual([{ op: 'allocate', tx_id: TX2, job_id: TARGET, amount: 84.1, from_job_id: SOURCE }])
  })
})
