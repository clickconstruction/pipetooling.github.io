// @vitest-environment jsdom
/**
 * The Needs you line's count (punch list #238, PR 2): the deck's own candidates through the same
 * kernel, quiet until asked and on a refused read, and read again when a press lands anywhere.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JOB_KIND_CHANGED_EVENT } from '../lib/jobs/jobKindWrite'
import type { JobKindCandidates, JobKindJobSource } from '../lib/needsYou/fillInJobKinds'
import { useJobKindGaps } from './useJobKindGaps'

const job = (id: string, over: Partial<JobKindJobSource> = {}): JobKindJobSource => ({
  id,
  status: 'working',
  billing_only: false,
  kind: null,
  hcp_number: '',
  click_number: id,
  bid_id: null,
  project_id: null,
  revenue: 0,
  first_work_date: '2026-09-01',
  job_name: null,
  job_address: null,
  customer_name: null,
  created_at: null,
  ...over,
})

afterEach(cleanup)

describe('useJobKindGaps', () => {
  it('counts what the kernel reads as not set and reads again on a press', async () => {
    let candidates: JobKindCandidates = { jobs: [job('a'), job('b'), job('c', { kind: 'project' })], fixtures: [] }
    const io = { fetchCandidates: vi.fn(async () => candidates) }
    const { result } = renderHook(() => useJobKindGaps(true, io))
    await waitFor(() => expect(result.current.gaps).toEqual({ count: 2 }))
    candidates = { jobs: [job('a')], fixtures: [] }
    act(() => {
      window.dispatchEvent(new Event(JOB_KIND_CHANGED_EVENT))
    })
    await waitFor(() => expect(result.current.gaps).toEqual({ count: 1 }))
  })

  it('stays quiet when it is off, and on a refused read', async () => {
    const off = { fetchCandidates: vi.fn(async (): Promise<JobKindCandidates> => ({ jobs: [job('a')], fixtures: [] })) }
    const { result: quiet } = renderHook(() => useJobKindGaps(false, off))
    await new Promise((r) => setTimeout(r, 0))
    expect(quiet.current.gaps).toBeNull()
    expect(off.fetchCandidates).not.toHaveBeenCalled()

    const refused = { fetchCandidates: vi.fn(async (): Promise<JobKindCandidates> => { throw new Error('refused') }) }
    const { result } = renderHook(() => useJobKindGaps(true, refused))
    await waitFor(() => expect(refused.fetchCandidates).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.gaps).toBeNull()
  })
})
