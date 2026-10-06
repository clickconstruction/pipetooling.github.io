/**
 * GC mode design spike: bring in a schedule a customer or the architect hands us, the Gantt's G-137
 * (mock-up and plan `to-dos/gc-mode/mockups/G-137.md`). A customer who keeps a master schedule hands
 * it to us at award: "this is the schedule you build to". The file already holds their dates and
 * their waits, so the office should not have to move bar after bar to them.
 *
 * Three steps, each pure. `readScheduleFile` reads the two files G-136 writes, from our export or
 * from the customer's own programs: Microsoft Project's XML (MSPDI), which Primavera P6 also writes,
 * and our three spreadsheets. It says what it could not read. `guessPlaces` guesses where each of
 * their activities lands on this job, with the reason, for the office to tick. `importedSchedule`
 * makes the schedule, through the first draft's own kernel: their dates and waits on the lines the
 * file names, the first draft's way everywhere else. The result is a schedule like any other.
 *
 * The reader takes the MSPDI namespace and the spreadsheet's headers from `gcScheduleExport.ts`, so
 * what we write and what we read cannot drift apart. Its own file, out of the barrel.
 */
import type { GcProject, ProjectSchedule, ScheduleActivity, ScheduleImport, ScheduleImportPlace, ScheduleImportRow, ScheduleMilestone } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleLinesOf } from './gcBuildingSchedule'
import { TRADE_TEMPLATES, lineStage, scheduleDraft } from './gcNewProject'
import { weekdayDate } from './gcWords'
import { CSV_COLUMNS, EXPORT_DATES_CUSTOMER, EXPORT_DATES_TEAM, EXPORT_WAITS_GROUP, MSPDI_NAMESPACE, csvHeads, type ExportCopy } from './gcScheduleExport'

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

// ---------------------------------------------------------------------------------------------
// Reading a file
// ---------------------------------------------------------------------------------------------

/** One activity or date of theirs, as the file has it. */
export interface ImportFileRow {
  /** The file's own key: `task:12` (its task's number) or `row:5` (its line in the spreadsheet). */
  key: string
  name: string
  /** The groups above it, outermost first: summary tasks, or the spreadsheet's group column. */
  groups: string[]
  start: string
  finish: string
  /** A date: a milestone, or one of our spreadsheet's dates to meet. */
  date: boolean
  /** Their finish-to-start waits on other activities in the file, with the days of gap. */
  after: { key: string; gap: number }[]
  notBefore: string | null
  mustFinishBy: string | null
  /** Our own spreadsheet's Kind, Trade and Company, when the file is ours. */
  kind: string | null
  trade: string | null
  company: string | null
}

export interface ScheduleFileReading {
  /** Microsoft Project's XML, or one of our spreadsheets. */
  format: 'project' | 'spreadsheet'
  /** The project's title in a project file. Null: a spreadsheet, which has none. */
  title: string | null
  /** Their activities and dates, in the file's order. */
  rows: ImportFileRow[]
  /** The waits between their activities, finish to start. */
  waits: number
  /** One sentence for each kind of thing it could not read, counted. */
  unread: string[]
}

export type ScheduleFileResult = ScheduleFileReading | { problem: string }

const NOT_PROJECT_XML = 'This file is not Microsoft Project’s XML. Ask them to save it from Project or Primavera with Save as XML.'
const NOT_OUR_COLUMNS = 'This spreadsheet’s columns are not the ones Export writes. Ask them for the project file instead.'
const OWN_PROGRAM = 'Only its own program opens this file. Ask them to save it from Project or Primavera with Save as XML.'

/** What a file could not give, counted while reading. */
type Unread = { notFinishStart: number; outside: number; onGroup: number; onDate: number; percentGap: number; noDates: number; inactive: number; unknownName: number; outsideWaits: number; progress: boolean }

