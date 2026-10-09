// @vitest-environment jsdom
/**
 * Render smoke for pulling work earlier (G-37): the line over the chart offers the press or names
 * what holds the days, the window saves one pull with its reason and sentence and recomputes when a
 * tick comes off, and the walk lists work that finished early above the week and opens a box right
 * after It finished today.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcPullLine, GcPullWindow } from './GcPullEarlier'
import { GcScheduleWalk } from './GcScheduleWalk'
import { GcMoveHistory } from './GcScheduleMoves.proto'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { planPull } from '../../lib/gcMode/gcPullEarlier'
import { moveBillingShift, planBillingShift, shiftWords } from '../../lib/gcMode/gcBillingForecast'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const DUCTWORK_DONE: GcAction = { type: 'tradeReport', projectId: 'fairoaksd', packageId: 'fhvac', sovId: 'fhvac-2', pct: 100 }
const TOP_OUT_DONE: GcAction = { type: 'selfReportStage', projectId: 'fairoaksd', packageId: 'fplumb', lineId: 'fplumb-3', pct: 100 }
const NOTE = 'Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.'

describe('the line over the chart', () => {
  it('offers the press when something can start sooner', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const onPull = vi.fn()
    render(<GcPullLine offer={planPull(s, job(s))!} onPull={onPull} />)
    expect(screen.getByText('finished early')).toBeTruthy()
    expect(screen.getByText(`${NOTE} 1 activity can start 7 days sooner. The job still finishes Tue Dec 8.`)).toBeTruthy()
    fireEvent.click(screen.getByText('Pull the work earlier'))
    expect(onPull).toHaveBeenCalled()
  })

  it('names what holds the days, with no press', () => {
    const s = play(initialGcState(), { type: 'tradeReport', projectId: 'fairoaksd', packageId: 'froof', sovId: 'froof-1', pct: 100 })
    render(<GcPullLine offer={planPull(s, job(s))!} onPull={() => undefined} />)
    expect(screen.getByText(/Sheet metal and flashing waits on submittal 07 62 00-01, which is with us\./)).toBeTruthy()
    expect(screen.queryByText('Pull the work earlier')).toBeNull()
  })

  it('says nothing when nothing can be pressed or chased', () => {
    const s = play(initialGcState(), DUCTWORK_DONE)
    const { container } = render(<GcPullLine offer={planPull(s, job(s))!} onPull={() => undefined} />)
    expect(container.textContent).toBe('')
  })
})

describe('the window a pull is saved from', () => {
  it('starts with the reason and the sentence, and saves one pull', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const dispatch = vi.fn()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} dispatch={dispatch} onClose={onClose} onSaved={onSaved} />)
    expect(screen.getByRole('dialog', { name: 'Pull the work earlier' })).toBeTruthy()
    expect(screen.getByText('Finished early', { selector: 'button' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(NOTE)
    expect(screen.getByText('7 days sooner')).toBeTruthy()
    expect(screen.getByText(/It was drawn with 47 days of room before it\./)).toBeTruthy()
    fireEvent.click(screen.getByText('Pull 1 activity earlier'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'pullScheduleEarlier', projectId: 'fairoaksd', leaveOut: [], why: { reason: 'early', note: NOTE, by: 'The office' } })
    expect(onSaved).toHaveBeenCalledWith('move-1')
    expect(onClose).toHaveBeenCalled()
  })

  it('a tick off leaves nothing to pull, and the press waits', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const dispatch = vi.fn()
    render(<GcPullWindow state={s} project={job(s)} dispatch={dispatch} onClose={() => undefined} />)
    fireEvent.click(screen.getByLabelText('Pull Rough-in inspection earlier'))
    expect(screen.getByText('Left out. It keeps its dates.')).toBeTruthy()
    expect(screen.getByText('Tick at least one to pull.')).toBeTruthy()
    const save = screen.getByText('Pull 0 activities earlier').closest('button')!
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('what the pull moves between bills (G-97)', () => {
  const press = (s: GcState, note: string) => play(s, { type: 'pullScheduleEarlier', projectId: 'fairoaksd', leaveOut: [], why: { reason: 'early', note, by: 'Robert' } })
  const billingLine = () => screen.queryByText(/^Billing: /)?.textContent ?? null

  it('the window reads, before the press, the shift the move\'s row reads after it', () => {
    // TPO membrane moved out to finish Oct 20 pushes Sheet metal across the Oct 25 bill day.
    // Then its submittal is approved, and Summit finishes TPO today, 18 days early.
    const tpo = job(initialGcState()).schedule!.activities.find((a) => a.lineId === 'froof-1')!
    const s = play(
      initialGcState(),
      { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: 'froof-1', start: tpo.start, finish: '2026-10-20', after: tpo.after, why: { reason: 'weather', note: 'Rain all week on the roof.', by: 'Robert' } },
      { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6' },
      { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6', answer: 'approved', note: '' },
      { type: 'tradeReport', projectId: 'fairoaksd', packageId: 'froof', sovId: 'froof-1', pct: 100 },
    )
    const offer = planPull(s, job(s))!
    expect(offer.pulls.map((p) => [p.lineId, p.from.start, p.to.start])).toEqual([['froof-3', '2026-10-21', '2026-10-03']])
    const shift = planBillingShift(s, job(s), offer)
    render(<GcPullWindow state={s} project={job(s)} dispatch={() => undefined} onClose={() => undefined} />)
    expect(billingLine()).toBe(`Billing: ${shiftWords(shift, 'will')}`)
    expect(billingLine()).toBe('Billing: $14,301 of the Nov 25 bill moves to Oct 25.')
    cleanup()
    const after = press(s, offer.note)
    expect(moveBillingShift(after, job(after), job(after).schedule!.moves![0]!)).toEqual(shift)
    render(<GcMoveHistory state={after} project={job(after)} dispatch={() => undefined} />)
    expect(billingLine()).toBe(`Billing: ${shiftWords(shift, 'did')}`)
    expect(billingLine()).toBe('Billing: it moved $14,301 of the Nov 25 bill to Oct 25.')
  })

  it('Top out and Ductwork bring in only the inspection, which carries no dollars: no word on billing, before or after', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    render(<GcPullWindow state={s} project={job(s)} dispatch={() => undefined} onClose={() => undefined} />)
    expect(billingLine()).toBeNull()
    cleanup()
    const after = press(s, NOTE)
    expect(moveBillingShift(after, job(after), job(after).schedule!.moves![0]!)).toEqual([])
    render(<GcMoveHistory state={after} project={job(after)} dispatch={() => undefined} />)
    expect(billingLine()).toBeNull()
  })
})

describe('the walk', () => {
  it('lists work that finished early first, and Keep the dates is kept with the walk', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const dispatch = vi.fn()
    render(<GcScheduleWalk state={s} project={job(s)} holds={new Map()} dispatch={dispatch} onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Work that finished early' })).toBeTruthy()
    expect(screen.getByText('Rough-in inspection can start Mon Oct 5, 7 days sooner.')).toBeTruthy()
    expect(screen.getByText('Pull the work after it earlier?')).toBeTruthy()
    fireEvent.click(screen.getByText('Keep the dates'))
    fireEvent.click(screen.getByText('Finish the walk'))
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'recordScheduleWalk', kept: [], moveIds: [], keptEarly: ['fplumb-3', 'fhvac-2'] }))
  })

  it('opens a box right after It finished today', () => {
    // Ductwork at 80%, finished by the superintendent's word in the walk.
    const s = play(
      initialGcState(),
      { type: 'setActualDates', projectId: 'fairoaksd', lineId: 'fhvac-2', actualStart: '2026-09-14', by: 'Robert' },
      { type: 'setActualDates', projectId: 'fairoaksd', lineId: 'fhvac-2', actualFinish: '2026-10-02', by: 'Robert' },
    )
    render(<GcScheduleWalk state={s} project={job(s)} holds={new Map()} dispatch={() => undefined} onClose={() => undefined} />)
    // Nothing to press or chase yet, so there is no item above the week.
    expect(screen.queryByText('Work that finished early')).toBeNull()
    fireEvent.click(screen.getByText('HVAC · Ductwork'))
    expect(screen.getByText('It finished Fri Oct 2, 7 days early. Nothing can start sooner yet. Rough-in inspection still waits on Top out, which finishes Fri Oct 9.')).toBeTruthy()
    expect(screen.queryByText('Pull the work earlier…')).toBeNull()
  })
})
