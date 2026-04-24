import { describe, expect, it, vi } from 'vitest'
import type { MercuryJobAllocationWithAttributionRow } from './fetchMercuryJobAllocationsWithAttributionForJob'
import * as fetchJobMod from './fetchMercuryJobAllocationsWithAttributionForJob'
import { fetchUnattributedMercuryLinesForManyJobs } from './fetchUnattributedMercuryForManyJobs'

function sampleRow(
  id: string,
  tx: string,
  amount: number,
  attribution: string | null,
): MercuryJobAllocationWithAttributionRow {
  return {
    id,
    amount,
    note: null,
    mercury_transaction_id: tx,
    attributionDisplayName: attribution,
    mercury_transactions: {
      posted_at: '2020-01-15',
      counterparty_name: 'X',
      amount: 1,
      note: null,
      external_memo: null,
      mercury_account_id: 'a1',
      raw: null,
    },
  }
}

describe('fetchUnattributedMercuryLinesForManyJobs', () => {
  it('merges multiple jobs and uses cache when provided', async () => {
    const spy = vi.spyOn(fetchJobMod, 'fetchMercuryJobAllocationsWithAttributionForJob')
    try {
      spy.mockImplementation(async (jobId: string) => {
        if (jobId === 'j1') {
          return [sampleRow('1', 'txA', 10, null), sampleRow('2', 'txA', 5, null)]
        }
        return [sampleRow('3', 'txB', 3, null)]
      })
      const cache = new Map<string, MercuryJobAllocationWithAttributionRow[]>()
      cache.set('j1', [sampleRow('1', 'txA', 10, null), sampleRow('2', 'txA', 5, null)])

      const out = await fetchUnattributedMercuryLinesForManyJobs({
        jobIds: ['j1', 'j2'],
        jobLabelById: { j1: '100 · A', j2: '200 · B' },
        cacheByJobId: cache,
        operationLabel: 'test',
        concurrency: 2,
      })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('j2', expect.stringContaining('test'))
      const j1rows = out.filter((r) => r.jobId === 'j1')
      expect(j1rows.length).toBe(1)
      expect(j1rows[0]!.lineAmount).toBe(15)
      expect(j1rows[0]!.jobLabel).toBe('100 · A')
      const j2rows = out.filter((r) => r.jobId === 'j2')
      expect(j2rows.length).toBe(1)
      expect(j2rows[0]!.mercury_transaction_id).toBe('txB')
    } finally {
      spy.mockRestore()
    }
  })
})
