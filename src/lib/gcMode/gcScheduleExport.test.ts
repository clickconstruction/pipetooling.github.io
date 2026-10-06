// @vitest-environment jsdom
/**
 * Export the schedule (the Gantt's G-136, `to-dos/gc-mode/mockups/G-136.md`): the rows, the
 * spreadsheet and the project file, on Fair Oaks Shops, Building D as the Schedule tab hands it to
 * the chart. jsdom for its XML parser only.
 */
import { describe, expect, it } from 'vitest'
import { GC_COMPANY, initialGcState } from './gcFixture'
import { scheduleMeasures } from './gcBuildingSchedule'
import { NO_FILTERS, ganttBars, ganttGroups, ganttLinks, type GanttGroupBy } from './gcGantt'
import { waitHolds, waitRows } from './gcScheduleWaits'
import { customerBarWords, customerDoneWords, customerSchedulePicture, customerStanding, CUSTOMER_STAGE_WORDS } from './gcCustomerSchedule'
import { forWords, type GanttPrintInput } from './gcGanttPrint'
import { CSV_COLUMNS, EXPORT_DATES_CUSTOMER, EXPORT_DATES_TEAM, EXPORT_STAGES_GROUP, EXPORT_WAITS_GROUP, MSPDI_NAMESPACE, exportFileName, isMilestoneRow, scheduleCsv, scheduleExport, scheduleMspdi, type ExportRow, type ScheduleExport } from './gcScheduleExport'
import { plainWordsFailures } from '../plainWords'
import type { GcProject } from './gcTypes'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026: the chart's bars with the waits' holds, as Print or PDF is fed. */
function fairOaks(change: (p: GcProject) => GcProject = (p) => p) {
  const state = initialGcState()
  const found = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')
  if (!found) throw new Error('the made-up data lost Fair Oaks D')
  const project = change(found)
  const m = scheduleMeasures(state, project)
  const bars = ganttBars(m.items, m.float, waitHolds(state, project), state.today, true)
  const input: GanttPrintInput = {
    bars,
    filters: NO_FILTERS,
    filterNames: { critical: '5 or fewer spare days', late: 'Late or behind', held: 'Held', soon: 'Next 3 weeks', moved: 'Moved since Start' },
    by: 'trade',
    folded: new Set(),
    links: true,
    milestones: m.milestones,
    waits: waitRows(state, project),
    lost: new Map(),
    today: state.today,
    building: true,
    for: 'team',
    job: {
      name: project.name,
      place: project.address,
      company: GC_COMPANY.name,
      by: 'Robert Douglas',
      finishWords: 'The work runs 3 days behind the plan.',
      doneWords: customerDoneWords(customerStanding(state, project)),
      customer: customerSchedulePicture(state, project),
    },
  }
  // Every company the team's file names: the trades, our crew, the city, the supplier, the utility. Not the customer, whose file it is.
  const companies = [...new Set([...m.items.map((i) => i.company), ...input.waits.map((w) => w.wait.who), GC_COMPANY.name])].filter((c) => c !== input.job.customer.name)
  return { state, project, bars, input, companies }
}

/** The same job for a customer who is a GC: they may see every bar. */
function forAGc() {
  const f = fairOaks((p) => ({ ...p, customerRole: 'gc' }))
  return { ...f, input: { ...f.input, for: 'customer' as const } }
}

const under = (x: ScheduleExport) => x.rows.filter((r) => r.level === 2)
const work = (x: ScheduleExport) => x.rows.filter((r) => r.kind === 'activity' || r.kind === 'inspection' || r.kind === 'added')
const named = (x: ScheduleExport, name: string, group?: string) => {
  const r = x.rows.find((row) => row.name === name && row.level === 2 && (group === undefined || row.group === group))
  if (!r) throw new Error(`no ${name} in the file`)
  return r
}

/** RFC 4180, with the byte-order mark first: the rows of cells. */
function parseCsv(text: string): string[][] {
  expect(text.charCodeAt(0)).toBe(0xfeff)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 1; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else cell += c
  }
  expect(row).toEqual([])
  expect(cell).toBe('')
  return rows
}

/** The spreadsheet as objects by its header. */
function csvObjects(text: string): Record<string, string>[] {
  const [head, ...lines] = parseCsv(text)
  return lines.map((cells) => Object.fromEntries((head ?? []).map((h, i) => [h, cells[i] ?? ''])))
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}

