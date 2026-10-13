/**
 * Papers on this job (BUILD_PLAN.md cut 4, the prototype's v1.176, `job-papers-mockups.html` B), lifted from
 * `paperCell`, `jobPaperCounts`, `jobPapersHtml` and `jobStripHtml` in `to-dos/gc-mode/messages/prototype.html` on
 * spike/gc-mode (v1.178): a row per company on the job, a column per paper in the flow's order, a dot per cell;
 * the counts in the title as pills that filter; and the strip before the job's day, Before bid day on a bid and
 * Before bill day on a job being billed. Pure: each cell reads flows/state.ts's paper reading for this job.
 */
import { INSURANCE_ASK_DAYS } from '../gc/promises'
import { daysUntil, shortDate, weekdayDate } from '../gc/words'
import { boardLines, dueWords, type BoardCompany, type BoardContext } from './board'
import { factForPaper, type FlowKind, type PaperId } from './facts'
import { flat, type FlowDef, type PaperReading, type StepPlace, type Who } from './state'

/** A company on the job, with each paper read for this job. */
export interface JobPaperCompany extends BoardCompany {
  kind: FlowKind
  /** By paper: flows/state.ts's paperRead for this job; null or missing when no step on its flow turns on the paper. */
  reads: Readonly<Partial<Record<PaperId, PaperReading | null>>>
}

export interface JobPapersInput {
  jobId: string
  /** The flows by kind. The columns are each flow's papers in its steps' order. */
  flows: Partial<Record<FlowKind, FlowDef>>
  companies: readonly JobPaperCompany[]
  today: string
  /** Each step's usual, for the compare that has sat too long. */
  usual: BoardContext['usual']
  firstNames: BoardContext['firstNames']
  jobs: BoardContext['jobs']
  /** Days before a paper runs out that it reads as running out soon, by paper; the renewal ask's 30 otherwise. */
  soonDays?: Readonly<Record<string, number>>
  /** Column words for a paper the flow editor added, by paper. */
  labels?: Readonly<Record<string, string>>
}

/** A column's word, shorter than the paper's label: "Insurance", not "Insurance certificate". */
const COLUMN_WORDS: Partial<Record<FlowKind, Readonly<Partial<Record<PaperId, string>>>>> = {
  trade: { invitation: 'Invitation', w9: 'W-9', coi: 'Insurance', msa: 'MSA', quote: 'Quote', sow: 'SOW', waiver: 'Waivers', final_waiver: 'Final waiver' },
  customer: { msa: 'Agreement', bid: 'Bid', contract: 'Contract', schedule: 'Schedule', payapp: 'Pay apps', co: 'Changes' },
  arch: { plans: 'Plans', addendum: 'Addenda', submittal: 'Submittals', certificate: 'Certificates' },
}

export interface GridColumn {
  paper: PaperId
  label: string
  /** The first step that turns on the paper. */
  stepId: string
  who: Who
  ours: boolean
}

/** A flow's columns: every paper its steps turn on, in the steps' order, the final waiver included. */
export function gridColumns(flow: FlowDef, labels: Readonly<Record<string, string>> = {}): GridColumn[] {
  const seen = new Set<PaperId>()
  const out: GridColumn[] = []
  for (const s of flat(flow)) {
    for (const paper of s.papers) {
      if (seen.has(paper)) continue
      seen.add(paper)
      out.push({ paper, label: COLUMN_WORDS[flow.kind]?.[paper] ?? labels[paper] ?? paper, stepId: s.id, who: s.who, ours: !!factForPaper(paper)?.ours })
    }
  }
  return out
}

/**
 * A cell: done with its day, waiting on them, none yet, late, runs out soon, lapsed, or later in the flow. Late and
 * runs out soon are both orange; the screen's legend says "late, or runs out soon".
 */
export type CellMark = 'done' | 'waiting' | 'none' | 'late' | 'soon' | 'lapsed' | 'later'

/** What a press on a cell does: open the paper, ask for it or send it, remind them, or nothing yet. */
export type CellPress = 'open' | 'ask' | 'send' | 'remind' | null

export interface PaperCell {
  paper: PaperId
  stepId: string | null
  mark: CellMark
  /** Under the dot: "Sep 12", "late 2 days", "runs out Oct 20", "their move". */
  words: string
  /** The hover's middle line. */
  tip: string
  lateDays: number
  press: CellPress
}

