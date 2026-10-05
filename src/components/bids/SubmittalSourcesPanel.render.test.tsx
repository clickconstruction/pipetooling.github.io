// @vitest-environment jsdom
/**
 * Render smoke for the first step's body, moved out of `BidsSubmittalsTab.tsx` (2026-10-04): the
 * seam pinned. It draws what it is handed and reports each press; nothing is written here.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalSourcesPanel, type SubmittalSourcesPanelProps } from './SubmittalSourcesPanel'
import type { SubmittalTaskRow } from '../../lib/submittals/robotTasks'

const read = { id: 'task-1', bid_id: 'b', submittal_id: null, kind: 'read_schedule', input: {}, result: { rows: [{ tag: 'WC-1', fixture: 'water closet', manufacturer: 'TOTO', model: 'CT708UVG#01', confidence: 0.95 }, { tag: 'HB-3', model: 'B74-CH', confidence: 0.4 }] }, status: 'ready', requested_at: '2026-09-17T10:00:00Z', claimed_at: null, finished_at: '2026-09-17T10:05:00Z', reviewed_at: null, summary: 'Read P002.' } as unknown as SubmittalTaskRow
const queued = { ...read, id: 'task-q', result: null, status: 'queued', finished_at: null, summary: null } as unknown as SubmittalTaskRow

function mount(over: Partial<SubmittalSourcesPanelProps> = {}) {
  const on = { onChooseFromTakeoff: vi.fn(), onOpenCompare: vi.fn(), onPlugIn: vi.fn(), onAskRobot: vi.fn(), onCancelTask: vi.fn(), onLookChecked: vi.fn(), onConfirmSchedule: vi.fn() }
  renderWithProviders(
    <SubmittalSourcesPanel takeoffFixtures={0} takeoffWithProduct={0} scheduleTags={0} picks={0} hasRevision={false} hasPlans tasks={[]} robotSeat={{ live: false, line: 'No robot seat exists.' }} lookChecked={{}} busy={false} {...on} {...over} />,
  )
  return on
}

describe('SubmittalSourcesPanel', () => {
  it('a takeoff and nothing else: the takeoff is the first door; no compare card without picks', () => {
    const on = mount({ takeoffFixtures: 12, takeoffWithProduct: 9 })
    expect(screen.getByTestId('source-takeoff').textContent).toContain('12 fixtures, 9 with a part')
    expect(screen.queryByTestId('source-picks')).toBeNull()
    expect(screen.getByTestId('source-schedule').textContent).toContain('none yet')
    expect(screen.getByTestId('choose-from-takeoff').textContent).toBe('Choose from the takeoff')
    fireEvent.click(screen.getByTestId('choose-from-takeoff'))
    expect(on.onChooseFromTakeoff).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('plug-in-schedule'))
    expect(on.onPlugIn).toHaveBeenCalledTimes(1)
  })

  it('no takeoff: its door is held; picks and a schedule read their counts and a revision turns Choose into Add', () => {
    const on = mount({ picks: 3, scheduleTags: 5, hasRevision: true })
    expect((screen.getByTestId('choose-from-takeoff') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('choose-from-takeoff').textContent).toBe('Add from the takeoff')
    expect(screen.getByTestId('source-picks').textContent).toContain('3 picked lines')
    expect(screen.getByTestId('source-schedule').textContent).toContain('5 tags')
    expect(screen.getByTestId('plug-in-schedule').textContent).toBe('Add to the schedule')
    fireEvent.click(screen.getByRole('button', { name: 'Open the compare' }))
    expect(on.onOpenCompare).toHaveBeenCalledTimes(1)
  })

  it('no door to Pricing: the compare card keeps its words and loses its button', () => {
    mount({ picks: 1, onOpenCompare: undefined })
    expect(screen.getByTestId('source-picks').textContent).toContain('1 picked line')
    expect(screen.queryByRole('button', { name: 'Open the compare' })).toBeNull()
  })

  it('a schedule with nothing picked yet offers the door to Pricing on the schedule card; picks or no schedule, it is gone', () => {
    const on = mount({ scheduleTags: 5 })
    fireEvent.click(screen.getByTestId('open-compare-from-schedule'))
    expect(on.onOpenCompare).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('open-compare-from-schedule').textContent).toBe('Pick the products on Pricing')
    cleanup()
    mount({ scheduleTags: 5, picks: 2 })
    expect(screen.queryByTestId('open-compare-from-schedule')).toBeNull()
    cleanup()
    mount()
    expect(screen.queryByTestId('open-compare-from-schedule')).toBeNull()
  })

  it('each source is one row: its name and count, then its door; the sentences are hover lines, not text on the page', () => {
    mount({ takeoffFixtures: 26, takeoffWithProduct: 22, picks: 3 })
    expect(screen.getByTestId('source-takeoff').textContent).toBe('The takeoff · 26 fixtures, 22 with a partChoose from the takeoff')
    expect(screen.getByTestId('source-picks').textContent).toBe('Quotes compared · 3 picked linesOpen the compare')
    expect(screen.getByTestId('source-schedule').textContent).toBe('The plans’ schedule · none yetType or paste the schedule')
    expect(screen.getByTestId('submittal-sources').textContent).not.toContain('Optional.')
    expect(within(screen.getByTestId('source-schedule')).getByTitle(/^Optional\. A tag is the plan’s name for a fixture/)).toBeTruthy()
    expect(within(screen.getByTestId('source-takeoff')).getByTitle('One row per fixture you tick. The part under it is the product.')).toBeTruthy()
  })

  it('a queued ask says so in the schedule card and Cancel reports its task', () => {
    const fresh = { ...queued, requested_at: new Date().toISOString() } as SubmittalTaskRow
    const on = mount({ tasks: [fresh], robotSeat: { live: true, line: '' } })
    const state = screen.getByTestId('robot-schedule')
    // One line: the chip and its button. The sentence waits in the card.
    expect(state.textContent).toBe('🤖 Queued to read the plansCancel')
    fireEvent.mouseEnter(state)
    expect(within(state).getByRole('note').textContent).toContain('The robot is queued to read the fixture schedule off the plans.')
    fireEvent.click(within(state).getByRole('button', { name: 'Cancel' }))
    expect(on.onCancelTask).toHaveBeenCalledWith('task-q')
    expect(screen.queryByTestId('robot-schedule-confirm')).toBeNull()
  })

  it('an ask nobody came for says the day it was asked and offers to take it back', () => {
    const on = mount({ tasks: [queued] })
    const state = screen.getByTestId('robot-schedule')
    expect(state.getAttribute('data-stale')).toBe('true')
    // The chip itself says the ask is stuck and the day it was asked: nothing that matters waits for a hover.
    expect(within(state).getByTestId('robot-schedule-chip').textContent).toBe('🤖 Asked Sep 17 · no robot seat exists')
    fireEvent.click(within(state).getByTestId('robot-schedule-chip'))
    expect(within(state).getByRole('note').textContent).toContain('You asked the robot on Sep 17.')
    expect(within(state).getByTestId('robot-line').textContent).toBe('Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.')
    fireEvent.click(within(state).getByRole('button', { name: 'Take the ask back' }))
    expect(on.onCancelTask).toHaveBeenCalledWith('task-q')
  })

  it('a read schedule: the sure tags ride, the ticked unsure ones join them, Discard confirms none', () => {
    const on = mount({ tasks: [read], lookChecked: { 'HB-3': true } })
    const card = screen.getByTestId('robot-schedule-confirm')
    expect(card.textContent).toContain('The robot read 2 tags off the plans')
    expect(card.textContent).toContain('WC-1 ✓')
    fireEvent.click(screen.getByLabelText('Keep HB-3'))
    expect(on.onLookChecked).toHaveBeenCalledWith('HB-3', false)
    expect(screen.getByTestId('confirm-schedule').textContent).toBe('Confirm 2')
    fireEvent.click(screen.getByTestId('confirm-schedule'))
    expect(on.onConfirmSchedule).toHaveBeenLastCalledWith(read, ['WC-1', 'HB-3'])
    fireEvent.click(within(card).getByRole('button', { name: "Discard the robot's rows" }))
    expect(on.onConfirmSchedule).toHaveBeenLastCalledWith(read, [])
  })
})
