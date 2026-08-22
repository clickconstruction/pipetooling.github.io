import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()
const maybeSingleMock = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingleMock() }),
      }),
    }),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (fn: () => Promise<{ data: unknown; error: unknown }>) => {
    const { data, error } = await fn()
    if (error) throw error
    return data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))

import { propagateReportPctToJob } from './propagateReportPctToJob'

const COMPLETE_100 = { 'How complete is the job?': '100' }

describe('propagateReportPctToJob', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    maybeSingleMock.mockReset()
  })

  it('returns the job status with no error when the RPC succeeds', async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: 'working', pct_complete: 40 }, error: null })
    rpcMock.mockResolvedValue({ data: { ok: true, previous: 40, pct: 100 }, error: null })
    const result = await propagateReportPctToJob('job-1', COMPLETE_100)
    expect(result).toEqual({ jobStatus: 'working', pctError: null })
    expect(rpcMock).toHaveBeenCalledWith('set_job_pct_from_field', {
      p_job_id: 'job-1',
      p_pct: 100,
      p_note: 'from field report',
    })
  })

  it('surfaces an in-band RPC {error} instead of swallowing it', async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: 'working', pct_complete: null }, error: null })
    rpcMock.mockResolvedValue({
      data: { error: "Not authorized to update this job's percent complete" },
      error: null,
    })
    const result = await propagateReportPctToJob('job-1', COMPLETE_100)
    expect(result.jobStatus).toBe('working')
    expect(result.pctError).toBe("Not authorized to update this job's percent complete")
  })

  it('surfaces an RPC transport error', async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: 'working', pct_complete: null }, error: null })
    rpcMock.mockResolvedValue({ data: null, error: { message: 'FetchError: network down' } })
    const result = await propagateReportPctToJob('job-1', COMPLETE_100)
    expect(result.jobStatus).toBe('working')
    expect(result.pctError).toBe('FetchError: network down')
  })

  it('skips the RPC (no error) when the report pct matches the job', async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: 'working', pct_complete: 100 }, error: null })
    const result = await propagateReportPctToJob('job-1', COMPLETE_100)
    expect(result).toEqual({ jobStatus: 'working', pctError: null })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('reports the lookup failure and a null status when the job read throws', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error('RLS says no') })
    const result = await propagateReportPctToJob('job-1', COMPLETE_100)
    expect(result.jobStatus).toBeNull()
    expect(result.pctError).toBe('RLS says no')
  })
})
