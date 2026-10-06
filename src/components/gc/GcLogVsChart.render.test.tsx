// @vitest-environment jsdom
/**
 * Render smoke for the daily log and the chart (G-60): the card's rows with what to do, Open goes
 * to the bar, It started keeps the real start, nothing shows when the two agree; and the chart's
 * side, the note beside the bar and the Log line on its hover card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcLogVsChart } from './GcLogVsChart'
import { GcGantt } from './GcGantt'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { logChartGaps, logChartNotes } from '../../lib/gcMode/gcLogVsChart'
import type { DailyLog, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

/** Fair Oaks D with Summit Roofing left off this week's logs, and Guadalupe Flatwork back on site Monday and Tuesday. */
function fairOaksDisagrees(): GcState {
  const state = initialGcState()
  const week = ['2026-09-28', '2026-09-29', '2026-10-01']
  const change = (l: DailyLog): DailyLog => {
    const crews = week.includes(l.date) ? l.crews.filter((c) => c.packageId !== 'froof') : l.crews
    return { ...l, crews: ['2026-09-28', '2026-09-29'].includes(l.date) ? [...crews, { packageId: 'fconc', workers: 3 }] : crews }
  }
  return { ...state, projects: state.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, dailyLogs: (p.dailyLogs ?? []).map(change) } : p)) }
}

describe('the daily log and the chart, the card', () => {
  it('says each trade’s week with what to do, and Open goes to the bar', () => {
    const state = fairOaksDisagrees()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const onOpen = vi.fn()
    render(<GcLogVsChart project={project} gaps={logChartGaps(state, project)} dispatch={vi.fn()} onOpen={onOpen} />)
    expect(screen.getByText('The daily log and the chart')).toBeTruthy()
    expect(screen.getByText('this week · 2')).toBeTruthy()
    expect(screen.getByText(/Summit Roofing was not on site Mon, Tue and Thu\. The chart has TPO membrane running those days\./)).toBeTruthy()
    expect(screen.getByText('Ask when the crew comes back. If the work slipped, move the bar and say why.')).toBeTruthy()
    expect(screen.getByText(/Guadalupe Flatwork was on site Mon and Tue, 6 worker-days\./)).toBeTruthy()
    expect(screen.getByText('If it is punch work, nothing changes. If the work is new, add it with Add an activity.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open TPO membrane' }))
    expect(onOpen).toHaveBeenCalledWith('froof-1')
  })

  it('keeps the real start in one press, and shows no Open where there is no editor', () => {
    let state = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
    state = gcReducer(state, { type: 'startProject', projectId: 'helotes', anyway: { reason: 'The slab before the rain', by: 'Robert' } })
    state = gcReducer(state, { type: 'saveDailyLog', projectId: 'helotes', log: { date: '2026-10-02', sky: 'clear', high: 84, low: 63, weatherStop: false, crews: [{ packageId: 'dplumb', workers: 3 }], done: '', delays: [], visitors: '' } })
    const project = state.projects.find((p) => p.id === 'helotes')!
    const dispatch = vi.fn()
    // The Daily log tab passes no onOpen: its rows answer with It started, not the editor.
    render(<GcLogVsChart project={project} gaps={logChartGaps(state, project).filter((g) => g.kind === 'noBar')} dispatch={dispatch} />)
    expect(screen.getByText(/Our own crew was on site Fri, 3 worker-days\. Nothing of ours runs on the chart that day\. Underground starts Mon Oct 5\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'It started Fri Oct 2' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'setActualDates', projectId: 'helotes', lineId: 'dplumb-1', actualStart: '2026-10-02', by: 'The office' })
    // On the Schedule tab the same row also opens the bar it is about.
    cleanup()
    const onOpen = vi.fn()
    render(<GcLogVsChart project={project} gaps={logChartGaps(state, project)} dispatch={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Underground' }))
    expect(onOpen).toHaveBeenCalledWith('dplumb-1')
  })

  it('shows nothing when the log and the chart agree', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const { container } = render(<GcLogVsChart project={project} gaps={logChartGaps(state, project)} dispatch={vi.fn()} onOpen={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})

describe('the daily log and the chart, on the chart', () => {
  it('writes the note beside the bar, and the Log line on its hover card', () => {
    const state = fairOaksDisagrees()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const m = scheduleMeasures(state, project)
    const logNotes = logChartNotes(logChartGaps(state, project))
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={vi.fn()} logNotes={logNotes} />)
    expect(screen.getByText('not on site this week')).toBeTruthy()
    const bar = container.querySelector('[data-gantt-bar="froof-1"]')!
    fireEvent.mouseEnter(bar, { clientX: 10, clientY: 10 })
    const card = screen.getByRole('tooltip')
    expect(card.textContent).toContain('LogNobody from Summit Roofing on the daily log Mon, Tue and Thu.')
    // The log's line is said once, not again as the bar's note.
    expect(card.textContent).not.toContain('Note')
  })
})
