/** Main's own tests for the chart on paper: one company's work on our team's copy, and never on the customer's (G-13). */
import { describe, expect, it } from 'vitest'
import { GC_COMPANY } from '../company'
import { changeOrderTails } from './changeOrderDays'
import { customerDoneWords, customerSchedulePicture, customerStanding } from './customerSchedule'
import { lostDaysByLine } from './daysLost'
import type { GanttFilters, GanttHold } from './gantt'
import { NO_FILTERS, ganttBars, ganttGroups } from './gantt'
import type { GanttPrintInput, GanttPrintRow } from './ganttPrint'
import { ganttPrint } from './ganttPrint'
import { scheduleMeasures } from './schedule'
import { initialGcState } from './testState'
import { waitRows } from './waits'
import type { GcProject } from '../types'
import { plainWordsFailures } from '../../plainWords'

/** The chart's filter pills, by their names on the toolbar. */
const FILTER_NAMES: Record<keyof GanttFilters, string> = { critical: '5 or fewer spare days', late: 'Late or behind', held: 'Held', soon: 'Next 3 weeks', moved: 'Moved since Start' }

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026, as the Schedule tab hands it to the chart: two bars held, the trades that are done folded. */
function fairOaks(change: (p: GcProject) => GcProject = (p) => p) {
  const state = initialGcState()
  const found = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')
  if (!found) throw new Error('the made-up data lost Fair Oaks D')
  const project = change(found)
  const m = scheduleMeasures(state, project)
  const lineOf = (label: string) => {
    const item = m.items.find((i) => i.label === label)
    if (!item) throw new Error(`no ${label} on Fair Oaks D`)
    return item.activity.lineId
  }
  const holds = new Map<string, GanttHold>([
    [lineOf('Sheet metal and flashing'), { kind: 'submittal', words: 'submittal 07 62 00-01', late: false }],
    [lineOf('Rooftop units'), { kind: 'rfi', words: 'RFI-003, with the architect', late: false }],
  ])
  const bars = ganttBars(m.items, m.float, holds, state.today, true, changeOrderTails(project, state.today))
  const opening = new Set(ganttGroups(bars, 'trade').filter((g) => g.bars.every((b) => b.status === 'done')).map((g) => g.key))
  const input: GanttPrintInput = {
    bars,
    filters: NO_FILTERS,
    filterNames: FILTER_NAMES,
    by: 'trade',
    folded: opening,
    links: true,
    milestones: m.milestones,
    waits: waitRows(state, project),
    lost: lostDaysByLine(project),
    today: state.today,
    building: true,
    for: 'team',
    job: {
      name: project.name,
      place: project.address,
      company: GC_COMPANY.name,
      by: 'Robert Douglas',
      finishWords: 'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11. The contract says substantial completion by Dec 11.',
      doneWords: customerDoneWords(customerStanding(state, project)),
      customer: customerSchedulePicture(state, project),
    },
    noteOf: (b) => (b.hold ? { words: `waits on ${b.hold.words}`, color: 'var(--text-amber-800)' } : null),
  }
  return { state, project, bars, opening, input, companies: [...new Set(m.items.map((i) => i.company))] }
}

const barIds = (pages: GanttPrintRow[][]) => pages.flat().flatMap((r) => (r.kind === 'bar' ? [r.bar.id] : []))

describe('Print or PDF with one company picked (G-13)', () => {
  it('our team’s copy prints only the company’s bars and says whose work it is', () => {
    const { input, bars } = fairOaks()
    const p = ganttPrint({ ...input, company: 'Pecan Valley Electric', folded: new Set() })
    const theirs = new Set(bars.filter((b) => b.item.company === 'Pecan Valley Electric').map((b) => b.id))
    expect(barIds(p.pages)).toHaveLength(5)
    expect(barIds(p.pages).every((id) => theirs.has(id))).toBe(true)
    expect(p.shows.slice(1, 3)).toEqual(['It shows 5 of 30 activities, by trade.', "Only Pecan Valley Electric's work shows."])
  })

  it('names a company ending in s the way a person writes it, and says the pills after it', () => {
    const { input } = fairOaks()
    const p = ganttPrint({ ...input, company: 'Summit Roofing', filters: { ...NO_FILTERS, late: true } })
    expect(p.shows.slice(1, 4)).toEqual(['It shows 1 of 30 activities, by trade.', "Only Summit Roofing's work shows.", 'Filter on: Late or behind.'])
    expect(ganttPrint({ ...input, company: 'Iron Horse Partners' }).shows).toContain("Only Iron Horse Partners' work shows.")
  })

  it('the sentence reads as plain words', () => {
    const { input } = fairOaks()
    const p = ganttPrint({ ...input, company: 'Pecan Valley Electric' })
    expect(p.shows.flatMap((line) => plainWordsFailures(line))).toEqual([])
  })

  it('the customer’s copy is the same page whatever company is picked', () => {
    const { input } = fairOaks()
    const plain = ganttPrint({ ...input, for: 'customer' })
    const picked = ganttPrint({ ...input, for: 'customer', company: 'Pecan Valley Electric' })
    expect(picked.pages).toEqual(plain.pages)
    expect(picked.shows).toEqual(plain.shows)
  })
})
