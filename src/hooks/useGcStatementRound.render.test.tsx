// @vitest-environment jsdom
/**
 * The GC statement round's data (the GC_REVIEW_MODAL map's step 8), on the hook: the week's
 * certifications, this week's marks, six weeks of marks and the round GCs' senders are read
 * while it is open and never while it is shut; each refresher reads its part again; a failed
 * read empties that part (and says the certifications failed); a new week or a new list of GCs
 * reads again, and an answer for a list that is gone, or for a shut window, is dropped.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { GcReviewCertRow } from '../lib/jobs/gcReviewCertification'
import type { RoundMarkRow } from '../lib/jobs/gcStatementRounds'

const io = vi.hoisted(() => ({
  certs: vi.fn<(weekStart: string) => Promise<unknown[]>>(),
  marks: vi.fn<(weekStart: string) => Promise<unknown[]>>(),
  marksSince: vi.fn<(since: string) => Promise<unknown[]>>(),
  senders: vi.fn<(gcIds: string[]) => Promise<Map<string, string>>>(),
}))
vi.mock('../lib/gcReviewCertifications', () => ({ listGcReviewCertifications: io.certs }))
vi.mock('../lib/gcStatementRoundIo', () => ({
  listGcStatementRoundMarks: io.marks,
  listGcStatementRoundMarksSince: io.marksSince,
  listGcStatementSenders: io.senders,
}))

import { useGcStatementRound, type UseGcStatementRoundInput } from './useGcStatementRound'

/** A Monday; the six board weeks run from five Mondays before it. */
const WEEK = '2026-10-05'
const SIX_WEEKS_BACK = '2026-08-31'
const NEXT_WEEK = '2026-10-12'
const cert = (gcId: string, week = WEEK) => ({ week_start: week, gc_customer_id: gcId, certified_by_name: 'Taunya', certified_at: `${week}T15:00:00Z`, job_count: 1, total: 1000, snapshot: null, note: '' }) as GcReviewCertRow
const mark = (gcId: string, week = WEEK) => ({ gc_customer_id: gcId, week_start: week, action: 'sent', acted_by: 'u-taunya', acted_by_name: 'Taunya', acted_at: `${week}T16:00:00Z`, channel: 'email', note: null, temperature: null, expected_pay_by: null }) as RoundMarkRow

