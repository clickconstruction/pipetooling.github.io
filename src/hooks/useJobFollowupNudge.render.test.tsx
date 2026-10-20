// @vitest-environment jsdom
/**
 * The follow-ups nudge's two figures (v2.5512): the quiet count leaves the idle cards to the idle card, the idle
 * summary counts them with their contract and the reader's own, and with the ZZ switch a ZZ test job leaves the idle
 * figures by its names or the shared ids (punch list #61). Made-up jobs; the kernel is real.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const ymdAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
const cand = (id: string, over: Record<string, unknown>) => ({
  id,
  stage: 'working',
  hcpNumber: id,
  jobName: `Job ${id}`,
  address: '1 Main',
  customerName: 'Ann Lee',
  pctComplete: 50,
  revenue: 1000,
  paymentsMade: 0,
  latestActivityAt: new Date().toISOString(),
  nextScheduledOn: null,
  lastWorkYmd: ymdAgo(40),
  createdYmd: ymdAgo(90),
  masterUserId: 'u-other',
  ...over,
})
const CANDS = [
  cand('A', { revenue: 900, masterUserId: 'u-me' }),
  cand('Z', { jobName: 'ZZ TEST idle', revenue: 2200 }),
  cand('Y', { customerName: 'Hill Street', revenue: 300 }),
  cand('Q', { stage: 'billed', lastWorkYmd: ymdAgo(5), latestActivityAt: new Date(Date.now() - 12 * 86400000).toISOString() }),
]
vi.mock('../lib/jobs/jobFollowupStore', async () => {
  const actual = await vi.importActual<typeof import('../lib/jobs/jobFollowupStore')>('../lib/jobs/jobFollowupStore')
  const { DEFAULT_JOB_FOLLOWUP_SETTINGS } = await import('../lib/jobs/jobFollowupQueue')
  return {
    ...actual,
    fetchJobFollowupCandidates: () => Promise.resolve(CANDS),
    fetchJobFollowupReviews: () => Promise.resolve([]),
    fetchJobFollowupSettings: () => Promise.resolve(DEFAULT_JOB_FOLLOWUP_SETTINGS),
  }
})
const loadIds = vi.fn(async (_u: unknown) => new Set(['Y']))
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: (u: unknown) => loadIds(u) }))

const { useJobFollowupNudge } = await import('./useJobFollowupNudge')

describe('useJobFollowupNudge (v2.5512)', () => {
  it('counts the quiet cards alone and sums the idle ones with the reader’s own', async () => {
    const { result } = renderHook(() => useJobFollowupNudge(true, { userId: 'u-me' }))
    await waitFor(() => expect(result.current.idle).not.toBeNull())
    expect(result.current.count).toBe(1)
    expect(result.current.stageCounts?.billed).toBe(1)
    expect(result.current.idle).toEqual({ count: 3, total: 3400, mine: 1 })
    expect(loadIds).not.toHaveBeenCalled()
  })

  it('with the ZZ switch, a ZZ job leaves the idle figures by its name or the shared ids', async () => {
    const { result } = renderHook(() => useJobFollowupNudge(true, { userId: 'u-me', hideZzTestJobs: true }))
    await waitFor(() => expect(result.current.idle).not.toBeNull())
    expect(result.current.idle).toEqual({ count: 1, total: 900, mine: 1 })
    expect(loadIds).toHaveBeenCalledWith('u-me')
  })

  it('off, it reports nothing', async () => {
    const { result } = renderHook(() => useJobFollowupNudge(false))
    expect(result.current).toEqual({ count: null, stageCounts: null, idle: null })
  })
})