const kids = (el: Element) => [...el.children]
const child = (el: Element, name: string) => kids(el).find((c) => c.localName === name) ?? null
const textOf = (el: Element, name: string) => child(el, name)?.textContent ?? null
const tasksOf = (doc: Document) => [...doc.getElementsByTagNameNS(MSPDI_NAMESPACE, 'Task')]

/** The elements this file writes, in the order MSPDI's schema puts them (a subsequence of it). */
const PROJECT_ORDER = ['SaveVersion', 'Name', 'Title', 'ScheduleFromStart', 'StartDate', 'FinishDate', 'CalendarUID', 'DefaultStartTime', 'DefaultFinishTime', 'MinutesPerDay', 'MinutesPerWeek', 'DaysPerMonth', 'DurationFormat', 'StatusDate', 'ExtendedAttributes', 'Calendars', 'Tasks']
const TASK_ORDER = ['UID', 'ID', 'Name', 'OutlineNumber', 'OutlineLevel', 'Start', 'Finish', 'Duration', 'DurationFormat', 'Milestone', 'Summary', 'PercentComplete', 'ActualStart', 'ActualFinish', 'ConstraintType', 'ConstraintDate', 'PredecessorLink', 'ExtendedAttribute']
const LINK_ORDER = ['PredecessorUID', 'Type', 'CrossProject', 'LinkLag', 'LagFormat']

/** The names in order, each from the list, never going back in it (an element may repeat). */
function inOrder(names: string[], order: string[]) {
  let at = 0
  for (const n of names) {
    const i = order.indexOf(n, at)
    expect(i, `${n} after ${order[at] ?? 'the end'}`).toBeGreaterThanOrEqual(0)
    at = i
  }
}

