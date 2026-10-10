// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 16b-ii: the late finish's whose-days line on the Schedule window and Ask
 * for the days under it (G-141). The money team's press drafts the time extension on Bill the customer, says so and reads
 * again; anyone else reads who asks. The late finish is the real one on Fair Oaks D with an ask laid over it, since the
 * test state has no change orders.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { loadSchedule } from '../../lib/gc/scheduleIo'
import { draftTimeExtension } from '../../lib/gc/gcIo'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { TimeExtensionAsk } from '../../lib/gc/timeExtension'
import type { GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return { loadSchedule, loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)) }
})
vi.mock('../../lib/gc/gcIo', () => ({ draftTimeExtension: vi.fn(() => Promise.resolve('co-9')) }))

const ASK: TimeExtensionAsk = {
  days: 4,
  moves: [{ id: 'move-1', lineId: 'fplumb-3', label: 'Top out', days: 4, reason: 'owner', on: '2026-09-28', why: 'a decision we were waiting on from you' }] as unknown as TimeExtensionAsk['moves'],
  reason: 'owner',
  description: 'A time extension for the decision we asked you for on Sep 28',
  rule: '4 days, the days your decision moved the finish.',
  contract: null,
  saves: null,
  spare: 0,
} as TimeExtensionAsk
const SPLIT = 'Of the 4 late days, 4 are at your door: a decision we were waiting on from you.'
vi.mock('../../lib/gc/lateFinish', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/lateFinish')>()
  return { ...real, lateFinish: vi.fn((state: GcState, project: Parameters<typeof real.lateFinish>[1]) => ({ ...real.lateFinish(state, project), late: 4, words: [SPLIT], split: SPLIT, ask: ASK })) }
})

afterEach(() => {
  cleanup()
  vi.mocked(loadSchedule).mockReset()
  vi.mocked(draftTimeExtension).mockClear()
})

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const open = (reads: { money?: boolean }) => {
  vi.mocked(loadSchedule).mockResolvedValue({ state: s, project: fairOaks, version: 3 })
  render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" canMove reads={reads} onClose={vi.fn()} />)
}

describe('Ask for the days on the schedule (PR 16b-ii)', () => {
  it('the money team presses it: the time extension is drafted on Bill the customer, said, and the schedule reads again', async () => {
    open({ money: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Ask for the days' }))
    await waitFor(() => expect(draftTimeExtension).toHaveBeenCalledWith('fairoaksd', ASK))
    expect((await screen.findByRole('status')).textContent).toBe('A change order for 4 days is drafted on Bill the customer. Nothing went to the customer.')
    await waitFor(() => expect(vi.mocked(loadSchedule).mock.calls.length).toBeGreaterThan(1))
  })

  it('anyone else reads who asks, with no press', async () => {
    open({})
    await screen.findByText(SPLIT)
    expect(screen.queryByRole('button', { name: 'Ask for the days' })).toBeNull()
    expect(document.querySelector('[data-ask-note]')!.textContent).toBe('The money team asks the customer for these days on Bill the customer.')
    expect(draftTimeExtension).not.toHaveBeenCalled()
  })
})
