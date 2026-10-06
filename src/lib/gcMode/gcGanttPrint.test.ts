import { describe, expect, it } from 'vitest'
import { GC_COMPANY, initialGcState } from './gcFixture'
import { scheduleMeasures } from './gcBuildingSchedule'
import { NO_FILTERS, ganttBars, ganttFilter, ganttGroups, ganttLinks, spareTail, type GanttBar, type GanttFilters, type GanttHold } from './gcGantt'
import { waitRows } from './gcScheduleWaits'
import { lostDaysByLine } from './gcDaysLost'
import { changeOrderTails } from './gcChangeOrderDays'
import { customerDoneWords, customerFullChart, customerSchedulePicture, customerStages, customerStanding } from './gcCustomerSchedule'
import { PRINT_GROUP, PRINT_ROW, ganttPrint, ganttPrintHtml, lookAheadWindow, placeMilestones, printAxis, printPages, type GanttPrintInput, type GanttPrintRow } from './gcGanttPrint'
import { plainWordsFailures } from '../plainWords'
import type { GcProject } from './gcTypes'

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
const chartOrder = (bars: GanttBar[]) => ganttGroups(bars, 'trade').flatMap((g) => g.bars.map((b) => b.id))

describe('Print or PDF: our team’s copy is the chart as the person has it (G-21)', () => {
  it('prints every bar once, in the chart’s order, under its own group', () => {
    const { input, bars } = fairOaks()
    const p = ganttPrint({ ...input, folded: new Set() })
    expect(barIds(p.pages)).toEqual(chartOrder(bars))
    let group = ''
    for (const r of p.pages.flat()) {
      if (r.kind === 'group') group = r.key
      if (r.kind === 'bar') expect(r.bar.item.pkg?.id ?? 'inspections').toBe(group)
    }
  })

  it('keeps the chart’s folds: a finished trade prints as its one bar, and the window says so', () => {
    const { input } = fairOaks()
    const p = ganttPrint(input)
    expect(p.pages.flat().flatMap((r) => (r.kind === 'group' && r.folded ? [r.title] : []))).toEqual(['Sitework', 'Concrete'])
    expect(barIds(p.pages)).toHaveLength(23)
    expect(p.shows).toEqual(['2 landscape pages, letter size.', 'It shows all 30 activities, by trade.', 'Sitework and Concrete are folded into one bar each.', 'Lines show what waits on what.'])
    expect(p.head.lines).toEqual([
      '7920 Fair Oaks Pkwy, Fair Oaks Ranch. For our team. As of Fri Oct 2, 2026.',
      'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11. The contract says substantial completion by Dec 11.',
      '72% of the work is done. We planned 76% by today.',
      'It shows all 30 activities, by trade. Sitework and Concrete are folded into one bar each. Lines show what waits on what.',
    ])
  })

  it('prints exactly the bars each filter shows, and names its pill', () => {
    const { input, bars } = fairOaks()
    for (const key of Object.keys(NO_FILTERS) as (keyof GanttFilters)[]) {
      const filters = { ...NO_FILTERS, [key]: true }
      const p = ganttPrint({ ...input, filters, folded: new Set() })
      expect(barIds(p.pages)).toEqual(chartOrder(ganttFilter(bars, filters)))
      expect(p.shows).toContain(`Filter on: ${FILTER_NAMES[key]}.`)
    }
    expect(ganttPrint({ ...input, filters: { ...NO_FILTERS, late: true, held: true } }).shows).toContain('Filters on: Late or behind, Held.')
    expect(ganttPrint({ ...input, filters: { ...NO_FILTERS, late: true } }).shows.slice(0, 3)).toEqual(['1 landscape page, letter size.', 'It shows 5 of 30 activities, by trade.', 'Filter on: Late or behind.'])
  })

  it('draws a filtered print closer: the paper spans the bars shown and the dates to meet, from a Monday', () => {
    const { input } = fairOaks()
    const all = ganttPrint(input)
    const late = ganttPrint({ ...input, filters: { ...NO_FILTERS, late: true } })
    expect(all.axis).toMatchObject({ first: '2026-06-29', days: 180, scale: 'weeks', window: false })
    expect(late.axis.days).toBeLessThan(all.axis.days)
    expect(new Date(`${late.axis.first}T00:00:00Z`).getUTCDay()).toBe(1)
  })

  it('draws a line between two bars only when both are on the same page, and none when the lines are hidden', () => {
    const { input } = fairOaks()
    const p = ganttPrint({ ...input, folded: new Set() })
    const pageOf = new Map(p.pages.flatMap((rows, i) => rows.flatMap((r) => (r.kind === 'bar' ? [[r.bar.id, i] as const] : []))))
    expect(p.pages).toHaveLength(2)
    for (const l of p.links) {
      expect(pageOf.get(l.from)).toBe(l.page)
      expect(pageOf.get(l.to)).toBe(l.page)
    }
    const every = ganttLinks(input.bars)
    const crossing = every.filter((l) => pageOf.get(l.from) !== pageOf.get(l.to))
    expect(crossing.length).toBeGreaterThan(0)
    expect(p.links).toHaveLength(every.length - crossing.length)
    expect(ganttPrint({ ...input, links: false }).links).toEqual([])
    expect(ganttPrint({ ...input, links: false }).shows).toContain('The lines between bars are hidden.')
  })

  it('keeps what the work waits on on page 1 and the dates to meet on every page', () => {
    const { input } = fairOaks()
    const p = ganttPrint(input)
    expect(p.pages[0]?.slice(0, 4).map((r) => r.kind)).toEqual(['waits', 'wait', 'wait', 'wait'])
    expect(p.pages.slice(1).flat().some((r) => r.kind === 'wait' || r.kind === 'waits')).toBe(false)
    expect(p.milestones.map((m) => m.row.milestone.label)).toEqual(['Slab poured', 'Dry-in', 'Rough-in inspection', 'Substantial completion'])
    expect(ganttPrintHtml(p).split('Dates the job must meet').length - 1).toBe(p.pages.length)
    // The key lists the marks each page uses, today on every one.
    expect(p.key.every((marks) => marks.includes('today') && marks.includes('milestone'))).toBe(true)
    expect(p.key[0]).toContain('wait')
    expect(p.key[1]).not.toContain('wait')
  })
})