describe('Export the schedule: our team’s file is the whole schedule (G-136)', () => {
  it('lists every bar once under its group, in the chart’s order, then what the work waits on, then the dates the job must meet', () => {
    const { input, bars } = fairOaks()
    const x = scheduleExport(input)
    const groups = ganttGroups(bars, 'trade')
    expect(work(x).map((r) => [r.group, r.name])).toEqual(groups.flatMap((g) => g.bars.map((b) => [g.title, b.item.label])))
    expect(x.rows.filter((r) => r.level === 1).map((r) => r.name)).toEqual([...groups.map((g) => g.title), EXPORT_WAITS_GROUP, EXPORT_DATES_TEAM])
    expect(x.rows.map((r) => r.uid)).toEqual(x.rows.map((_, i) => i + 1))
    expect(x.count).toBe('The whole schedule, by trade: 30 activities, 3 things the work waits on and 4 dates to meet.')
    expect(x.forWords).toBe("Our team's copy names the companies and shows the spare days.")
    expect(named(x, 'Top out')).toMatchObject({ kind: 'activity', trade: 'Plumbing', company: 'Our own crew', start: '2026-09-28', finish: '2026-10-09', days: 12, done: 40, spare: 37, stands: '37 spare days' })
    expect(named(x, 'Final inspection')).toMatchObject({ kind: 'inspection', trade: null, company: 'The city', spare: 0, stands: 'no spare days' })
    // A bar that is done has no spare days to sort by.
    expect(named(x, 'Paving')).toMatchObject({ done: 100, spare: null, stands: 'done' })
  })

  it('is the same file whatever the filters, the folds or the links show; the grouping is the chart’s', () => {
    const { input, bars } = fairOaks()
    const whole = scheduleExport(input)
    const shown: GanttPrintInput = { ...input, filters: { ...NO_FILTERS, late: true, held: true }, folded: new Set(['fsite', 'fconc', 'fplumb']), links: false }
    expect(scheduleExport(shown)).toEqual(whole)
    for (const by of ['stage', 'company'] as GanttGroupBy[]) {
      const x = scheduleExport({ ...input, by })
      expect(work(x).map((r) => [r.group, r.name])).toEqual(ganttGroups(bars, by).flatMap((g) => g.bars.map((b) => [g.title, b.item.label])))
      expect(x.count).toBe(`The whole schedule, by ${by}: 30 activities, 3 things the work waits on and 4 dates to meet.`)
    }
  })

  it('carries each wait as the number of a row in the file, with its days of gap, and loses none', () => {
    const plain = fairOaks()
    const slab = plain.bars.find((b) => b.item.label === 'Slab on grade')
    const foundations = plain.bars.find((b) => b.item.label === 'Foundations')
    if (!slab || !foundations) throw new Error('no slab')
    // Three days of cure before the slab: the gap rides with the wait.
    const { input, bars } = fairOaks((p) => ({ ...p, schedule: p.schedule && { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === slab.id ? { ...a, lag: { [foundations.id]: 3 } } : a)) } }))
    const x = scheduleExport(input)
    const uids = new Set(under(x).map((r) => r.uid))
    for (const r of x.rows) for (const w of r.waitsOn) expect(uids.has(w.uid)).toBe(true)
    expect(x.rows.flatMap((r) => r.waitsOn)).toHaveLength(ganttLinks(bars).length + 3)
    expect(named(x, 'Slab on grade').waitsOn).toEqual([
      { uid: named(x, 'Foundations').uid, name: 'Foundations (Concrete)', gap: 3 },
      { uid: named(x, 'Underground').uid, name: 'Underground (Plumbing)', gap: 0 },
    ])
    expect(csvObjects(scheduleCsv(x)).find((r) => r.Activity === 'Slab on grade')?.['Waits on']).toBe('Foundations (Concrete) +3 days; Underground (Plumbing)')
    const task = tasksOf(parseXml(scheduleMspdi(x))).find((t) => textOf(t, 'Name') === 'Slab on grade')
    const lags = kids(task as Element)
      .filter((c) => c.localName === 'PredecessorLink')
      .map((l) => [textOf(l, 'PredecessorUID'), textOf(l, 'LinkLag')])
    expect(lags).toEqual([
      [String(named(x, 'Foundations').uid), '14400'],
      [String(named(x, 'Underground').uid), '0'],
    ])
  })

  it('makes what the work waits on from outside a day of its own, which the work it holds waits on', () => {
    const x = scheduleExport(fairOaks().input)
    expect(x.rows.filter((r) => r.group === EXPORT_WAITS_GROUP && r.level === 2).map((r) => ({ name: r.name, kind: r.kind, trade: r.trade, company: r.company, start: r.start, finish: r.finish, stands: r.stands }))).toEqual([
      { name: 'Rooftop units on site', kind: 'delivery', trade: 'HVAC', company: "Cool Breeze Mechanical's supplier", start: '2026-10-20', finish: '2026-10-20', stands: 'ordered Sep 1, late' },
      { name: 'The transformer done', kind: 'utility', trade: null, company: 'CPS Energy', start: '2026-10-15', finish: '2026-10-15', stands: 'requested Sep 15' },
      { name: 'The restroom tile decided', kind: 'decision', trade: 'Plumbing', company: 'Cibolo Creek Partners', start: '2026-10-30', finish: '2026-10-30', stands: 'asked Sep 28' },
    ])
    for (const [held, wait] of [
      ['Rooftop units', 'Rooftop units on site'],
      ['Site lighting', 'The transformer done'],
      ['Trim', 'The restroom tile decided'],
    ] as const) {
      expect(named(x, held, held === 'Rooftop units' ? 'HVAC' : undefined).waitsOn.map((w) => w.name)).toContain(wait)
    }
    expect(named(x, 'Rooftop units', 'HVAC').stands).toBe('held')
  })

  it('puts the dates the job must meet on their days, met or not', () => {
    const x = scheduleExport(fairOaks().input)
    expect(x.rows.filter((r) => r.group === EXPORT_DATES_TEAM && r.level === 2).map((r) => [r.name, r.start, r.finish, r.stands, r.actualFinish])).toEqual([
      ['Slab poured', '2026-08-28', '2026-08-28', 'met', '2026-08-27'],
      ['Dry-in', '2026-09-25', '2026-09-25', '7 days late', null],
      ['Rough-in inspection', '2026-10-13', '2026-10-13', 'due', null],
      ['Substantial completion', '2026-12-11', '2026-12-11', 'due', null],
    ])
  })

  it('never reads the rough: a job with one exports exactly what it exports without it', () => {
    const without = fairOaks()
    const withRough = fairOaks((p) => ({ ...p, rough: { start: '2026-06-01', days: { structure: 40, trim: 30 }, by: 'Robert Douglas', on: '2026-05-20', kept: { on: '2026-05-25', weeks: 40, finish: '2027-03-01', at: 'bid' } } }))
    for (const f of ['team', 'customer'] as const) {
      const a = scheduleExport({ ...without.input, for: f })
      const b = scheduleExport({ ...withRough.input, for: f })
      expect(b).toEqual(a)
      expect(scheduleCsv(b)).toBe(scheduleCsv(a))
      expect(scheduleMspdi(b)).toBe(scheduleMspdi(a))
    }
  })
})

