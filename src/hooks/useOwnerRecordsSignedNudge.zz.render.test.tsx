// @vitest-environment jsdom
/**
 * The owner-signed line and ZZ test jobs (punch list #61, review on #5250): a request whose seed job is a ZZ test job
 * leaves the line, by the shared ids. A failed id read keeps every request, since an owner who signed waits on real
 * records. The line's kernel is a stand-in here: it counts the requests it is handed. Made-up rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const ROWS = [
  { id: 'rA', seed_job_id: 'A', job_ids: ['A'], property_address: '101 Hill Street', file: null },
  { id: 'rY', seed_job_id: 'Y', job_ids: ['Y'], property_address: '9 Test Lane', file: null },
  { id: 'rN', seed_job_id: null, job_ids: [], property_address: '12 Oak Road', file: null },
]
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'order', 'limit']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: ROWS, error: null })
      return chain
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => (await op()).data,
}))
vi.mock('../lib/jobs/ownerRecords', () => ({
  ownerRecordsSignedWaiting: (rows: { id: string }[]) => ({ count: rows.length, first: { requestId: rows.map((r) => r.id).join(','), jobId: null, name: '', address: '', signedOn: '' } }),
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

const { useOwnerRecordsSignedNudge } = await import('./useOwnerRecordsSignedNudge')

const read = async (hide: boolean) => {
  const { result } = renderHook(() => useOwnerRecordsSignedNudge(true, hide, 'u-ann'))
  await waitFor(() => expect(result.current.signed).not.toBeNull())
  return result.current.signed!.first.requestId
}

beforeEach(() => {
  loadIds.mockReset()
  idsFail = false
})

describe('useOwnerRecordsSignedNudge · ZZ test jobs', () => {
  it('a request on a ZZ test job leaves the line; one with no seed job stays', async () => {
    loadIds.mockResolvedValue(new Set(['Y']))
    expect(await read(true)).toBe('rA,rN')
    expect(loadIds).toHaveBeenCalledWith('u-ann')
  })

  it('a failed id read keeps every request', async () => {
    idsFail = true
    expect(await read(true)).toBe('rA,rY,rN')
  })

  it('for a dev who shows ZZ jobs, every request stays and no ids are read', async () => {
    expect(await read(false)).toBe('rA,rY,rN')
    expect(loadIds).not.toHaveBeenCalled()
  })
})