function unreadWords(u: Unread): string[] {
  const left = (n: number) => (n === 1 ? 'it is' : 'they are')
  return [
    ...(u.notFinishStart > 0 ? [`${plural(u.notFinishStart, 'wait does', 'waits do')} not start when the work before ends. The app has only that kind, so ${left(u.notFinishStart)} left out.`] : []),
    ...(u.onDate > 0 ? [`${plural(u.onDate, 'wait runs', 'waits run')} to or from a date. The app's waits run between work, so ${left(u.onDate)} left out.`] : []),
    ...(u.onGroup > 0 ? [`${plural(u.onGroup, 'wait is', 'waits are')} on a group, not on work, so ${left(u.onGroup)} left out.`] : []),
    ...(u.outside > 0 ? [`${plural(u.outside, 'wait is', 'waits are')} on work outside this file, so ${left(u.outside)} left out.`] : []),
    ...(u.percentGap > 0 ? [`${plural(u.percentGap, 'wait has its gap', 'waits have their gap')} as a percent, so ${left(u.percentGap)} left out.`] : []),
    ...(u.unknownName > 0 ? [`${plural(u.unknownName, 'wait names', 'waits name')} no row of the file, or two rows, so ${left(u.unknownName)} left out.`] : []),
    ...(u.noDates > 0 ? [`${plural(u.noDates, 'task has', 'tasks have')} no start or finish, so ${left(u.noDates)} left out.`] : []),
    ...(u.inactive > 0 ? [`${plural(u.inactive, 'task is', 'tasks are')} marked inactive, so ${left(u.inactive)} left out.`] : []),
    ...(u.outsideWaits > 0 ? [`${plural(u.outsideWaits, 'thing the work waits on is', 'things the work waits on are')} left out. The office enters them on the job.`] : []),
    ...(u.progress ? ['The file says what is done. That comes from the trades and the walk, so it is passed over.'] : []),
  ]
}

function newUnread(): Unread {
  return { notFinishStart: 0, outside: 0, onGroup: 0, onDate: 0, percentGap: 0, noDates: 0, inactive: 0, unknownName: 0, outsideWaits: 0, progress: false }
}

/** "2026-10-09T08:00:00" → "2026-10-09". Null: not a date. */
function isoDay(s: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((s ?? '').trim())
  return m ? (m[1] ?? null) : null
}

/** A spreadsheet's day: ours (2026-10-09) or Excel's own after an edit (10/9/2026, 10/9/26). */
function sheetDay(s: string): string | null {
  const iso = isoDay(s)
  if (iso) return iso
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s.trim())
  if (!m) return null
  const y = (m[3] ?? '').length === 2 ? `20${m[3] ?? ''}` : (m[3] ?? '')
  return `${y}-${(m[1] ?? '').padStart(2, '0')}-${(m[2] ?? '').padStart(2, '0')}`
}

function kid(el: Element, name: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === name) return c
  return null
}

function val(el: Element, name: string): string | null {
  return kid(el, name)?.textContent ?? null
}

/** A gap's format codes in MSPDI: the elapsed ones count every hour, the percent ones cannot be read as days. */
const ELAPSED_FORMATS = new Set([4, 6, 8, 10, 12, 36, 38, 40, 42, 44])
const PERCENT_FORMATS = new Set([19, 20, 51, 52])

function readProjectXml(text: string): ScheduleFileResult {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml')
  } catch {
    return { problem: NOT_PROJECT_XML }
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return { problem: NOT_PROJECT_XML }
  const root = doc.documentElement
  if (root.localName !== 'Project' || root.namespaceURI !== MSPDI_NAMESPACE) return { problem: NOT_PROJECT_XML }
  const minutesPerDay = Number(val(root, 'MinutesPerDay')) || 480
  const tasks = Array.from(kid(root, 'Tasks')?.children ?? []).filter((t) => t.localName === 'Task')
  const u = newUnread()
  const groups: { level: number; name: string }[] = []
  const summaries = new Set<string>()
  // Tasks passed over on purpose (inactive, or our own waits): a link to one goes quietly with it.
  const passed = new Set<string>()
  const read: { row: ImportFileRow; links: { uid: string; type: number; lag: number; format: number; cross: boolean }[] }[] = []
  for (const t of tasks) {
    const uid = (val(t, 'UID') ?? '').trim()
    // Task 0 is the program's own summary of the whole job; a blank row has nothing.
    if (!uid || uid === '0' || val(t, 'IsNull') === '1') continue
    const level = Number(val(t, 'OutlineLevel')) || 1
    while (groups.length > 0 && (groups[groups.length - 1]?.level ?? 0) >= level) groups.pop()
    const name = (val(t, 'Name') ?? '').trim() || `Task ${val(t, 'ID') ?? uid}`
    if (val(t, 'Summary') === '1') {
      summaries.add(uid)
      groups.push({ level, name })
      continue
    }
    if (val(t, 'Active') === '0') {
      u.inactive += 1
      passed.add(uid)
      continue
    }
    // Our own file's outside waits (G-136): the office keeps the job's waits itself.
    if (groups[groups.length - 1]?.name === EXPORT_WAITS_GROUP) {
      u.outsideWaits += 1
      passed.add(uid)
      continue
    }
    const start = isoDay(val(t, 'Start'))
    const finish = isoDay(val(t, 'Finish'))
    if (!start || !finish) {
      u.noDates += 1
      passed.add(uid)
      continue
    }
    if (Number(val(t, 'PercentComplete')) > 0 || isoDay(val(t, 'ActualStart'))) u.progress = true
    const held = isoDay(val(t, 'ConstraintDate'))
    const constraint = Number(val(t, 'ConstraintType'))
    read.push({
      row: {
        key: `task:${uid}`,
        name,
        groups: groups.map((g) => g.name),
        start,
        finish: finish < start ? start : finish,
        date: val(t, 'Milestone') === '1',
        after: [],
        // Start no earlier than a day before its start is a limit of its own; on its start day it is only a hold, as G-136 writes every task.
        notBefore: constraint === 4 && held && held < start ? held : null,
        mustFinishBy: constraint === 7 && held ? held : null,
        kind: null,
        trade: null,
        company: null,
      },
      links: Array.from(t.children)
        .filter((c) => c.localName === 'PredecessorLink')
        .map((l) => ({ uid: (val(l, 'PredecessorUID') ?? '').trim(), type: Number(val(l, 'Type') ?? 1), lag: Number(val(l, 'LinkLag') ?? 0) || 0, format: Number(val(l, 'LagFormat') ?? 7), cross: val(l, 'CrossProject') === '1' })),
    })
  }
  const byUid = new Map(read.map((r) => [r.row.key.slice('task:'.length), r.row]))
  let waits = 0
  for (const { row, links } of read) {
    for (const l of links) {
      const pred = byUid.get(l.uid)
      if (l.cross) u.outside += 1
      else if (l.type !== 1) u.notFinishStart += 1
      else if (PERCENT_FORMATS.has(l.format)) u.percentGap += 1
      else if (passed.has(l.uid)) continue
      else if (summaries.has(l.uid)) u.onGroup += 1
      else if (!pred) u.outside += 1
      else if (pred.date || row.date) u.onDate += 1
      else {
        const perDay = (ELAPSED_FORMATS.has(l.format) ? 1440 : minutesPerDay) * 10
        row.after.push({ key: pred.key, gap: Math.round(l.lag / perDay) })
        waits += 1
      }
    }
  }
  return { format: 'project', title: (val(root, 'Title') ?? val(root, 'Name') ?? '').trim() || null, rows: read.map((r) => r.row), waits, unread: unreadWords(u) }
}