describe('the customer’s files read their picture and nothing else (G-136)', () => {
  it('gives an owner the stages of the job and the dates to meet, as their portal has them', () => {
    const { input } = fairOaks()
    const picture = input.job.customer
    const x = scheduleExport({ ...input, for: 'customer' })
    expect(x.copy).toBe('stages')
    expect(x.rows.filter((r) => r.level === 1).map((r) => r.name)).toEqual([EXPORT_STAGES_GROUP, EXPORT_DATES_CUSTOMER])
    expect(under(x).filter((r) => r.kind === 'stage').map((r) => [r.name, r.start, r.finish, r.done, r.stands])).toEqual(picture.stages.map((s) => [s.label, s.start, s.finish, Math.round(s.pct), CUSTOMER_STAGE_WORDS[s.state]]))
    expect(under(x).filter((r) => r.kind === 'date').map((r) => [r.name, r.start, r.stands])).toEqual(picture.milestones.map((m) => [m.milestone.label, m.due, m.state === 'hit' ? 'met' : m.state === 'late' ? `${m.daysLate} days late` : 'due']))
    expect(x.count).toBe('The whole schedule, by stage: 10 stages and 4 dates to meet.')
    expect(x.forWords).toBe(forWords({ ...input, for: 'customer' }))
    expect(x.files).toEqual({ csv: 'Fair-Oaks-Shops-Building-D-schedule-for-Cibolo-Creek-Partners-2026-10-02.csv', xml: 'Fair-Oaks-Shops-Building-D-schedule-for-Cibolo-Creek-Partners-2026-10-02.xml' })
  })

  it('gives a GC every bar of their list, by stage, in the order built, in their words', () => {
    const { input } = forAGc()
    const picture = input.job.customer
    expect(picture.everyBar).toBe(true)
    const x = scheduleExport(input)
    expect(x.copy).toBe('everyBar')
    const theirBars = picture.fullChart.flatMap((g) => g.group.bars)
    const built = ganttGroups(theirBars, 'stage')
    expect(work(x).map((r) => [r.group, r.name, r.start, r.finish, r.stands])).toEqual(built.flatMap((g) => g.bars.map((b) => [g.title, b.item.label, b.item.activity.start, b.item.activity.finish, customerBarWords(b).words])))
    expect(x.rows.filter((r) => r.level === 1).map((r) => r.name)).toEqual([...built.map((g) => g.title), EXPORT_DATES_CUSTOMER])
    // The list puts the stage running today first; the file reads in the order built.
    expect(picture.fullChart[0]?.group.title).not.toBe(built[0]?.title)
    expect(named(x, 'Top out').stands).toBe('on plan')
    expect(x.count).toBe('The whole schedule, by stage: 30 activities and 4 dates to meet.')
  })

  it('names no company, says no spare days and carries no wait, in its rows or in either file', () => {
    for (const { input, companies } of [{ ...fairOaks(), input: { ...fairOaks().input, for: 'customer' as const } }, forAGc()]) {
      const x = scheduleExport(input)
      for (const r of x.rows) {
        expect(r.company).toBeNull()
        expect(r.trade).toBeNull()
        expect(r.spare).toBeNull()
        expect(r.waitsOn).toEqual([])
        expect(r.group).not.toBe(EXPORT_WAITS_GROUP)
        expect(['delivery', 'decision', 'permit', 'utility']).not.toContain(r.kind)
      }
      for (const file of [scheduleCsv(x), scheduleMspdi(x)]) {
        for (const c of companies) expect(file).not.toContain(c)
        expect(file).not.toMatch(/spare/i)
        expect(file).not.toMatch(/on site|decided|The transformer/)
        expect(file).not.toContain('PredecessorLink')
      }
      expect(CSV_COLUMNS[x.copy].map((c) => c.head)).not.toContain('Company')
      expect(CSV_COLUMNS[x.copy].map((c) => c.head)).not.toContain('Spare days')
    }
  })
})