describe('a trade’s own new day from its portal (G-117)', () => {
  it('prints as the chart draws it, an amber dashed tail keyed in the chart’s words, on our team’s copy only', () => {
    const { input } = fairOaks()
    const tpo = input.bars.find((b) => b.item.label === 'TPO membrane')
    if (!tpo) throw new Error('no TPO membrane on Fair Oaks D')
    const lateSaid = new Map([[tpo.id, { finish: '2026-10-14', words: 'Summit Roofing says TPO membrane will finish Wed Oct 14, not Fri Oct 9: materials.' }]])
    const team = ganttPrint({ ...input, lateSaid })
    expect(team.key[0]).toContain('said')
    expect(ganttPrintHtml(team)).toContain("a trade's new day from its portal, not on the dates yet")
    expect(ganttPrint(input).key.flat()).not.toContain('said')
    expect(ganttPrint({ ...input, lateSaid, for: 'customer' }).key.flat()).not.toContain('said')
  })
})

describe('spare days on the paper (G-08)', () => {
  it('prints our team a faint tail for each bar with room while Show spare days is on, keyed and said; never the customer', () => {
    const { input } = fairOaks()
    const off = ganttPrint({ ...input, folded: new Set() })
    expect(off.key.flat()).not.toContain('spare')
    expect(ganttPrintHtml(off)).not.toContain('data-spare=')
    const on = ganttPrint({ ...input, folded: new Set(), spare: true })
    const withRoom = input.bars.filter((b) => spareTail(b)).map((b) => b.id)
    expect(withRoom).toHaveLength(14)
    const html = ganttPrintHtml(on)
    expect([...html.matchAll(/data-spare="([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([...withRoom].sort())
    expect(on.key.flat()).toContain('spare')
    expect(html).toContain('its spare days, how long it can slip before the job finishes later')
    expect(on.shows).toContain("Each bar's spare days show as a faint tail.")
    expect(on.head.lines.some((l) => l.includes("Each bar's spare days show as a faint tail."))).toBe(true)
    expect(on.pages).toHaveLength(off.pages.length)
    for (const customer of [ganttPrint({ ...input, spare: true, for: 'customer' })]) {
      expect(customer.spare).toBe(false)
      expect(customer.key.flat()).not.toContain('spare')
      expect(ganttPrintHtml(customer)).not.toContain('data-spare=')
    }
  })
})

describe('the scale and the dates to meet', () => {
  it('picks the scale from the page: every day for five weeks, Mondays for six months, the 1st and 15th for two years', () => {
    expect(printAxis('2026-09-21', 35, 300, 434, true)).toMatchObject({ scale: 'days', tint: true })
    expect(printAxis('2026-06-29', 180, 300, 434, false)).toMatchObject({ scale: 'weeks', tint: false })
    const long = printAxis('2026-01-05', 730, 300, 434, false)
    expect(long.scale).toBe('months')
    expect(long.ticks.every((t) => t.label === '1' || t.label === '15')).toBe(true)
    expect(printAxis('2026-09-21', 35, 300, 434, true).ticks.slice(0, 2).map((t) => t.letter)).toEqual(['M', 'T'])
  })

  it('takes a third line for the dates to meet before letting two labels run together', () => {
    const { input } = fairOaks()
    const cramped = placeMilestones(input.milestones, printAxis('2026-06-29', 180, 306, 428, false), 734)
    expect(cramped.lines).toBe(3)
    const line = (label: string) => cramped.placed.find((m) => m.row.milestone.label === label)?.line
    expect(line('Dry-in')).not.toBe(line('Substantial completion'))
    // With room, two lines do.
    expect(placeMilestones(input.milestones, printAxis('2026-06-29', 180, 0, 3000, false), 3000).lines).toBe(2)
  })
})

describe('paging', () => {
  const heading = (key: string, folded = false): GanttPrintRow => ({ kind: 'group', key, title: key, sub: '', start: '2026-10-01', finish: '2026-10-09', pct: null, stands: '', tone: 'grey', folded, now: false, continued: false })
  const bar = (): GanttPrintRow => ({ kind: 'bar', bar: {} as GanttBar, stands: '', tone: 'grey', note: null, done: '', plan: '', plain: false })
  const height = (r: GanttPrintRow) => (r.kind === 'group' || r.kind === 'waits' ? PRINT_GROUP : PRINT_ROW)

  it('splits 70 bars in 3 groups over pages: no page ends on a heading, a cut group repeats its heading, every row prints once', () => {
    const rows = ['A', 'B', 'C'].flatMap((k, i) => [heading(k), ...Array.from({ length: i === 2 ? 24 : 23 }, bar)])
    const pages = printPages(rows, 400, 400)
    expect(pages).toHaveLength(3)
    for (const page of pages) {
      expect(page.reduce((h, r) => h + height(r), 0)).toBeLessThanOrEqual(400)
      expect(page[page.length - 1]?.kind).toBe('bar')
    }
    const continued = pages.slice(1).map((p) => p[0])
    expect(continued.every((r) => r?.kind === 'group' && r.continued)).toBe(true)
    expect(pages.flat().filter((r) => r.kind === 'bar')).toHaveLength(70)
    expect(pages.flat().filter((r) => r.kind === 'group' && !r.continued)).toHaveLength(3)
  })

  it('moves a heading to the next page unless two of its rows fit under it; a folded one may end a page', () => {
    const rows = [heading('A'), ...Array.from({ length: 5 }, bar), heading('B'), bar(), bar(), bar()]
    const pages = printPages(rows, 110, 400)
    expect(pages[0]).toHaveLength(6)
    expect(pages[1]?.[0]).toMatchObject({ kind: 'group', key: 'B', continued: false })
    const withFold = printPages([heading('A'), ...Array.from({ length: 5 }, bar), heading('F', true), heading('B'), bar(), bar()], 95, 400)
    expect(withFold[0]?.[withFold[0].length - 1]).toMatchObject({ kind: 'group', key: 'F', folded: true })
  })

  it('still makes a page when nothing passes the filters', () => {
    expect(printPages([], 300, 300)).toEqual([[]])
  })
})

describe('the customer’s copy reads what their own views read', () => {
  it('a customer who reads stages gets their portal’s stages and lists, whatever the chart shows', () => {
    const { input, state, project, companies } = fairOaks()
    const c = ganttPrint({ ...input, for: 'customer', filters: { ...NO_FILTERS, late: true }, by: 'company' })
    expect(c.copy).toBe('stages')
    expect(c.pages.flat().map((r) => (r.kind === 'stage' ? r.stage.label : r.kind))).toEqual(customerStages(state, project).map((s) => s.label))
    expect(c.head.title).toBe('Fair Oaks Shops, Building D: your schedule')
    expect(c.head.lines).toEqual(['For Cibolo Creek Partners. As of Fri Oct 2, 2026.', 'We finish Fri Dec 11. Your contract says Dec 11.', '72% of the work is done. We planned 76% by today.'])
    expect(c.lists).toEqual([
      { title: 'What changed this week', lines: ['Nothing moved. The schedule stands as planned.'] },
      { title: 'What we need from you', lines: ['Your decision on the restroom tile, needed by Mon Nov 30: Trim waits on it.'] },
    ])
    expect(c.forWords).toBe('Cibolo Creek Partners reads the stages of the job, as in their portal. Their copy is those stages. It names no company and shows no spare days. The filters and folds do not change it.')
    const html = ganttPrintHtml(c)
    for (const company of companies) expect(html).not.toContain(company)
    expect(html).not.toMatch(/spare/)
    expect(html).toContain('Dates to meet')
  })

  it('a GC or an owner’s rep gets every bar as their portal’s list: no company, no spare days, no red edge', () => {
    const { input, state, project, companies } = fairOaks()
    const gc = { ...project, customerRole: 'gc' as const }
    const c = ganttPrint({ ...input, for: 'customer', by: 'company', job: { ...input.job, customer: customerSchedulePicture(state, gc) } })
    expect(c.copy).toBe('everyBar')
    expect(barIds(c.pages)).toEqual(customerFullChart(state, gc).flatMap((g) => (g.open ? g.group.bars.map((b) => b.id) : [])))
    const rows = c.pages.flat().flatMap((r) => (r.kind === 'bar' ? [r] : []))
    expect(rows.every((r) => r.plain && r.note === null)).toBe(true)
    expect(rows.map((r) => r.stands)).toContain('on plan')
    expect(c.key.flat()).not.toContain('tight')
    expect(c.forWords).toBe('Cibolo Creek Partners may see every bar. Their copy lists every bar by stage, as in their portal. It names no company and shows no spare days. The filters and folds do not change it.')
    const html = ganttPrintHtml(c)
    for (const company of companies) expect(html).not.toContain(company)
    expect(html).not.toMatch(/spare/)
  })

  it('puts the lists on a page of their own when the last page has no room for them', () => {
    const { input } = fairOaks()
    const asks = Array.from({ length: 25 }, (_, i) => `Your signature on change order ${i + 1}, sent Sep 30.`)
    const c = ganttPrint({ ...input, for: 'customer', job: { ...input.job, customer: { ...input.job.customer, asks } } })
    expect(c.listsPage).toBe(true)
    expect(c.shows[0]).toBe('2 landscape pages, letter size.')
    const html = ganttPrintHtml(c)
    expect(html.split('<section class="page">').length - 1).toBe(2)
    expect(html).toContain('Page 2 of 2')
  })
})

describe('Next 3 weeks on paper: the look-ahead sheet', () => {
  it('runs from the Monday of last week to the Sunday three weeks out, a day at a time, the cut bars marked', () => {
    const { input } = fairOaks()
    expect(lookAheadWindow('2026-10-02')).toEqual({ first: '2026-09-21', last: '2026-10-25' })
    const p = ganttPrint({ ...input, filters: { ...NO_FILTERS, soon: true } })
    expect(p.lookAhead).toBe(true)
    expect(p.axis).toMatchObject({ first: '2026-09-21', days: 35, scale: 'days', window: true, tint: true })
    expect(p.head.title).toBe('Fair Oaks Shops, Building D: the next 3 weeks')
    expect(p.head.lines).toContain('The page runs from Mon Sep 21 to Sun Oct 25, a day at a time.')
    expect(p.pages).toHaveLength(1)
    expect(p.key[0]).toContain('cut')
    expect(p.milestones.map((m) => m.row.milestone.label)).toEqual(['Dry-in', 'Rough-in inspection'])
    // No line runs to a bar cut at the edge.
    const cut = new Set(input.bars.filter((b) => b.item.activity.start < '2026-09-21' || b.item.activity.finish > '2026-10-25').map((b) => b.id))
    expect(p.links.some((l) => cut.has(l.from) || cut.has(l.to))).toBe(false)
  })

  it('is our team’s only: the customer’s copy ignores the filters', () => {
    const { input } = fairOaks()
    expect(ganttPrint({ ...input, for: 'customer', filters: { ...NO_FILTERS, soon: true } }).lookAhead).toBe(false)
  })
})

describe('the document', () => {
  it('is letter landscape, a page section a page, the name escaped, the title naming the job and the day', () => {
    const { input } = fairOaks()
    const p = ganttPrint({ ...input, job: { ...input.job, name: 'Smith & Sons <Shop>' } })
    const html = ganttPrintHtml(p)
    expect(html).toContain('@page { size: letter landscape; margin: 0.4in; }')
    expect(html.split('<section class="page">').length - 1).toBe(p.pages.length)
    expect(html).toContain('<title>Smith &amp; Sons &lt;Shop&gt;, the schedule, Oct 2, 2026</title>')
    expect(html).not.toContain('Smith & Sons <Shop>')
    expect(html).toContain('Page 1 of 2')
    expect(html).toContain('Page 2 of 2')
    expect(html).toContain('Printed Fri Oct 2, 2026 by Robert Douglas, Click Construction.')
    expect(html).toContain('Every day is a working day, weekends and holidays too.')
  })

  it('says every sentence of the window and the pages in plain words', () => {
    const { input, state, project } = fairOaks()
    const gc = customerSchedulePicture(state, { ...project, customerRole: 'ownersRep' })
    const prints = [
      ganttPrint(input),
      ganttPrint({ ...input, folded: new Set(['sitework', 'concrete', 'plumbing', 'roofing', 'electrical'].flatMap((t) => ganttGroups(input.bars, 'trade').filter((g) => g.title.toLowerCase() === t).map((g) => g.key))), links: false }),
      ganttPrint({ ...input, filters: { ...NO_FILTERS, late: true, held: true } }),
      ganttPrint({ ...input, filters: { ...NO_FILTERS, soon: true } }),
      ganttPrint({ ...input, spare: true }),
      ganttPrint({ ...input, filters: { critical: true, late: true, held: true, soon: true, moved: true } }),
      ganttPrint({ ...input, for: 'customer' }),
      ganttPrint({ ...input, for: 'customer', job: { ...input.job, customer: gc } }),
    ]
    for (const p of prints) {
      for (const words of [...p.shows, p.forWords, p.head.lines[0] ?? '', p.running, p.foot, p.everyDay ?? '', p.empty ?? '']) expect(plainWordsFailures(words)).toEqual([])
    }
  })
})
