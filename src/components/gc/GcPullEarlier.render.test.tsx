// @vitest-environment jsdom
/**
 * The schedule's PR 9d: pulling work earlier (G-37) on main's test state, ported from the prototype's test. The line over
 * the chart offers the press or names what holds the days; the window saves one pull through the one move save, with
 * its reason, its sentence and its line in the log, re-planned when a tick comes off; someone else's save first is
 * said and the schedule read again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcPullLine, GcPullWindow } from './GcPullEarlier'
import { planPull } from '../../lib/gc/schedule/pullEarlier'
import { withLineReported } from '../../lib/gc/schedule/testReports'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import type { ScheduleActivity, ScheduleMove } from '../../lib/gc/schedule/types'
import type { GcState } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'
import { checkSupabaseError } from '../../utils/errorHandling'

installDomShims()
afterEach(cleanup)

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
/** Ductwork and our crew's Top out reported done today, 7 days early: the rough-in inspection can come in. */
const earlyFinish = () => withLineReported(withLineReported(initialGcState(), 'fairoaksd', 'fhvac', 'fhvac-2', 100), 'fairoaksd', 'fplumb', 'fplumb-3', 100)
const NOTE = 'Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.'

describe('GcPullLine: the line over the chart', () => {
  it('offers the press when something can start sooner', () => {
    const s = earlyFinish()
    const onPull = vi.fn()
    render(<GcPullLine offer={planPull(s, job(s))!} onPull={onPull} />)
    expect(screen.getByText('finished early')).toBeTruthy()
    expect(screen.getByText(`${NOTE} 1 activity can start 7 days sooner. The job still finishes Tue Dec 8.`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pull the work earlier' }))
    expect(onPull).toHaveBeenCalled()
  })

  it('says nothing when nothing can be pressed or chased', () => {
    const s = withLineReported(initialGcState(), 'fairoaksd', 'fhvac', 'fhvac-2', 100)
    const { container } = render(<GcPullLine offer={planPull(s, job(s))!} onPull={() => undefined} />)
    expect(container.textContent).toBe('')
  })
})

describe('GcPullWindow: the window a pull is saved from', () => {
  it('starts with the reason and the sentence, and saves one pull through the one save with its line in the log', async () => {
    const s = earlyFinish()
    const onSave = vi.fn(() => Promise.resolve('db-7'))
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={onSave} onReload={vi.fn()} onClose={onClose} onSaved={onSaved} />)
    const dialog = screen.getByRole('dialog', { name: 'Pull the work earlier' })
    expect(within(dialog).getByRole('button', { name: 'Finished early' }).getAttribute('aria-pressed')).toBe('true')
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toBe(NOTE)
    expect(within(dialog).getByText('7 days sooner')).toBeTruthy()
    expect(within(dialog).queryByText(/^Billing: /)).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pull 1 activity earlier' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [move, activities, words] = onSave.mock.calls[0] as unknown as [{ lineId: string; reason: string; note: string; by: string; pull?: { finished: string[] } }, unknown[], string]
    expect(move).toMatchObject({ reason: 'early', note: NOTE, by: 'Rosa', pull: { finished: ['fplumb-3', 'fhvac-2'] } })
    expect(activities).toEqual(planPull(s, job(s))!.activities)
    expect(words).toBe(`Rosa pulled 1 activity earlier on Fair Oaks Shops, Building D. ${NOTE}`)
    expect(onSaved).toHaveBeenCalledWith('db-7')
  })

  it('a tick off leaves nothing to pull, and the press waits', () => {
    const s = earlyFinish()
    const onSave = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={onSave} onReload={vi.fn()} onClose={() => undefined} />)
    fireEvent.click(screen.getByLabelText('Pull Rough-in inspection earlier'))
    expect(screen.getByText('Left out. It keeps its dates.')).toBeTruthy()
    expect(screen.getByText('Tick at least one to pull.')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Pull 0 activities earlier' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('a save someone else beat stays open, says theirs, and reads the schedule again', async () => {
    const s = earlyFinish()
    const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Ann: The fixtures ship a week late.' }] })
    let stale: unknown = null
    try {
      checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'save the move')
    } catch (e) {
      stale = e
    }
    const onReload = vi.fn()
    const onClose = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={vi.fn(() => Promise.reject(stale))} onReload={onReload} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Pull the work earlier' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pull 1 activity earlier' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30.')
    expect(onReload).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the billing line only with the money team’s reading of it, for the pull as the ticks have it (16c)', () => {
    const s = earlyFinish()
    const billingOf = vi.fn(() => '$4,000 of the Nov 1 bill moves to Oct 1.')
    const { unmount } = render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={vi.fn()} onReload={vi.fn()} onClose={() => undefined} billingOf={billingOf} />)
    expect(document.querySelector('[data-pull-billing]')!.textContent).toBe('Billing: $4,000 of the Nov 1 bill moves to Oct 1.')
    expect(billingOf).toHaveBeenCalledWith(expect.objectContaining({ activities: expect.any(Array) }))
    unmount()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={vi.fn()} onReload={vi.fn()} onClose={() => undefined} />)
    expect(document.querySelector('[data-pull-billing]')).toBeNull()
  })

  it('tries the pull on the what-if copy: its own words, its reason filled in (PR 11)', async () => {
    const s = earlyFinish()
    const onSave = vi.fn((_move: ScheduleMove, _activities: ScheduleActivity[], _words: string) => Promise.resolve(null))
    const onClose = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={onSave} onReload={vi.fn()} onClose={onClose} trying />)
    const dialog = screen.getByRole('dialog', { name: 'Pull the work earlier' })
    expect(dialog.textContent).toContain('Tried in the what-if. Keep puts it on the real schedule.')
    expect(plainWordsFailures('Tried in the what-if. Keep puts it on the real schedule.')).toEqual([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try pulling 1 activity earlier' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    // The window's own reason: a listed one and a sentence, so Keep never asks for one.
    expect(onSave.mock.calls[0]![0]).toMatchObject({ reason: 'early', note: NOTE })
  })

  it('says each thing a first-timer reads in plain words', () => {
    const s = earlyFinish()
    render(<GcPullWindow state={s} project={job(s)} by="Rosa" onSave={vi.fn()} onReload={vi.fn()} onClose={() => undefined} />)
    const said = [
      'Work finished early. What was right behind it can start sooner.',
      'Untick one a trade cannot start sooner. It keeps its dates, and so does what waits on it.',
      'Saved as one move by Rosa, today. Undo puts every date back.',
      'Left out. It keeps its dates.',
      'It keeps its dates, with the work before it.',
      'Tick at least one to pull.',
      'Your pull was not saved. The chart shows the new dates now. Look at it again on them.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
    expect(screen.getByText(said[0]!)).toBeTruthy()
  })
})