describe('the spreadsheet (G-136)', () => {
  it('is the byte-order mark, a header, then one line for each row under a group, CRLF, dates as 2026-10-09', () => {
    const x = scheduleExport(fairOaks().input)
    const csv = scheduleCsv(x)
    expect(csv.startsWith('﻿Group,Activity,Kind,Trade,Company,Start,Finish,Days,Done %,Spare days,Where it stands,Waits on,Not before,Must finish by,Really started,Really finished\r\n')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    const lines = csvObjects(csv)
    expect(lines).toHaveLength(37)
    for (const l of lines) {
      expect(l.Start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(l.Finish).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(lines.find((l) => l.Activity === 'Top out')).toMatchObject({ Group: 'Plumbing', Kind: 'activity', Company: 'Our own crew', Days: '12', 'Done %': '40', 'Spare days': '37', 'Where it stands': '37 spare days', 'Waits on': 'Rough in (Plumbing)' })
    expect(lines.find((l) => l.Activity === 'Rooftop units on site')).toMatchObject({ Kind: 'delivery', 'Where it stands': 'ordered Sep 1, late', Days: '', 'Spare days': '' })
    expect(lines.find((l) => l.Activity === 'Dry-in')).toMatchObject({ Group: EXPORT_DATES_TEAM, Kind: 'date to meet', 'Where it stands': '7 days late' })
  })

  it('keeps a name with a comma or a quote in one cell, and starts a cell a spreadsheet would run with a quote mark', () => {
    const x = scheduleExport(forAGc().input)
    const first = under(x)[0] as ExportRow
    const rows = [first, { ...first, name: 'Doors, frames and "hardware"' }, { ...first, name: '=HYPERLINK("http://example.test")' }, { ...first, name: '-Final walk' }]
    const lines = csvObjects(scheduleCsv({ copy: 'everyBar', rows }))
    expect(lines.map((l) => l.Activity)).toEqual([first.name, 'Doors, frames and "hardware"', '\'=HYPERLINK("http://example.test")', "'-Final walk"])
  })

  it('has spare days as a number to sort by on our team’s copy only', () => {
    const team = csvObjects(scheduleCsv(scheduleExport(fairOaks().input)))
    expect(team.filter((l) => l['Spare days'] !== '').every((l) => /^\d+$/.test(l['Spare days'] ?? ''))).toBe(true)
    const byNumber = [...team].filter((l) => l['Spare days'] !== '').sort((a, b) => Number(a['Spare days']) - Number(b['Spare days']))
    expect(byNumber[0]?.Activity).toBe('Final inspection')
    expect(parseCsv(scheduleCsv(scheduleExport({ ...fairOaks().input, for: 'customer' })))[0]).toEqual(['Group', 'Name', 'Start', 'Finish', 'Done %', 'Where it stands'])
    expect(parseCsv(scheduleCsv(scheduleExport(forAGc().input)))[0]).toEqual(['Stage', 'Activity', 'Start', 'Finish', 'Where it stands'])
  })
})

describe('the project file (G-136)', () => {
  it('parses as Microsoft Project’s XML, with one calendar where every day is worked, 8 to 5 with an hour at noon', () => {
    const x = scheduleExport(fairOaks().input)
    const doc = parseXml(scheduleMspdi(x))
    const root = doc.documentElement
    expect([root.localName, root.namespaceURI]).toEqual(['Project', MSPDI_NAMESPACE])
    inOrder(kids(root).map((c) => c.localName), PROJECT_ORDER)
    expect([textOf(root, 'Title'), textOf(root, 'Name'), textOf(root, 'StartDate'), textOf(root, 'FinishDate'), textOf(root, 'StatusDate')]).toEqual(['Fair Oaks Shops, Building D', x.files.xml, '2026-07-06T08:00:00', '2026-12-11T17:00:00', '2026-10-02T17:00:00'])
    expect([textOf(root, 'MinutesPerDay'), textOf(root, 'MinutesPerWeek'), textOf(root, 'DaysPerMonth'), textOf(root, 'CalendarUID')]).toEqual(['480', '3360', '30', '1'])
    const calendars = [...doc.getElementsByTagNameNS(MSPDI_NAMESPACE, 'Calendar')]
    expect(calendars).toHaveLength(1)
    const days = [...(calendars[0] as Element).getElementsByTagNameNS(MSPDI_NAMESPACE, 'WeekDay')]
    expect(days.map((d) => [textOf(d, 'DayType'), textOf(d, 'DayWorking')])).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), '1']))
    for (const d of days) expect([...d.getElementsByTagNameNS(MSPDI_NAMESPACE, 'WorkingTime')].map((w) => `${textOf(w, 'FromTime')}-${textOf(w, 'ToTime')}`)).toEqual(['08:00:00-12:00:00', '13:00:00-17:00:00'])
  })

  it('writes each task with what both programs read, in the schema’s order: groups as summary tasks, numbered 1, 2, 3', () => {
    for (const x of [scheduleExport(fairOaks().input), scheduleExport({ ...fairOaks().input, for: 'customer' }), scheduleExport(forAGc().input)]) {
      const tasks = tasksOf(parseXml(scheduleMspdi(x)))
      expect(tasks).toHaveLength(x.rows.length)
      let group = ''
      tasks.forEach((t, i) => {
        inOrder(kids(t).map((c) => c.localName), TASK_ORDER)
        for (const l of kids(t).filter((c) => c.localName === 'PredecessorLink')) inOrder(kids(l).map((c) => c.localName), LINK_ORDER)
        for (const need of ['UID', 'ID', 'Name', 'OutlineNumber', 'OutlineLevel', 'Start', 'Finish', 'Duration']) expect(child(t, need), need).not.toBeNull()
        expect([textOf(t, 'UID'), textOf(t, 'ID')]).toEqual([String(i + 1), String(i + 1)])
        // Primavera makes the summary tasks its WBS: every task sits under one, nothing at the top alone.
        const level = textOf(t, 'OutlineLevel')
        expect(textOf(t, 'Summary')).toBe(level === '1' ? '1' : '0')
        if (level === '1') group = textOf(t, 'OutlineNumber') ?? ''
        else expect(textOf(t, 'OutlineNumber')?.startsWith(`${group}.`)).toBe(true)
      })
      expect(textOf(tasks[0] as Element, 'OutlineLevel')).toBe('1')
    }
  })

  it('has a 12-day bar as 96 hours from 8:00 to 17:00, and a date as a milestone at the end of its day', () => {
    const x = scheduleExport(fairOaks().input)
    const tasks = tasksOf(parseXml(scheduleMspdi(x)))
    const task = (name: string) => tasks.find((t) => textOf(t, 'Name') === name) as Element
    expect(['Start', 'Finish', 'Duration', 'DurationFormat', 'Milestone', 'PercentComplete'].map((n) => textOf(task('Top out'), n))).toEqual(['2026-09-28T08:00:00', '2026-10-09T17:00:00', 'PT96H0M0S', '7', '0', '40'])
    expect(['Start', 'Finish', 'Duration', 'Milestone', 'PercentComplete', 'ActualFinish'].map((n) => textOf(task('Slab poured'), n))).toEqual(['2026-08-28T17:00:00', '2026-08-28T17:00:00', 'PT0H0M0S', '1', '100', '2026-08-27T17:00:00'])
    expect(['Start', 'Milestone'].map((n) => textOf(task('Rooftop units on site'), n))).toEqual(['2026-10-20T17:00:00', '1'])
    for (const r of x.rows) {
      const t = tasks[r.uid - 1] as Element
      expect(textOf(t, 'Milestone')).toBe(isMilestoneRow(r) ? '1' : '0')
    }
  })

  it('holds every task to start no earlier than its day, so neither program moves our dates', () => {
    const x = scheduleExport(fairOaks().input)
    for (const t of tasksOf(parseXml(scheduleMspdi(x)))) {
      if (textOf(t, 'Summary') === '1') {
        expect(child(t, 'ConstraintType')).toBeNull()
        continue
      }
      expect([textOf(t, 'ConstraintType'), textOf(t, 'ConstraintDate')]).toEqual(['4', textOf(t, 'Start')])
    }
  })

  it('links each wait finish to start, to a task in the file, its gap in tenths of a minute', () => {
    const x = scheduleExport(fairOaks().input)
    const tasks = tasksOf(parseXml(scheduleMspdi(x)))
    const uids = new Set(tasks.map((t) => textOf(t, 'UID')))
    const links = tasks.flatMap((t) => kids(t).filter((c) => c.localName === 'PredecessorLink'))
    expect(links).toHaveLength(x.rows.flatMap((r) => r.waitsOn).length)
    for (const l of links) {
      expect(uids.has(textOf(l, 'PredecessorUID'))).toBe(true)
      expect([textOf(l, 'Type'), textOf(l, 'LinkLag'), textOf(l, 'LagFormat')]).toEqual(['1', '0', '7'])
    }
  })

  it('leaves out what Primavera does not take from it and what would list our companies; the company rides in Text1 on our team’s copy', () => {
    const x = scheduleExport(fairOaks().input)
    const xml = scheduleMspdi(x)
    for (const tag of ['Baseline', 'Deadline', 'Notes', 'Resources', 'Assignments', 'Manual']) expect(xml).not.toContain(`<${tag}>`)
    const doc = parseXml(xml)
    const defs = [...doc.getElementsByTagNameNS(MSPDI_NAMESPACE, 'ExtendedAttributes')]
    expect(defs).toHaveLength(1)
    expect(['FieldID', 'FieldName', 'Alias'].map((n) => textOf((defs[0] as Element).children[0] as Element, n))).toEqual(['188743731', 'Text1', 'Company'])
    const topOut = tasksOf(doc).find((t) => textOf(t, 'Name') === 'Top out') as Element
    expect(textOf(child(topOut, 'ExtendedAttribute') as Element, 'Value')).toBe('Our own crew')
    expect(tasksOf(doc).filter((t) => child(t, 'ExtendedAttribute')).length).toBe(under(x).filter((r) => r.company).length)
  })
})

