// @vitest-environment jsdom
/**
 * Render smoke for moving a bar (the owner, 2026-10-05: "an explanation should be given and
 * recorded"): the window will not save without a reason and a sentence, sends both with the move,
 * and the history lists it with Undo on the last one standing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcMoveExplain, GcMoveHistory } from './GcScheduleMoves'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const job = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!
function tpo(state: GcState) {
  const id = job(state).packages.flatMap((k) => k.sow?.sov ?? []).find((l) => l.label === 'TPO membrane')!.id
  return job(state).schedule!.activities.find((a) => a.lineId === id)!
}

describe('the window a move is saved from', () => {
  it('says what the move does, and saves only with a reason and a sentence', () => {
    const state = initialGcState()
    const a = tpo(state)
    const dispatch = vi.fn()
    const onClose = vi.fn()
    render(<GcMoveExplain project={job(state)} pending={{ lineId: a.lineId, start: addDays(a.start, 7), finish: addDays(a.finish, 7), after: a.after }} dispatch={dispatch} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Why it moved' })).toBeTruthy()
    expect(screen.getByText('Move Roofing · TPO membrane')).toBeTruthy()
    expect(screen.getByText('7 days later')).toBeTruthy()
    expect(screen.getByText(/The job still finishes/)).toBeTruthy()
    const save = screen.getByText('Save the move').closest('button')!
    expect(save.disabled).toBe(true)
    expect(screen.getByText('Pick why it moved.')).toBeTruthy()
    fireEvent.click(screen.getByText('Weather'))
    expect(screen.getByText('Say what happened, in a sentence.')).toBeTruthy()
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rain stopped the roof for two days.' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setScheduleActivity', lineId: a.lineId, start: addDays(a.start, 7), why: { reason: 'weather', note: 'Rain stopped the roof for two days.', by: 'The office' } }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('Cancel saves nothing', () => {
    const state = initialGcState()
    const a = tpo(state)
    const dispatch = vi.fn()
    render(<GcMoveExplain project={job(state)} pending={{ lineId: a.lineId, start: addDays(a.start, 7), finish: addDays(a.finish, 7), after: a.after }} dispatch={dispatch} onClose={() => undefined} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('the record of moves', () => {
  it('starts empty, then lists a move with who, why and their words, with Undo', () => {
    const state = initialGcState()
    const first = render(<GcMoveHistory state={state} project={job(state)} dispatch={() => undefined} />)
    expect(screen.getByText(/None yet/)).toBeTruthy()
    first.unmount()
    const a = tpo(state)
    const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: a.lineId, start: addDays(a.start, 7), finish: addDays(a.finish, 7), after: a.after, why: { reason: 'weather', note: 'Rain stopped the roof for two days.', by: 'Robert' } })
    const dispatch = vi.fn()
    render(<GcMoveHistory state={moved} project={job(moved)} dispatch={dispatch} />)
    expect(screen.getByText('Changes to the schedule (1)')).toBeTruthy()
    expect(screen.getByText(/Robert/)).toBeTruthy()
    expect(screen.getByText('Weather')).toBeTruthy()
    expect(screen.getByText('“Rain stopped the roof for two days.”')).toBeTruthy()
    expect(screen.getByText('The trades have not been told.')).toBeTruthy()
    expect(screen.getByText('Tell the trades · 2')).toBeTruthy()
    fireEvent.click(screen.getByText('Undo'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'undoScheduleMove', projectId: 'fairoaksd', moveId: 'move-1', by: 'The office' })
  })
})
