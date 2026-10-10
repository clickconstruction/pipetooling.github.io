// @vitest-environment jsdom
/**
 * Render smoke for the what-if copy (G-81): the toolbar's way in and out, the violet line with Keep
 * and Throw it away, a move tried with no reason, Keep asking for the missing one, and the Schedule
 * tab hiding what belongs to the real schedule while the copy is shown.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcWhatIfButton, GcWhatIfKeep, GcWhatIfKept, GcWhatIfLine } from './GcWhatIf.proto'
import { GcMoveExplain } from './GcScheduleMoves.proto'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { whatIfProject } from '../../lib/gcMode/gcWhatIf'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
function tryFinish(s: GcState, lineId: string, finish: string, why?: { reason: 'weather'; note: string; by: string }): GcState {
  const a = job(s).whatIf!.schedule.activities.find((x) => x.lineId === lineId)!
  return play(s, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'setScheduleActivity', projectId: ID, lineId, start: a.start, finish, after: a.after, ...(why ? { why } : {}) } })
}
const s0 = initialGcState()
const s1 = play(s0, { type: 'startWhatIf', projectId: ID, by: 'Robert' })
const s3 = tryFinish(tryFinish(s1, 'froof-1', '2026-10-16', { reason: 'weather', note: 'Rain is forecast all next week.', by: 'Robert' }), 'fplumb-3', '2026-10-12')

describe('the way in and out', () => {
  it('makes a copy, opens the one there is, and goes back to the real schedule', () => {
    const dispatch = vi.fn()
    const onShow = vi.fn()
    const first = render(<GcWhatIfButton project={job(s0)} shown={false} dispatch={dispatch} onShow={onShow} />)
    fireEvent.click(screen.getByText('What if…'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'startWhatIf', projectId: ID, by: 'The office' })
    expect(onShow).toHaveBeenCalledWith(true)
    first.unmount()
    const open = render(<GcWhatIfButton project={job(s3)} shown={false} dispatch={dispatch} onShow={onShow} />)
    expect(screen.getByText('What if · 2')).toBeTruthy()
    open.unmount()
    render(<GcWhatIfButton project={job(s3)} shown dispatch={dispatch} onShow={onShow} />)
    fireEvent.click(screen.getByText('See the real schedule'))
    expect(onShow).toHaveBeenLastCalledWith(false)
  })
})

describe('the line over the chart in the copy', () => {
  it('says what the copy does, and Throw it away asks once', () => {
    const dispatch = vi.fn()
    const onReal = vi.fn()
    render(<GcWhatIfLine state={s3} project={job(s3)} dispatch={dispatch} onKeep={() => undefined} onReal={onReal} />)
    expect(screen.getByText(/2 moves tried\. 5 bars differ from the real schedule\./)).toBeTruthy()
    expect(screen.getByText(/The bills: \$22,661 of the Oct 25 bill moves to Nov 25\./)).toBeTruthy()
    expect(screen.getByText('Keep the 2 moves…')).toBeTruthy()
    fireEvent.click(screen.getByText('Throw it away'))
    expect(screen.getByText(/Throw away the copy and its 2 moves\? The real schedule stays as it is\./)).toBeTruthy()
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByText('Throw it away').find((b) => b.closest('button')?.className !== undefined)!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'throwAwayWhatIf', projectId: ID, by: 'The office' })
    expect(onReal).toHaveBeenCalled()
  })
})

describe('a move tried in the copy', () => {
  it('needs no reason: Try it saves without one', () => {
    const copy = whatIfProject(job(s1))!
    const a = copy.schedule!.activities.find((x) => x.lineId === 'froof-1')!
    const dispatch = vi.fn()
    render(<GcMoveExplain state={s1} project={copy} pending={{ lineId: 'froof-1', start: a.start, finish: '2026-10-16', after: a.after }} dispatch={dispatch} onClose={() => undefined} tryIt />)
    expect(screen.getByText('Try moving Roofing · TPO membrane')).toBeTruthy()
    expect(screen.getByText('In the what-if, a reason is optional. Keep asks for one.')).toBeTruthy()
    const tryIt = screen.getByText('Try it').closest('button')!
    expect(tryIt.disabled).toBe(false)
    fireEvent.click(tryIt)
    expect(dispatch).toHaveBeenCalledWith({ type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: a.start, finish: '2026-10-16', after: a.after })
  })
})

describe('Keep', () => {
  it('asks for the missing reason, then keeps', () => {
    const dispatch = vi.fn()
    render(<GcWhatIfKeep state={s3} project={job(s3)} dispatch={dispatch} onClose={() => undefined} onKept={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Keep the what-if' })).toBeTruthy()
    expect(screen.getByText('“Rain is forecast all next week.”')).toBeTruthy()
    const keep = screen.getByText('Keep the 2 moves').closest('button')!
    expect(keep.disabled).toBe(true)
    expect(screen.getByText('Give each move a reason and a sentence.')).toBeTruthy()
    fireEvent.click(screen.getByText('Crew'))
    fireEvent.change(screen.getByPlaceholderText('What happened, in your words.'), { target: { value: 'Our crew is two men short next week.' } })
    expect(keep.disabled).toBe(false)
    fireEvent.click(keep)
    const topOut = job(s3).whatIf!.schedule.moves![0]!.id
    expect(dispatch).toHaveBeenCalledWith({ type: 'keepWhatIf', projectId: ID, by: 'The office', whys: { [topOut]: { reason: 'crew', note: 'Our crew is two men short next week.' } } })
  })

  it('once kept, names the companies not told, with Tell the trades', () => {
    const topOut = job(s3).whatIf!.schedule.moves![0]!.id
    const kept = play(s3, { type: 'keepWhatIf', projectId: ID, by: 'Robert', whys: { [topOut]: { reason: 'crew', note: 'Our crew is two men short next week.' } } })
    render(<GcWhatIfKept state={kept} project={job(kept)} dispatch={() => undefined} />)
    expect(screen.getByText('2 moves kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told.')).toBeTruthy()
    fireEvent.click(screen.getByText('Tell the trades'))
    expect(screen.getByRole('dialog', { name: 'Tell the trades' })).toBeTruthy()
  })
})

describe('the Schedule tab in the copy', () => {
  it('shows the copy with its line and history, and hides what belongs to the real schedule', () => {
    render(<GcBuildingScheduleTab state={s3} project={job(s3)} dispatch={() => undefined} />)
    // The real schedule first, with the way into the copy.
    expect(screen.getByText(/Update the week/)).toBeTruthy()
    expect(screen.queryByText(/Tried in the what-if/)).toBeNull()
    expect(screen.getAllByText('To verify').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('What if · 2'))
    expect(screen.getByText(/A copy of the schedule to try moves on\./)).toBeTruthy()
    expect(screen.getByText('Tried in the what-if (2)')).toBeTruthy()
    expect(screen.queryByText(/Update the week/)).toBeNull()
    expect(screen.queryByText('Days lost, by cause')).toBeNull()
    // The cards that record what happened, or reach someone, are the real schedule's: the copy hides them.
    for (const title of ['The baseline', 'To verify', 'Starting soon', "Something that is no trade's line"]) expect(screen.queryByText(title)).toBeNull()
    expect(screen.queryByText('Print or PDF')).toBeNull()
    fireEvent.click(screen.getAllByText('See the real schedule')[0]!)
    expect(screen.getByText(/Update the week/)).toBeTruthy()
  })
})