/** RFC 4180: the rows of cells. */
function csvTable(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** A cell our export guarded with a quote mark, so a spreadsheet would not run it, reads as written. */
function unguard(s: string): string {
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s
}

const WAIT_KINDS = new Set(['delivery', 'decision', 'permit', 'utility'])

function readSpreadsheet(text: string): ScheduleFileResult {
  const [head = [], ...lines] = csvTable(text.replace(/^﻿/, ''))
  const heads = head.map((h) => h.trim())
  // Our team's copy carries a Place column after Company while a bar has a place kept (G-83): either header is ours.
  const copy = (Object.keys(CSV_COLUMNS) as ExportCopy[]).find((c) => [false, true].some((withPlace) => csvHeads(c, withPlace).join('\u0000') === heads.join('\u0000')))
  if (!copy) return { problem: NOT_OUR_COLUMNS }
  const cellOf = (cells: string[], name: string) => {
    const i = heads.indexOf(name)
    return i < 0 ? '' : unguard((cells[i] ?? '').trim())
  }
  const u = newUnread()
  const rows: ImportFileRow[] = []
  // Names of our own outside waits, so a wait on one goes quietly with it.
  const passed: { name: string; trade: string | null }[] = []
  const waitsOn: string[] = []
  lines.forEach((cells, i) => {
    const name = cellOf(cells, copy === 'stages' ? 'Name' : 'Activity')
    const group = cellOf(cells, copy === 'everyBar' ? 'Stage' : 'Group')
    const kind = copy === 'team' ? cellOf(cells, 'Kind') || null : null
    const trade = copy === 'team' ? cellOf(cells, 'Trade') || null : null
    if (kind && WAIT_KINDS.has(kind)) {
      u.outsideWaits += 1
      passed.push({ name, trade })
      return
    }
    const start = sheetDay(cellOf(cells, 'Start'))
    const finish = sheetDay(cellOf(cells, 'Finish'))
    if (!start || !finish) {
      u.noDates += 1
      return
    }
    if (Number(cellOf(cells, 'Done %')) > 0 || cellOf(cells, 'Really started') || cellOf(cells, 'Really finished')) u.progress = true
    rows.push({
      key: `row:${i + 1}`,
      name: name || `Row ${i + 1}`,
      groups: group ? [group] : [],
      start,
      finish: finish < start ? start : finish,
      date: kind === 'date to meet' || (copy !== 'team' && (group === EXPORT_DATES_CUSTOMER || group === EXPORT_DATES_TEAM)),
      after: [],
      notBefore: sheetDay(cellOf(cells, 'Not before')),
      mustFinishBy: sheetDay(cellOf(cells, 'Must finish by')),
      kind,
      trade,
      company: copy === 'team' ? cellOf(cells, 'Company') || null : null,
    })
    waitsOn.push(copy === 'team' ? cellOf(cells, 'Waits on') : '')
  })
  // Waits on, by the names the export writes: "Slab on grade (Concrete) +3 days; Rough-in inspection".
  let waits = 0
  rows.forEach((row, i) => {
    for (const part of (waitsOn[i] ?? '').split(';').map((p) => p.trim()).filter(Boolean)) {
      const gapMatch = /^(.*?)\s+([+-])(\d+) days?$/.exec(part)
      const ref = gapMatch ? (gapMatch[1] ?? '') : part
      const gap = gapMatch ? (gapMatch[2] === '-' ? -1 : 1) * Number(gapMatch[3]) : 0
      const traded = /^(.*) \(([^()]+)\)$/.exec(ref)
      const label = traded ? (traded[1] ?? '') : ref
      const trade = traded ? (traded[2] ?? null) : null
      const matches = (r: { name: string; trade: string | null }) => r.name === label && (trade === null || r.trade === trade)
      const found = rows.filter(matches)
      if (found.length === 0 && passed.some(matches)) continue
      // A wait is on work, never on a date: "Rough-in inspection" names both, and means the inspection.
      const work = found.filter((r) => !r.date)
      const pred = work.length === 1 ? work[0] : work.length === 0 && found.length === 1 ? found[0] : undefined
      if (!pred) u.unknownName += 1
      else if (pred.date || row.date) u.onDate += 1
      else {
        row.after.push({ key: pred.key, gap })
        waits += 1
      }
    }
  })
  return { format: 'spreadsheet', title: null, rows, waits, unread: unreadWords(u) }
}

/**
 * What a file holds: its activities, its dates and their waits, and one sentence for each kind of
 * thing it could not read. Microsoft Project's XML or one of the three spreadsheets G-136 writes.
 */
export function readScheduleFile(text: string, fileName: string): ScheduleFileResult {
  if (/\.(mpp|xer|pdf)$/i.test(fileName.trim())) return { problem: OWN_PROGRAM }
  const body = text.replace(/^﻿/, '').trimStart()
  return body.startsWith('<') ? readProjectXml(body) : readSpreadsheet(text)
}

/** "What it holds: 13 activities, 14 waits between them and 4 dates." */
export function importHoldsWords(reading: ScheduleFileReading): string {
  const acts = reading.rows.filter((r) => !r.date).length
  const dates = reading.rows.filter((r) => r.date).length
  const parts = [plural(acts, 'activity', 'activities'), ...(reading.waits > 0 ? [`${plural(reading.waits, 'wait', 'waits')} between them`] : []), ...(dates > 0 ? [plural(dates, 'date', 'dates')] : [])]
  return `What it holds: ${andList(parts)}.`
}

// ---------------------------------------------------------------------------------------------
// The guess, left for the office to tick
// ---------------------------------------------------------------------------------------------

/** Where a row of theirs may go on the window: one of the places, or not ours. */
export type ImportChoice = ScheduleImportPlace | { kind: 'out' }

export interface ImportGuess {
  /** Where it lands. Null: not placed, so it stays out unless the office places it. */
  place: ImportChoice | null
  /** The trade it reads as, even when no line is picked. Null: none. */
  packageId: string | null
  /** Why, in a few words: "the word ductwork", "their group Plumbing". */
  why: string
}

/** One of the job's lines, with its trade. */
export interface ImportLine {
  lineId: string
  label: string
  packageId: string
  trade: string
}

/** The job's lines a row of theirs may land on, trade by trade, in the order the job lists them. */
export function importLines(project: GcProject): ImportLine[] {
  return project.packages.flatMap((pkg) => scheduleLinesOf(pkg).map((l) => ({ lineId: l.lineId, label: l.label, packageId: pkg.id, trade: pkg.trade })))
}

/** Words that say the work is someone else's: the owner's equipment, a tenant's fit-out. */
const NOT_OURS = /\bby (?:the )?(?:owner|others|tenant)\b|\bowner[- ]furnished\b|\b(?:ofoi|ofci|nic)\b/i

/** Short words that tell nothing about a trade or a line. */
const STOP = new Set(['and', 'the', 'with', 'from', 'plan', 'plans', 'detail', 'details', 'sheet', 'sheets', 'schedule', 'schedules', 'section', 'sections', 'building', 'supply', 'work', 'install', 'installation'])

/** The words of a name, each cut to its first four letters, as New Project matches sheets to lines ("utilities" meets "utility"). */
function stems(text: string): { stem: string; word: string }[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map((w) => ({ stem: w.slice(0, 4), word: w }))
}

function inspectionPlace(name: string): { place: ScheduleImportPlace; why: string } {
  if (/\brough/i.test(name)) return { place: { kind: 'roughInInspection' }, why: 'the word rough' }
  if (/\bfinal\b/i.test(name)) return { place: { kind: 'finalInspection' }, why: 'the word final' }
  return { place: { kind: 'inspection' }, why: 'the word inspection' }
}

function wholeWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(text.toLowerCase())
}

