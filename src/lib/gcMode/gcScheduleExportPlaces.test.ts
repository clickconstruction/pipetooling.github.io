// @vitest-environment jsdom
/**
 * The place in the exported schedule (G-83's follow-up to G-136): a Place column after Company in
 * our team's spreadsheet, and Text2 "Place" declared beside Text1 "Company" in our team's project
 * file, while a bar has a place kept. Never on the customer's copies. On Fair Oaks Shops, Building D
 * with its guesses kept, Top out typed in the North bay and Ductwork on the Mezzanine, two places no
 * other word in a file can hold. jsdom for its XML parser only.
 */
import { describe, expect, it } from 'vitest'
import { GC_COMPANY, initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { scheduleItems, scheduleMeasures } from './gcBuildingSchedule'
import { NO_FILTERS, ganttBars, type GanttGroupBy } from './gcGantt'
import { waitHolds, waitRows } from './gcScheduleWaits'
import { customerDoneWords, customerSchedulePicture, customerStanding } from './gcCustomerSchedule'
import type { GanttPrintInput } from './gcGanttPrint'
import { MSPDI_TEXT1, MSPDI_TEXT2, csvColumns, scheduleCsv, scheduleExport, scheduleMspdi, type ScheduleExport } from './gcScheduleExport'
import { placeRows } from './gcPlaces'
import { readScheduleFile } from './gcScheduleImport'
import type { GcProject, GcState } from './gcTypes'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleItems(s, job(s)).find((i) => i.label === label && i.pkg)!.activity.lineId
const TYPED = ['North bay', 'Mezzanine']

/** The made-up job with every guess kept and two places typed. */
function placed(): GcState {
  const s0 = initialGcState()
  const guesses = Object.fromEntries(placeRows(s0, job(s0)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : [])))
  return gcReducer(s0, { type: 'setActivityPlaces', projectId: ID, places: { ...guesses, [lineOf(s0, 'Top out')]: 'North bay', [lineOf(s0, 'Ductwork')]: 'Mezzanine' } })
}

/** The export as the Schedule tab hands the chart to it (G-136's own input), for our team or the customer. */
function exportOf(state: GcState, forWhom: 'team' | 'customer', by: GanttGroupBy = 'trade', change: (p: GcProject) => GcProject = (p) => p): ScheduleExport {
  const project = change(job(state))
  const m = scheduleMeasures(state, project)
  const input: GanttPrintInput = {
    bars: ganttBars(m.items, m.float, waitHolds(state, project), state.today, true),
    filters: NO_FILTERS,
    filterNames: { critical: '5 or fewer spare days', late: 'Late or behind', held: 'Held', soon: 'Next 3 weeks', moved: 'Moved since Start' },
    by,
    folded: new Set(),
    links: true,
    milestones: m.milestones,
    waits: waitRows(state, project),
    lost: new Map(),
    today: state.today,
    building: true,
    for: forWhom,
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
  return scheduleExport(input)
}

/** RFC 4180, enough for these files: the byte-order mark off, CRLF lines, quoted cells. */
function csvLines(csv: string): Record<string, string>[] {
  const lines = csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')
  const cells = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out
  }
  const [head, ...rest] = lines.map(cells)
  return rest.map((r) => Object.fromEntries((head ?? []).map((h, i) => [h, r[i] ?? ''])))
}

function xmlOf(x: ScheduleExport): Document {
  return new DOMParser().parseFromString(scheduleMspdi(x), 'application/xml')
}

const child = (el: Element, tag: string) => [...el.children].find((c) => c.tagName === tag)
const textOf = (el: Element, tag: string) => child(el, tag)?.textContent ?? null

/** Each task under a group: its name and the value of the text field with that id, or ''. */
function fieldOf(doc: Document, fieldId: number): [string | null, string][] {
  return [...doc.getElementsByTagName('Task')]
    .filter((t) => textOf(t, 'Summary') === '0')
    .map((t) => [textOf(t, 'Name'), [...t.children].filter((c) => c.tagName === 'ExtendedAttribute').find((a) => textOf(a, 'FieldID') === String(fieldId))?.getElementsByTagName('Value')[0]?.textContent ?? ''])
}

