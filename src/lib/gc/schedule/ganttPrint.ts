/**
 * GC mode, the real build, the schedule's PR 1b: the chart on paper, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcGanttPrint.ts`).
 */
import { addDays } from '../building'
import type { CustomerSchedulePicture, CustomerStage } from './customerSchedule'
import { CUSTOMER_NOTHING_MOVED, CUSTOMER_STAGE_WORDS, customerBarWords } from './customerSchedule'
import type { LostDay } from './daysLost'
import type { GanttBar, GanttFilters, GanttGroup, GanttGroupBy } from './gantt'
import { ganttAxis, ganttFilter, ganttGroups, ganttLinks, holidayOn, isWeekend, linkPath, spareTail } from './gantt'
import type { PeopleWeek } from './peopleOnSite'
import { SHORT_BY } from './peopleOnSite'
import type { MilestoneRow } from './schedule'
import { daysBetween } from './schedule'
import type { WaitRow } from './waits'
import { shortDate, weekdayDate } from '../words'

export type GanttPrintFor = 'team' | 'customer'

/** What the Schedule tab knows that the chart does not: the job's words and the customer's picture. */
export interface GanttPrintJob {
  /** "Fair Oaks Shops, Building D" */
  name: string
  /** "7920 Fair Oaks Pkwy, Fair Oaks Ranch" */
  place: string
  /** Our company, on the top of every page. */
  company: string
  /** Who prints, for the foot. */
  by: string
  /** The projected finish as the Projected finish card says it, with the contract's day. */
  finishWords: string
  /** The lines the Projected finish measure prints under that sentence on a late job (G-98's `lateFinish().words`): the money at the fee, whose days, the change orders. */
  finishLines?: string[]
  /** "72% of the work is done. We planned 76% by today." Null while the schedule is being drawn. */
  doneWords: string | null
  customer: CustomerSchedulePicture
}

/** The chart as the person has it, read from the chart's own state. */
export interface GanttPrintInput {
  /** Every bar, as the chart made them (`ganttBars`). */
  bars: GanttBar[]
  filters: GanttFilters
  /** The filter pills' names, as the chart labels them, so the words name the pill to find. */
  filterNames: Record<keyof GanttFilters, string>
  by: GanttGroupBy
  folded: ReadonlySet<string>
  /** The lines between bars: off when Hide the links is pressed. */
  links: boolean
  milestones: MilestoneRow[]
  waits: WaitRow[]
  lost: ReadonlyMap<string, LostDay[]>
  today: string
  /** Off while buying out: the schedule is being drawn, and nothing reports a percent yet. */
  building: boolean
  for: GanttPrintFor
  job: GanttPrintJob
  /** The chart's own note beside a bar, so paper and screen say the same thing. */
  noteOf?: (bar: GanttBar) => { words: string; color: string } | null
  /** A trade's own new finish from its portal, not on the dates yet (G-117): the chart's amber dashed tail. */
  lateSaid?: ReadonlyMap<string, { finish: string; words: string }>
  /** Show spare days is on (G-08): each bar's spare days as the chart's faint tail, on our team's copy. */
  spare?: boolean
  /** Where each bar could start now that the work before it finished early (G-37): the chart's green ghost behind it. */
  earlier?: ReadonlyMap<string, { start: string; finish: string; words: string }>
  /** Show people on site is on (G-84): each week's people between two days, for the strip under the last page's rows on our team's copy (G-144). */
  peopleOf?: (from: string, to: string) => PeopleWeek[]
  /** One company picked on the chart (G-13): our team's copy shows only its work and says so. The customer's copies never read it. */
  company?: string
}

// ---------------------------------------------------------------------------------------------
// What comes out
// ---------------------------------------------------------------------------------------------

type Tone = GanttBar['tone']

/** One row on paper: a group's heading, a bar, what the work waits on, one of the customer's stages, or the people on site per week. */
export type GanttPrintRow =
  | { kind: 'group'; key: string; title: string; sub: string; start: string; finish: string; pct: number | null; stands: string; tone: Tone; folded: boolean; now: boolean; continued: boolean }
  | { kind: 'bar'; bar: GanttBar; stands: string; tone: Tone; note: { words: string; ink: string } | null; done: string; plan: string; plain: boolean }
  | { kind: 'waits'; continued: boolean }
  | { kind: 'wait'; row: WaitRow; who: string }
  | { kind: 'stage'; stage: CustomerStage; stands: string }
  | { kind: 'people'; weeks: PeopleWeek[] }

type Heading = Extract<GanttPrintRow, { kind: 'group' | 'waits' }>

export type GanttPrintColumnKey = 'activity' | 'dates' | 'done' | 'plan' | 'stands'

export interface GanttPrintColumn {
  key: GanttPrintColumnKey
  label: string
  x: number
  w: number
}

export interface GanttPrintAxis {
  /** The first day drawn: a Monday. */
  first: string
  days: number
  /** Where the chart's lane starts, and how wide a day is, in points. */
  x0: number
  ptPerDay: number
  scale: 'days' | 'weeks' | 'months'
  months: { label: string; at: number; days: number }[]
  ticks: { label: string; at: number; strong: boolean; letter: string | null }[]
  marked: { at: number; weekend: boolean; holiday: string | null }[]
  /** Weekends are tinted only when a day is wide enough to see. */
  tint: boolean
  /** The look-ahead's window: bars past an edge are cut there and marked. */
  window: boolean
}

/** The marks the key explains, in the key's order. */
export type GanttPrintMark = 'done' | 'underway' | 'notStarted' | 'tight' | 'late' | 'held' | 'inspection' | 'coTail' | 'said' | 'spare' | 'earlier' | 'wait' | 'baseline' | 'actual' | 'group' | 'stage' | 'milestone' | 'link' | 'weekend' | 'holiday' | 'lost' | 'cut' | 'people' | 'peopleShort' | 'today'

/** A date the job must meet, placed on its line so no two labels run together. */
export interface GanttPrintMilestone {
  row: MilestoneRow
  /** "Dry-in Sep 25, 7 days late" */
  words: string
  late: boolean
  /** Which line of the row, from the top, and whether the label reads to the right of its diamond. */
  line: number
  right: boolean
}

export interface GanttPrintLink {
  from: string
  to: string
  critical: boolean
  /** Days of gap on the wait (G-35). */
  gap: number
  page: number
}

export interface GanttPrint {
  for: GanttPrintFor
  /** Which picture: our chart, the customer's stages, or every bar as the customer's list. */
  copy: 'team' | 'stages' | 'everyBar'
  /** Next 3 weeks on, on our team's copy: the look-ahead sheet (pick 2). */
  lookAhead: boolean
  /** The document's title, which a browser offers as the PDF's name. */
  title: string
  head: { title: string; company: string; lines: string[] }
  /** The line atop pages 2 and after. */
  running: string
  /** The window's sentences: the pages, then what it shows. */
  shows: string[]
  /** The line under Who it is for. */
  forWords: string
  columns: GanttPrintColumn[]
  axis: GanttPrintAxis
  today: string
  milestones: GanttPrintMilestone[]
  /** Lines the dates to meet take: two, or more when two would run labels together. */
  milestoneLines: number
  pages: GanttPrintRow[][]
  links: GanttPrintLink[]
  waitLinks: { wait: string; to: string; late: boolean; page: number }[]
  lost: ReadonlyMap<string, LostDay[]>
  /** A trade's own new finish from its portal (G-117), on our team's copy only. */
  lateSaid: ReadonlyMap<string, { finish: string; words: string }>
  /** Each bar's spare days as a faint tail (G-08), on our team's copy only, when Show spare days is on. */
  spare: boolean
  /** Where each bar could start earlier (G-37), on our team's copy only. */
  earlier: ReadonlyMap<string, { start: string; finish: string; words: string }>
  /** The marks each page uses. */
  key: GanttPrintMark[][]
  /** "Every day is a working day, weekends and holidays too." Our team's copy only. */
  everyDay: string | null
  /** The customer's What changed this week and What we need from you, after the chart. */
  lists: { title: string; lines: string[] }[]
  /** The lists did not fit under the last page's rows, so they have a page of their own. */
  listsPage: boolean
  foot: string
  /** Said instead of rows when nothing passes the filters. */
  empty: string | null
}

// ---------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------

/** Letter landscape with 0.4 in margins, in points: 10.2 by 7.7 in, a little short so no browser's rounding spills a page. */
export const PRINT_PAGE = { width: 734, height: 550 } as const

/** A bar's row, and a group's heading, in points. */
export const PRINT_ROW = 13

export const PRINT_GROUP = 15

/** The people on site per week (G-144): the numbers over the bars, in points. */
export const PRINT_PEOPLE = 28

/** The tallest of its bars, the week with the most people, in points. */
const PEOPLE_BAR_H = 15

const TITLE_H = 20

const LINE_H = 11

const RUNNING_H = 14