const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? '' : 's'}`

/** One cell, for one company on one job. `place` is the company's place on the cell's step on this job, for its day. */
export function paperCell(col: GridColumn, read: PaperReading | null | undefined, place: StepPlace | null, today: string, soonDays = INSURANCE_ASK_DAYS): PaperCell {
  const base = { paper: col.paper, stepId: read?.stepId ?? col.stepId, lateDays: 0 }
  const getIt: CellPress = col.ours ? 'send' : 'ask'
  if (!read) return { ...base, stepId: null, mark: 'later', words: '', tip: 'not on this flow', press: null }
  const late = place?.lateDays != null && place.lateDays > 0 ? place.lateDays : 0
  const lateCell = (tip: string): PaperCell => ({ ...base, mark: 'late', words: `late ${plural(late, 'day')}`, tip, lateDays: late, press: 'remind' })
  if (read.mark === 'bad') {
    const day = read.expires ?? read.on
    return { ...base, mark: 'lapsed', words: 'ran out', tip: day ? `ran out ${weekdayDate(day)}` : 'ran out', press: getIt }
  }
  if (read.mark === 'ok') {
    if (read.expires && daysUntil(read.expires, today) <= soonDays) return { ...base, mark: 'soon', words: `runs out ${shortDate(read.expires)}`, tip: `current, runs out ${weekdayDate(read.expires)}`, press: getIt }
    return { ...base, mark: 'done', words: read.on ? shortDate(read.on) : 'done', tip: read.on ? `on file since ${weekdayDate(read.on)}` : 'on file', press: 'open' }
  }
  if (read.mark === 'wait') {
    if (late) return lateCell(`went, and it is late ${plural(late, 'day')}`)
    // A day still ahead says the most: an asked quote due Thu reads "due Thu", not how long since it was asked.
    const words = place?.due ? `due ${dueWords(place.due, today)}` : read.on ? `${-daysUntil(read.on, today)} d` : 'waiting'
    return { ...base, mark: 'waiting', words, tip: read.on ? `went ${weekdayDate(read.on)}, waiting on them` : 'waiting on them', press: 'remind' }
  }
  if (read.stepState === 'now') {
    if (late) return lateCell(`their move, late ${plural(late, 'day')}`)
    const ours = col.who === 'us'
    const words = place?.due ? `due ${dueWords(place.due, today)}` : ours ? 'ours' : 'their move'
    return { ...base, mark: 'waiting', words, tip: ours ? 'our move' : 'their move', press: ours ? (col.ours ? 'send' : null) : 'remind' }
  }
  if (read.stepState === 'done' || read.stepState === 'lapsed' || read.stepState === 'next') return { ...base, mark: 'none', words: 'none yet', tip: 'nothing on file yet', press: getIt }
  return { ...base, mark: 'later', words: '', tip: read.stepState === 'skipped' ? 'skipped' : 'not yet on this job', press: null }
}

export interface JobPaperCounts {
  lapsed: number
  late: number
  soon: number
  waiting: number
  done: number
}

export function jobPaperCounts(cells: readonly PaperCell[]): JobPaperCounts {
  const n: JobPaperCounts = { lapsed: 0, late: 0, soon: 0, waiting: 0, done: 0 }
  for (const c of cells) {
    if (c.mark === 'lapsed') n.lapsed++
    else if (c.mark === 'late') n.late++
    else if (c.mark === 'soon') n.soon++
    else if (c.mark === 'waiting') n.waiting++
    else if (c.mark === 'done') n.done++
  }
  return n
}

/** A pill in the title, and the filter it sets: late and runs out soon share one orange pill. */
export type PillKey = 'lapsed' | 'lateOrSoon' | 'waiting' | 'done'

export interface JobPaperPill {
  key: PillKey | null
  words: string
  tone: 'bad' | 'warn' | 'ok' | ''
}

/** "1 lapsed", "2 late or runs out soon", "3 waiting", "12 done"; "all in" when every paper is in; nothing when there are no papers. */
export function jobPaperPills(n: JobPaperCounts): JobPaperPill[] {
  const orange = n.late + n.soon
  if (!n.lapsed && !orange && !n.waiting) return n.done ? [{ key: null, words: 'all in', tone: 'ok' }] : []
  const pills: JobPaperPill[] = []
  if (n.lapsed) pills.push({ key: 'lapsed', words: `${n.lapsed} lapsed`, tone: 'bad' })
  if (orange) pills.push({ key: 'lateOrSoon', words: `${orange} ${!n.soon ? 'late' : !n.late ? 'runs out soon' : 'late or runs out soon'}`, tone: 'warn' })
  if (n.waiting) pills.push({ key: 'waiting', words: `${n.waiting} waiting`, tone: '' })
  if (n.done) pills.push({ key: 'done', words: `${n.done} done`, tone: 'ok' })
  return pills
}

const pillOf = (m: CellMark): PillKey | null => (m === 'lapsed' ? 'lapsed' : m === 'late' || m === 'soon' ? 'lateOrSoon' : m === 'waiting' ? 'waiting' : m === 'done' ? 'done' : null)

export interface JobPaperRow {
  contactId: string
  name: string
  /** "Sitework · Greg Paulk", else the kind's word. */
  sub: string
  /** Each cell, and whether the pill filter dims it. */
  cells: (PaperCell & { dim: boolean })[]
}

export interface JobPaperSection {
  kind: FlowKind
  title: string
  columns: GridColumn[]
  rows: JobPaperRow[]
}

export interface JobPaperGrid {
  sections: JobPaperSection[]
  counts: JobPaperCounts
  pills: JobPaperPill[]
}

const SECTION_ORDER: readonly FlowKind[] = ['trade', 'customer', 'arch']
const SECTION_TITLE: Record<FlowKind, string> = { trade: 'Trade partner', customer: 'Customer', arch: 'Architect', residential: 'Customer', sub: 'Sub', unknown: 'Who is this?' }
const KIND_WORDS: Record<FlowKind, string> = { trade: 'trade partner', customer: 'customer', arch: 'architect', residential: 'customer', sub: 'sub', unknown: 'unknown' }

/** Lapsed first, then late or runs out soon, then waiting, then the rest. */
const rankOf = (cells: readonly PaperCell[]): number => (cells.some((c) => c.mark === 'lapsed') ? 0 : cells.some((c) => c.mark === 'late' || c.mark === 'soon') ? 1 : cells.some((c) => c.mark === 'waiting') ? 2 : 3)

function cellsOf(input: JobPapersInput, c: JobPaperCompany, cols: readonly GridColumn[]): PaperCell[] {
  return cols.map((col) => {
    const read = c.reads[col.paper]
    const place = c.places.find((p) => p.stepId === (read?.stepId ?? col.stepId) && (p.jobId === input.jobId || p.jobId == null)) ?? null
    return paperCell(col, read, place, input.today, input.soonDays?.[col.paper] ?? INSURANCE_ASK_DAYS)
  })
}

/** The grid: a section per kind, companies with something wrong first, then A to Z; the pill filter keeps the rows with one such cell. */
export function jobPaperGrid(input: JobPapersInput, filter: PillKey | null = null): JobPaperGrid {
  const all: PaperCell[] = []
  const sections = SECTION_ORDER.flatMap((kind): JobPaperSection[] => {
    const flow = input.flows[kind]
    const people = input.companies.filter((c) => c.kind === kind && !c.off)
    if (!flow || !people.length) return []
    const columns = gridColumns(flow, input.labels)
    const rows = people
      .map((c) => {
        const cells = cellsOf(input, c, columns)
        all.push(...cells)
        return { c, cells, rank: rankOf(cells) }
      })
      .filter((r) => !filter || r.cells.some((x) => pillOf(x.mark) === filter))
      .sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name))
      .map(({ c, cells }): JobPaperRow => ({
        contactId: c.contactId,
        name: c.name,
        sub: [c.trades.join(', '), c.personName].filter(Boolean).join(' · ') || KIND_WORDS[kind],
        cells: cells.map((x) => ({ ...x, dim: filter != null && pillOf(x.mark) !== filter })),
      }))
    return rows.length ? [{ kind, title: SECTION_TITLE[kind], columns, rows }] : []
  })
  const counts = jobPaperCounts(all)
  return { sections, counts, pills: jobPaperPills(counts) }
}

// ---------------------------------------------------------------------------------------------------
// The strip before the job's day.

/** One of Bill day's gates, as billDay/trades.ts reads it. The press stays the gate's own. */
export interface BillGate {
  ok: boolean
  text: string
  small: string
}

export type StripPress =
  | { kind: 'ask'; contactId: string; stepId: string; paper: string }
  | { kind: 'remind'; contactId: string; stepId: string; label: string }
  | { kind: 'compare' }
  | { kind: 'remind-many'; contactIds: string[]; stepId: string; label: string }
  | { kind: 'gate'; index: number }

export interface StripLine {
  /** The dot: red, orange, or gray for on time. */
  tone: 'r' | 'o' | 'g'
  text: string
  /** A gate's second line. */
  small: string | null
  press: StripPress
}

export interface JobStrip {
  kind: 'bid' | 'bill'
  /** "Before bid day" or "Before bill day". */
  title: string
  day: string
  daysLeft: number
  lines: StripLine[]
}

export interface StripJob {
  kind: 'bid' | 'project' | 'pipeline'
  /** A bid's due day. */
  due?: string | null
  /** Our bid went. */
  sent?: boolean
}

/** Three names at most, so the line stays one short sentence: "A, B, C and 2 more". */
function namesWords(names: readonly string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

/** Before bid day: the insurance that ran out, the late quotes, the compare over its usual, and the quotes still due. */
function bidStrip(input: JobPapersInput, job: StripJob): JobStrip | null {
  const flow = input.flows.trade
  if (!flow || !job.due || job.sent) return null
  const daysLeft = daysUntil(job.due, input.today)
  if (daysLeft < 0) return null
  const trades = input.companies.filter((c) => c.kind === 'trade' && !c.off)
  const cols = gridColumns(flow, input.labels)
  const cell = (c: JobPaperCompany, paper: string): PaperCell | null => {
    const col = cols.find((x) => x.paper === paper)
    return col ? (cellsOf(input, c, [col])[0] ?? null) : null
  }
  const lines: StripLine[] = []
  for (const c of trades) {
    const coi = c.reads.coi
    if (cell(c, 'coi')?.mark === 'lapsed' && coi) {
      const day = coi.expires ?? coi.on
      lines.push({ tone: 'r', text: `${c.name}'s insurance ran out${day ? ` ${shortDate(day)}` : ''}. No statement of work can go to them until a new one is in.`, small: null, press: { kind: 'ask', contactId: c.contactId, stepId: coi.stepId, paper: 'coi' } })
    }
  }
  for (const c of trades) {
    const q = cell(c, 'quote')
    if (q?.mark === 'late' && q.stepId) lines.push({ tone: 'o', text: `${c.name}'s quote is late ${plural(q.lateDays, 'day')}.`, small: null, press: { kind: 'remind', contactId: c.contactId, stepId: q.stepId, label: `Remind ${c.firstName ?? c.name}` } })
  }
  const compare = flat(flow).find((s) => s.facts.includes('carried'))
  if (compare) {
    const ctx: BoardContext = { flow, jobs: input.jobs, usual: input.usual, firstNames: input.firstNames, today: input.today }
    for (const l of boardLines(ctx, trades, compare)) {
      if (l.jobId !== input.jobId || !l.overUsual || l.days == null || l.usual == null) continue
      lines.push({ tone: 'o', text: `${l.name}'s quote is in. The compare has sat ${plural(l.days, 'day')}, over the usual ${l.usual}.`, small: null, press: { kind: 'compare' } })
    }
  }
  const due = trades.filter((c) => cell(c, 'quote')?.mark === 'waiting')
  const [first] = due
  const askStep = first ? cell(first, 'quote')?.stepId : null
  if (first && askStep) {
    lines.push({
      tone: 'g',
      text: `${plural(due.length, 'quote')} due ${weekdayDate(job.due)}: ${namesWords(due.map((c) => c.name))}. On time so far.`,
      small: null,
      press: { kind: 'remind-many', contactIds: due.map((c) => c.contactId), stepId: askStep, label: due.length === 1 ? `Remind ${first.firstName ?? first.name}` : `Remind all ${due.length}` },
    })
  }
  return lines.length ? { kind: 'bid', title: 'Before bid day', day: job.due, daysLeft, lines } : null
}

/**
 * The strip before the job's day, or null when there is nothing to say: Before bid day on a bid until its day,
 * and Before bill day on a job being billed, with the gates still open, the first red.
 */
export function jobStrip(input: JobPapersInput, job: StripJob, bill?: { day: string; gates: readonly BillGate[] }): JobStrip | null {
  if (job.kind === 'bid') return bidStrip(input, job)
  if (job.kind !== 'project' || !bill) return null
  const open = bill.gates.map((g, index) => ({ g, index })).filter((x) => !x.g.ok)
  if (!open.length) return null
  return {
    kind: 'bill',
    title: 'Before bill day',
    day: bill.day,
    daysLeft: daysUntil(bill.day, input.today),
    lines: open.map(({ g, index }, i) => ({ tone: i === 0 ? 'r' : 'o', text: g.text, small: g.small, press: { kind: 'gate', index } })),
  }
}
