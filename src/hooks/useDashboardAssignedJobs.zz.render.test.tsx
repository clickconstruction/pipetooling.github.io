// @vitest-environment jsdom
/**
 * The Dashboard's job cards and ZZ test jobs (punch list #61, v2.5122): the assigned, team ready-to-bill and
 * superintendent lists hold until the shared ids land, like Ready to bill, then drop a ZZ job by its name or
 * by the ids (two of the RPCs return no customer name). Made-up jobs.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ZzTestJobIdsState } from './useZzTestJobIds'

const ROWS = [
  { id: 'A', job_name: '101 Hill Street' },
  { id: 'Z', job_name: 'ZZ TEST working' },
  { id: 'Y', job_name: 'Hill Street remodel' },
]
vi.mock('../lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: ROWS, error: null }) } }))
vi.mock('../utils/errorHandling', () => ({ withSupabaseRetry: async (op: () => Promise<{ data: unknown }>) => (await op()).data }))
let zz: ZzTestJobIdsState = { ids: null, status: 'loading', retry: () => {} }
vi.mock('./useZzTestJobIds', () => ({ useZzTestJobIds: () => zz }))
let hidden = true
vi.mock('../lib/jobs/zzTestJobSwitch', () => ({ useZzTestJobsHidden: () => hidden }))

const { useDashboardAssignedJobs } = await import('./useDashboardAssignedJobs')
const render = () => renderHook(() => useDashboardAssignedJobs({ authUserId: 'u-ann', role: 'primary' }))

describe('useDashboardAssignedJobs · ZZ test jobs', () => {
  it('holds the lists while the ids load', async () => {
    hidden = true
    zz = { ids: null, status: 'loading', retry: () => {} }
    const { result } = render()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.assignedJobs).toEqual([])
    expect(result.current.assignedReadyToBillJobs).toEqual([])
    expect(result.current.assignedJobsLoading).toBe(true)
  })

  it('drops a ZZ job by its name and a ZZ customer’s job by the ids once they land', async () => {
    hidden = true
    zz = { ids: new Set(['Z', 'Y']), status: 'ready', retry: () => {} }
    const { result } = render()
    await waitFor(() => expect(result.current.assignedJobs.map((j) => j.id)).toEqual(['A']))
    await waitFor(() => expect(result.current.assignedReadyToBillJobs.map((j) => j.id)).toEqual(['A']))
  })

  it('a dev who shows them gets every row', async () => {
    hidden = false
    zz = { ids: null, status: 'off', retry: () => {} }
    const { result } = render()
    await waitFor(() => expect(result.current.assignedJobs.map((j) => j.id)).toEqual(['A', 'Z', 'Y']))
  })
})
