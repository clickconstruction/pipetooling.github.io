// @vitest-environment jsdom
/**
 * The schedule's PR 9d: the weekly walk (G-52) on main's test state, ported from the prototype's tests. The line over the
 * chart says when it was walked; the walk keeps a bar, gives it its real days, or moves it with why through the one move
 * save; work that finished early leads it for those who may pull; Finish keeps the walk once, with the moves' ids the
 * saves answered; someone else's save first is said under the bar and the schedule read again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWalk, GcWalkLine, type WalkPresses } from './GcScheduleWalk'
import { chartHolds } from '../../lib/gc/schedule/chartHolds'
import { withLineReported } from '../../lib/gc/schedule/testReports'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import { walkItems } from '../../lib/gc/schedule/walk'
import type { GcState } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'
import { checkSupabaseError } from '../../utils/errorHandling'

installDomShims()
afterEach(cleanup)

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const holdsOf = (s: GcState) => chartHolds(s, job(s))
const earlyFinish = () => withLineReported(withLineReported(initialGcState(), 'fairoaksd', 'fhvac', 'fhvac-2', 100), 'fairoaksd', 'fplumb', 'fplumb-3', 100)

function presses(over: Partial<{ [K in keyof WalkPresses]: WalkPresses[K] }> = {}) {
  return {
    save: vi.fn<WalkPresses['save']>(() => Promise.resolve('db-7')),
    actual: vi.fn<WalkPresses['actual']>(() => Promise.resolve()),
    walk: vi.fn<WalkPresses['walk']>(() => Promise.resolve()),
    reload: vi.fn(),
    ...over,
  }
}

function walk(s: GcState, p = presses(), canPull = false) {
  render(<GcScheduleWalk state={s} project={job(s)} holds={holdsOf(s)} by="Rosa" canPull={canPull} presses={p} onClose={() => undefined} />)
  return { p, dialog: screen.getByRole('dialog', { name: 'Update the week' }) }
}

describe('GcWalkLine: the line over the chart', () => {
  it('says it was never walked, with the walk’s count, and opens it', () => {
    const s = initialGcState()
    const onWalk = vi.fn()
    render(<GcWalkLine state={s} project={job(s)} holds={holdsOf(s)} canPull={false} onWalk={onWalk} />)
    expect(screen.getByText('check the dates')).toBeTruthy()
    // The test day, Fri Oct 2, is the walk's day: the line says so.
    expect(document.querySelector('[data-walk-line]')!.textContent).toContain('Not walked yet. Nobody has checked these dates against the job. It is Friday: walk it before the report goes.')
    const n = walkItems(s, job(s), holdsOf(s)).length
    fireEvent.click(screen.getByRole('button', { name: `Update the week · ${n}` }))
    expect(onWalk).toHaveBeenCalled()
  })

  it('counts work that finished early as one more, only for those who may pull', () => {
    const s = earlyFinish()
    const n = walkItems(s, job(s), holdsOf(s)).length
    render(<GcWalkLine state={s} project={job(s)} holds={holdsOf(s)} canPull onWalk={vi.fn()} />)
    expect(screen.getByRole('button', { name: `Update the week · ${n + 1}` })).toBeTruthy()
    cleanup()
    render(<GcWalkLine state={s} project={job(s)} holds={holdsOf(s)} canPull={false} onWalk={vi.fn()} />)
    expect(screen.getByRole('button', { name: `Update the week · ${n}` })).toBeTruthy()
  })
})

describe('GcScheduleWalk: the walk', () => {
  it('keeps a bar as drawn, and Finish keeps the walk once with it', async () => {
    const s = initialGcState()
    const first = walkItems(s, job(s), holdsOf(s))[0]!
    const { p, dialog } = walk(s)
    expect(within(dialog).getByRole('heading', { name: first.name })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, keep it' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish the walk' }))
    await waitFor(() => expect(p.walk).toHaveBeenCalledTimes(1))
    const n = walkItems(s, job(s), holdsOf(s)).length
    expect(p.walk).toHaveBeenCalledWith({ on: '2026-10-02', kept: [first.lineId], moveIds: [], skipped: n - 1 })
    expect(await screen.findByRole('heading', { name: 'The week is updated' })).toBeTruthy()
    expect(document.querySelector('[data-walk-done]')!.textContent).toBe(`Walked today by Rosa. 1 kept as drawn, 0 moved, ${n - 1} not looked at.`)
  })

  it('moves a bar with why through the one save, and keeps the move’s id with the walk', async () => {
    const s = initialGcState()
    const first = walkItems(s, job(s), holdsOf(s))[0]!
    const a = job(s).schedule!.activities.find((x) => x.lineId === first.lineId)!
    const { p, dialog } = walk(s)
    fireEvent.click(within(dialog).getByRole('button', { name: first.started ? 'A new finish day' : 'A new start day' }))
    const later = first.started ? '2026-12-31' : '2026-12-01'
    fireEvent.change(within(dialog).getByLabelText(first.started ? 'The new finish day' : 'The new start day'), { target: { value: later } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog).getByLabelText('What happened, in your words'), { target: { value: 'Rain all week.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move it' }))
    await waitFor(() => expect(p.save).toHaveBeenCalledTimes(1))
    const [move, , words] = vi.mocked(p.save).mock.calls[0]!
    expect(move).toMatchObject({ lineId: a.lineId, reason: 'weather', note: 'Rain all week.', by: 'Rosa' })
    expect(words).toMatch(/ Rosa: Rain all week\.$/)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: new RegExp(`^${first.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · moved`) })).toBeTruthy())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish the walk' }))
    await waitFor(() => expect(p.walk).toHaveBeenCalledWith(expect.objectContaining({ kept: [], moveIds: ['db-7'] })))
  })

  it('a save someone else beat is said under the bar, reads the schedule again, and the bar stays to answer', async () => {
    const s = initialGcState()
    const first = walkItems(s, job(s), holdsOf(s))[0]!
    const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Ann: The fixtures ship a week late.' }] })
    let stale: unknown = null
    try {
      checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'save the move')
    } catch (e) {
      stale = e
    }
    const p = presses({ save: vi.fn<WalkPresses['save']>(() => Promise.reject(stale)) })
    const { dialog } = walk(s, p)
    fireEvent.click(within(dialog).getByRole('button', { name: first.started ? 'A new finish day' : 'A new start day' }))
    fireEvent.change(within(dialog).getByLabelText(first.started ? 'The new finish day' : 'The new start day'), { target: { value: first.started ? '2026-12-31' : '2026-12-01' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog).getByLabelText('What happened, in your words'), { target: { value: 'Rain all week.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move it' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30.')
    expect(p.reload).toHaveBeenCalled()
    expect(within(dialog).getByRole('heading', { name: first.name })).toBeTruthy()
    expect(document.querySelector('[data-walk-tally]')!.textContent).toMatch(/^0 kept as drawn, 0 moved, /)
  })

  it('gives a bar its real start, a record', async () => {
    const s = initialGcState()
    const item = walkItems(s, job(s), holdsOf(s)).find((i) => !job(s).schedule!.activities.find((a) => a.lineId === i.lineId)?.actualStart && !job(s).schedule!.activities.find((a) => a.lineId === i.lineId)?.inspection)!
    const { p, dialog } = walk(s)
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'It started today' }))
    await waitFor(() => expect(p.actual).toHaveBeenCalledWith(item.lineId, '2026-10-02', null))
  })

  it('leads with work that finished early for those who may pull, and Keep the dates is kept with the walk', async () => {
    const s = earlyFinish()
    const { p, dialog } = walk(s, presses(), true)
    expect(within(dialog).getByRole('heading', { name: 'Work that finished early' })).toBeTruthy()
    expect(within(dialog).getByText('Rough-in inspection can start Mon Oct 5, 7 days sooner.')).toBeTruthy()
    expect(within(dialog).getByText('Pull the work after it earlier?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep the dates' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish the walk' }))
    await waitFor(() => expect(p.walk).toHaveBeenCalledWith(expect.objectContaining({ kept: [], moveIds: [], keptEarly: ['fplumb-3', 'fhvac-2'] })))
  })

  it('has no early item for someone who may not pull', () => {
    const { dialog } = walk(earlyFinish())
    expect(within(dialog).queryByRole('heading', { name: 'Work that finished early' })).toBeNull()
  })

  it('records nothing when nothing was looked at', async () => {
    const { p, dialog } = walk(initialGcState())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish the walk' }))
    expect(await screen.findByRole('heading', { name: 'Nothing was looked at' })).toBeTruthy()
    expect(p.walk).not.toHaveBeenCalled()
  })

  it('says each thing a first-timer reads in plain words', () => {
    const said = [
      'You can finish with some not looked at. The record says how many.',
      "Tell the trades from Changes to the schedule, under the chart. The customer's Friday report reads this list.",
      'The walk is not recorded. The schedule still reads as not walked.',
      'No dates moved. The schedule stands as drawn.',
      'Nothing on the schedule needs a look this week.',
      'Nothing that finished early is waiting now.',
      'Nothing can come in until the hold is gone.',
      'Your answer was not saved. The schedule shows the new dates now. Answer it again on them.',
      'It is Friday: walk it before the report goes.',
      'Every bar has been looked at.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