/** The line of a trade a name lands on: the same name, else the most words shared, else the trade's one line in the name's stage. */
function lineFor(lines: ImportLine[], trade: string, name: string): { line: ImportLine | null; why: string | null } {
  const exact = lines.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())
  if (exact) return { line: exact, why: null }
  const want = new Set(stems(name).map((s) => s.stem))
  const scored = lines.map((l) => ({ l, n: new Set(stems(l.label).map((s) => s.stem).filter((s) => want.has(s))).size }))
  const best = Math.max(0, ...scored.map((s) => s.n))
  const top = scored.filter((s) => s.n === best)
  if (best > 0 && top.length === 1) return { line: top[0]?.l ?? null, why: null }
  const stage = lineStage(trade, name)
  const inStage = lines.filter((l) => lineStage(trade, l.label) === stage)
  if (inStage.length === 1) return { line: inStage[0] ?? null, why: null }
  return { line: null, why: inStage.length === 0 ? `${trade}, no line in its stage` : `${trade}, ${inStage.length} lines in its stage` }
}

/**
 * Where each of their activities most likely lands on this job, with the reason, in this order:
 * our own spreadsheet's Kind and Trade; not ours by its name (by owner, by others); an
 * inspection; a trade the job has, named in the row or its group, else a word only that trade
 * has; then the trade's line. Dates are not guessed: they are ticked to come in. A guess to start
 * from, never the last word.
 */