const HEAD_GAP = 6

/** The column heads, the months and the day marks. */
export const PRINT_AXIS_H = 26

/** A line of the dates the job must meet. Two lines at least, four at most. */
const MS_LINE_H = 11

const MS_MAX_LINES = 4

function milestonesHeight(lines: number): number {
  return 2 + lines * MS_LINE_H
}

/** A line of the key, the working-day line and the foot line, in points. */
const KEY_LINE_H = 9

const FOOT_H = 22

/** A key entry's swatch and gaps, and a character of its 6.5 pt words, in points. */
const KEY_ENTRY_PT = 28

const KEY_CHAR_PT = 3.5

const LIST_TITLE_H = 13

const LIST_LINE_H = 10.5

/** A head line of 8 pt type: about this many points a character. */
const HEAD_CHAR_PT = 4.1

const LIST_CHAR_PT = 3.9

/** Next 3 weeks (`soon`), and the look-ahead's reach past today. */
const LOOK_AHEAD_DAYS = 21

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function weekdayOf(on: string): number {
  const [y, m, d] = on.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

function year(on: string): string {
  return on.slice(0, 4)
}

/** "Fri Oct 2, 2026" */
function dayWords(on: string): string {
  return `${weekdayDate(on)}, ${year(on)}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
}

// ---------------------------------------------------------------------------------------------
// The axis
// ---------------------------------------------------------------------------------------------

/** The days from `first`, `days` long, on a lane `width` points wide: months, the day marks for the scale, weekends and holidays. */
export function printAxis(first: string, days: number, x0: number, width: number, window: boolean): GanttPrintAxis {
  const ptPerDay = width / Math.max(1, days)
  const scale: GanttPrintAxis['scale'] = ptPerDay >= 10 ? 'days' : ptPerDay >= 2 ? 'weeks' : 'months'
  const months: GanttPrintAxis['months'] = []
  const ticks: GanttPrintAxis['ticks'] = []
  const marked: GanttPrintAxis['marked'] = []
  for (let i = 0; i < days; i++) {
    const on = addDays(first, i)
    const dom = Number(on.slice(8))
    if (i === 0 || dom === 1) months.push({ label: `${MONTH_NAMES[Number(on.slice(5, 7)) - 1] ?? ''} ${year(on)}`, at: i, days: 0 })
    const month = months[months.length - 1]
    if (month) month.days += 1
    const wd = weekdayOf(on)
    if (scale === 'days') ticks.push({ label: String(dom), at: i, strong: wd === 1, letter: DAY_LETTERS[wd] ?? null })
    else if (scale === 'weeks' && wd === 1) ticks.push({ label: String(dom), at: i, strong: false, letter: null })
    else if (scale === 'months' && (dom === 1 || dom === 15)) ticks.push({ label: String(dom), at: i, strong: dom === 1, letter: null })
    const holiday = holidayOn(on)
    if (holiday || isWeekend(on)) marked.push({ at: i, weekend: isWeekend(on), holiday })
  }
  return { first, days, x0, ptPerDay, scale, months, ticks, marked, tint: ptPerDay >= 6, window }
}

/** The look-ahead's window: the Monday of last week to the Sunday three weeks out. */
export function lookAheadWindow(today: string): { first: string; last: string } {
  let monday = today
  while (weekdayOf(monday) !== 1) monday = addDays(monday, -1)
  let last = addDays(today, LOOK_AHEAD_DAYS)
  while (weekdayOf(last) !== 0) last = addDays(last, 1)
  return { first: addDays(monday, -7), last }
}

/**
 * The dates the job must meet, each on the first place its label runs into no other: its own line,
 * another line, then the left of its diamond. Two lines, and a third or fourth only when two would
 * run labels together.
 */
export function placeMilestones(milestones: MilestoneRow[], axis: GanttPrintAxis, width: number): { placed: GanttPrintMilestone[]; lines: number } {
  const sorted = [...milestones].sort((a, b) => (a.due < b.due ? -1 : 1))
  for (let lines = 2; ; lines++) {
    const taken: [number, number][][] = Array.from({ length: lines }, () => [])
    let clash = false
    const placed = sorted.map((r, i): GanttPrintMilestone => {
      const late = r.state === 'late' || r.state === 'missed'
      const words = `${r.milestone.label} ${shortDate(r.due)}${late ? `, ${r.daysLate} days late` : r.state === 'hit' ? ', met' : ''}`
      const cx = axis.x0 + (daysBetween(axis.first, r.due) + 0.5) * axis.ptPerDay
      // A little over the type's width, so two labels never touch.
      const w = textWidth(words, 6, late) * 1.1 + 4
      const own = i % lines
      const order = [own, ...Array.from({ length: lines }, (_, k) => k).filter((k) => k !== own)]
      const places = [...order.map((line) => ({ line, right: true })), ...order.map((line) => ({ line, right: false }))]
      const span = (o: { right: boolean }): [number, number] => (o.right ? [cx - 4, cx + 5 + w] : [cx - 5 - w, cx + 4])
      const inside = (o: { right: boolean }) => span(o)[0] >= axis.x0 - 2 && span(o)[1] <= width
      const free = (o: { line: number; right: boolean }) => inside(o) && (taken[o.line] ?? []).every(([a, b]) => span(o)[1] < a || span(o)[0] > b)
      let o = places.find(free)
      if (!o) {
        clash = true
        o = places.find(inside) ?? { line: own, right: true }
      }
      taken[o.line]?.push(span(o))
      return { row: r, words, late, line: o.line, right: o.right }
    })
    if (!clash || lines >= MS_MAX_LINES) return { placed, lines }
  }
}

// ---------------------------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------------------------

/** The screen's note colors (CSS variables), as ink on paper. */
const NOTE_INK: Record<string, string> = {
  'var(--text-red-700)': '#b91c1c',
  'var(--text-amber-800)': '#92400e',
  'var(--text-violet-800)': '#5b21b6',
  'var(--text-green-800)': '#166534',
  'var(--text-muted)': '#6b7280',
}

/** Any other note color prints in the page's soft grey. */
const NOTE_INK_ELSE = '#4b5563'

function noteInk(css: string): string {
  return NOTE_INK[css] ?? (css.startsWith('#') ? css : NOTE_INK_ELSE)
}

/** An inspection or an added activity reports no percent: it is done, or not. */
function reportsPercent(b: GanttBar): boolean {
  return !b.item.activity.inspection && !b.item.activity.added
}

function teamGroupRow(g: GanttGroup, folded: boolean, building: boolean): GanttPrintRow {
  const allDone = g.bars.length > 0 && g.bars.every((b) => b.status === 'done')
  const stands = g.late > 0 ? `${g.late} behind` : g.held > 0 ? `${g.held} held` : building && allDone ? 'done' : ''
  return {
    kind: 'group',
    key: g.key,
    title: g.title,
    sub: g.sub,
    start: g.start,
    finish: g.finish,
    pct: building && g.bars.some(reportsPercent) ? g.pct : null,
    stands,
    tone: g.late > 0 || g.held > 0 ? 'amber' : stands === 'done' ? 'green' : 'grey',
    folded,
    now: false,
    continued: false,
  }
}

function teamBarRow(b: GanttBar, input: GanttPrintInput): GanttPrintRow {
  const a = b.item.activity
  const reports = input.building && reportsPercent(b)
  const note = input.noteOf?.(b) ?? null
  return {
    kind: 'bar',
    bar: b,
    stands: b.statusWords,
    tone: b.tone,
    note: note ? { words: note.words, ink: noteInk(note.color) } : null,
    done: reports ? `${Math.round(b.item.actual)}%` : '',
    plan: reports && b.status !== 'done' && a.start <= input.today ? `${Math.round(b.item.plannedToday)}%` : '',
    plain: false,
  }
}

/** Our team's rows: what the work waits on, then the chart's groups as the person has them. */
function teamRows(input: GanttPrintInput, shown: GanttBar[]): GanttPrintRow[] {
  const rows: GanttPrintRow[] = []
  if (input.waits.length > 0) {
    rows.push({ kind: 'waits', continued: false })
    for (const w of input.waits) rows.push({ kind: 'wait', row: w, who: w.wait.who })
  }
  for (const g of ganttGroups(shown, input.by)) {
    const folded = input.folded.has(g.key)
    rows.push(teamGroupRow(g, folded, input.building))
    if (!folded) for (const b of g.bars) rows.push(teamBarRow(b, input))
  }
  return rows
}

/** The customer's every bar: their portal's list, by stage, today first, the finished stages folded. */
function everyBarRows(picture: CustomerSchedulePicture, building: boolean): GanttPrintRow[] {
  return picture.fullChart.flatMap(({ group: g, open, now }): GanttPrintRow[] => [
    {
      kind: 'group',
      key: g.key,
      title: g.title,
      sub: '',
      start: g.start,
      finish: g.finish,
      pct: building ? g.pct : null,
      stands: g.late > 0 ? `${g.late} behind` : g.held > 0 ? `${g.held} held` : '',
      tone: g.late > 0 || g.held > 0 ? 'amber' : 'grey',
      folded: !open,
      now,
      continued: false,
    },
    ...(open
      ? g.bars.map((b): GanttPrintRow => {
          const w = customerBarWords(b)
          return { kind: 'bar', bar: b, stands: w.words, tone: w.tone, note: null, done: '', plan: '', plain: true }
        })
      : []),
  ])
}

function stageRows(picture: CustomerSchedulePicture): GanttPrintRow[] {
  return picture.stages.map((s) => ({ kind: 'stage', stage: s, stands: CUSTOMER_STAGE_WORDS[s.state] }))
}

function rowHeight(r: GanttPrintRow): number {
  if (r.kind === 'people') return PRINT_PEOPLE
  return r.kind === 'group' || r.kind === 'waits' ? PRINT_GROUP : PRINT_ROW
}

function isHeading(r: GanttPrintRow): r is Heading {
  return r.kind === 'group' || r.kind === 'waits'
}

function isChild(r: GanttPrintRow): boolean {
  return r.kind === 'bar' || r.kind === 'wait'
}

/**
 * The rows split into pages. A page takes rows while they fit. A heading never ends a page: it
 * moves to the next one unless two of its rows (or all, when it has fewer) fit under it. A group
 * cut by a page repeats its heading at the top of the next one, marked continued.
 */
export function printPages(rows: GanttPrintRow[], firstCap: number, nextCap: number): GanttPrintRow[][] {
  const pages: GanttPrintRow[][] = []
  let page: GanttPrintRow[] = []
  let used = 0
  let cap = firstCap
  let heading: Heading | null = null
  rows.forEach((r, i) => {
    let need = rowHeight(r)
    if (isHeading(r)) for (let k = i + 1; k <= i + 2 && rows[k] && isChild(rows[k] as GanttPrintRow); k++) need += rowHeight(rows[k] as GanttPrintRow)
    if (page.length > 0 && used + need > cap) {
      pages.push(page)
      page = []
      used = 0
      cap = nextCap
      if (isChild(r) && heading) {
        const again: Heading = { ...heading, continued: true }
        page.push(again)
        used += rowHeight(again)
      }
    }
    if (isHeading(r)) heading = r
    else if (!isChild(r)) heading = null
    page.push(r)
    used += rowHeight(r)
  })
  if (page.length > 0 || pages.length === 0) pages.push(page)
  return pages
}

// ---------------------------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------------------------

const BY_WORDS: Record<GanttGroupBy, string> = { trade: 'by trade', stage: 'by stage', company: 'by company' }

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

/** What the person has the chart showing, in sentences: the count, the filters by their pills' names, the folds, the lines. */
function showsWords(input: GanttPrintInput, shown: GanttBar[], groups: GanttGroup[], window: { first: string; last: string } | null): string[] {
  const total = input.bars.length
  const on = (Object.keys(input.filters) as (keyof GanttFilters)[]).filter((k) => input.filters[k])
  const words: string[] = []
  const narrowed = on.length > 0 || input.company !== undefined
  words.push(narrowed ? `It shows ${shown.length} of ${plural(total, 'activity', 'activities')}, ${BY_WORDS[input.by]}.` : `It shows all ${plural(total, 'activity', 'activities')}, ${BY_WORDS[input.by]}.`)
  if (input.company !== undefined) words.push(`Only ${possessive(input.company)} work shows.`)
  if (on.length > 0) words.push(`${on.length === 1 ? 'Filter' : 'Filters'} on: ${on.map((k) => input.filterNames[k]).join(', ')}.`)
  const folded = groups.filter((g) => input.folded.has(g.key)).map((g) => g.title)
  if (folded.length === 1) words.push(`${folded[0] ?? ''} is folded into one bar.`)
  else if (folded.length > 1 && folded.length <= 4) words.push(`${andList(folded)} are folded into one bar each.`)
  else if (folded.length > 4) words.push(`${folded.length} groups are folded into one bar each.`)
  words.push(input.links ? 'Lines show what waits on what.' : 'The lines between bars are hidden.')
  if (input.spare && shown.some((b) => spareTail(b))) words.push("Each bar's spare days show as a faint tail.")
  if (input.peopleOf && shown.length > 0) words.push("People on site print under the last page's rows, the plan beside the daily log.")
  if (window) words.push(`The page runs from ${weekdayDate(window.first)} to ${weekdayDate(window.last)}, a day at a time.`)
  return words
}

/** The line under Who it is for. Export the schedule (G-136) says the same line under the same switch. */
export function forWords(input: Pick<GanttPrintInput, 'for' | 'job'>): string {
  const c = input.job.customer
  if (input.for === 'team') return "Our team's copy names the companies and shows the spare days."
  const what = c.everyBar ? `${c.name} may see every bar. Their copy lists every bar by stage, as in their portal.` : `${c.name} reads the stages of the job, as in their portal. Their copy is those stages.`
  return `${what} It names no company and shows no spare days. The filters and folds do not change it.`
}

// ---------------------------------------------------------------------------------------------
// The whole print
// ---------------------------------------------------------------------------------------------

const COLUMN_W: Record<GanttPrintColumnKey, number> = { activity: 150, dates: 64, done: 26, plan: 26, stands: 62 }

const COLUMN_LABELS: Record<GanttPrintColumnKey, string> = { activity: 'Activity', dates: 'Dates', done: 'Done', plan: 'Plan', stands: 'Where it stands' }

/** Between the columns and the chart's lane. */
const LANE_GAP = 6

function columnsOf(keys: GanttPrintColumnKey[], first: string): GanttPrintColumn[] {
  let x = 0
  return keys.map((key) => {
    const col = { key, label: key === 'activity' ? first : COLUMN_LABELS[key], x, w: COLUMN_W[key] }
    x += COLUMN_W[key]
    return col
  })
}

function headLinesHeight(lines: string[]): number {
  return lines.reduce((h, l) => h + LINE_H * Math.max(1, Math.ceil((l.length * HEAD_CHAR_PT) / PRINT_PAGE.width)), 0)
}

function listsHeight(lists: { title: string; lines: string[] }[]): number {
  return lists.reduce((h, l) => h + LIST_TITLE_H + l.lines.reduce((s, line) => s + LIST_LINE_H * Math.max(1, Math.ceil((line.length * LIST_CHAR_PT) / PRINT_PAGE.width)), 0), 0)
}

function marksOf(rows: GanttPrintRow[], print: Pick<GanttPrint, 'copy' | 'axis' | 'lost' | 'lateSaid' | 'spare' | 'earlier' | 'links' | 'waitLinks'> & { milestones: readonly unknown[] }, page: number): GanttPrintMark[] {
  const used = new Set<GanttPrintMark>()
  for (const r of rows) {
    if (r.kind === 'group') used.add('group')
    if (r.kind === 'stage') used.add('stage')
    if (r.kind === 'wait') used.add('wait')
    if (r.kind === 'people') used.add('people')
    if (r.kind === 'people' && r.weeks.some((w) => w.short)) used.add('peopleShort')
    if (r.kind !== 'bar') continue
    const b = r.bar
    const a = b.item.activity
    if (b.status === 'done') used.add('done')
    else if (b.status === 'late' || b.status === 'failed') used.add('late')
    else if (b.hold) used.add('held')
    else if (a.inspection) used.add('inspection')
    else if (b.item.actual > 0) used.add('underway')
    else used.add('notStarted')
    if (!r.plain && b.tight) used.add('tight')
    if (!r.plain && b.moved && b.status !== 'done') used.add('baseline')
    if (!r.plain && a.actualStart) used.add('actual')
    if (!r.plain && b.coTail) used.add('coTail')
    const said = r.plain ? undefined : print.lateSaid.get(b.id)
    if (said && said.finish > a.finish) used.add('said')
    if (!r.plain && print.spare && spareTail(b)) used.add('spare')
    if (!r.plain && print.earlier.has(b.id)) used.add('earlier')
    if (!r.plain && (print.lost.get(b.id) ?? []).length > 0) used.add('lost')
    if (print.axis.window && (a.start < print.axis.first || a.finish > addDays(print.axis.first, print.axis.days - 1))) used.add('cut')
  }
  if (print.milestones.length > 0) used.add('milestone')
  if (print.links.some((l) => l.page === page) || print.waitLinks.some((l) => l.page === page)) used.add('link')
  if (print.axis.tint && print.axis.marked.some((d) => d.weekend)) used.add('weekend')
  if (print.axis.marked.some((d) => d.holiday)) used.add('holiday')
  used.add('today')
  const order: GanttPrintMark[] = ['done', 'underway', 'notStarted', 'tight', 'late', 'held', 'inspection', 'coTail', 'said', 'spare', 'earlier', 'wait', 'baseline', 'actual', 'group', 'stage', 'milestone', 'link', 'weekend', 'holiday', 'lost', 'cut', 'people', 'peopleShort', 'today']
  return order.filter((m) => used.has(m))
}

/**
 * The chart on paper. Our team's copy is the chart as the person has it; the customer's copies
 * are their portal's picture, whatever the chart shows.
 */
export function ganttPrint(input: GanttPrintInput): GanttPrint {
  const { job, today } = input
  const picture = job.customer
  const copy: GanttPrint['copy'] = input.for === 'team' ? 'team' : picture.everyBar ? 'everyBar' : 'stages'
  const shown = ganttFilter(input.bars, input.filters, input.company)
  const groups = ganttGroups(shown, input.by)
  const lookAhead = copy === 'team' && input.filters.soon
  const window = lookAhead ? lookAheadWindow(today) : null

  const columns =
    copy === 'stages'
      ? columnsOf(['activity', 'dates', 'done', 'stands'], 'Stage')
      : copy === 'everyBar'
        ? columnsOf(['activity', 'dates', 'done', 'stands'], 'Activity')
        : columnsOf(input.building ? ['activity', 'dates', 'done', 'plan', 'stands'] : ['activity', 'dates', 'stands'], 'Activity')
  const x0 = columns.reduce((w, c) => w + c.w, 0) + LANE_GAP
  const laneW = PRINT_PAGE.width - x0

  // The span: the bars shown and the dates to meet (`ganttAxis`), or the look-ahead's window.
  const milestones = copy === 'team' ? input.milestones : picture.milestones
  const spanBars = copy === 'team' ? shown : copy === 'everyBar' ? picture.fullChart.flatMap((g) => g.group.bars) : input.bars
  const span = window ? { first: window.first, days: daysBetween(window.first, window.last) + 1 } : ganttAxis(spanBars, milestones, today, 'weeks')
  const drawn = printAxis(span.first, span.days, x0, laneW, Boolean(window))
  // Weekends and holidays are a reading aid for our team; the customer's portal marks neither.
  const axis = copy === 'team' ? drawn : { ...drawn, marked: [], tint: false }
  const last = addDays(axis.first, axis.days - 1)
  const inWindow = (on: string) => on >= axis.first && on <= last

  const rows = copy === 'team' ? teamRows(input, shown) : copy === 'everyBar' ? everyBarRows(picture, input.building) : stageRows(picture)
  // People on site per week (G-84) under the last page's rows: our team's copy, while Show people on site is on (G-144).
  if (copy === 'team' && input.peopleOf && shown.length > 0) {
    const weeks = input.peopleOf(axis.first, last)
    if (weeks.length > 0) rows.push({ kind: 'people', weeks })
  }

  const titleWords = copy === 'team' ? (lookAhead ? 'the next 3 weeks' : 'the schedule') : 'your schedule'
  const asOf = `As of ${dayWords(today)}.`
  const headLines =
    copy === 'team'
      ? [
          `${job.place ? `${job.place}. ` : ''}For our team. ${asOf}`,
          job.finishWords,
          ...(job.finishLines ?? []),
          ...(job.doneWords ? [job.doneWords] : []),
          showsWords(input, shown, groups, window).slice(0, window ? -1 : undefined).join(' '),
          ...(window ? [`The page runs from ${weekdayDate(window.first)} to ${weekdayDate(window.last)}, a day at a time.`] : []),
        ]
      : [`For ${picture.name}. ${asOf}`, [picture.standing.finishWords, ...picture.contractDays].join(' '), ...(picture.doneWords ? [picture.doneWords] : [])]
  const lists = copy === 'team' ? [] : [{ title: 'What changed this week', lines: picture.changes.length > 0 ? picture.changes : [CUSTOMER_NOTHING_MOVED] }, ...(picture.asks.length > 0 ? [{ title: 'What we need from you', lines: picture.asks }] : [])]

  // The key's height: every page keeps room for the key the whole print would need.
  const lateSaid: ReadonlyMap<string, { finish: string; words: string }> = copy === 'team' ? (input.lateSaid ?? new Map()) : new Map()
  // Spare days are our team's: a customer never sees them.
  const spare = copy === 'team' && Boolean(input.spare)
  const earlier: ReadonlyMap<string, { start: string; finish: string; words: string }> = copy === 'team' ? (input.earlier ?? new Map()) : new Map()
  const keyMarks = marksOf(rows, { copy, axis, milestones, lost: input.lost, lateSaid, spare, earlier, links: input.links && copy === 'team' ? [{ from: '', to: '', critical: false, gap: 0, page: 0 }] : [], waitLinks: [] }, 0)
  const keyLines = Math.max(1, Math.ceil(keyMarks.reduce((w, m) => w + KEY_ENTRY_PT + keyWords(m, today).length * KEY_CHAR_PT, 0) / PRINT_PAGE.width))
  const keyH = keyLines * KEY_LINE_H + (copy === 'team' ? KEY_LINE_H : 0) + FOOT_H
  const ms = placeMilestones(axis.window ? milestones.filter((m) => inWindow(m.due)) : milestones, axis, PRINT_PAGE.width)
  const chartTop = PRINT_AXIS_H + (ms.placed.length > 0 ? milestonesHeight(ms.lines) : 0)
  const firstCap = PRINT_PAGE.height - (TITLE_H + headLinesHeight(headLines) + HEAD_GAP) - chartTop - keyH
  const nextCap = PRINT_PAGE.height - (RUNNING_H + HEAD_GAP) - chartTop - keyH
  const pages = printPages(rows, firstCap, nextCap)

  // The lists go under the last page's rows when they fit, else on a page of their own.
  const lastRows = pages[pages.length - 1] ?? []
  const lastCap = pages.length === 1 ? firstCap : nextCap
  const lastUsed = lastRows.reduce((h, r) => h + rowHeight(r), 0)
  const listsPage = lists.length > 0 && lastUsed + listsHeight(lists) + HEAD_GAP > lastCap

  // Where each bar landed, for the lines between them: both ends on one page, both rows drawn.
  const pageOf = new Map<string, number>()
  const waitPage = new Map<string, number>()
  pages.forEach((p, i) =>
    p.forEach((r) => {
      if (r.kind === 'bar') pageOf.set(r.bar.id, i)
      if (r.kind === 'wait') waitPage.set(r.row.wait.id, i)
    }),
  )
  const byId = new Map(shown.map((b) => [b.id, b]))
  const drawable = (id: string) => {
    const b = byId.get(id)
    return Boolean(b) && (!window || (b !== undefined && inWindow(b.item.activity.start) && inWindow(b.item.activity.finish)))
  }
  const links: GanttPrintLink[] =
    copy === 'team' && input.links
      ? ganttLinks(shown).flatMap((l) => {
          const page = pageOf.get(l.from)
          if (page === undefined || page !== pageOf.get(l.to) || !drawable(l.from) || !drawable(l.to)) return []
          return [{ from: l.from, to: l.to, critical: l.critical, gap: byId.get(l.to)?.item.activity.lag?.[l.from] ?? 0, page }]
        })
      : []
  const waitLinks =
    copy === 'team' && input.links
      ? input.waits.flatMap((w) =>
          w.state === 'done'
            ? []
            : w.holds.flatMap((h) => {
                const page = waitPage.get(w.wait.id)
                return page !== undefined && page === pageOf.get(h.lineId) && drawable(h.lineId) ? [{ wait: w.wait.id, to: h.lineId, late: w.late, page }] : []
              }),
        )
      : []

  const shows = [
    `${plural(pages.length + (listsPage ? 1 : 0), 'landscape page', 'landscape pages')}, letter size.`,
    ...(copy === 'team' ? showsWords(input, shown, groups, window) : []),
  ]
  const print: GanttPrint = {
    for: input.for,
    copy,
    lookAhead,
    title: copy === 'team' ? `${job.name}, ${titleWords}, ${shortDate(today)}, ${year(today)}` : `${job.name}, your schedule, for ${picture.name}, ${shortDate(today)}, ${year(today)}`,
    head: { title: `${job.name}: ${titleWords}`, company: job.company, lines: headLines },
    running: `${job.name}: ${titleWords}, as of ${dayWords(today)}. Continued.`,
    shows,
    forWords: forWords(input),
    columns,
    axis,
    today,
    milestones: ms.placed,
    milestoneLines: ms.lines,
    pages,
    links,
    waitLinks,
    lost: copy === 'team' ? input.lost : new Map(),
    lateSaid,
    spare,
    earlier,
    key: [],
    everyDay: copy === 'team' ? 'Every day is a working day, weekends and holidays too.' : null,
    lists,
    listsPage,
    foot: `Printed ${dayWords(today)} by ${job.by}, ${job.company}.`,
    empty: rows.length === 0 ? 'Nothing on the schedule passes these filters.' : null,
  }
  print.key = pages.map((p, i) => marksOf(p, print, i))
  return print
}

// ---------------------------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------------------------

/** The paper's inks: black and the greys for the page, the chart's saturated status colors for the bars. */
const P = {
  ink: '#1a1a1a',
  soft: '#4b5563',
  muted: '#6b7280',
  faint: '#9ca3af',
  rule: '#e5e7eb',
  line: '#cfd4db',
  strong: '#aab2bd',
  band: '#f3f4f6',
  white: '#ffffff',
  blue: '#3b82f6',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  violet: '#7c3aed',
  blueFill: '#dbeafe',
  blueTint: '#eff6ff',
  greenFill: '#bbf7d0',
  greenGhost: '#dcfce7',
  redTint: '#fef2f2',
  amberFill: '#fef3c7',
  violetFill: '#ede9fe',
  redInk: '#b91c1c',
  amberInk: '#92400e',
  greenInk: '#166534',
  blueInk: '#1e40af',
  violetInk: '#5b21b6',
} as const

const TONE_INK: Record<Tone, string> = { green: P.greenInk, red: P.redInk, amber: P.amberInk, blue: P.blueInk, grey: P.soft }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A rough width of a line of type, in points: enough to cut a name before it runs into the next column. */
function textWidth(s: string, size: number, bold = false): number {
  return s.length * size * (bold ? 0.56 : 0.52)
}

function fit(s: string, width: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= width) return s
  const n = Math.max(1, Math.floor(width / (size * (bold ? 0.56 : 0.52))) - 1)
  return `${s.slice(0, n).trimEnd()}…`
}

function n2(v: number): string {
  return String(Math.round(v * 100) / 100)
}

function text(x: number, y: number, words: string, opts: { size?: number; fill?: string; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; italic?: boolean } = {}): string {
  const attrs = [`x="${n2(x)}"`, `y="${n2(y)}"`, `font-size="${opts.size ?? 7}"`, `fill="${opts.fill ?? P.ink}"`]
  if (opts.bold) attrs.push('font-weight="700"')
  if (opts.italic) attrs.push('font-style="italic"')
  if (opts.anchor && opts.anchor !== 'start') attrs.push(`text-anchor="${opts.anchor}"`)
  return `<text ${attrs.join(' ')}>${esc(words)}</text>`
}

function rect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(0, w))}" height="${n2(h)}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`
}

function hline(x1: number, x2: number, y: number, stroke: string, width = 0.4): string {
  return `<line x1="${n2(x1)}" y1="${n2(y)}" x2="${n2(x2)}" y2="${n2(y)}" stroke="${stroke}" stroke-width="${width}"/>`
}

function vline(x: number, y1: number, y2: number, stroke: string, width = 0.4, extra = ''): string {
  return `<line x1="${n2(x)}" y1="${n2(y1)}" x2="${n2(x)}" y2="${n2(y2)}" stroke="${stroke}" stroke-width="${width}"${extra ? ` ${extra}` : ''}/>`
}

function diamond(cx: number, cy: number, r: number, fill: string): string {
  return `<path d="M${n2(cx)} ${n2(cy - r)} L${n2(cx + r)} ${n2(cy)} L${n2(cx)} ${n2(cy + r)} L${n2(cx - r)} ${n2(cy)} Z" fill="${fill}"/>`
}

/** How a bar looks for where it stands: the screen's `barLook`, on paper. A customer's bar has no red edge, since that edge is the spare days drawn. */
function barLook(b: GanttBar, plain: boolean): { fill: string; stroke: string; width: number; dash: string | null } {
  const edge = plain ? null : b.critical ? { stroke: P.red, width: 1.4 } : b.tight ? { stroke: P.red, width: 1.1 } : null
  if (b.status === 'done') return { fill: P.greenFill, stroke: P.green, width: 0.9, dash: null }
  if (b.status === 'failed') return { fill: P.redTint, stroke: P.red, width: 1.4, dash: null }
  if (b.hold) return { fill: 'url(#gp-held)', stroke: edge?.stroke ?? P.amber, width: edge?.width ?? 0.9, dash: null }
  if (b.item.activity.inspection) return { fill: P.violetFill, stroke: edge?.stroke ?? P.violet, width: edge?.width ?? 0.9, dash: '2 1.2' }
  if (b.status === 'late') return { fill: P.redTint, stroke: P.red, width: 1.4, dash: null }
  if (b.status === 'behind') return { fill: P.blueFill, stroke: edge?.stroke ?? P.amber, width: edge?.width ?? 0.9, dash: null }
  return { fill: b.item.actual > 0 ? P.blueFill : P.blueTint, stroke: edge?.stroke ?? P.blue, width: edge?.width ?? 0.9, dash: null }
}

const KEY_WORDS: Record<GanttPrintMark, string> = {
  done: 'done',
  underway: 'under way, the dark part is done',
  notStarted: 'not started',
  tight: '5 or fewer spare days, it sets the finish',
  late: 'late, or an inspection that failed',
  held: 'held, it waits on something',
  inspection: 'an inspection',
  coTail: 'days a signed change order adds, not on the dates yet',
  said: "a trade's new day from its portal, not on the dates yet",
  spare: 'its spare days, how long it can slip before the job finishes later',
  earlier: 'where it could start, now that the work before it finished early',
  wait: 'what the work waits on, from the day asked for to the day expected',
  baseline: 'where it sat in the plan at Start',
  actual: 'the days it really ran',
  group: 'a whole group as one bar',
  stage: 'a stage of the job, the dark part is done',
  milestone: 'a date the job must meet',
  link: 'a line, the work after waits on the work before',
  weekend: 'a weekend',
  holiday: 'a holiday',
  lost: 'a day lost to the weather',
  cut: 'it runs on past the edge of the page',
  people: "people on site, the plan's busiest day each week beside the daily log's",
  peopleShort: `a week the daily log fell ${SHORT_BY} or more people short of the plan`,
  today: 'today',
}

function keyWords(mark: GanttPrintMark, today: string): string {
  return mark === 'today' ? `today, ${weekdayDate(today)}` : KEY_WORDS[mark]
}

function keySwatch(mark: GanttPrintMark): string {
  const box = (fill: string, stroke: string, width = 0.9, dash = '') => `<rect x="0.5" y="1.5" width="15" height="6" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
  const inner = (() => {
    switch (mark) {
      case 'done':
        return box(P.greenFill, P.green)
      case 'underway':
        return `${box(P.blueFill, P.blue)}${rect(0.5, 1.5, 8, 6, P.blue, 'opacity="0.85"')}`
      case 'notStarted':
        return box(P.blueTint, P.blue)
      case 'tight':
        return box(P.blueTint, P.red, 1.4)
      case 'late':
        return box(P.redTint, P.red, 1.4)
      case 'held':
        return box('url(#gp-held)', P.amber)
      case 'inspection':
        return box(P.violetFill, P.violet, 0.9, '2 1.2')
      case 'coTail':
        return box('url(#gp-tail)', P.violet, 0.9, '2 1.2')
      case 'said':
        return box(P.white, P.amber, 0.9, '2 1.2')
      case 'earlier':
        return box(P.greenGhost, P.green, 0.9, '2 1.2')
      case 'spare':
        return `${rect(0.5, 6, 14, 1.6, P.blue, 'opacity="0.35"')}${vline(14.5, 4.5, 8, P.blue, 0.9, 'opacity="0.75"')}`
      case 'wait':
        return `<rect x="0.5" y="2.5" width="15" height="4" rx="2" fill="${P.violetFill}" stroke="${P.violet}" stroke-width="0.9"/>`
      case 'baseline':
        return rect(0.5, 5, 15, 1.4, P.strong)
      case 'actual':
        return rect(0.5, 3, 15, 1.4, P.green)
      case 'group':
        return `${rect(0.5, 2.5, 15, 4, P.strong, 'rx="1.5"')}${rect(0.5, 2.5, 9, 4, P.soft, 'rx="1.5"')}`
      case 'stage':
        return `${box(P.blueTint, P.blue)}${rect(0.5, 1.5, 9, 6, P.blue, 'opacity="0.7"')}`
      case 'milestone':
        return diamond(8, 4.5, 3.4, P.muted)
      case 'link':
        return `<path d="M1 4.5 H13 l-3 -2 m3 2 l-3 2" fill="none" stroke="${P.muted}" stroke-width="0.8"/>`
      case 'weekend':
        return `<rect x="4" y="0.5" width="8" height="8" fill="${P.band}" stroke="${P.line}" stroke-width="0.5"/>`
      case 'holiday':
        return rect(4, 3, 8, 3, P.amber, 'rx="1"')
      case 'lost':
        return `${box(P.blueFill, P.blue)}<rect x="6" y="1.5" width="3" height="6" fill="url(#gp-lost)"/>`
      case 'cut':
        return `<path d="M2 4.5 L6 1.5 L6 7.5 Z M14 4.5 L10 1.5 L10 7.5 Z" fill="${P.soft}"/>`
      case 'people':
        return `<rect x="2" y="3" width="5" height="5.5" rx="0.8" fill="${P.white}" stroke="${P.muted}" stroke-width="0.7"/>${rect(9, 1, 5, 7.5, P.blue, 'rx="0.8" opacity="0.85"')}`
      case 'peopleShort':
        return `<rect x="2" y="1" width="5" height="7.5" rx="0.8" fill="${P.white}" stroke="${P.muted}" stroke-width="0.7"/>${rect(9, 4, 5, 4.5, P.amber, 'rx="0.8" opacity="0.85"')}`
      case 'today':
        return vline(8, 0.5, 8.5, P.blue, 1.2)
    }
  })()
  return `<svg width="16" height="9" viewBox="0 0 16 9" aria-hidden="true">${inner}</svg>`
}

/** One page's chart: the column heads and months, the dates to meet, the rows, the lines and today. */
function chartSvg(p: GanttPrint, rows: GanttPrintRow[], page: number): string {
  const { axis } = p
  const W = PRINT_PAGE.width
  const ms = p.milestones.length > 0 ? milestonesHeight(p.milestoneLines) : 0
  const top = PRINT_AXIS_H + ms
  const height = top + rows.reduce((h, r) => h + rowHeight(r), 0) + (p.empty ? PRINT_ROW * 2 : 0)
  const x = (on: string) => axis.x0 + daysBetween(axis.first, on) * axis.ptPerDay
  const dayW = axis.ptPerDay
  const lastDay = addDays(axis.first, axis.days - 1)
  const out: string[] = []
  const clip = `gp-lane-${page}`
  out.push(`<defs><clipPath id="${clip}"><rect x="${n2(axis.x0)}" y="0" width="${n2(W - axis.x0)}" height="${n2(height)}"/></clipPath></defs>`)

  // Behind the rows: weekends and holidays, and the months' lines.
  const behind: string[] = []
  for (const d of axis.marked) {
    if (d.holiday) behind.push(rect(axis.x0 + d.at * dayW, top, Math.max(dayW, 0.8), height - top, P.amberFill, 'opacity="0.7"'))
    else if (axis.tint) behind.push(rect(axis.x0 + d.at * dayW, top, dayW, height - top, P.band, 'opacity="0.8"'))
  }
  for (const mo of axis.months) behind.push(vline(axis.x0 + mo.at * dayW, 0, height, P.line, 0.5))
  out.push(`<g clip-path="url(#${clip})">${behind.join('')}</g>`)

  // The column heads.
  for (const c of p.columns) {
    const right = c.key === 'done' || c.key === 'plan'
    out.push(text(right ? c.x + c.w - 3 : c.x + 2, PRINT_AXIS_H - 5, c.label, { size: 6.5, bold: true, fill: P.soft, anchor: right ? 'end' : 'start' }))
  }
  // The months and the day marks.
  const head: string[] = []
  for (const mo of axis.months) {
    const room = mo.days * dayW
    const label = room > 64 ? mo.label : room > 24 ? mo.label.slice(0, 3) : ''
    if (label) head.push(text(axis.x0 + mo.at * dayW + 3, 9, label, { size: 7, bold: true, fill: P.soft }))
  }
  const todayX = x(p.today) + dayW / 2
  for (const t of axis.ticks) {
    const tx = axis.x0 + t.at * dayW
    if (Math.abs(tx - todayX) < 12) continue
    if (axis.scale === 'days') {
      head.push(text(tx + dayW / 2, 17.5, t.label, { size: 6, anchor: 'middle', bold: t.strong, fill: P.soft }))
      if (t.letter) head.push(text(tx + dayW / 2, 24, t.letter, { size: 5, anchor: 'middle', fill: P.faint }))
    } else {
      head.push(vline(tx, 11, 14, P.strong, 0.5))
      head.push(text(tx + 1.5, 20, t.label, { size: 6, bold: t.strong, fill: P.soft }))
    }
  }
  for (const d of axis.marked) if (d.holiday) head.push(rect(axis.x0 + d.at * dayW + dayW / 2 - 2.5, PRINT_AXIS_H - 3, 5, 2.5, P.amber, 'rx="1"'))
  if (p.today >= axis.first && p.today <= lastDay) {
    head.push(`<rect x="${n2(todayX - 11)}" y="12.5" width="22" height="8.5" rx="4.25" fill="${P.blue}"/>`)
    head.push(text(todayX, 19, 'today', { size: 5.5, bold: true, fill: P.white, anchor: 'middle' }))
  }
  out.push(`<g clip-path="url(#${clip})">${head.join('')}</g>`)
  out.push(hline(0, W, PRINT_AXIS_H, P.strong, 0.6))

  // The dates the job must meet, each on the line `placeMilestones` gave it.
  if (ms > 0) {
    out.push(text(2, PRINT_AXIS_H + 14, p.copy === 'team' ? 'Dates the job must meet' : 'Dates to meet', { size: 6.5, bold: true }))
    for (const m of p.milestones) {
      const r = m.row
      const color = m.late ? P.red : r.state === 'hit' ? P.green : P.muted
      const ink = m.late ? P.redInk : r.state === 'hit' ? P.greenInk : P.soft
      const cx = x(r.due) + dayW / 2
      const cy = PRINT_AXIS_H + 7 + m.line * MS_LINE_H
      out.push(diamond(cx, cy, 3.2, color))
      out.push(text(m.right ? cx + 5 : cx - 5, cy + 2.2, m.words, { size: 6, fill: ink, bold: m.late, anchor: m.right ? 'start' : 'end' }))
    }
  }

  // The rows.
  const at = new Map<string, number>()
  const waitAt = new Map<string, { y: number; x: number }>()
  let y = top
  const lane: string[] = []
  const cells: string[] = []
  const colX = (key: GanttPrintColumnKey) => p.columns.find((c) => c.key === key)
  let h = PRINT_ROW
  const rowY = (size: number) => h / 2 + size * 0.36
  const cell = (key: GanttPrintColumnKey, words: string, opts: { fill?: string; bold?: boolean; size?: number } = {}) => {
    const c = colX(key)
    if (!c || !words) return
    const right = key === 'done' || key === 'plan'
    const size = opts.size ?? (key === 'activity' ? 7 : 6.5)
    cells.push(text(right ? c.x + c.w - 3 : c.x + 2, y + rowY(size), fit(words, c.w - 5, size, opts.bold), { size, fill: opts.fill ?? P.ink, bold: opts.bold ?? false, anchor: right ? 'end' : 'start' }))
  }
  for (const r of rows) {
    h = rowHeight(r)
    cells.push(hline(0, W, y, P.rule))
    if (r.kind === 'group' || r.kind === 'waits') cells.push(rect(0, y, W, h, P.band))
    if (r.kind === 'waits') {
      cell('activity', `What the work waits on${r.continued ? ', continued' : ''}`, { bold: true })
    } else if (r.kind === 'wait') {
      const wt = r.row.wait
      const name = p.copy === 'team' && r.who ? `${wt.title}, ${r.who}` : wt.title
      const c = colX('activity')
      if (c) cells.push(text(c.x + 10, y + rowY(7), fit(name, c.w - 13, 7), { size: 7 }))
      const from = wt.askedOn ?? (p.today < wt.expectedOn ? p.today : wt.expectedOn)
      const to = wt.doneOn ?? wt.expectedOn
      const start = from < to ? from : to
      const end = from < to ? to : from
      cell('dates', start === end ? shortDate(start) : `${shortDate(start)} to ${shortDate(end)}`, { fill: P.soft })
      cell('stands', r.row.stateWords, { fill: TONE_INK[r.row.tone] })
      const color = r.row.state === 'done' ? P.green : r.row.late ? P.red : P.violet
      lane.push(`<rect x="${n2(x(start))}" y="${n2(y + h / 2 - 2.5)}" width="${n2(Math.max(dayW, (daysBetween(start, end) + 1) * dayW))}" height="5" rx="2.5" fill="${r.row.state === 'done' ? P.greenFill : P.violetFill}" stroke="${color}" stroke-width="0.9"${wt.askedOn ? '' : ' stroke-dasharray="2 1.2"'}/>`)
      if (wt.askedOn) lane.push(`<circle cx="${n2(x(wt.askedOn) + dayW / 2)}" cy="${n2(y + h / 2)}" r="1.8" fill="${color}"/>`)
      if (wt.shippedOn) lane.push(`<path d="M${n2(x(wt.shippedOn) + dayW / 2)} ${n2(y + h / 2 - 2.2)} l2 3.6 h-4 Z" fill="${color}"/>`)
      lane.push(wt.doneOn ? rect(x(wt.doneOn) + dayW / 2 - 1.8, y + h / 2 - 1.8, 3.6, 3.6, color) : diamond(x(wt.expectedOn) + dayW / 2, y + h / 2, 2.4, color))
      if (r.row.neededBy && r.row.state !== 'done') lane.push(vline(x(r.row.neededBy), y + 2, y + h - 2, r.row.late ? P.red : P.violet, 1))
      waitAt.set(wt.id, { y: y + h / 2, x: x(to) + dayW })
    } else if (r.kind === 'group') {
      const c = colX('activity')
      if (c) {
        const title = `${r.folded ? '▸' : '▾'} ${r.title}${r.continued ? ', continued' : ''}`
        const tw = Math.min(textWidth(title, 7, true), c.w - 6)
        cells.push(text(c.x + 2, y + rowY(7), fit(title, c.w - 6, 7, true), { size: 7, bold: true }))
        if (r.now) cells.push(text(c.x + 4 + tw + 3, y + rowY(6), 'now', { size: 6, bold: true, fill: P.blueInk }))
        else if (r.sub && c.w - tw - 10 > 20) cells.push(text(c.x + 4 + tw + 3, y + rowY(6.5), fit(r.sub, c.w - tw - 10, 6.5), { size: 6.5, fill: P.muted }))
      }
      cell('dates', `${shortDate(r.start)} to ${shortDate(r.finish)}`, { fill: P.soft })
      if (r.pct !== null) cell('done', `${Math.round(r.pct)}%`, { bold: true })
      cell('stands', r.stands, { fill: TONE_INK[r.tone] })
      const gx = x(r.start)
      const gw = (daysBetween(r.start, r.finish) + 1) * dayW
      const gh = r.folded ? 5 : 3.5
      lane.push(rect(gx, y + (h - gh) / 2, gw, gh, P.strong, 'rx="1.5"'))
      if (r.pct !== null && r.pct > 0) lane.push(rect(gx, y + (h - gh) / 2, (gw * Math.min(100, r.pct)) / 100, gh, r.pct >= 100 ? P.green : P.soft, 'rx="1.5"'))
    } else if (r.kind === 'stage') {
      const s = r.stage
      cell('activity', s.label)
      cell('dates', `${shortDate(s.start)} to ${shortDate(s.finish)}`, { fill: P.soft })
      cell('done', `${Math.round(s.pct)}%`)
      cell('stands', r.stands, { fill: s.state === 'behind' ? P.amberInk : s.state === 'done' ? P.greenInk : P.soft })
      const color = s.state === 'done' ? P.green : s.state === 'behind' ? P.amber : P.blue
      const sx = x(s.start)
      const sw = (daysBetween(s.start, s.finish) + 1) * dayW
      lane.push(`<rect x="${n2(sx)}" y="${n2(y + 3)}" width="${n2(sw)}" height="${n2(h - 6)}" rx="1.5" fill="${s.state === 'done' ? P.greenFill : P.blueTint}" stroke="${color}" stroke-width="0.9"/>`)
      if (s.pct > 0 && s.state !== 'done') lane.push(rect(sx, y + 3, (sw * Math.min(100, s.pct)) / 100, h - 6, color, 'opacity="0.7" rx="1.5"'))
    } else if (r.kind === 'people') {
      // People on site per week (G-144), as the strip under the chart: the plan's busiest day outlined,
      // the daily log's filled beside it, amber when short, the numbers over them where a week has room.
      cells.push(hline(0, W, y, P.strong, 0.6))
      const c = colX('activity')
      if (c) {
        cells.push(text(c.x + 2, y + 11, 'People on site', { size: 7, bold: true }))
        cells.push(text(c.x + 2, y + 20, 'the plan, then the daily log', { size: 6, fill: P.muted }))
      }
      const most = Math.max(1, ...r.weeks.map((w) => Math.max(w.planned.count, w.logged?.count ?? 0)))
      const weekW = 7 * dayW
      const barW = Math.max(1.2, Math.min(8, weekW * 0.28))
      const foot = y + h - 3
      const tall = (n: number) => (n > 0 ? Math.max(1, (n / most) * PEOPLE_BAR_H) : 0)
      // The numbers print when the widest fits in half a week, so two never run together.
      const numbers = weekW / 2 >= textWidth(String(most), 5.5, true) + 1
      for (const w of r.weeks) {
        // The plan on the week's first half, the log on its second, each number over its bar.
        const planMid = x(w.weekOf) + weekW * 0.25
        const logMid = x(w.weekOf) + weekW * 0.75
        // A faint line at each Monday, as the screen's strip, so a week's two numbers read as a pair.
        const parts: string[] = [vline(x(w.weekOf), y + 1, y + h - 1, P.rule, 0.5)]
        const ph = tall(w.planned.count)
        const lh = w.logged ? tall(w.logged.count) : 0
        if (ph > 0) parts.push(`<rect x="${n2(planMid - barW / 2)}" y="${n2(foot - ph)}" width="${n2(barW)}" height="${n2(ph)}" rx="0.8" fill="${P.white}" stroke="${P.muted}" stroke-width="0.7"/>`)
        if (lh > 0) parts.push(rect(logMid - barW / 2, foot - lh, barW, lh, w.short ? P.amber : P.blue, 'rx="0.8" opacity="0.85"'))
        if (numbers) {
          parts.push(text(planMid, y + 7.5, String(w.planned.count), { size: 5.5, fill: P.soft, anchor: 'middle' }))
          if (w.logged) parts.push(text(logMid, y + 7.5, String(w.logged.count), { size: 5.5, bold: true, fill: w.short ? P.amberInk : P.blueInk, anchor: 'middle' }))
        }
        lane.push(`<g data-people="${w.weekOf}" data-planned="${w.planned.count}" data-logged="${w.logged?.count ?? ''}">${parts.join('')}</g>`)
      }
    } else {
      const b = r.bar
      const a = b.item.activity
      at.set(b.id, y + h / 2)
      const c = colX('activity')
      if (c) cells.push(text(c.x + 10, y + rowY(7), fit(b.item.label, c.w - 13, 7), { size: 7 }))
      cell('dates', a.start === a.finish ? shortDate(a.start) : `${shortDate(a.start)} to ${shortDate(a.finish)}`, { fill: P.soft })
      cell('done', r.done)
      cell('plan', r.plan, { fill: P.soft })
      cell('stands', r.stands, { fill: TONE_INK[r.tone] })
      const bx = x(a.start)
      const bw = Math.max(dayW, (daysBetween(a.start, a.finish) + 1) * dayW)
      const by = y + 3
      const bh = h - 6
      const look = barLook(b, r.plain)
      if (!r.plain && a.actualStart) {
        const end = a.actualFinish ?? (p.today > a.actualStart ? p.today : a.actualStart)
        lane.push(rect(x(a.actualStart), y + 1, Math.max(dayW, (daysBetween(a.actualStart, end) + 1) * dayW), 1.4, P.green, a.actualFinish ? '' : 'opacity="0.6"'))
      }
      // Where it could start now that the work before it finished early (G-37): the chart's green ghost, behind the bar.
      const soon = r.plain ? undefined : p.earlier.get(b.id)
      if (soon) lane.push(`<rect data-earlier="${esc(b.id)}" x="${n2(x(soon.start))}" y="${n2(by)}" width="${n2(Math.max(dayW, (daysBetween(soon.start, soon.finish) + 1) * dayW))}" height="${n2(bh)}" rx="1.5" fill="${P.greenGhost}" stroke="${P.green}" stroke-width="0.9" stroke-dasharray="2 1.2" opacity="0.8"/>`)
      if (!r.plain && b.moved && b.status !== 'done') lane.push(rect(x(b.item.baseline.start), y + h - 2.4, (daysBetween(b.item.baseline.start, b.item.baseline.finish) + 1) * dayW, 1.4, P.strong))
      lane.push(`<rect x="${n2(bx)}" y="${n2(by)}" width="${n2(bw)}" height="${n2(bh)}" rx="1.5" fill="${look.fill}" stroke="${look.stroke}" stroke-width="${look.width}"${look.dash ? ` stroke-dasharray="${look.dash}"` : ''}/>`)
      if (b.item.actual > 0 && b.status !== 'done') lane.push(rect(bx, by, (bw * Math.min(100, b.item.actual)) / 100, bh, P.blue, 'opacity="0.85" rx="1.5"'))
      for (const d of r.plain ? [] : (p.lost.get(b.id) ?? [])) lane.push(rect(x(d.date), by, Math.max(1.2, dayW), bh, 'url(#gp-lost)'))
      // Its spare days (G-08): a faint line at the bar's foot to the last day it can finish, under the other tails.
      const st = p.spare && !r.plain ? spareTail(b) : null
      if (st) {
        const sx = x(st.from)
        lane.push(`<rect data-spare="${esc(b.id)}" x="${n2(sx)}" y="${n2(by + bh)}" width="${n2(st.days * dayW)}" height="1.6" fill="${P.blue}" opacity="0.35"/>`)
        lane.push(vline(sx + st.days * dayW, by + bh - 1.5, by + bh + 2, P.blue, 0.9, 'opacity="0.75"'))
      }
      const tailW = !r.plain && b.coTail ? b.coTail.days * dayW : 0
      if (tailW > 0) lane.push(`<rect x="${n2(bx + bw)}" y="${n2(by)}" width="${n2(tailW)}" height="${n2(bh)}" fill="url(#gp-tail)" stroke="${P.violet}" stroke-width="0.8" stroke-dasharray="2 1.2"/>`)
      // A trade's own new finish from its portal (G-117): an amber dashed tail out to it, as on the chart.
      const said = r.plain ? undefined : p.lateSaid.get(b.id)
      const saidW = said && said.finish > a.finish ? daysBetween(a.finish, said.finish) * dayW : 0
      if (saidW > 0) lane.push(`<rect x="${n2(bx + bw)}" y="${n2(by)}" width="${n2(saidW)}" height="${n2(bh)}" fill="none" stroke="${P.amber}" stroke-width="0.9" stroke-dasharray="2 1.2"/>`)
      if (!r.plain && a.notBefore) lane.push(vline(x(a.notBefore), y + 2, y + h - 2, P.violet, 1))
      if (!r.plain && a.mustFinishBy) lane.push(vline(x(a.mustFinishBy) + dayW, y + 2, y + h - 2, a.finish > a.mustFinishBy ? P.red : P.violet, 1))
      if (axis.window && a.start < axis.first) lane.push(`<path d="M${n2(axis.x0 + 1)} ${n2(y + h / 2)} l3.5 -3 v6 Z" fill="${P.soft}"/>`)
      if (axis.window && a.finish > lastDay) lane.push(`<path d="M${n2(W - 1)} ${n2(y + h / 2)} l-3.5 -3 v6 Z" fill="${P.soft}"/>`)
      if (r.note) {
        const after = Math.min(bx + bw + Math.max(tailW, saidW), W) + 4
        const room = W - after
        const words = r.note.words
        if (textWidth(words, 6) <= room || bx - axis.x0 < textWidth(words, 6) + 4) lane.push(text(after, y + rowY(6), fit(words, Math.max(room, 30), 6), { size: 6, fill: r.note.ink }))
        else lane.push(text(bx - 4, y + rowY(6), words, { size: 6, fill: r.note.ink, anchor: 'end' }))
      }
    }
    y += h
  }
  if (p.empty) cells.push(text(2, y + PRINT_ROW, p.empty, { size: 7.5, fill: P.muted }))
  out.push(cells.join(''))

  // The lines between bars, then what the work waits on to the work it holds.
  const lines: string[] = []
  for (const l of p.links.filter((k) => k.page === page)) {
    const y1 = at.get(l.from)
    const y2 = at.get(l.to)
    const from = rows.find((r): r is Extract<GanttPrintRow, { kind: 'bar' }> => r.kind === 'bar' && r.bar.id === l.from)?.bar
    const to = rows.find((r): r is Extract<GanttPrintRow, { kind: 'bar' }> => r.kind === 'bar' && r.bar.id === l.to)?.bar
    if (y1 === undefined || y2 === undefined || !from || !to) continue
    const x2 = x(from.item.activity.finish) + dayW
    const x1 = x(to.item.activity.start) - 1
    lines.push(`<path d="${linkPath(x2, y1, x1, y2, PRINT_ROW)}" fill="none" stroke="${l.critical ? P.red : P.muted}" stroke-width="${l.critical ? 0.9 : 0.6}" stroke-linejoin="round" opacity="0.85"/>`)
    if (l.gap > 0) lines.push(text(x2 + 3, y1 - 2, `+${l.gap}`, { size: 5.5, fill: P.muted }))
  }
  for (const l of p.waitLinks.filter((k) => k.page === page)) {
    const w = waitAt.get(l.wait)
    const y2 = at.get(l.to)
    const to = rows.find((r): r is Extract<GanttPrintRow, { kind: 'bar' }> => r.kind === 'bar' && r.bar.id === l.to)?.bar
    if (!w || y2 === undefined || !to) continue
    lines.push(`<path d="${linkPath(w.x, w.y, x(to.item.activity.start) - 1, y2, PRINT_ROW)}" fill="none" stroke="${l.late ? P.red : P.violet}" stroke-width="0.7" stroke-dasharray="2.5 1.5" stroke-linejoin="round" opacity="0.85"/>`)
  }
  out.push(`<g clip-path="url(#${clip})">${lane.join('')}${lines.join('')}</g>`)

  // Today, over everything.
  if (p.today >= axis.first && p.today <= lastDay) out.push(vline(todayX, PRINT_AXIS_H, height, P.blue, 1, 'opacity="0.75"'))
  return `<svg class="chart" width="${PRINT_PAGE.width}pt" height="${n2(height)}pt" viewBox="0 0 ${PRINT_PAGE.width} ${n2(height)}" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`
}

const CSS = `
@page { size: letter landscape; margin: 0.4in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${P.white}; color: ${P.ink}; }
body { font: 8pt/1.35 -apple-system, "Segoe UI", system-ui, Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 10.2in; height: 7.65in; overflow: hidden; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
.page:last-of-type { break-after: auto; page-break-after: auto; }
.top { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
h1 { font-size: 13pt; margin: 0 0 2pt; }
.co { font-size: 8pt; color: ${P.soft}; white-space: nowrap; }
.head p { margin: 0; line-height: 11pt; }
.head, .running { margin-bottom: 6pt; }
.running { color: ${P.soft}; line-height: 14pt; }
svg.chart { display: block; }
svg.chart text { font-family: inherit; }
.lists { margin-top: 6pt; }
.lists h2 { font-size: 8pt; margin: 4pt 0 1pt; }
.lists p { margin: 0; font-size: 7.5pt; line-height: 10.5pt; }
.foot { margin-top: auto; font-size: 6.5pt; color: ${P.soft}; }
.key { display: flex; flex-wrap: wrap; gap: 1pt 9pt; line-height: 9pt; }
.key span { display: inline-flex; align-items: center; gap: 3pt; white-space: nowrap; }
.line { display: flex; justify-content: space-between; line-height: 10pt; }
@media screen {
  html, body { background: #d1d5db; }
  body { padding: 16px; }
  .page { width: 11in; height: 8.5in; padding: 0.4in; margin: 0 auto 16px; background: ${P.white}; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18); }
}
`

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>
<pattern id="gp-held" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect width="4" height="4" fill="${P.white}"/><rect width="2" height="4" fill="${P.amberFill}"/><rect x="1.6" width="0.5" height="4" fill="${P.amber}" opacity="0.6"/></pattern>
<pattern id="gp-tail" patternUnits="userSpaceOnUse" width="3.5" height="3.5" patternTransform="rotate(45)"><rect width="3.5" height="3.5" fill="${P.white}"/><rect width="1.6" height="3.5" fill="${P.violetFill}"/></pattern>
<pattern id="gp-lost" patternUnits="userSpaceOnUse" width="2" height="2"><rect width="1" height="2" fill="${P.ink}" opacity="0.55"/></pattern>
</defs></svg>`

/** The pages as one document, light whatever the app's theme, letter landscape. */
export function ganttPrintHtml(p: GanttPrint): string {
  const total = p.pages.length + (p.listsPage ? 1 : 0)
  const listsHtml = p.lists.length > 0 ? `<div class="lists">${p.lists.map((l) => `<h2>${esc(l.title)}</h2>${l.lines.map((line) => `<p>${esc(line)}</p>`).join('')}`).join('')}</div>` : ''
  const foot = (n: number, marks: GanttPrintMark[]) =>
    `<footer class="foot"><div class="key">${marks.map((m) => `<span>${keySwatch(m)}${esc(keyWords(m, p.today))}</span>`).join('')}</div>${p.everyDay ? `<div class="line"><span>${esc(p.everyDay)}</span></div>` : ''}<div class="line"><span>${esc(p.foot)}</span><span>Page ${n} of ${total}</span></div></footer>`
  const head = (i: number) =>
    i === 0
      ? `<header class="head"><div class="top"><h1>${esc(p.head.title)}</h1><span class="co">${esc(p.head.company)}</span></div>${p.head.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</header>`
      : `<header class="running">${esc(p.running)}</header>`
  const pages = p.pages.map((rows, i) => {
    const last = i === p.pages.length - 1
    return `<section class="page">${head(i)}${chartSvg(p, rows, i)}${last && !p.listsPage ? listsHtml : ''}${foot(i + 1, p.key[i] ?? [])}</section>`
  })
  if (p.listsPage) pages.push(`<section class="page">${head(p.pages.length)}${listsHtml}${foot(total, [])}</section>`)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>${CSS}</style></head><body>${DEFS}${pages.join('')}</body></html>`
}
