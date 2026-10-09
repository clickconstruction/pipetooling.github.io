// @vitest-environment jsdom
/**
 * Render smoke for too many trades in one place (G-83): the card and its window keeping the guesses
 * in one press, the opened bar's place line, the morning list's line, the move window's line, and the
 * Schedule tab hiding the card in a what-if copy. The chart's lane's tests moved to main with the
 * schedule's PR 7a (#5017) and are `GcPlaces.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcPlaceLine, GcPlacesCard } from './GcPlaces.proto'
import { GcMorningList } from './GcMorningList'
import { GcMoveExplain } from './GcScheduleMoves.proto'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { scheduleItems } from '../../lib/gcMode/gcBuildingSchedule'
import { crowdedWeeks, placeRows } from '../../lib/gcMode/gcPlaces'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleItems(s, job(s)).find((i) => i.label === label && i.pkg)!.activity.lineId
const s0 = initialGcState()
/** Every guess kept, as Keep these places sends them. */
const kept = gcReducer(s0, { type: 'setActivityPlaces', projectId: ID, places: Object.fromEntries(placeRows(s0, job(s0)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))) })

describe('Where the work is: the card and its window', () => {
  it('counts the guesses, lists every bar not done, and keeps the guesses in one press', () => {
    const dispatch = vi.fn()
    render(<GcPlacesCard state={s0} project={job(s0)} crowded={[]} dispatch={dispatch} />)
    expect(screen.getByText(/13 bars not done have a guessed place, and 1 has none\./)).toBeTruthy()
    fireEvent.click(screen.getByText('Look at the places'))
    expect(screen.getByRole('dialog', { name: 'Where the work is' })).toBeTruthy()
    expect(document.querySelectorAll('[data-place-row]')).toHaveLength(14)
    expect(screen.getAllByText('a guess from its name')).toHaveLength(5)
    expect(screen.getByText('no guess')).toBeTruthy()
    fireEvent.click(screen.getByText('Keep these places'))
    const sent = dispatch.mock.calls[0]?.[0] as Extract<GcAction, { type: 'setActivityPlaces' }>
    expect([sent.type, sent.projectId, Object.keys(sent.places).length, sent.places[lineOf(s0, 'TPO membrane')], sent.places[lineOf(s0, 'Top out')]]).toEqual(['setActivityPlaces', ID, 13, 'Roof', 'Inside'])
  })

  it('holds Keep while a place is too long', () => {
    render(<GcPlacesCard state={s0} project={job(s0)} crowded={[]} dispatch={vi.fn()} />)
    fireEvent.click(screen.getByText('Look at the places'))
    fireEvent.change(screen.getByLabelText('Where Roofing · TPO membrane is'), { target: { value: 'x'.repeat(41) } })
    expect(screen.getByText('A place is 40 characters at most.')).toBeTruthy()
    expect((screen.getByText('Keep these places') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says the runs of too many once places are kept', () => {
    render(<GcPlacesCard state={kept} project={job(kept)} crowded={crowdedWeeks(kept, job(kept))} dispatch={vi.fn()} />)
    expect(screen.getByText('Inside has too many from Fri Oct 2 to Fri Oct 9.')).toBeTruthy()
    expect(screen.getByText(/13 bars have a place\./)).toBeTruthy()
  })
})

describe('the opened bar’s place line', () => {
  it('offers the guess to set, and nothing for an inspection', () => {
    const dispatch = vi.fn()
    const lighting = lineOf(s0, 'Lighting')
    render(<GcPlaceLine project={job(s0)} lineId={lighting} trade="Electrical" label="Lighting" dispatch={dispatch} />)
    expect((screen.getByLabelText('Where its work is') as HTMLInputElement).value).toBe('Inside')
    expect(screen.getByText('A guess from its stage. It counts once you set it.')).toBeTruthy()
    fireEvent.click(screen.getByText('Set the place'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setActivityPlaces', projectId: ID, places: { [lighting]: 'Inside' } })
    cleanup()
    const { container } = render(<GcPlaceLine project={job(s0)} lineId="fairoaksd-insp-roughin" trade="Inspections" label="Rough-in inspection" dispatch={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('the morning list and the move window', () => {
  it('puts the line under the morning list’s summary, in amber, and the place beside each bar', () => {
    const { container } = render(<GcMorningList state={kept} project={job(kept)} day={kept.today} onDay={vi.fn()} />)
    const line = container.querySelector('[data-morning-crowding]') as HTMLElement
    expect(line.textContent).toBe('Inside has 3 trades at once today. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.')
    expect(line.style.color).toBe('var(--text-amber-800)')
    expect(container.querySelector('[data-morning-company="fplumb"]')?.textContent).toContain('Top out · Inside')
  })

  it('says it before the move saves', () => {
    const fire = job(kept).schedule!.activities.find((a) => a.lineId === lineOf(kept, 'Fire alarm'))!
    const { container } = render(<GcMoveExplain state={kept} project={job(kept)} pending={{ lineId: fire.lineId, start: '2026-11-30', finish: '2026-12-18', after: fire.after }} dispatch={vi.fn()} onClose={vi.fn()} />)
    expect(document.querySelector('[data-move-crowding]')?.textContent ?? container.textContent).toBe('Too many in one place: Inside would have 3 trades at once, Mon Nov 30 to Fri Dec 4.')
  })
})

describe('the Schedule tab', () => {
  it('shows the card on the real schedule and hides it in a what-if copy', () => {
    const copy = gcReducer(s0, { type: 'startWhatIf', projectId: ID, by: 'Robert' })
    render(<GcBuildingScheduleTab state={copy} project={job(copy)} dispatch={() => undefined} />)
    expect(screen.getByText('Where the work is')).toBeTruthy()
    fireEvent.click(screen.getByText('What if · 0'))
    expect(screen.queryByText('Where the work is')).toBeNull()
  })
})