export function guessPlaces(project: GcProject, reading: ScheduleFileReading): Map<string, ImportGuess> {
  const lines = importLines(project)
  const linesOf = (packageId: string) => lines.filter((l) => l.packageId === packageId)
  // Each trade's words: its name, New Project's words and usual scope for it, and this job's own lines.
  const words = new Map(
    project.packages.map((pkg) => {
      const t = TRADE_TEMPLATES.find((x) => x.trade === pkg.trade)
      const all = [pkg.trade, ...(t?.words ?? []), ...(t?.scope ?? []), ...linesOf(pkg.id).map((l) => l.label)]
      return [pkg.id, new Set(all.flatMap((w) => stems(w).map((s) => s.stem)))] as const
    }),
  )
  const onLine = (packageId: string, trade: string, name: string, why: string): ImportGuess => {
    const found = lineFor(linesOf(packageId), trade, name)
    return found.line ? { place: { kind: 'line', lineId: found.line.lineId }, packageId, why } : { place: null, packageId, why: found.why ?? why }
  }
  const out = new Map<string, ImportGuess>()
  for (const row of reading.rows) {
    if (row.date) continue
    const name = row.name
    // 1. Our own spreadsheet says.
    if (row.kind === 'inspection') {
      out.set(row.key, { ...inspectionPlace(name), packageId: null, why: 'our spreadsheet says inspection' })
      continue
    }
    if (row.kind === 'added activity') {
      out.set(row.key, { place: { kind: 'added', who: row.company ?? '' }, packageId: null, why: 'our spreadsheet says the job’s own' })
      continue
    }
    const named = row.trade ? project.packages.find((p) => p.trade === row.trade) : undefined
    if (named) {
      out.set(row.key, onLine(named.id, named.trade, name, 'our spreadsheet’s Trade column'))
      continue
    }
    // 2. Not ours by its name.
    const notOurs = NOT_OURS.exec(name)
    if (notOurs) {
      out.set(row.key, { place: { kind: 'out' }, packageId: null, why: notOurs[0].toLowerCase() })
      continue
    }
    // 3. An inspection.
    if (/inspection/i.test(name)) {
      out.set(row.key, { ...inspectionPlace(name), packageId: null })
      continue
    }
    // 4. A trade the job has: named in the row, then in its groups, innermost first.
    const inName = project.packages.find((p) => wholeWord(name, p.trade))
    if (inName) {
      const said = new RegExp(inName.trade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').exec(name)?.[0] ?? inName.trade
      out.set(row.key, onLine(inName.id, inName.trade, name, `the word ${said === said.toUpperCase() ? said : said.toLowerCase()}`))
      continue
    }
    const group = [...row.groups].reverse().find((g) => project.packages.some((p) => wholeWord(g, p.trade)))
    const inGroup = group ? project.packages.find((p) => wholeWord(group, p.trade)) : undefined
    if (group && inGroup) {
      out.set(row.key, onLine(inGroup.id, inGroup.trade, name, `their group ${group}`))
      continue
    }
    // Then a word only one of the job's trades has: the one with the most of the name's words.
    const mine = stems(name)
    const scored = project.packages
      .map((p) => ({ p, hits: mine.filter((s) => words.get(p.id)?.has(s.stem)) }))
      .filter((x) => x.hits.length > 0)
      .sort((a, b) => b.hits.length - a.hits.length)
    const first = scored[0]
    const second = scored[1]
    if (first && (!second || second.hits.length < first.hits.length)) {
      out.set(row.key, onLine(first.p.id, first.p.trade, name, `the word ${first.hits[0]?.word ?? ''}`))
      continue
    }
    if (first && second) {
      const shared = first.hits.find((h) => second.hits.some((x) => x.stem === h.stem))?.word ?? first.hits[0]?.word ?? ''
      out.set(row.key, { place: null, packageId: null, why: `${shared} is in ${possessive(first.p.trade)} lines and in ${possessive(second.p.trade)}` })
      continue
    }
    out.set(row.key, { place: null, packageId: null, why: 'no trade in its name' })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// The schedule it makes: the first draft's own path
// ---------------------------------------------------------------------------------------------

/** "dry in", "substantial completion": names compared without case or marks. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return norm(a) === norm(b)
}

/** The schedule an import makes, with what it left out and the log's words. */
export interface ImportedSchedule {
  schedule: ProjectSchedule
  /** A wait their own dates break, left out, in a sentence each. */
  notes: string[]
  /** How many of their activities are on the schedule, and how many of our lines the first draft drew. */
  kept: number
  drawn: number
  /** Our lines the file does not name, drawn as the first draft draws them. */
  notIn: ImportLine[]
  /** The first draft's inspections the file does not name: "Rough-in inspection". */
  inspectionsNotIn: string[]
  /** Our lines not in the file that run into or past their final inspection, by name. Empty when the file has no final inspection. */
  pastFinal: string[]
  words: string
}

/**
 * The schedule a file makes (the reducer's one call). The first draft, exactly as Draw a first
 * draft draws it (`scheduleDraft` with the rough's stage days when we bid one), then: the lines,
 * inspections and job's own activities the file names take its dates (the span, when two of
 * theirs land on one) and its waits on what is on the schedule; our lines not in it keep the first
 * draft's waits and days and start the day after what they wait on; the final inspection, when the
 * file has none, waits on everything nothing else waits on; the dates to meet are theirs as
 * ticked, and ours not taken are worked out again the first draft's way.
 */
export function importedSchedule(project: GcProject, imp: ScheduleImport): ImportedSchedule {
  const draft = scheduleDraft(project, imp.workStarts, project.rough?.days)
  const roughId = `${project.id}-insp-roughin`
  const finalId = `${project.id}-insp-final`
  const lines = importLines(project)
  const lineIds = new Set(lines.map((l) => l.lineId))
  const used = new Set(draft.activities.map((a) => a.lineId))
  const fresh = (prefix: string) => {
    let n = 1
    while (used.has(`${prefix}-${n}`)) n += 1
    used.add(`${prefix}-${n}`)
    return `${prefix}-${n}`
  }
  const acts = new Map<string, ScheduleActivity>(draft.activities.map((a) => [a.lineId, a]))
  // Where each kept row lands, and what lands on each activity.
  const targetOf = new Map<string, string>()
  const landed = new Map<string, ScheduleImportRow[]>()
  for (const row of imp.rows) {
    const p = row.place
    let id: string | null = null
    if (p.kind === 'line') id = lineIds.has(p.lineId) ? p.lineId : null
    else if (p.kind === 'roughInInspection') id = roughId
    else if (p.kind === 'finalInspection') id = finalId
    else if (p.kind === 'inspection') id = fresh(`${project.id}-insp`)
    else id = fresh(`${project.id}-own`)
    if (!id || !row.start || !row.finish) continue
    targetOf.set(row.key, id)
    landed.set(id, [...(landed.get(id) ?? []), row])
    if (!acts.has(id)) {
      // An inspection or the job's own activity the first draft does not have.
      const label = id === roughId ? 'Rough-in inspection' : id === finalId ? 'Final inspection' : row.name
      acts.set(id, p.kind === 'added' ? { lineId: id, packageId: '', start: row.start, finish: row.finish, after: [], added: { label: row.name, who: p.who.trim() || imp.from, doneOn: null } } : { lineId: id, packageId: '', start: row.start, finish: row.finish, after: [], inspection: { label } })
    }
  }
  // Their dates and waits on what the file names.
  for (const [id, rows] of landed) {
    const base = acts.get(id)
    if (!base) continue
    const start = rows.reduce((m, r) => (r.start < m ? r.start : m), rows[0]?.start ?? base.start)
    const finish = rows.reduce((m, r) => (r.finish > m ? r.finish : m), rows[0]?.finish ?? base.finish)
    const gaps = new Map<string, number>()
    for (const r of rows) {
      for (const w of r.after) {
        const to = targetOf.get(w.key)
        if (!to || to === id) continue
        gaps.set(to, Math.max(gaps.get(to) ?? Number.NEGATIVE_INFINITY, w.gap))
      }
    }
    const notBefore = rows.map((r) => r.notBefore).filter((d): d is string => Boolean(d)).sort().pop()
    const mustFinishBy = rows.map((r) => r.mustFinishBy).filter((d): d is string => Boolean(d)).sort()[0]
    const lag = Object.fromEntries([...gaps].filter(([, g]) => g !== 0))
    const { lag: _lag, notBefore: _nb, mustFinishBy: _mf, ...rest } = base
    acts.set(id, { ...rest, start, finish: finish < start ? start : finish, after: [...gaps.keys()], ...(Object.keys(lag).length > 0 ? { lag } : {}), ...(notBefore ? { notBefore } : {}), ...(mustFinishBy ? { mustFinishBy } : {}) })
  }
  // A wait their own dates break is left out: the dates are theirs.
  const nameOf = (id: string) => {
    const a = acts.get(id)
    return a?.inspection?.label ?? a?.added?.label ?? lines.find((l) => l.lineId === id)?.label ?? id
  }
  const notes: string[] = []
  for (const id of landed.keys()) {
    const a = acts.get(id)
    if (!a) continue
    const broken = a.after.filter((p) => {
      const pred = acts.get(p)
      return pred !== undefined && landed.has(p) && a.start <= addDays(pred.finish, a.lag?.[p] ?? 0)
    })
    if (broken.length === 0) continue
    for (const p of broken) notes.push(`${nameOf(id)} starts before ${nameOf(p)} ends in their file, so its wait on ${nameOf(p)} is left out.`)
    const lag = Object.fromEntries(Object.entries(a.lag ?? {}).filter(([p]) => !broken.includes(p)))
    const { lag: _lag, ...rest } = a
    acts.set(id, { ...rest, after: a.after.filter((p) => !broken.includes(p)), ...(Object.keys(lag).length > 0 ? { lag } : {}) })
  }
  // The final inspection the file does not name waits on everything nothing else waits on, as the first draft has it.
  if (!landed.has(finalId) && acts.has(finalId)) {
    const final = acts.get(finalId) as ScheduleActivity
    const waitedOn = new Set([...acts.values()].filter((a) => a.lineId !== finalId).flatMap((a) => a.after))
    acts.set(finalId, { ...final, after: [...acts.keys()].filter((id) => id !== finalId && !waitedOn.has(id)) })
  }
  // Our lines and inspections not in the file: the first draft's waits and days, from the day after what they wait on.
  const placed = new Set<string>(landed.keys())
  const place = (id: string, path: Set<string>): ScheduleActivity | undefined => {
    const a = acts.get(id)
    if (!a || placed.has(id) || path.has(id)) return a
    path.add(id)
    const days = daysBetween(a.start, a.finish)
    const after = a.after.filter((p) => acts.has(p))
    const start = after.reduce((m, p) => {
      const pred = place(p, path)
      const next = pred ? addDays(pred.finish, 1 + (a.lag?.[p] ?? 0)) : m
      return next > m ? next : m
    }, imp.workStarts)
    const moved: ScheduleActivity = { ...a, after, start, finish: addDays(start, days) }
    acts.set(id, moved)
    placed.add(id)
    path.delete(id)
    return moved
  }
  for (const id of [...acts.keys()]) place(id, new Set())
  // The dates to meet: theirs as ticked; ours not taken, worked out again the first draft's way.
  const stageOfLine = new Map(lines.map((l) => [l.lineId, lineStage(l.trade, l.label)]))
  const lastDryIn = [...acts.values()].filter((a) => stageOfLine.get(a.lineId) === 'dryIn').reduce<string | null>((m, a) => (m === null || a.finish > m ? a.finish : m), null)
  const taken = new Set<number>()
  const milestones: ScheduleMilestone[] = draft.milestones.map((m) => {
    const i = imp.dates.findIndex((d, k) => !taken.has(k) && sameName(d.name, m.label))
    const theirs = imp.dates[i]
    if (theirs) {
      taken.add(i)
      return { ...m, planned: theirs.on }
    }
    if (m.id === `${project.id}-dryin` && lastDryIn) return { ...m, planned: lastDryIn }
    if (m.id === `${project.id}-roughin`) return { ...m, planned: acts.get(roughId)?.finish ?? m.planned }
    if (m.id === `${project.id}-substantial`) {
      const final = acts.get(finalId)
      return { ...m, planned: final ? addDays(final.finish, 3) : m.planned }
    }
    return m
  })
  imp.dates.forEach((d, k) => {
    if (!taken.has(k) && d.on) milestones.push({ id: fresh(`${project.id}-date`), label: d.name, planned: d.on, packageId: null, metOn: null })
  })
  const kept = targetOf.size
  const notIn = lines.filter((l) => !landed.has(l.lineId))
  const drawn = notIn.length
  const inspectionsNotIn = [roughId, finalId].filter((id) => draft.activities.some((a) => a.lineId === id) && !landed.has(id)).map((id) => acts.get(id)?.inspection?.label ?? id)
  const theirFinal = landed.has(finalId) ? acts.get(finalId) : undefined
  const pastFinal = theirFinal ? notIn.filter((l) => (acts.get(l.lineId)?.finish ?? '') >= theirFinal.start).map((l) => l.label) : []
  const dates = imp.dates.length
  const words = [
    `Drew the schedule on ${project.name} from ${possessive(imp.from)} file ${imp.file}.`,
    `${kept} of their activities ${kept === 1 ? 'is' : 'are'} on our schedule${dates > 0 ? `, with ${plural(dates, 'date', 'dates')} to meet` : ''}.`,
    ...(drawn > 0 ? [`${plural(drawn, 'of our lines was', 'of our lines were')} drawn as the first draft draws them.`] : []),
  ].join(' ')
  return { schedule: { activities: [...acts.values()], milestones, baseline: null, lookAhead: [] }, notes, kept, drawn, notIn, inspectionsNotIn, pastFinal, words }
}

/**
 * Why an import is refused on this job, or null when it may come in. It makes the first schedule,
 * or takes the place of one drawn before Start that nobody walked or moved. Never while bidding,
 * on a lost job, past Start with a schedule, or while a what-if copy is open.
 */
export function importRefusal(project: GcProject): string | null {
  if (project.stage === 'pursuing') return 'While we bid, the rough schedule is the one to draw.'
  if (project.lostOn) return 'This job was lost.'
  if (project.whatIf) return 'A what-if copy is open. Keep it or throw it away first.'
  const s = project.schedule
  if (!s) return null
  if (project.startedOn) return `This job started ${weekdayDate(project.startedOn)}. A new set of plans is the way to change its schedule now.`
  if ((s.walks ?? []).length > 0) return 'The schedule was walked. Its record stays as it is.'
  if ((s.moves ?? []).length > 0 || s.baseline) return 'The schedule has moves with their reasons. They stay as they are.'
  return null
}

// ---------------------------------------------------------------------------------------------
// The window's words
// ---------------------------------------------------------------------------------------------

/** What the window says it is, before a file is chosen. */
export const IMPORT_INTRO = ['A schedule from Microsoft Project, Primavera P6 or our own spreadsheet.', "It makes this job's first schedule.", 'Nothing is sent to the trades or the customer.']

/** Said on the second door, over a schedule drawn before Start. */
export const IMPORT_REPLACES = 'It takes the place of the schedule drawn now. The changes made to it are lost.'

/** "3 of theirs are not placed. They stay out unless you pick a place." Null: every row has a place. */
export function notPlacedWords(n: number): string | null {
  if (n === 0) return null
  return `${n} of theirs ${n === 1 ? 'is' : 'are'} not placed. ${n === 1 ? 'It stays' : 'They stay'} out unless you pick a place.`
}

/**
 * Our lines the file does not name, trade by trade: "Electrical: Panels and feeders, Lighting and
 * Low voltage rough." The first draft's inspections it does not name, and our lines that run into
 * their final inspection, each in a sentence of their own.
 */
export function notInWords(made: Pick<ImportedSchedule, 'notIn' | 'inspectionsNotIn' | 'pastFinal'>): string[] {
  const trades = [...new Set(made.notIn.map((l) => l.trade))]
  return [
    ...trades.map((t) => `${t}: ${andList(made.notIn.filter((l) => l.trade === t).map((l) => l.label))}.`),
    ...made.inspectionsNotIn.map((label) => `The first draft's ${label.toLowerCase()} is not in it either. It is drawn after the work it waits on.`),
    ...(made.pastFinal.length > 0 ? [`${andList(made.pastFinal)} ${made.pastFinal.length === 1 ? 'runs' : 'run'} into their final inspection. Look at ${made.pastFinal.length === 1 ? 'it' : 'them'} before Start.`] : []),
  ]
}
