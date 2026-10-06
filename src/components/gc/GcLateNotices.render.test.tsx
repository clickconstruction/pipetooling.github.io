// @vitest-environment jsdom
/**
 * Render smoke for "Trades say they will be late" on the Schedule tab (the Gantt, G-117): the
 * card's words, Take handing Why it moved the company's day, reason and words (and the window
 * saving the notice with the move), Push back sending the office's words, the pushed back line,
 * the move's own line in Changes to the schedule, and the dashed tail on the chart.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcLateNotices } from './GcLateNotices'
import { GcMoveExplain, GcMoveHistory } from './GcScheduleMoves'
import { GcGantt } from './GcGantt'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { lateNoticeMove, lateNoticeTails } from '../../lib/gcMode/gcLateNotices'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const TPO = 'froof-1'
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const PUSH = 'We need the roof dry by Oct 9. Cool Breeze sets the rooftop units Oct 12.'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const told = () => gcReducer(initialGcState(), { type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId: TPO, day: '2026-10-14', reason: 'materials', note: NOTE })
const pending = { lineId: TPO, start: '2026-09-21', finish: '2026-10-14', after: ['fsteel-2'], why: { reason: 'materials' as const, note: `Summit Roofing told us Fri Oct 2: ${NOTE}` }, lateNoticeId: 'late-1' }

describe('Trades say they will be late', () => {
  it('is not on the tab until a company says so', () => {
    const state = initialGcState()
    const { container } = render(<GcLateNotices state={state} project={job(state)} dispatch={vi.fn()} onTake={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('says what the company said, when, and what taking it does; Take hands the day to Why it moved', () => {
    const state = told()
    const onTake = vi.fn()
    render(<GcLateNotices state={state} project={job(state)} dispatch={vi.fn()} onTake={onTake} />)
    expect(screen.getByText('Trades say they will be late (1)')).toBeTruthy()
    expect(screen.getByText('1 to answer')).toBeTruthy()
    expect(screen.getByText('Summit Roofing')).toBeTruthy()
    expect(screen.getByText('Sent today, 7 days before its finish.')).toBeTruthy()
    expect(screen.getByText('Says it will finish Wed Oct 14, not Fri Oct 9. That is 5 days later.')).toBeTruthy()
    expect(screen.getByText(`“${NOTE}”`, { exact: false })).toBeTruthy()
    expect(screen.getByText('If you take it: 2 activities after it move out. The job still finishes Tue Dec 8.')).toBeTruthy()
    expect(screen.getByText('Call Carla').closest('a')?.getAttribute('href')).toMatch(/^tel:/)
    fireEvent.click(screen.getByText('Take Wed Oct 14'))
    expect(onTake).toHaveBeenCalledWith(pending)
  })

  it('pushes back only with a sentence, and sends the office’s words', () => {
    const state = told()
    const dispatch = vi.fn()
    render(<GcLateNotices state={state} project={job(state)} dispatch={dispatch} onTake={vi.fn()} />)
    fireEvent.click(screen.getByText('Push back'))
    expect(screen.getByText('It goes to Summit Roofing in its portal. TPO membrane keeps its finish, Fri Oct 9.')).toBeTruthy()
    const send = screen.getByText('Send it to Summit Roofing').closest('button')!
    expect(send.disabled).toBe(true)
    expect(screen.getByText('Say what you need, in a sentence.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: PUSH } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({ type: 'pushBackLateNotice', projectId: ID, noticeId: 'late-1', note: PUSH, by: 'The office' })
  })

  it('keeps a push back on the card, waiting on the company’s word', () => {
    const pushed = gcReducer(told(), { type: 'pushBackLateNotice', projectId: ID, noticeId: 'late-1', note: PUSH, by: 'Robert' })
    render(<GcLateNotices state={pushed} project={job(pushed)} dispatch={vi.fn()} onTake={vi.fn()} />)
    expect(screen.getByText('pushed back')).toBeTruthy()
    expect(screen.getByText('We asked them today to keep Fri Oct 9. No answer yet.')).toBeTruthy()
    expect(screen.queryByText('Take Wed Oct 14')).toBeNull()
  })
})

describe('Take, through Why it moved', () => {
  it('opens with their reason picked and their words, and saves the notice with the move', () => {
    const state = told()
    const move = lateNoticeMove(state, job(state), job(state).schedule!.lateNotices![0]!)!
    const dispatch = vi.fn()
    render(<GcMoveExplain project={job(state)} pending={move} dispatch={dispatch} onClose={vi.fn()} />)
    expect(screen.getByText('Materials').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Summit Roofing told us Fri Oct 2: ${NOTE}`)
    fireEvent.click(screen.getByText('Save the move'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setScheduleActivity', lineId: TPO, finish: '2026-10-14', lateNoticeId: 'late-1', why: { reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}`, by: 'The office' } }))
  })

  it('names the company and how far ahead it told us, in Changes to the schedule', () => {
    const asked = told()
    const taken = gcReducer(asked, { type: 'setScheduleActivity', projectId: ID, ...pending, why: { ...pending.why, by: 'Robert' } })
    render(<GcMoveHistory state={taken} project={job(taken)} dispatch={vi.fn()} />)
    expect(screen.getByText('Summit Roofing asked for this Fri Oct 2, 7 days before its finish.')).toBeTruthy()
  })
})

describe('the chart', () => {
  it('draws the company’s day as a dashed tail on its bar, until it is taken', () => {
    const state = told()
    const m = scheduleMeasures(state, job(state))
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={vi.fn()} lateSaid={lateNoticeTails(state, job(state))} />)
    const tail = container.querySelector(`[data-gantt-said="${TPO}"]`)
    expect(tail?.getAttribute('title')).toBe('Summit Roofing says it will finish Wed Oct 14: materials. Not on the dates yet.')
    expect(screen.getByText("a trade's new day from its portal, not on the dates yet")).toBeTruthy()
  })
})
