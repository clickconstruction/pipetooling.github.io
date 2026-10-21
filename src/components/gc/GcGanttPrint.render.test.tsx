// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 7a: Print or PDF's render tests on the chart alone.
 * The ones that render the prototype's Schedule tab stay on the spike. Moved word for word from the
 * GC mode prototype (branch spike/gc-mode, `GcGanttPrint.render.test.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch. Since the schedule's PR 10 the print files a copy
 * (`printAndFile`, mocked here): the job's team's pages under the team, the customer's under their name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GC_COMPANY } from '../../lib/gc/company'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gc/schedule/customerSchedule'
import type { GanttHold } from '../../lib/gc/schedule/gantt'
import type { GanttPrintJob } from '../../lib/gc/schedule/ganttPrint'
import type { GanttPrintFiling } from './GcGanttPrint'
import { plainWordsFailures } from '../../lib/plainWords'

const io = vi.hoisted(() => ({ opens: true, printed: [] as { html: string; filing: Record<string, unknown> }[] }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  printAndFile: (html: string, filing: Record<string, unknown>) => {
    if (!io.opens) return false
    io.printed.push({ html, filing })
    return true
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  io.opens = true
  io.printed.length = 0
})

const FILING: GanttPrintFiling = { projectId: 'proj-fair-oaks-d', customerId: 'cust-cibolo', customerName: 'Cibolo Creek Partners' }

function chart({ print = true, hold, logNote, filing }: { print?: boolean; hold?: string; logNote?: { label: string; note: string }; filing?: GanttPrintFiling } = {}) {
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
  return render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={holds} today={state.today} building picked={null} onPick={vi.fn()} {...(print ? { print: job } : {})} {...(filing ? { printFiling: filing } : {})} {...(logNotes ? { logNotes } : {})} />)
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

  it('Print or PDF prints the pages and files a copy under the job’s team, then closes the window (the schedule’s PR 10)', () => {
    chart({ filing: FILING })
    fireEvent.click(printButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Print or PDF' }))
    expect(io.printed).toHaveLength(1)
    const { html, filing } = io.printed[0]!
    expect(html).toContain('@page { size: letter landscape; margin: 0.4in; }')
    expect(filing).toEqual({
      kind: 'gc_schedule_print',
      title: expect.any(String),
      recipientName: 'The job’s team',
      customerId: 'cust-cibolo',
      source: { table: 'gc_schedules', id: 'proj-fair-oaks-d' },
    })
    expect(html).toContain(`<title>${String(filing.title)}</title>`)
    expect(screen.queryByRole('dialog', { name: 'Print the chart' })).toBeNull()
  })

  it('the customer’s pages file under the customer’s name', () => {
    chart({ filing: FILING })
    fireEvent.click(printButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Print or PDF' }))
    expect(io.printed[0]?.filing).toMatchObject({ kind: 'gc_schedule_print', recipientName: 'Cibolo Creek Partners', customerId: 'cust-cibolo' })
    expect(io.printed[0]?.html).toContain('Fair Oaks Shops, Building D: your schedule')
  })

  it('a blocked pop-up files nothing, keeps the window open and says what to do', () => {
    io.opens = false
    chart({ filing: FILING })
    fireEvent.click(printButton())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Print or PDF' }))
    expect(io.printed).toHaveLength(0)
    expect(within(dialog()).getByRole('alert').textContent).toBe('The print window was blocked. Allow pop-ups for this site and press it again.')
    expect(plainWordsFailures(within(dialog()).getByRole('alert').textContent ?? '')).toEqual([])
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
