// @vitest-environment jsdom
/**
 * The hook behind the run's first step (punch list #362, step 5): when the left-out rows are read, what a failed
 * read leaves, and what the two writes send. The checklist's rules are `lienGetItRight.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { buildLienBoard } from '../../lib/jobs/lienBoard'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import type { LienLeftOutRow } from '../../lib/jobs/lienLeftOut'
import { buildLienNextUp } from '../../lib/jobs/lienNextUp'
import { useLienGetItRight } from './useLienGetItRight'

const readMock = vi.fn<() => Promise<LienLeftOutRow[]>>()
const writeMock = vi.fn<(w: unknown) => Promise<{ changed: boolean }>>()
vi.mock('../../lib/jobs/lienLeftOutIo', () => ({ readLienLeftOut: () => readMock(), writeLienLeftOut: (w: unknown) => writeMock(w) }))

const TODAY = '2026-11-15'
const RUN_DAY = '2026-11-16'
const notices: LienDeskEntry[] = [{ jobId: 'cedar', customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1900, hasOwner: false, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-09'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: RUN_DAY, daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile: 'needs_owner' }]
const board = buildLienBoard({ notices, affidavits: [], retainage: [], todayYmd: TODAY, jobNumber: (id) => `ZZ-${id}`, jobName: (id) => `ZZ ${id}`, gcName: () => 'ZZ Builders', leaderName: 'Sam' })
const rows = buildLienNextUp({ notices, affidavits: [], retainage: [], letterTwoByJob: {}, role: 'assistant', todayYmd: TODAY, jobTitle: (id) => `ZZ ${id}`, gcName: () => 'ZZ Builders' })
const jobTitle = (id: string) => `ZZ ${id}`
const left = (over: Partial<LienLeftOutRow> = {}): LienLeftOutRow => ({ id: 'r1', jobId: 'cedar', paper: 'notice', runDay: RUN_DAY, reason: 'customer_paying', note: '', leftOutBy: 'u-rosa', leftOutAt: '2026-11-15T16:00:00Z', putBackBy: null, putBackAt: null, ...over })

const mount = (shown = true) => renderHook((p: { shown: boolean; refreshKey: unknown }) => useLienGetItRight({ shown: p.shown, board, rows, todayYmd: TODAY, jobTitle, refreshKey: p.refreshKey }), { initialProps: { shown, refreshKey: 1 } })

beforeEach(() => {
  readMock.mockReset().mockResolvedValue([])
  writeMock.mockReset().mockResolvedValue({ changed: true })
})
afterEach(cleanup)

describe('useLienGetItRight', () => {
  it('reads nothing while To do is not shown, and has no checklist until the rows are read', async () => {
    const view = mount(false)
    expect(readMock).not.toHaveBeenCalled()
    expect(view.result.current.run).toBeNull()
    view.rerender({ shown: true, refreshKey: 1 })
    await waitFor(() => expect(view.result.current.run).not.toBeNull())
    expect(readMock).toHaveBeenCalledTimes(1)
    expect(view.result.current.run!.counts).toMatchObject({ papers: 1, settle: 1, leftOut: 0 })
  })

  it('reads again when the desk re-reads', async () => {
    const view = mount()
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(1))
    readMock.mockResolvedValue([left()])
    view.rerender({ shown: true, refreshKey: 2 })
    await waitFor(() => expect(view.result.current.run?.counts.leftOut).toBe(1))
    expect(readMock).toHaveBeenCalledTimes(2)
  })

  it('a failed read leaves no checklist and says its reason, and a later good read brings it back', async () => {
    readMock.mockRejectedValueOnce({ message: 'permission denied for table lien_run_left_out', code: '42501' })
    const view = mount()
    await waitFor(() => expect(view.result.current.failure).not.toBeNull())
    expect(view.result.current.run).toBeNull()
    expect(view.result.current.open).toBe(false)
    await act(async () => {
      await view.result.current.reload()
    })
    expect(view.result.current.failure).toBeNull()
    expect(view.result.current.run).not.toBeNull()
  })

  it('opens only while there is a checklist to show', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current.run).not.toBeNull())
    expect(view.result.current.open).toBe(false)
    act(() => view.result.current.setOpen(true))
    expect(view.result.current.open).toBe(true)
  })

  it('Leave out writes the paper with the run’s own day, then reads again', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current.run).not.toBeNull())
    const line = view.result.current.run!.settle[0]!
    readMock.mockResolvedValue([left()])
    await act(async () => {
      await view.result.current.leaveOut(line, 'customer_paying', 'A check is promised.')
    })
    expect(writeMock).toHaveBeenCalledWith({ jobId: 'cedar', paper: 'notice', leftOut: true, runDay: RUN_DAY, reason: 'customer_paying', note: 'A check is promised.' })
    expect(view.result.current.run!.counts).toMatchObject({ papers: 0, settle: 0, leftOut: 1 })
  })

  it('Put it back writes the paper with no run, then reads again', async () => {
    readMock.mockResolvedValue([left()])
    const view = mount()
    await waitFor(() => expect(view.result.current.run?.counts.leftOut).toBe(1))
    readMock.mockResolvedValue([])
    await act(async () => {
      await view.result.current.putBack(view.result.current.run!.leftOut[0]!)
    })
    expect(writeMock).toHaveBeenCalledWith({ jobId: 'cedar', paper: 'notice', leftOut: false })
    expect(view.result.current.run!.counts).toMatchObject({ settle: 1, leftOut: 0 })
  })

  it('a refused write is the caller’s to show, and nothing is read again', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current.run).not.toBeNull())
    writeMock.mockRejectedValueOnce(new Error('Not authorized to leave a lien paper out of the run'))
    await expect(view.result.current.leaveOut(view.result.current.run!.settle[0]!, 'other', 'why')).rejects.toThrow('Not authorized')
    expect(readMock).toHaveBeenCalledTimes(1)
  })
})
