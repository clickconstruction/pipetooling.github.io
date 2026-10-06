// @vitest-environment jsdom
/**
 * Render smoke for Export on the chart (the Gantt's G-136, `to-dos/gc-mode/mockups/G-136.md`): the
 * toolbar's button beside Print or PDF, the Export the schedule window with the whole schedule's
 * count, who it is for, and a button for each file, saved through the browser (stood in for here).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GC_COMPANY, initialGcState } from '../../lib/gcMode/gcFixture'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { waitHolds, waitRows } from '../../lib/gcMode/gcScheduleWaits'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import type { GanttPrintJob } from '../../lib/gcMode/gcGanttPrint'
import { downloadTextFile } from '../../lib/gcMode/gcDownloadFile'
import { plainWordsFailures } from '../../lib/plainWords'

vi.mock('../../lib/gcMode/gcDownloadFile', () => ({ downloadTextFile: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.mocked(downloadTextFile).mockClear()
})

function chart({ print = true }: { print?: boolean } = {}) {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
  const m = scheduleMeasures(state, project)
  const job: GanttPrintJob = {
    name: project.name,
    place: project.address,
    company: GC_COMPANY.name,
    by: 'Robert Douglas',
    finishWords: 'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11.',
    doneWords: customerDoneWords(customerStanding(state, project)),
    customer: customerSchedulePicture(state, project),
  }
  return render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={waitHolds(state, project)} waits={waitRows(state, project)} today={state.today} building picked={null} onPick={vi.fn()} {...(print ? { print: job } : {})} />)
}

const exportButton = () => within(document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement).getByRole('button', { name: 'Export' })
const dialog = () => screen.getByRole('dialog', { name: 'Export the schedule' })
const saves = () => vi.mocked(downloadTextFile).mock.calls.map(([text, name, type]) => ({ text, name, type }))

describe('Export on the chart (G-136)', () => {
  it('sits beside Print or PDF, only when the tab gives the job its words', () => {
    chart({ print: false })
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull()
    cleanup()
    chart()
    const buttons = [...(document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement).querySelectorAll('button')].map((b) => b.textContent)
    expect(buttons.indexOf('Export')).toBe(buttons.indexOf('Print or PDF') + 1)
  })

  it('opens Export the schedule: the whole schedule, the filters line, who it is for and the two files, in plain words', () => {
    chart()
    fireEvent.click(exportButton())
    const d = dialog()
    expect(within(d).getByText('The whole schedule, by trade: 30 activities, 3 things the work waits on and 4 dates to meet.')).toBeTruthy()
    expect(within(d).getByText('The filters and folds do not change a file.')).toBeTruthy()
    expect(within(d).getByText("Our team's copy names the companies and shows the spare days.")).toBeTruthy()
    expect(within(d).getByRole('button', { name: 'Our team' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(d).getByText('A file Microsoft Project and Primavera P6 open, with the waits between the work.')).toBeTruthy()
    // The prototype opened neither program: the window says who checks the first real import.
    expect(within(d).getByText("Nobody has opened this file in Project or Primavera yet. The owner checks the first import with a scheduler's copy of each program.")).toBeTruthy()
    const sentences = [...d.querySelectorAll('div')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '')
    expect(sentences.length).toBeGreaterThan(5)
    for (const s of sentences) expect(plainWordsFailures(s)).toEqual([])
  })

  it('is the whole schedule whatever the filters and folds show', () => {
    chart()
    fireEvent.click(screen.getByRole('button', { name: /^Late or behind/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Fold all' }))
    fireEvent.click(exportButton())
    expect(within(dialog()).getByText('The whole schedule, by trade: 30 activities, 3 things the work waits on and 4 dates to meet.')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    expect(saves()[0]?.text.split('\r\n').filter(Boolean)).toHaveLength(38)
  })

  it('saves our team’s spreadsheet and project file by name and type, and stays open for the other', () => {
    chart()
    fireEvent.click(exportButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    expect(within(dialog()).getByText('Saved Fair-Oaks-Shops-Building-D-schedule-2026-10-02.csv.')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Project file' }))
    const [csv, xml] = saves()
    expect([csv?.name, csv?.type]).toEqual(['Fair-Oaks-Shops-Building-D-schedule-2026-10-02.csv', 'text/csv;charset=utf-8'])
    expect(csv?.text.startsWith('﻿Group,Activity,Kind,Trade,Company,')).toBe(true)
    expect(csv?.text).toContain('Plumbing,Top out,activity,Plumbing,Our own crew,2026-09-28,2026-10-09,12,40,37,37 spare days,Rough in (Plumbing),,,,')
    expect([xml?.name, xml?.type]).toEqual(['Fair-Oaks-Shops-Building-D-schedule-2026-10-02.xml', 'application/xml;charset=utf-8'])
    expect(xml?.text).toContain('<Project xmlns="http://schemas.microsoft.com/project">')
    expect(xml?.text).toContain('<Alias>Company</Alias>')
    expect(within(dialog()).getByText('Saved Fair-Oaks-Shops-Building-D-schedule-2026-10-02.xml.')).toBeTruthy()
    // Another copy on show: the line no longer names our team's file.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    expect(within(dialog()).getByRole('status').textContent).toBe('')
  })

  it('The customer changes both files: their stages, their name on the file, no company', () => {
    chart()
    fireEvent.click(exportButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    expect(within(dialog()).getByText('The whole schedule, by stage: 10 stages and 4 dates to meet.')).toBeTruthy()
    expect(within(dialog()).getByText(/^Cibolo Creek Partners reads the stages of the job/)).toBeTruthy()
    expect(within(dialog()).getByText('A file Microsoft Project and Primavera P6 open.')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Spreadsheet' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Project file' }))
    const [csv, xml] = saves()
    expect(csv?.name).toBe('Fair-Oaks-Shops-Building-D-schedule-for-Cibolo-Creek-Partners-2026-10-02.csv')
    expect(csv?.text.startsWith('﻿Group,Name,Start,Finish,Done %,Where it stands\r\nStages of the job,Site prep,2026-07-06,2026-07-17,100,done\r\n')).toBe(true)
    expect(xml?.name).toBe('Fair-Oaks-Shops-Building-D-schedule-for-Cibolo-Creek-Partners-2026-10-02.xml')
    for (const file of [csv?.text ?? '', xml?.text ?? '']) {
      for (const company of ['Our own crew', 'Summit Roofing', 'Cool Breeze Mechanical', 'The city', 'CPS Energy']) expect(file).not.toContain(company)
      expect(file).not.toContain('Text1')
      expect(file).not.toMatch(/spare/i)
    }
  })

  it('closes on Close and on the dark around it', () => {
    chart()
    fireEvent.click(exportButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Export the schedule' })).toBeNull()
    fireEvent.click(exportButton())
    fireEvent.click(dialog().parentElement as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'Export the schedule' })).toBeNull()
  })
})

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
