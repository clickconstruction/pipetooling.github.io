// @vitest-environment jsdom
/**
 * Render smoke for the weekly walk (the owner, 2026-10-05: "build the weekly walk"): the line over
 * the chart says the schedule was never walked, the walk goes one bar at a time, a new day needs
 * a reason and a sentence, and finishing records what was kept and moved.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcScheduleWalk, GcWalkLine } from './GcScheduleWalk.proto'
import { initialGcState } from '../../lib/gcMode/gcFixture'

afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')!

describe('the line over the chart', () => {
  it('says nobody has walked it, and opens the walk', () => {
    const onWalk = vi.fn()
    render(<GcWalkLine state={state} project={project} holds={new Map()} onWalk={onWalk} />)
    expect(screen.getByText('check the dates')).toBeTruthy()
    expect(screen.getByText(/Not walked yet\./)).toBeTruthy()
    fireEvent.click(screen.getByText('Update the week · 8'))
    expect(onWalk).toHaveBeenCalled()
  })
})

describe('the walk', () => {
  it('goes one bar at a time, and a new day needs a reason and a sentence', () => {
    const dispatch = vi.fn()
    render(<GcScheduleWalk state={state} project={project} holds={new Map()} dispatch={dispatch} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Update the week' })).toBeTruthy()
    expect(screen.getByText('The week · 0 of 8')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Electrical service inspection' })).toBeTruthy()
    fireEvent.click(screen.getByText('Yes, keep it'))
    // On to the next: erection, due today at 80%, with the day its pace points to.
    expect(screen.getByRole('heading', { name: 'Structural steel · Erection' })).toBeTruthy()
    expect(screen.getByText('Iron Horse Fabrication reported 80%. The plan has 100% by today.')).toBeTruthy()
    fireEvent.click(screen.getByText('Take Fri Oct 9, its pace'))
    const move = screen.getByText('Move it').closest('button')!
    expect(move.disabled).toBe(true)
    fireEvent.click(screen.getByText('Crew'))
    fireEvent.change(screen.getByLabelText('What happened, in your words'), { target: { value: 'Iron Horse was two men short all week.' } })
    expect(move.disabled).toBe(false)
    fireEvent.click(move)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setScheduleActivity', finish: '2026-10-09', why: { reason: 'crew', note: 'Iron Horse was two men short all week.', by: 'The office' } }))
    expect(screen.getByText('The week · 2 of 8')).toBeTruthy()
    fireEvent.click(screen.getByText('Finish the walk'))
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'recordScheduleWalk', by: 'The office', moveIds: ['move-1'], skipped: 6 }))
    expect(screen.getByText('The week is updated')).toBeTruthy()
  })

  it('finishing with nothing looked at records nothing', () => {
    const dispatch = vi.fn()
    render(<GcScheduleWalk state={state} project={project} holds={new Map()} dispatch={dispatch} onClose={() => undefined} />)
    fireEvent.click(screen.getByText('Finish the walk'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByText('Nothing was looked at')).toBeTruthy()
  })
})