/** A promise the test settles by hand, to hold an answer back. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  io.certs.mockReset().mockImplementation(async (week) => [cert('gc-knight', week)])
  io.marks.mockReset().mockImplementation(async (week) => [mark('gc-loberg', week)])
  io.marksSince.mockReset().mockImplementation(async () => [mark('gc-loberg'), mark('gc-loberg', '2026-09-21')])
  io.senders.mockReset().mockImplementation(async (ids) => new Map(ids.map((id) => [id, 'u-taunya'] as const)))
})

const GC_IDS = ['gc-knight', 'gc-loberg']
function mount(over: Partial<UseGcStatementRoundInput> = {}) {
  return renderHook((p: UseGcStatementRoundInput) => useGcStatementRound(p), { initialProps: { open: true, certWeekStart: WEEK, roundGcIds: GC_IDS, ...over } })
}

describe('useGcStatementRound', () => {
  it('reads the week while open: the certifications, this week’s marks, six weeks of marks and each round GC’s sender', async () => {
    const { result } = mount()
    expect(result.current.certsRead).toBe('reading')
    await waitFor(() => expect(result.current.certsRead).toBe('read'))
    expect(io.certs).toHaveBeenCalledWith(WEEK)
    expect(io.marks).toHaveBeenCalledWith(WEEK)
    expect(io.marksSince).toHaveBeenCalledWith(SIX_WEEKS_BACK)
    expect(io.senders).toHaveBeenCalledWith(GC_IDS)
    expect(result.current.certRows.map((r) => r.gc_customer_id)).toEqual(['gc-knight'])
    await waitFor(() => expect(result.current.roundMarks.map((m) => m.gc_customer_id)).toEqual(['gc-loberg']))
    expect(result.current.boardMarks.map((m) => m.week_start)).toEqual([WEEK, '2026-09-21'])
    await waitFor(() => expect([...result.current.roundSenders]).toEqual([['gc-knight', 'u-taunya'], ['gc-loberg', 'u-taunya']]))
  })

  it('reads nothing while shut, and reads the week afresh each time it opens', async () => {
    const view = mount({ open: false })
    await act(async () => {})
    expect(io.certs).not.toHaveBeenCalled()
    expect(io.marks).not.toHaveBeenCalled()
    expect(io.marksSince).not.toHaveBeenCalled()
    expect(io.senders).not.toHaveBeenCalled()
    view.rerender({ open: true, certWeekStart: WEEK, roundGcIds: GC_IDS })
    await waitFor(() => expect(view.result.current.certsRead).toBe('read'))
    view.rerender({ open: false, certWeekStart: WEEK, roundGcIds: GC_IDS })
    view.rerender({ open: true, certWeekStart: WEEK, roundGcIds: GC_IDS })
    await act(async () => {})
    expect(io.certs).toHaveBeenCalledTimes(2)
    expect(io.marks).toHaveBeenCalledTimes(2)
    expect(io.marksSince).toHaveBeenCalledTimes(2)
    expect(io.senders).toHaveBeenCalledTimes(2)
  })

  it('refreshCerts reads the week again; a failed read empties the rows and says so, and the next good read says read', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.certRows).toHaveLength(1))
    io.certs.mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.refreshCerts())
    await waitFor(() => expect(result.current.certsRead).toBe('failed'))
    expect(result.current.certRows).toEqual([])
    io.certs.mockImplementationOnce(async () => [cert('gc-knight'), cert('gc-harper')])
    act(() => result.current.refreshCerts())
    await waitFor(() => expect(result.current.certsRead).toBe('read'))
    expect(result.current.certRows.map((r) => r.gc_customer_id)).toEqual(['gc-knight', 'gc-harper'])
    expect(io.certs).toHaveBeenCalledTimes(3)
  })

  it('refreshRoundMarks reads both lists again, and a failed read empties that list alone', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.boardMarks).toHaveLength(2))
    io.marks.mockImplementationOnce(async () => [mark('gc-loberg'), mark('gc-knight')])
    io.marksSince.mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.refreshRoundMarks())
    await waitFor(() => expect(result.current.roundMarks).toHaveLength(2))
    await waitFor(() => expect(result.current.boardMarks).toEqual([]))
    io.marks.mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.refreshRoundMarks())
    await waitFor(() => expect(result.current.roundMarks).toEqual([]))
    await waitFor(() => expect(result.current.boardMarks).toHaveLength(2))
    expect(io.marks).toHaveBeenCalledTimes(3)
    expect(io.marksSince).toHaveBeenCalledTimes(3)
  })

  it('a new week reads that week', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current.certsRead).toBe('read'))
    view.rerender({ open: true, certWeekStart: NEXT_WEEK, roundGcIds: GC_IDS })
    await waitFor(() => expect(io.certs).toHaveBeenLastCalledWith(NEXT_WEEK))
    expect(io.marks).toHaveBeenLastCalledWith(NEXT_WEEK)
    expect(io.marksSince).toHaveBeenLastCalledWith('2026-09-07')
    await waitFor(() => expect(view.result.current.certRows[0]?.week_start).toBe(NEXT_WEEK))
    // A refresher after the change reads the new week, not the one it was made for.
    act(() => view.result.current.refreshRoundMarks())
    expect(io.marks).toHaveBeenLastCalledWith(NEXT_WEEK)
  })

  it('the senders follow the round’s GCs, and an answer for a list that is gone is dropped', async () => {
    const first = deferred<Map<string, string>>()
    io.senders.mockImplementationOnce(() => first.promise)
    const view = mount()
    view.rerender({ open: true, certWeekStart: WEEK, roundGcIds: ['gc-harper'] })
    await waitFor(() => expect(view.result.current.roundSenders.get('gc-harper')).toBe('u-taunya'))
    expect(io.senders).toHaveBeenLastCalledWith(['gc-harper'])
    await act(async () => first.resolve(new Map([['gc-knight', 'u-old']])))
    expect([...view.result.current.roundSenders]).toEqual([['gc-harper', 'u-taunya']])
  })

  it('shutting the window drops a senders answer still on its way', async () => {
    const late = deferred<Map<string, string>>()
    io.senders.mockImplementationOnce(() => late.promise)
    const view = mount()
    view.rerender({ open: false, certWeekStart: WEEK, roundGcIds: GC_IDS })
    await act(async () => late.resolve(new Map([['gc-knight', 'u-late']])))
    expect(view.result.current.roundSenders.size).toBe(0)
  })

  it('reloadSenders reads the round GCs’ senders and keeps them; a failed read rejects for the caller to say so', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.roundSenders.size).toBe(2))
    io.senders.mockImplementationOnce(async () => new Map([['gc-knight', 'u-malachi']]))
    await act(async () => {
      await result.current.reloadSenders()
    })
    expect(io.senders).toHaveBeenLastCalledWith(GC_IDS)
    expect([...result.current.roundSenders]).toEqual([['gc-knight', 'u-malachi']])
    io.senders.mockRejectedValueOnce(new Error('offline'))
    await expect(result.current.reloadSenders()).rejects.toThrow('offline')
    expect([...result.current.roundSenders]).toEqual([['gc-knight', 'u-malachi']])
  })

  it('reloadSenders reads the GCs the round has now, not the ones it started with', async () => {
    const view = mount()
    await waitFor(() => expect(view.result.current.roundSenders.size).toBe(2))
    view.rerender({ open: true, certWeekStart: WEEK, roundGcIds: ['gc-harper'] })
    await act(async () => {
      await view.result.current.reloadSenders()
    })
    expect(io.senders).toHaveBeenLastCalledWith(['gc-harper'])
  })
})
