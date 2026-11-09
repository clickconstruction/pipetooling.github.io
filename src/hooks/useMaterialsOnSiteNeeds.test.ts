// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

/**
 * The Needs you card's materials hook (punch list #209, v2.6728) over a faked on-site store: the desk's
 * load is asked for once, the facts come from the store's jobs through the summary kernel, a job
 * still loading or a ZZ test job the viewer hides is left out, and nothing reads until the desk has.
 */
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state = {
    version: 0,
    desk: { loaded: false, loading: false, error: null as string | null, raw: null as unknown },
    jobs: {} as Record<string, { loaded: boolean; containers: unknown[]; movements: unknown[] }>,
    loadDesk: vi.fn(async () => {}),
    bump() {
      state.version += 1
      for (const l of listeners) l()
    },
    listeners,
  }
  return state
})

vi.mock('../lib/materials/onSiteStore', () => ({
  loadDesk: store.loadDesk,
  deskLoadState: () => store.desk,
  jobIdsWithData: () => Object.keys(store.jobs),
  jobLoadState: (id: string) => ({ loaded: store.jobs[id]?.loaded ?? false, loading: false, error: null, raw: null }),
  listContainers: (id: string) => store.jobs[id]?.containers ?? [],
  listMovements: (id: string) => store.jobs[id]?.movements ?? [],
  subscribe: (l: () => void) => {
    store.listeners.add(l)
    return () => store.listeners.delete(l)
  },
  getVersion: () => store.version,
  priceOf: (key: string) => (key === 'id:p1' ? 20 : null),
  serverSummary: () => null,
}))
const zz = vi.hoisted(() => ({ ids: new Set<string>() }))
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: vi.fn(async () => zz.ids) }))

import { useMaterialsOnSiteNeeds } from './useMaterialsOnSiteNeeds'

const NOW = new Date('2026-11-08T18:00:00Z')
const box = (id: string, jobId: string, kind = 'cage') => ({ id, jobId, label: id.toUpperCase(), kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' })
const mv = (over: Record<string, unknown>) => ({ id: String(Math.random()), jobId: 'j1', partId: 'p1', partName: 'Copper 90', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  store.desk = { loaded: false, loading: false, error: null, raw: null }
  store.jobs = {}
  store.loadDesk.mockClear()
  zz.ids = new Set()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function seed() {
  // j1: box A1 counted today at 8 of 10 expected (2 short at $20), box B2 never counted.
  store.jobs.j1 = {
    loaded: true,
    containers: [box('a1', 'j1'), box('b2', 'j1')],
    movements: [
      mv({ reason: 'delivered', quantity: 10, at: '2026-11-01T10:00:00Z', toContainerId: 'a1' }),
      mv({ reason: 'counted', quantity: 8, at: '2026-11-08T10:00:00Z', fromContainerId: 'a1' }),
      mv({ reason: 'delivered', quantity: 4, at: '2026-11-01T10:00:00Z', toContainerId: 'b2' }),
    ],
  }
  // j2: one box counted yesterday, nothing short.
  store.jobs.j2 = { loaded: true, containers: [box('c1', 'j2')], movements: [mv({ jobId: 'j2', reason: 'counted', quantity: 3, at: '2026-11-07T10:00:00Z', fromContainerId: 'c1' })] }
}

describe('useMaterialsOnSiteNeeds', () => {
  it('asks the store for the desk once, and reads nothing until it has loaded', () => {
    const { result } = renderHook(() => useMaterialsOnSiteNeeds(true, { hideZzTestJobs: false, userId: 'u1' }))
    expect(store.loadDesk).toHaveBeenCalledTimes(1)
    expect(result.current.needs).toBeNull()
  })

  it('reads the desk’s jobs through the summary kernel once the desk has loaded, and moves with the store', () => {
    seed()
    store.desk = { loaded: true, loading: false, error: null, raw: null }
    const { result } = renderHook(() => useMaterialsOnSiteNeeds(true, { hideZzTestJobs: false, userId: 'u1' }))
    expect(result.current.needs).toEqual({ staleBoxes: 1, staleJobs: 1, staleJobId: 'j1', missingLines: 1, missingMoneyWeek: 40, missingJobs: 1, missingJobId: 'j1' })
    // A count on B2 lands in the store: the box is no longer due.
    act(() => {
      store.jobs.j1!.movements.push(mv({ reason: 'counted', quantity: 4, at: '2026-11-08T12:00:00Z', fromContainerId: 'b2' }))
      store.bump()
    })
    expect(result.current.needs).toMatchObject({ staleBoxes: 0, staleJobs: 0, staleJobId: null, missingLines: 1 })
  })

  it('leaves out a job still loading, and a ZZ test job when the viewer hides them', async () => {
    seed()
    store.jobs.j3 = { loaded: false, containers: [box('z9', 'j3')], movements: [] }
    store.desk = { loaded: true, loading: false, error: null, raw: null }
    zz.ids = new Set(['j1'])
    const { result } = renderHook(() => useMaterialsOnSiteNeeds(true, { hideZzTestJobs: true, userId: 'u1' }))
    // Null until the ZZ ids are known, then j1 (hidden) and j3 (loading) are out and j2 alone is read.
    await waitFor(() => expect(result.current.needs).not.toBeNull())
    expect(result.current.needs).toEqual({ staleBoxes: 0, staleJobs: 0, staleJobId: null, missingLines: 0, missingMoneyWeek: 0, missingJobs: 0, missingJobId: null })
  })

  it('stays quiet when off or when the desk’s read was refused', () => {
    seed()
    store.desk = { loaded: true, loading: false, error: 'refused', raw: null }
    const a = renderHook(() => useMaterialsOnSiteNeeds(true, { hideZzTestJobs: false, userId: 'u1' }))
    expect(a.result.current.needs).toBeNull()
    a.unmount()
    store.desk = { loaded: true, loading: false, error: null, raw: null }
    store.loadDesk.mockClear()
    const b = renderHook(() => useMaterialsOnSiteNeeds(false, { hideZzTestJobs: false, userId: 'u1' }))
    expect(b.result.current.needs).toBeNull()
    expect(store.loadDesk).not.toHaveBeenCalled()
  })
})
