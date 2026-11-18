// @vitest-environment jsdom
/**
 * The Lien desk's By date view through its hook (v2.7571): what it hands back before the desk's data has
 * loaded, the run tile's press by role, and the leader's Board switch. The rows, the Board and the reminder
 * with data are held where they were, by `LienDesk.render.test.tsx` through the desk itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useLienDeskBoard, type LienDeskBoardInput } from './useLienDeskBoard'

const seen = vi.hoisted(() => ({ confirms: 0, toasts: 0, approvals: 0 }))

vi.mock('../../contexts/ConfirmDialogContext', () => ({
  useConfirmDialog: () => () => {
    seen.confirms += 1
    return Promise.resolve(true)
  },
}))
vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    showToast: () => {
      seen.toasts += 1
    },
  }),
}))
vi.mock('../../lib/jobs/lienDeskIo', () => ({
  approveLienDeskItem: () => {
    seen.approvals += 1
    return Promise.resolve()
  },
  tellLeaderOfLienApproval: () => Promise.resolve({}),
  tellLeaderOfLienAffidavits: () => Promise.resolve({}),
  tellLeaderOfLienSignatures: () => Promise.resolve({}),
}))

const input = (over: Partial<LienDeskBoardInput> = {}): LienDeskBoardInput => ({
  data: null,
  todayYmd: '2026-11-17',
  authRole: 'assistant',
  authUserId: 'user-1',
  leader: false,
  office: true,
  shown: true,
  oneColumn: false,
  courtesyByJob: {},
  serveDue: [],
  serveJobs: [],
  onChanged: () => {},
  onOpenRun: () => {},
  ...over,
})

afterEach(() => {
  cleanup()
  seen.confirms = 0
  seen.toasts = 0
  seen.approvals = 0
})

describe('useLienDeskBoard', () => {
  it('hands back an empty view until the desk has data', () => {
    const { result } = renderHook(() => useLienDeskBoard(input()))
    expect(result.current.nextUpRows).toEqual([])
    expect(result.current.board).toBeNull()
    expect(result.current.publicLine).toBeNull()
    expect(result.current.leaderView).toBeNull()
    expect(result.current.boardPick).toBeNull()
    expect(result.current.doNowBarParts).toEqual([])
    expect(result.current.waitingRows).toEqual([])
    expect(result.current.reminderPlan).toBeNull()
    expect(result.current.reminderWords).toBeNull()
    expect(result.current.nextUpWaitingOn).toBeNull()
  })

  it('the run tile opens the run for the office and for nobody else', () => {
    const onOpenRun = vi.fn()
    const office = renderHook(() => useLienDeskBoard(input({ onOpenRun })))
    act(() => office.result.current.openBoardTile({ kind: 'run' }))
    expect(onOpenRun).toHaveBeenCalledTimes(1)

    const leaderOnly = renderHook(() => useLienDeskBoard(input({ onOpenRun, office: false, leader: true, authRole: 'master_technician' })))
    act(() => leaderOnly.result.current.openBoardTile({ kind: 'run' }))
    expect(onOpenRun).toHaveBeenCalledTimes(1)
  })

  it('no switch narrows the Board to a leader’s own bins: a master and the office read the same bins (v2.7708)', () => {
    const master = renderHook(() => useLienDeskBoard(input({ authRole: 'master_technician', leader: true, office: false })))
    expect('boardMine' in master.result.current).toBe(false)
    expect('toggleBoardMine' in master.result.current).toBe(false)

    const office = renderHook(() => useLienDeskBoard(input()))
    expect(office.result.current.leaderView).toBeNull()
  })

  it('with nothing waiting, the leader’s press and the reminder ask nothing and write nothing', async () => {
    const { result } = renderHook(() => useLienDeskBoard(input({ leader: true })))
    await act(async () => {
      await result.current.approveTheLot()
      await result.current.remindLeader()
    })
    expect(seen.confirms).toBe(0)
    expect(seen.approvals).toBe(0)
    expect(seen.toasts).toBe(0)
  })

  it('a risk or leader tile with no Board leaves the pick empty', () => {
    const { result } = renderHook(() => useLienDeskBoard(input()))
    act(() => result.current.openBoardTile({ kind: 'risk' }))
    expect(result.current.boardPick).toBeNull()
    act(() => result.current.openBoardTile({ kind: 'leader' }))
    expect(result.current.boardPick).toBeNull()
    act(() => result.current.pickBoardBins(null))
    expect(result.current.boardPick).toBeNull()
  })
})
