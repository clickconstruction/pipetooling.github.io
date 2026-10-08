// @vitest-environment jsdom
/**
 * Render smoke for Export from the prototype's Schedule tab (the Gantt's G-136,
 * `to-dos/gc-mode/mockups/G-136.md`): the tab's own waits and dates in the file, and no Export inside
 * a what-if copy. The chart's own tests moved to main with the schedule's PR 7a (#5017) and are
 * `GcScheduleExport.render.test.tsx`. The chart is main's now, so the file is saved through main's
 * `downloadFile.ts` (the spike's `gcDownloadFile.ts` re-exports it), stood in for here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { downloadTextFile } from '../../lib/gc/downloadFile'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

vi.mock('../../lib/gc/downloadFile', () => ({ downloadTextFile: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.mocked(downloadTextFile).mockClear()
})

const exportButton = () => within(document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement).getByRole('button', { name: 'Export' })
const dialog = () => screen.getByRole('dialog', { name: 'Export the schedule' })
const saves = () => vi.mocked(downloadTextFile).mock.calls.map(([text, name, type]) => ({ text, name, type }))

describe('Export from the real Schedule tab (G-136)', () => {
  it('opens with the tab’s own waits and dates, and saves the whole schedule', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    render(<GcBuildingScheduleTab state={state} project={project} dispatch={vi.fn()} />)
    fireEvent.click(exportButton())
    expect(within(dialog()).getByText('The whole schedule, by trade: 30 activities, 3 things the work waits on and 4 dates to meet.')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    const csv = saves()[0]?.text ?? ''
    expect(csv).toContain('What the work waits on,Rooftop units on site,delivery,HVAC,')
    // The tab's holds reach the file as the chart shows them: Site lighting held by Pecan Valley's papers.
    expect(csv).toMatch(/\r\nElectrical,Site lighting,activity,Electrical,Pecan Valley Electric,[^\r]*,held,/)
  })
})

describe('Export and the what-if copy (G-136 after G-81)', () => {
  const ID = 'fairoaksd'
  const play = (st: GcState, ...actions: GcAction[]) => actions.reduce((x, a) => gcReducer(x, a), st)
  const job = (st: GcState) => st.projects.find((p) => p.id === ID)!
  /** A copy open with the TPO membrane a week later in it. */
  const withCopy = (): GcState => {
    const s1 = play(initialGcState(), { type: 'startWhatIf', projectId: ID, by: 'Robert' })
    const a = job(s1).whatIf!.schedule.activities.find((x) => x.lineId === 'froof-1')!
    return play(s1, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: a.start, finish: '2026-10-16', after: a.after } })
  }
  const toolbar = () => document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement

  it('has no Export inside the copy, and on the real schedule saves the real one, whatever the copy holds', () => {
    const plain = render(<GcBuildingScheduleTab state={initialGcState()} project={job(initialGcState())} dispatch={vi.fn()} />)
    fireEvent.click(exportButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    const real = saves()[0]?.text
    plain.unmount()
    vi.mocked(downloadTextFile).mockClear()

    const state = withCopy()
    render(<GcBuildingScheduleTab state={state} project={job(state)} dispatch={vi.fn()} />)
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'What if · 1' }))
    expect(within(toolbar()).getByRole('button', { name: 'See the real schedule' })).toBeTruthy()
    expect(within(toolbar()).queryByRole('button', { name: 'Export' })).toBeNull()
    expect(within(toolbar()).queryByRole('button', { name: 'Print or PDF' })).toBeNull()
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'See the real schedule' }))
    fireEvent.click(exportButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    expect(saves()[0]?.text).toBe(real)
    expect(real).toContain('Roofing,TPO membrane,activity,Roofing,Summit Roofing,2026-09-21,2026-10-09,')
  })
})