describe('the place in our team’s spreadsheet and project file', () => {
  it('adds nothing to a job with no place kept: the files G-136 writes', () => {
    const x = exportOf(initialGcState(), 'team')
    expect(csvColumns(x).map((c) => c.head)).not.toContain('Place')
    expect(scheduleCsv(x).split('\r\n')[0]).not.toContain('Place')
    expect(scheduleMspdi(x)).not.toContain(String(MSPDI_TEXT2))
    expect(scheduleMspdi(x)).not.toContain('Text2')
  })

  it('writes the Place column after Company, each bar’s kept place in it, and nothing where none is kept', () => {
    const x = exportOf(placed(), 'team')
    const heads = csvColumns(x).map((c) => c.head)
    expect(heads.slice(heads.indexOf('Company'), heads.indexOf('Company') + 3)).toEqual(['Company', 'Place', 'Start'])
    const rows = new Map(csvLines(scheduleCsv(x)).map((l) => [`${l.Group}|${l.Activity}`, l.Place]))
    expect([rows.get('Plumbing|Top out'), rows.get('HVAC|Ductwork'), rows.get('Electrical|Lighting'), rows.get('HVAC|Rooftop units'), rows.get('Electrical|Site lighting'), rows.get('Structural steel|Erection'), rows.get('Concrete|Foundations')]).toEqual([
      'North bay',
      'Mezzanine',
      'Inside',
      'Roof',
      'Site',
      '',
      '',
    ])
  })

  it('declares Text2 Place beside Text1 Company in the project file, and puts each kept place on its task', () => {
    const doc = xmlOf(exportOf(placed(), 'team'))
    const declared = [...doc.getElementsByTagName('ExtendedAttributes')[0]!.children].map((a) => [textOf(a, 'FieldID'), textOf(a, 'FieldName'), textOf(a, 'Alias')])
    expect(declared).toEqual([
      [String(MSPDI_TEXT1), 'Text1', 'Company'],
      [String(MSPDI_TEXT2), 'Text2', 'Place'],
    ])
    const places = new Map(fieldOf(doc, MSPDI_TEXT2))
    expect([places.get('Top out'), places.get('Ductwork'), places.get('Rooftop units'), places.get('Erection')]).toEqual(['North bay', 'Mezzanine', 'Roof', ''])
  })
})

describe('the lead’s pins, as G-136 has them', () => {
  it('the spreadsheet and the project file carry the same places, in the same order, read against the kernel’s rows', () => {
    for (const by of ['trade', 'stage', 'company'] as const) {
      const x = exportOf(placed(), 'team', by)
      const kernel = x.rows.filter((r) => r.level === 2).map((r) => [r.name, r.place ?? ''])
      const csv = csvLines(scheduleCsv(x)).map((l) => [l.Activity, l.Place])
      const xml = fieldOf(xmlOf(x), MSPDI_TEXT2)
      expect(kernel.filter(([, p]) => p !== '').length).toBe(13)
      expect(csv).toEqual(kernel)
      expect(xml).toEqual(kernel)
    }
  })

  it('the customer’s files hold no Place anywhere, by a search of the whole of each', () => {
    const s = placed()
    for (const x of [exportOf(s, 'customer'), exportOf(s, 'customer', 'trade', (p) => ({ ...p, customerRole: 'gc' }))]) {
      expect(x.copy === 'stages' || x.copy === 'everyBar').toBe(true)
      expect(x.rows.some((r) => 'place' in r)).toBe(false)
      expect(csvColumns(x).map((c) => c.head)).not.toContain('Place')
      for (const file of [scheduleCsv(x), scheduleMspdi(x)]) {
        expect(file).not.toContain('Place')
        expect(file).not.toContain('Text2')
        expect(file).not.toContain(String(MSPDI_TEXT2))
        expect(file).not.toContain('ExtendedAttribute')
        for (const typed of TYPED) expect(file).not.toContain(typed)
      }
    }
  })
})

describe('bringing our own file back in (G-137)', () => {
  it('reads our team’s spreadsheet and project file with places exactly as it reads them without', () => {
    const withPlaces = exportOf(placed(), 'team')
    const without = exportOf(initialGcState(), 'team')
    expect(scheduleCsv(withPlaces).split('\r\n')[0]).toContain(',Place,')
    for (const [write, name] of [[scheduleCsv, 'fair-oaks.csv'], [scheduleMspdi, 'fair-oaks.xml']] as const) {
      const read = readScheduleFile(write(withPlaces), name)
      expect('problem' in read).toBe(false)
      expect(read).toEqual(readScheduleFile(write(without), name))
    }
  })
})
