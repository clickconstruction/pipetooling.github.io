// @vitest-environment jsdom
/**
 * Render smoke for Print or PDF on the chart (the Gantt's G-21, `to-dos/gc-mode/mockups/G-21.md`):
 * the toolbar's button, the Print the chart window with what will print, who it is for, the pages
 * in a frame, and the print itself through the app's print helper.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GC_COMPANY, initialGcState } from '../../lib/gcMode/gcFixture'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import type { GanttHold } from '../../lib/gcMode/gcGantt'
import type { GanttPrintJob } from '../../lib/gcMode/gcGanttPrint'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function chart({ print = true, hold, logNote }: { print?: boolean; hold?: string; logNote?: { label: string; note: string } } = {}) {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
  const m = scheduleMeasures(state, project)
  const holds = new Map<string, GanttHold>()
  const held = hold ? m.items.find((i) => i.label === hold) : undefined
  if (held) holds.set(held.activity.lineId, { kind: 'submittal', words: 'submittal 23 09 23-01', late: false })
  const logged = logNote ? m.items.find((i) => i.label === logNote.label) : undefined
  const logNotes = logged && logNote ? new Map([[logged.activity.lineId, { note: logNote.note, words: logNote.note }]]) : undefined
  const job: GanttPrintJob = {
    name: project.name,
    place: project.address,
    company: GC_COMPANY.name,
    by: 'Robert Douglas',
    finishWords: 'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11.',
    doneWords: customerDoneWords(customerStanding(state, project)),
    customer: customerSchedulePicture(state, project),
  }
  return render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={holds} today={state.today} building picked={null} onPick={vi.fn()} {...(print ? { print: job } : {})} {...(logNotes ? { logNotes } : {})} />)
}

const printButton = () => screen.getByRole('button', { name: 'Print or PDF' })
const dialog = () => screen.getByRole('dialog', { name: 'Print the chart' })
const framed = () => dialog().querySelector('iframe')?.getAttribute('srcdoc') ?? ''

describe('Print or PDF on the chart (G-21)', () => {
  it('is on the toolbar only when the tab gives the job its words', () => {
    chart({ print: false })
    expect(screen.queryByRole('button', { name: 'Print or PDF' })).toBeNull()
    cleanup()
    chart()
    expect(printButton()).toBeTruthy()
  })

  it('opens Print the chart, light whatever the theme, with the pages and what the chart shows, in plain words', () => {
    chart()
    fireEvent.click(printButton())
    const d = dialog()
    expect(d.getAttribute('data-theme')).toBe('light')
    expect(within(d).getByText('2 landscape pages, letter size.')).toBeTruthy()
    expect(within(d).getByText('It shows all 30 activities, by trade.')).toBeTruthy()
    expect(within(d).getByText('Sitework and Concrete are folded into one bar each.')).toBeTruthy()
    expect(within(d).getByText("Our team's copy names the companies and shows the spare days.")).toBeTruthy()
    expect(framed()).toContain('Fair Oaks Shops, Building D: the schedule')
    // Every sentence the window says is a first-timer's: one idea each, none over 20 words.
    const sentences = [...d.querySelectorAll('div')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '')
    expect(sentences.length).toBeGreaterThan(4)
    for (const s of sentences) expect(plainWordsFailures(s)).toEqual([])
  })

  it('follows the filters: Late or behind prints 5 of 30 on one page', () => {
    chart()
    fireEvent.click(screen.getByRole('button', { name: /^Late or behind/ }))
    fireEvent.click(printButton())
    expect(within(dialog()).getByText('1 landscape page, letter size.')).toBeTruthy()
    expect(within(dialog()).getByText('It shows 5 of 30 activities, by trade.')).toBeTruthy()
    expect(within(dialog()).getByText('Filter on: Late or behind.')).toBeTruthy()
  })

  it('The customer swaps the pages for theirs: their stages, no company names', () => {
    chart()
    fireEvent.click(printButton())
    expect(framed()).toContain('Summit Roofing')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    expect(within(dialog()).getByText(/^Cibolo Creek Partners reads the stages of the job/)).toBeTruthy()
    expect(framed()).toContain('Fair Oaks Shops, Building D: your schedule')
    expect(framed()).not.toContain('Summit Roofing')
    expect(within(dialog()).getByText('1 landscape page, letter size.')).toBeTruthy()
  })

  it('Print or PDF writes the pages into a new window, prints them and closes the window', () => {
    const doc = { write: vi.fn(), close: vi.fn() }
    const win = { document: doc, focus: vi.fn(), print: vi.fn(), close: vi.fn(), onafterprint: null }
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    chart()
    fireEvent.click(printButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Print or PDF' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(String(doc.write.mock.calls[0]?.[0])).toContain('@page { size: letter landscape; margin: 0.4in; }')
    expect(win.print).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Print the chart' })).toBeNull()
  })

  it('prints the chart’s own note beside a bar, what the daily log says included (G-60)', () => {
    chart({ logNote: { label: 'Top out', note: 'nobody on the daily log since Mon Sep 28' } })
    fireEvent.click(printButton())
    expect(framed()).toContain('nobody on the daily log since Mon Sep 28')
  })

  it('is off when nothing passes the filters', () => {
    chart({ hold: 'Controls' })
    fireEvent.click(screen.getByRole('button', { name: /^Late or behind/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Held/ }))
    expect(screen.getByText('Nothing on the schedule passes these filters.')).toBeTruthy()
    expect((printButton() as HTMLButtonElement).disabled).toBe(true)
    expect(printButton().getAttribute('title')).toBe('Nothing passes these filters, so there is nothing to print.')
  })
})
