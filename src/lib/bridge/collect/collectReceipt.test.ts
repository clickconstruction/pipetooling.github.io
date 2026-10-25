import { describe, expect, it } from 'vitest'
import type { CollectBillRead } from './collectPile'
import { collectReceiptFor } from './collectReceipt'

const bill = (over: Partial<CollectBillRead>): CollectBillRead => ({ key: 'inv:1', jobId: 'j', payerId: 'c', payerName: 'A payer', billedYmd: '2026-09-24', usd: 100, state: 'notdue', isGc: false, gcByRecord: false, paceDays: 12, paceSource: 'segment', paceSamples: 150, expectedYmd: '2026-10-06', daysPastExpected: -1, ageDays: 10, promise: null, ...over })

describe('collectReceiptFor (v2.5857)', () => {
  it('reads the expected day and names its source', () => {
    expect(collectReceiptFor(bill({ paceSource: 'own', paceDays: 35, expectedYmd: '2026-10-29' }))).toEqual({ expectedYmd: '2026-10-29', source: 'pays in ~35d', basis: 'customer', paceDays: 35 })
    expect(collectReceiptFor(bill({ paceSource: 'gc', paceDays: 30, isGc: true, expectedYmd: '2026-10-24' }))).toEqual({ expectedYmd: '2026-10-24', source: 'the GC pace here ~30d', basis: 'company', paceDays: 30 })
    expect(collectReceiptFor(bill({ paceSource: 'segment', paceDays: 12, isGc: true }))).toMatchObject({ source: 'commercial pace ~12d', basis: 'company' })
    expect(collectReceiptFor(bill({ paceSource: 'segment', paceDays: 2 }))).toMatchObject({ source: 'their segment’s pace ~2d' })
    expect(collectReceiptFor(bill({ paceSource: 'company', paceDays: 7 }))).toMatchObject({ source: 'company pace ~7d', basis: 'company', paceDays: 7 })
  })
  it('reads a promise as promised, with no pace, and nothing when the bill has no day', () => {
    expect(collectReceiptFor(bill({ promise: { promisedYmd: '2026-11-06', markedByName: 'Taunya' }, expectedYmd: '2026-11-06', state: 'promised' }))).toEqual({ expectedYmd: '2026-11-06', source: 'promised', basis: 'promised', paceDays: null })
    expect(collectReceiptFor(bill({ expectedYmd: null, paceSource: 'none', paceDays: null }))).toBeNull()
  })
})
