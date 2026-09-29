import { describe, expect, it } from 'vitest'
import { cardEventRowsFromJobSummaryRows, cardEventRowsFromSnapshotLines } from './jobCardChargeEvents'
import type { JobSummaryMercuryAllocationRow } from '../../types/jobSummary'

const toYmd = (raw: string | null | undefined) => (raw ? raw.slice(0, 10) : null)
const line = (id: string, amount: number, postedAt: string | null = '2026-09-02T15:00:00Z') => ({
  id,
  mercuryTransactionId: `tx-${id}`,
  allocationAmount: amount,
  note: null,
  postedAt,
  counterpartyName: id,
  debitCardId: null,
})

describe('cardEventRowsFromSnapshotLines — the Job window’s cost timeline', () => {
  it('keeps what the parts cost counts, at its signed cost, and flags the fuel', () => {
    const rows = cardEventRowsFromSnapshotLines(
      [line('gas', -60), line('pipe', -100, '2026-09-03T15:00:00Z'), line('refund', 15), line('transfer', -500), line('invoiced', -40)],
      {
        exclusions: { bucketByTxId: new Map([['tx-transfer', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx-invoiced']) },
        fuelTxIds: new Set(['tx-gas']),
        toYmd,
      },
    )
    expect(rows.map((r) => [r.counterpartyName, r.dateKey, r.amount, r.fuel])).toEqual([
      ['gas', '2026-09-02', 60, true],
      ['pipe', '2026-09-03', 100, false],
      ['refund', '2026-09-02', -15, false],
    ])
  })

  it('with no lookups every line counts and none is fuel', () => {
    const rows = cardEventRowsFromSnapshotLines([line('a', -10), { ...line('b', -5), mercuryTransactionId: null }], { exclusions: undefined, fuelTxIds: undefined, toYmd })
    expect(rows.map((r) => [r.amount, r.fuel])).toEqual([[10, false], [5, false]])
  })
})

describe('cardEventRowsFromJobSummaryRows — Job Summary’s cost timeline', () => {
  const row = (id: string, amount: number, over: Partial<JobSummaryMercuryAllocationRow> = {}): JobSummaryMercuryAllocationRow => ({
    id,
    mercury_transaction_id: `tx-${id}`,
    amount,
    note: null,
    attributionDisplayName: 'Al',
    mercury_transactions: { posted_at: '2026-09-02T15:00:00Z', counterparty_name: id, amount, note: null, external_memo: null, raw: null },
    ...over,
  })

  it('leaves out a charge counted on a supply invoice, nets a refund, and flags the fuel', () => {
    const rows = cardEventRowsFromJobSummaryRows(
      [row('gas', -60, { isFuel: true }), row('invoiced', -40, { linkedToSupplyInvoice: true }), row('refund', 15)],
      toYmd,
    )
    expect(rows.map((r) => [r.counterpartyName, r.amount, r.fuel, r.attributionDisplayName])).toEqual([
      ['gas', 60, true, 'Al'],
      ['refund', -15, false, 'Al'],
    ])
  })

  it('a row with no transaction embed has no date', () => {
    expect(cardEventRowsFromJobSummaryRows([row('x', -5, { mercury_transactions: null })], toYmd)[0]).toMatchObject({ dateKey: null, counterpartyName: null })
  })
})
