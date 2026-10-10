// @vitest-environment jsdom
/**
 * Demand deadlines and ZZ test jobs (punch list #61, review on #5250): a letter on a ZZ test job leaves the count,
 * by the shared ids. A failed id read counts every letter, since a deadline warns about real money. The overdue
 * kernel is a stand-in here (its own suite covers the money): every letter it is handed counts. Made-up jobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const LETTERS = [
  { id: 'dA', job_id: 'A', invoice_ids: [], deadline_date: '2026-09-01', sent_at: '2026-08-01', voided_at: null },
  { id: 'dY', job_id: 'Y', invoice_ids: [], deadline_date: '2026-09-01', sent_at: '2026-08-01', voided_at: null },
]
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'not', 'lt', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: LETTERS, error: null })
      return chain
    },
  },
}))
vi.mock('../lib/jobs/demandLetterTracking', () => ({
  demandLettersOverdue: (letters: { job_id: string }[]) => ({ count: letters.length, total: 0, jobIds: letters.map((l) => l.job_id) }),
}))
const loadIds = vi.fn()
// A failed read throws inside the stand-in (a rejected promise handed back by a vi.fn reads as unhandled).
let idsFail = false
vi.mock('../lib/jobs/zzTestJobRows', () => ({
  loadZzTestJobIds: async (...a: unknown[]) => {
    const ids = loadIds(...a)
    if (idsFail) throw new Error('down')
    return ids
  },
}))

const { useDemandDeadlinesNudge } = await import('./useDemandDeadlinesNudge')

const read = async (hide: boolean) => {
  const { result } = renderHook(() => useDemandDeadlinesNudge(true, hide, 'u-ann'))
  await waitFor(() => expect(result.current.overdue).not.toBeNull())
  return result.current.overdue!
}

beforeEach(() => {
  loadIds.mockReset()
  idsFail = false
})

describe('useDemandDeadlinesNudge · ZZ test jobs', () => {
  it('a letter on a ZZ customer’s job leaves the count', async () => {
    loadIds.mockResolvedValue(new Set(['Y']))
    expect((await read(true)).jobIds).toEqual(['A'])
    expect(loadIds).toHaveBeenCalledWith('u-ann')
  })

  it('a failed id read counts every letter', async () => {
    idsFail = true
    expect((await read(true)).jobIds).toEqual(['A', 'Y'])
  })

  it('for a dev who shows ZZ jobs, every letter counts and no ids are read', async () => {
    expect((await read(false)).jobIds).toEqual(['A', 'Y'])
    expect(loadIds).not.toHaveBeenCalled()
  })
})
