// @vitest-environment jsdom
/**
 * The rings' reads (the Board's B2b-vi-c, `useRingLayers`): driven by `ringStages(role)`, each layer read once after the
 * board paints and set only once its read succeeds. A dev with jobs being built reads every layer and then sees each stage
 * ready; an estimator, who sees the bidding ring only, reads none; a failed read leaves its stages waiting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../lib/gc/scheduleIo', () => ({ loadSchedule: vi.fn() }))
vi.mock('../../lib/gc/dailyLogIo', () => ({ loadGcDailyLogs: vi.fn(), loadGcCrewOnSite: vi.fn() }))
vi.mock('../../lib/gc/changeOrderOfficeIo', () => ({ loadGcChangeOrdersOffice: vi.fn() }))
vi.mock('../../lib/gc/drawsIo', () => ({ loadGcDraws: vi.fn() }))
vi.mock('../../lib/gc/submittalsIo', () => ({ loadGcSubmittals: vi.fn() }))
vi.mock('../../lib/gc/gcIo', () => ({ loadGcChangeRequests: vi.fn() }))
vi.mock('../../lib/gc/punchIo', () => ({ loadGcPunch: vi.fn() }))
vi.mock('../../lib/gc/crewJobIo', () => ({ loadCrewJobs: vi.fn() }))

import { loadGcChangeOrdersOffice } from '../../lib/gc/changeOrderOfficeIo'
import { loadCrewJobs } from '../../lib/gc/crewJobIo'
import { loadGcCrewOnSite, loadGcDailyLogs } from '../../lib/gc/dailyLogIo'
import { NO_DRAWS } from '../../lib/gc/drawRows'
import { loadGcDraws } from '../../lib/gc/drawsIo'
import { loadGcChangeRequests } from '../../lib/gc/gcIo'
import { loadGcPunch } from '../../lib/gc/punchIo'
import { loadSchedule } from '../../lib/gc/scheduleIo'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { loadGcSubmittals } from '../../lib/gc/submittalsIo'
import { useRingLayers } from './useRingLayers'

const board = initialGcState()
const building = board.projects.filter((p) => p.stage === 'building').map((p) => p.id)

beforeEach(() => {
  vi.mocked(loadSchedule).mockResolvedValue(null)
  vi.mocked(loadGcDailyLogs).mockResolvedValue([])
  vi.mocked(loadGcCrewOnSite).mockResolvedValue([])
  vi.mocked(loadGcChangeOrdersOffice).mockResolvedValue([])
  vi.mocked(loadGcDraws).mockResolvedValue(NO_DRAWS)
  vi.mocked(loadGcSubmittals).mockResolvedValue({ submittals: [], holds: [], rounds: [] })
  vi.mocked(loadGcChangeRequests).mockResolvedValue([])
  vi.mocked(loadGcPunch).mockResolvedValue([])
  vi.mocked(loadCrewJobs).mockResolvedValue([])
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useRingLayers (the Board’s B2b-vi-c)', () => {
  it('reads every layer once for a dev, then each stage is ready', async () => {
    const { result } = renderHook(() => useRingLayers(board, 'dev', [], board.today))
    expect([...(result.current?.ready ?? [])]).toEqual(['pursuing'])
    await waitFor(() => expect([...(result.current?.ready ?? [])].sort()).toEqual(['building', 'buyout', 'pursuing']))
    expect(loadGcPunch).toHaveBeenCalledTimes(1)
    expect(loadGcPunch).toHaveBeenCalledWith(building)
    expect(loadGcSubmittals).toHaveBeenCalledWith(building)
    const scheduled = board.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building').map((p) => p.id)
    expect(vi.mocked(loadSchedule).mock.calls.map(([, id]) => id).sort()).toEqual([...scheduled].sort())
    expect(result.current?.failed).toBe(false)
  })

  it('reads nothing for an estimator, who sees the bidding ring only', async () => {
    const { result } = renderHook(() => useRingLayers(board, 'estimator', [], board.today))
    expect([...(result.current?.shown ?? [])]).toEqual(['pursuing'])
    expect([...(result.current?.ready ?? [])]).toEqual(['pursuing'])
    await Promise.resolve()
    for (const load of [loadSchedule, loadGcDailyLogs, loadGcChangeOrdersOffice, loadGcDraws, loadGcSubmittals, loadGcChangeRequests, loadGcPunch, loadCrewJobs]) {
      expect(load).not.toHaveBeenCalled()
    }
  })

  it('leaves a stage waiting when one of its reads fails, and says a read failed', async () => {
    vi.mocked(loadGcPunch).mockRejectedValue(new Error('no'))
    const { result } = renderHook(() => useRingLayers(board, 'dev', [], board.today))
    await waitFor(() => expect(result.current?.failed).toBe(true))
    await waitFor(() => expect(result.current?.ready.has('buyout')).toBe(true))
    expect(result.current?.ready.has('building')).toBe(false)
  })
})