describe('the lead’s pins (G-136)', () => {
  it('the spreadsheet and the project file name the same activities, in the same order, with the same dates, read against the kernel’s rows', () => {
    for (const x of [scheduleExport(fairOaks().input), scheduleExport({ ...fairOaks().input, by: 'company' }), scheduleExport({ ...fairOaks().input, for: 'customer' }), scheduleExport(forAGc().input)]) {
      const kernel = under(x).map((r) => [r.group, r.name, r.start, r.finish])
      const [nameCol, groupCol] = x.copy === 'stages' ? ['Name', 'Group'] : x.copy === 'everyBar' ? ['Activity', 'Stage'] : ['Activity', 'Group']
      const csv = csvObjects(scheduleCsv(x)).map((l) => [l[groupCol as string], l[nameCol as string], l.Start, l.Finish])
      let group = ''
      const xml = tasksOf(parseXml(scheduleMspdi(x))).flatMap((t) => {
        if (textOf(t, 'Summary') === '1') {
          group = textOf(t, 'Name') ?? ''
          return []
        }
        return [[group, textOf(t, 'Name'), textOf(t, 'Start')?.slice(0, 10), textOf(t, 'Finish')?.slice(0, 10)]]
      })
      expect(kernel.length).toBeGreaterThan(10)
      expect(csv).toEqual(kernel)
      expect(xml).toEqual(kernel)
    }
  })

  it('the customer’s project file holds no Text1 and no company anywhere, by a search of the whole file', () => {
    for (const { input, companies } of [{ ...fairOaks(), input: { ...fairOaks().input, for: 'customer' as const } }, forAGc()]) {
      const xml = scheduleMspdi(scheduleExport(input))
      expect(xml).not.toContain('Text1')
      expect(xml).not.toContain('188743731')
      expect(xml).not.toContain('ExtendedAttribute')
      expect(xml).not.toMatch(/company/i)
      expect(companies.length).toBeGreaterThan(8)
      for (const c of companies) {
        expect(xml).not.toContain(c)
        expect(xml).not.toContain(c.replace(/'/g, '&apos;'))
      }
    }
  })
})

describe('the words (G-136)', () => {
  it('says the count and who it is for in a first-timer’s words, for every copy', () => {
    const lines = [fairOaks().input, { ...fairOaks().input, for: 'customer' as const }, forAGc().input].flatMap((input) => {
      const x = scheduleExport(input)
      return [x.count, x.forWords]
    })
    for (const l of lines) expect(plainWordsFailures(l)).toEqual([])
  })

  it('names the file for the job and the day, and for the customer on theirs', () => {
    expect(exportFileName('Fair Oaks Shops, Building D', '2026-10-02', 'csv', null)).toBe('Fair-Oaks-Shops-Building-D-schedule-2026-10-02.csv')
    expect(exportFileName('Fair Oaks Shops, Building D', '2026-10-02', 'xml', 'Cibolo Creek Partners')).toBe('Fair-Oaks-Shops-Building-D-schedule-for-Cibolo-Creek-Partners-2026-10-02.xml')
  })
})
