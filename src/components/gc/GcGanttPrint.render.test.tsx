// @vitest-environment jsdom
/**
 * Render smoke for Print or PDF on the chart (the Gantt's G-21, `to-dos/gc-mode/mockups/G-21.md`):
 * the toolbar's button, the Print the chart window with what will print, who it is for, the pages
 * in a frame, and the print itself through the app's print helper.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'
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

  it('prints the spare-day tails while Show spare days is on, and says so (G-08)', () => {
    chart()
    fireEvent.click(screen.getByRole('button', { name: 'Show spare days' }))
    fireEvent.click(printButton())
    expect(within(dialog()).getByText("Each bar's spare days show as a faint tail.")).toBeTruthy()
    expect(framed()).toContain('data-spare=')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    expect(framed()).not.toContain('data-spare=')
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

describe('the paper takes the holds the chart is given (G-21 after G-77)', () => {
  it('prints Site lighting and Fire alarm as the Schedule tab’s chart shows them: held, by Pecan Valley’s papers', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    render(<GcBuildingScheduleTab state={state} project={project} dispatch={vi.fn()} />)
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    // What the chart says beside each bar: the note drawn after it (barNote, from the tab's holds).
    const onChart = (label: string) => {
      const name = [...document.querySelectorAll('[data-gantt-scroller] button')].find((b) => b.textContent?.trim() === label && !b.hasAttribute('data-gantt-bar'))
      const lane = name?.parentElement?.parentElement?.children[1]
      return [...(lane?.querySelectorAll('span') ?? [])].find((sp) => (sp as HTMLElement).style.whiteSpace === 'nowrap')?.textContent ?? ''
    }
    const site = onChart('Site lighting')
    const fire = onChart('Fire alarm')
    expect(site).toBe('waits on current insurance, theirs ran out Sep 15')
    expect(fire).toBe('waits on current insurance and submittal 28 31 11-01')
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const paper = new DOMParser().parseFromString(framed(), 'text/html')
    const texts = [...paper.querySelectorAll('svg.chart text')].map((t) => t.textContent ?? '')
    for (const [label, note] of [['Site lighting', site], ['Fire alarm', fire]] as const) {
      const at = texts.indexOf(label)
      expect(at).toBeGreaterThan(-1)
      expect(texts.slice(at, at + 5)).toContain('held')
      expect(texts).toContain(note)
    }
  })
})

describe('the Projected finish measure’s late lines on our team’s paper (G-98 after G-21)', () => {
  const ID = 'fairoaksd'
  const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
  const moveBy = (s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState => {
    const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
    return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
  }
  const changeOrder = (s: GcState, description: string, days: number, sign: boolean): GcState => {
    let state = gcReducer(s, { type: 'draftChangeOrder', projectId: ID, description, reason: 'plans', schedule: '', packageId: null, cost: 4_200, price: 0, days })
    const all = job(state).changeOrders ?? []
    const co = all[all.length - 1]!
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: co.id })
    return sign ? gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: co.id }) : state
  }
  /** The late-finish tests' job: Trim a week on the customer's tile, rain on Test and balance, change order 1 signed, change order 2 sent, $500 a day. */
  const lateJob = (): GcState => {
    let s = initialGcState()
    s = moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
    s = moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
    s = changeOrder(s, 'A larger roof curb for RTU-2', 1, true)
    s = changeOrder(s, 'Extra exterior lighting', 2, false)
    return gcReducer(s, { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
  }

  it('prints each line the measure shows, in its order, right under the finish sentence; the customer’s copy keeps its own', () => {
    const state = lateJob()
    render(<GcBuildingScheduleTab state={state} project={job(state)} dispatch={vi.fn()} />)
    const shown = [...document.querySelectorAll('[data-tour="gc-late-finish"] > span')].map((el) => el.textContent ?? '')
    expect(shown.length).toBeGreaterThanOrEqual(3)
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const head = () => [...new DOMParser().parseFromString(framed(), 'text/html').querySelectorAll('header.head p')].map((el) => el.textContent ?? '')
    const lines = head()
    const at = lines.findIndex((l) => l.startsWith('The contract says') || l.includes('The contract says'))
    expect(at).toBeGreaterThan(0)
    expect(lines.slice(at + 1, at + 1 + shown.length)).toEqual(shown)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    for (const line of shown) expect(head()).not.toContain(line)
  })
})
