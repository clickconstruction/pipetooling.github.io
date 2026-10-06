// @vitest-environment jsdom
/**
 * Render smoke for the rough schedule while we bid (the Gantt's G-45, `to-dos/gc-mode/mockups/G-45.md`):
 * a bidding job's Schedule tab opens on it, Draw a rough schedule makes the stages and the weeks,
 * a stage's days and Redraw move the count, Our number shows the weeks and the proposal sentence,
 * We sent our bid locks it as it went, and after we win the first draft starts from it.
 */
import { useReducer } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcNumberTab } from './GcOfficeTabs'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

function Shell() {
  const [state, dispatch] = useReducer(gcReducer, undefined, initialGcState)
  const project = state.projects.find((p) => p.name === 'Boerne Retail Shell')!
  return (
    <>
      <section aria-label="Schedule">
        <GcBuildingScheduleTab state={state} project={project} dispatch={dispatch} />
      </section>
      <section aria-label="Our number">
        <GcNumberTab state={state} project={project} dispatch={dispatch} />
      </section>
    </>
  )
}

const schedule = () => within(screen.getByRole('region', { name: 'Schedule' }))
const number = () => within(screen.getByRole('region', { name: 'Our number' }))
const card = () => document.querySelector('[data-tour="gc-rough"]') as HTMLElement

function drawFromNov2() {
  fireEvent.change(schedule().getByLabelText('If work starts'), { target: { value: '2026-11-02' } })
  fireEvent.click(schedule().getByRole('button', { name: 'Draw a rough schedule' }))
}

describe('a rough schedule while we bid (G-45)', () => {
  it('opens a bidding job’s Schedule tab on the rough, and Our number says the weeks are not drawn yet', () => {
    render(<Shell />)
    expect(schedule().getByText('A rough schedule for our bid')).toBeTruthy()
    expect(schedule().queryByRole('button', { name: 'Draw a first draft' })).toBeNull()
    expect(number().getByText('Weeks to build: not drawn yet. Draw a rough schedule on the Schedule tab.')).toBeTruthy()
    // Every sentence the card says is a first-timer's.
    const sentences = [...card().querySelectorAll('span')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '')
    expect(sentences).toContain('Nothing here goes to the trades or to Cibolo Creek Partners.')
    for (const s of sentences) expect(plainWordsFailures(s)).toEqual([])
  })

  it('draws Boerne Retail Shell from Mon Nov 2: its stages and 14 weeks, on the tab and beside the price', () => {
    render(<Shell />)
    drawFromNov2()
    expect(card().querySelectorAll('[data-rough-stage]')).toHaveLength(10)
    expect(schedule().getByText('14 weeks to build')).toBeTruthy()
    expect(screen.getAllByText('If work starts Mon Nov 2, substantial completion is Sun Feb 7. That is 14 weeks.')).toHaveLength(2)
    expect(number().getByText('We will build Boerne Retail Shell in 14 weeks from the day work starts.')).toBeTruthy()
    expect(number().getByText('Weeks to build').parentElement?.textContent).toContain('14')
  })

  it('takes a stage’s own days on Redraw, and the count follows the draw', () => {
    render(<Shell />)
    drawFromNov2()
    fireEvent.change(schedule().getByLabelText('Structure days'), { target: { value: '25' } })
    fireEvent.click(schedule().getByRole('button', { name: 'Redraw' }))
    expect(schedule().getByText('16 weeks to build')).toBeTruthy()
    expect(number().getByText('We will build Boerne Retail Shell in 16 weeks from the day work starts.')).toBeTruthy()
    expect((schedule().getByLabelText('Structure days') as HTMLInputElement).value).toBe('25')
  })

  it('locks when our bid goes in: no boxes, no Redraw, and the weeks read as they went', () => {
    render(<Shell />)
    drawFromNov2()
    fireEvent.click(number().getByRole('button', { name: 'We sent our bid' }))
    expect(schedule().queryByRole('button', { name: 'Redraw' })).toBeNull()
    expect(card().querySelectorAll('input')).toHaveLength(0)
    expect(screen.getAllByText('Our bid went in Fri Oct 2 with 14 weeks to build. The rough stays as it went.')).toHaveLength(2)
  })

  it('after we win, the first draft starts from the rough and says it against the weeks we bid', () => {
    render(<Shell />)
    drawFromNov2()
    fireEvent.click(number().getByRole('button', { name: 'We won this. Start buyout' }))
    expect(schedule().getByText('We bid 14 weeks, from the rough schedule. The first draft starts from its start day and its stage lengths.')).toBeTruthy()
    expect((schedule().getByDisplayValue('2026-11-02') as HTMLInputElement).type).toBe('date')
    fireEvent.click(schedule().getByRole('button', { name: 'Draw a first draft' }))
    expect(document.querySelector('[data-tour="gc-draft-vs-bid"]')?.textContent).toBe('The first draft runs the 14 weeks we bid.')
  })
})
