import { describe, expect, it } from 'vitest'
import { dedupeUnattributedRows } from './dedupeUnattributedMercuryRows'
import type { MercuryJobAllocationWithAttributionRow } from './fetchMercuryJobAllocationsWithAttributionForJob'

function row(
  partial: Partial<MercuryJobAllocationWithAttributionRow> & {
    id: string
    mercury_transaction_id: string
    amount: number
  },
): MercuryJobAllocationWithAttributionRow {
  return {
    id: partial.id,
    amount: partial.amount,
    note: null,
    mercury_transaction_id: partial.mercury_transaction_id,
    attributionDisplayName: partial.attributionDisplayName ?? null,
    mercury_transactions: null,
  }
}

describe('dedupeUnattributedRows', () => {
  it('drops rows with attributionDisplayName set', () => {
    const out = dedupeUnattributedRows([
      row({
        id: 'a',
        mercury_transaction_id: 'tx1',
        amount: 10,
        attributionDisplayName: 'Pat',
      }),
    ])
    expect(out).toEqual([])
  })

  it('dedupes by mercury_transaction_id and sums abs(amount)', () => {
    const out = dedupeUnattributedRows([
      row({ id: '1', mercury_transaction_id: 'tx1', amount: 10, attributionDisplayName: null }),
      row({ id: '2', mercury_transaction_id: 'tx1', amount: -5, attributionDisplayName: null }),
      row({ id: '3', mercury_transaction_id: 'tx2', amount: 3, attributionDisplayName: null }),
    ])
    const byTx = new Map(out.map((l) => [l.mercury_transaction_id, l.lineAmount]))
    expect(byTx.get('tx1')).toBe(15)
    expect(byTx.get('tx2')).toBe(3)
  })
})
