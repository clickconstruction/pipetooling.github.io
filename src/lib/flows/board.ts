/**
 * The Messages suite's boards (BUILD_PLAN.md cut 4), lifted from the prototype on branch spike/gc-mode
 * (`to-dos/gc-mode/messages/prototype.html`, v1.178): everyone by step at the top of Trade partners and
 * Customers (`boardLines`, `boardHtml`'s six pieces, `boardSummary`), By trade (`byTradeHtml`) and By
 * company (`companyTableHtml`). Pure: it reads places, one per company per step it is on now or lapsed
 * (one per job in the per-job lane), never the stamps behind them. flows/state.ts makes the places.
 *
 * Over usual is a watch in orange: it colors a chip and a dot and is counted under a step, but it never
 * counts toward Needs a hand, so it never reaches Follow up. A day still ahead means on time, so a line
 * with one is never over usual.
 */
import { daysUntil, shortDate, weekdayDate } from '../gc/words'
import { factById, FLOW_PAPERS, type FactId, type FlowKind, type PaperId } from './facts'
import { flat, LANE_WORDS, laneOf, type FlowDef, type FlowPhase, type FlowStep, type Lane, type StepPlace } from './state'

/** A company on a board, or a person with no company, with where it stands. */
export interface BoardCompany {
  contactId: string
  /** What a chip reads: the company's name, else the person's. */
  name: string
  /** The person we deal with: "Greg Paulk". Null for a company with nobody named. */
  personName: string | null
  /** What we call them, for "Remind Greg". */
  firstName: string | null
  /** The trades on the company's record (gc_companies.trades); empty when none is set. */
  trades: readonly string[]
  /** The jobs it is on, the default first. */
  jobIds: readonly string[]
  defaultJobId: string | null
  /** Off the flow: declined, went elsewhere, or let go. */
  off: { since: string; why: string } | null
  places: readonly StepPlace[]
  /** The Once lane's steps that are done, for By company's track. */
  onceDone: readonly string[]
  /** The jobs whose per-job lane is finished, so By company reads done there and not "not started". */
  jobsDone: readonly string[]
  /** How a job's lane ended at a fork, by job: `perJobJobs(reading)`'s `ended`, such as 'declined' or 'not_carried'. */
  jobsEnded?: Readonly<Partial<Record<string, FactId>>>
}

export interface BoardContext {
  flow: FlowDef
  /** Every job a company is on, by id. */
  jobs: Readonly<Record<string, { name: string }>>
  /** Each step's usual in days, from flows/going.ts. Missing or null under five done: no usual yet. */
  usual: Readonly<Record<string, number | null>>
  /** First names of the people a step can wait on, by contact id. */
  firstNames: Readonly<Record<string, string>>
  /** Today, YYYY-MM-DD in the app's calendar. */
  today: string
}

export type LineTone = 'late' | 'lapsed' | 'wait' | 'over' | ''

/** One chip on a step's row: a company on the step, once per job in the per-job lane. */
export interface BoardLine {
  contactId: string
  name: string
  firstName: string | null
  /** The company's jobs, for the job picker on a Once step. */
  companyJobIds: readonly string[]
  jobId: string | null
  step: FlowStep
  lane: Lane
  /** Days on the step, or since the paper ran out on a lapsed one. Null when the app has no day. */
  days: number | null
  /** Days late; 0 when it is not. */
  lateDays: number
  /** Its day while that is still ahead or today. */
  due: string | null
  lapsed: boolean
  lapsedPaper: PaperId | null
  waitingOn: StepPlace['waitingOn']
  usual: number | null
  /** Past the step's usual with nothing else to say: a watch, never a call. */
  overUsual: boolean
  tone: LineTone
}

/** The board's two pickers. Null is every job, or everyone's seat. */
export interface BoardFilter {
  jobId: string | null
  seat: string | null
}

export const NO_FILTER: BoardFilter = { jobId: null, seat: null }

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** Whole days from a day to today. */
const daysSince = (ymd: string, today: string): number => -daysUntil(ymd, today)

/** "today", "Thu" within the week, "Oct 22" past it. */
export function dueWords(due: string, today: string): string {
  const n = daysUntil(due, today)
  if (n === 0) return 'today'
  if (n > 0 && n <= 6) return weekdayDate(due).split(' ')[0] ?? shortDate(due)
  return shortDate(due)
}

/** A lapsed step in words: "insurance expired", or "lapsed" when the app does not know which paper. */
export function lapsedWords(paper: PaperId | null): string {
  return paper ? `${FLOW_PAPERS[paper].short} expired` : 'lapsed'
}

function lineOf(ctx: BoardContext, c: BoardCompany, p: StepPlace, step: FlowStep, lane: Lane): BoardLine {
  const days = p.since ? daysSince(p.since, ctx.today) : null
  const late = p.lateDays ?? (p.due ? -daysUntil(p.due, ctx.today) : null)
  const lateDays = late != null && late > 0 ? late : 0
  const due = p.due && lateDays === 0 ? p.due : null
  const lapsed = p.state === 'lapsed'
  const usual = ctx.usual[step.id] ?? null
  const overUsual = !lateDays && !lapsed && !p.waitingOn && !due && usual != null && days != null && days > usual
  const tone: LineTone = lateDays ? 'late' : lapsed ? 'lapsed' : p.waitingOn ? 'wait' : overUsual ? 'over' : ''
  return {
    contactId: c.contactId,
    name: c.name,
    firstName: c.firstName,
    companyJobIds: c.jobIds,
    jobId: p.jobId,
    step,
    lane,
    days,
    lateDays,
    due,
    lapsed,
    lapsedPaper: p.lapsedPaper,
    waitingOn: p.waitingOn,
    usual,
    overUsual,
    tone,
  }
}

/** Everyone on a step, late first and then the longest on it; companies off the flow are left out. */
export function boardLines(ctx: BoardContext, companies: readonly BoardCompany[], step: FlowStep): BoardLine[] {
  const lane = laneOf(ctx.flow, step.id) ?? 'once'
  const lines: BoardLine[] = []
  for (const c of companies) {
    if (c.off) continue
    for (const p of c.places) if (p.stepId === step.id) lines.push(lineOf(ctx, c, p, step, lane))
  }
  return lines.sort((a, b) => b.lateDays - a.lateDays || (b.days ?? -1) - (a.days ?? -1))
}

/** A line's day in words, the same order as its tone: late, lapsed, waiting, its day, over usual, how long. */
export function lineDayWords(l: BoardLine, ctx: Pick<BoardContext, 'firstNames' | 'today'>): string {
  if (l.lateDays) return `late ${plural(l.lateDays, 'day')}`
  if (l.lapsed) return lapsedWords(l.lapsedPaper)
  if (l.waitingOn) return `waiting on ${ctx.firstNames[l.waitingOn.contactId] ?? 'someone else'}`
  if (l.due) return `due ${dueWords(l.due, ctx.today)}`
  if (l.days == null) return ''
  if (l.overUsual) return `${l.days} d · over usual`
  return l.days === 0 ? 'today' : `${l.days} d`
}

/** The job picker narrows to one job (a Once step: the companies on it); the seat picker to the steps in one seat, and their-move steps with none. */
export function boardPasses(l: BoardLine, f: BoardFilter): boolean {
  const job = !f.jobId || l.jobId === f.jobId || (l.jobId == null && l.companyJobIds.includes(f.jobId))
  const seat = !f.seat || l.step.seat === f.seat || (l.step.who !== 'us' && !l.step.seat)
  return job && seat
}

/** What the two pickers offer: every job a company on the board is on, and every seat a step sits in. */
export function boardFilterOptions(ctx: BoardContext, companies: readonly BoardCompany[]): { jobs: { id: string; name: string }[]; seats: string[] } {
  const ids = [...new Set(companies.flatMap((c) => c.jobIds))]
  const jobs = ids.flatMap((id) => {
    const j = ctx.jobs[id]
    return j ? [{ id, name: j.name }] : []
  })
  const seats = [...new Set(flat(ctx.flow).flatMap((s) => (s.seat ? [s.seat] : [])))]
  return { jobs, seats }
}

/** Whether a company is on a step now or lapsed on it: the Messages list's by step chip. */
export const onStep = (c: BoardCompany, stepId: string): boolean => c.places.some((p) => p.stepId === stepId)

// ---------------------------------------------------------------------------------------------------
// 1. The tiles: one per phase with a dot per company, Off the flow, and Needs a hand.

/** The tiles in order: each step's phase is on the step, seeded in flows/seed.ts. */
const PHASES: Record<FlowKind, readonly FlowPhase[]> = {
  trade: ['setup', 'pricing', 'building'],
  customer: ['setup', 'pricing', 'building'],
  arch: ['building'],
  // No tiles until their flows have steps; their words are the customer's and the architect's until then.
  residential: [],
  sub: [],
  unknown: ['setup'],
}

const PHASE_WORDS: Record<FlowKind, Record<FlowPhase, string>> = {
  trade: { setup: 'Getting set up', pricing: 'Quoting', building: 'Building' },
  customer: { setup: 'Setting up', pricing: 'Bidding', building: 'Building' },
  arch: { setup: 'On the job', pricing: 'On the job', building: 'On the job' },
  residential: { setup: 'Setting up', pricing: 'Bidding', building: 'Building' },
  sub: { setup: 'On the job', pricing: 'On the job', building: 'On the job' },
  unknown: { setup: 'Who is this?', pricing: 'Who is this?', building: 'Who is this?' },
}

/** A dot's color: red late, orange lapsed or over usual, gray otherwise. */
export type DotTone = 'bad' | 'warn' | ''

export interface SummaryDot {
  contactId: string
  name: string
  tone: DotTone
  /** The company's worst line in the tile: a press opens its thread at that step. */
  line: BoardLine
}

export interface PhaseTile {
  phase: FlowPhase
  words: string
  /** Companies, never lines: a company with two asks is one company and one dot. */
  companies: number
  jobIds: string[]
  dots: SummaryDot[]
  /** The first step with someone on it, where a press on the tile jumps. */
  firstStepId: string | null
}

export interface OffCompany {
  contactId: string
  name: string
  since: string
  why: string
}

export interface BoardSummary {
  tiles: PhaseTile[]
  off: OffCompany[]
  /** Companies by their worst line. The late and the lapsed need a hand today; over usual and waiting are watches. */
  hand: { count: number; late: number; lapsed: number; over: number; waiting: number }
}

const TONE_RANK: Record<LineTone, number> = { late: 0, lapsed: 1, over: 2, wait: 3, '': 4 }

const dotTone = (t: LineTone): DotTone => (t === 'late' ? 'bad' : t === 'lapsed' || t === 'over' ? 'warn' : '')

/** Each company's worst line, in the order the lines came. */
function worstByCompany(lines: readonly BoardLine[]): BoardLine[] {
  const worst = new Map<string, BoardLine>()
  for (const l of lines) {
    const prior = worst.get(l.contactId)
    if (!prior || TONE_RANK[l.tone] < TONE_RANK[prior.tone]) worst.set(l.contactId, l)
  }
  return [...worst.values()]
}

function offCompanies(companies: readonly BoardCompany[], f: BoardFilter): OffCompany[] {
  return companies.flatMap((c) => (c.off && (!f.jobId || c.jobIds.includes(f.jobId)) ? [{ contactId: c.contactId, name: c.name, since: c.off.since, why: c.off.why }] : []))
}

export function boardSummary(ctx: BoardContext, companies: readonly BoardCompany[], f: BoardFilter = NO_FILTER): BoardSummary {
  const all = flat(ctx.flow).flatMap((s) => boardLines(ctx, companies, s).filter((l) => boardPasses(l, f)))
  const tiles = PHASES[ctx.flow.kind].map((phase): PhaseTile => {
    const xs = all.filter((l) => PHASES[ctx.flow.kind].length === 1 || l.step.phase === phase)
    const worst = worstByCompany(xs)
    return {
      phase,
      words: PHASE_WORDS[ctx.flow.kind][phase],
      companies: worst.length,
      jobIds: [...new Set(xs.flatMap((l) => (l.jobId ? [l.jobId] : [])))],
      dots: worst.map((l) => ({ contactId: l.contactId, name: l.name, tone: dotTone(l.tone), line: l })),
      firstStepId: xs[0]?.step.id ?? null,
    }
  })
  const hand = { count: 0, late: 0, lapsed: 0, over: 0, waiting: 0 }
  for (const l of worstByCompany(all)) {
    if (l.tone === 'late') hand.late++
    else if (l.tone === 'lapsed') hand.lapsed++
    else if (l.tone === 'over') hand.over++
    else if (l.tone === 'wait') hand.waiting++
  }
  hand.count = hand.late + hand.lapsed
  return { tiles, off: offCompanies(companies, f), hand }
}

/** "on Stone Oak Pharmacy", "on 2 bids" while quoting, "on 3 jobs"; empty with no job. */
export function tileJobWords(ctx: Pick<BoardContext, 'flow' | 'jobs'>, t: PhaseTile): string {
  if (!t.jobIds.length) return ''
  const only = t.jobIds.length === 1 ? ctx.jobs[t.jobIds[0] ?? ''] : undefined
  if (only) return `on ${only.name}`
  return `on ${t.jobIds.length} ${ctx.flow.kind === 'trade' && t.phase === 'pricing' ? 'bids' : 'jobs'}`
}

// ---------------------------------------------------------------------------------------------------
// 2 to 5. One row per step in the flow's order: empty runs folded, chips by job, days against the
// usual, and the row's own press.

/** What lands on an empty step, by the seed's step ids. A step the editor adds reads "Nobody on it." */
const LANDS: Readonly<Record<string, string>> = {
  invited: 'A new invitation lands here.',
  portal: 'A company that opens its link lands here.',
  papers: 'An opened portal lands here.',
  msa: 'Papers in land here.',
  ask: 'A new ask lands here.',
  compare: 'A quote that came in lands here.',
  sow: 'A carried quote lands here.',
  draws: 'A signed statement of work lands here.',
  closeout: "A trade's final waiver lands here.",
  agreement: 'A repeat customer lands here.',
  asked: 'A new ask lands here.',
  bid: 'An ask lands here once we take it.',
  yes: 'A sent bid lands here.',
  contract: 'A yes lands here.',
  start: 'A signed contract lands here.',
  onsite: 'A start date that has come lands here.',
  payapp: 'A job on site lands here each month.',
  close: 'A finished job lands here.',
  warranty: 'A closed job lands here for its year.',
  co: 'A change lands here.',
}

export const landsWords = (stepId: string, folded = false): string => LANDS[stepId] ?? (folded ? 'Nobody on them.' : 'Nobody on it.')

/** The facts that start a trade's flow: an empty row there offers Invite a company. */
const INVITE_FACTS: readonly FactId[] = ['invite_sent', 'portal_opened']
/** A fact that reads a paper they hand us. A step that waits only on these asks for them; the rest remind. */
const theyGive = (fact: FactId): boolean => {
  const f = factById(fact)
  return !!f?.paper && !f.ours
}

export type RowPress =
  | { kind: 'invite'; label: string }
  | { kind: 'bill-day'; label: string }
  | { kind: 'compare'; label: string }
  /** The step's own line to each company, one send window at a time. Nothing sends until Send. */
  | { kind: 'nudge'; label: string; contactIds: string[]; late: boolean }

/** The press at a row's right, keyed off the step's facts, which come from the code's list and never change. */
export function rowPress(step: FlowStep, lines: readonly BoardLine[]): RowPress | null {
  if (!lines.length) return step.facts.some((f) => INVITE_FACTS.includes(f)) ? { kind: 'invite', label: 'Invite a company' } : null
  if (step.facts.includes('draw_paid')) return { kind: 'bill-day', label: 'Bill day' }
  if (step.facts.includes('carried')) return { kind: 'compare', label: 'Open the compare' }
  if (step.who === 'us' && !step.loop) return null
  // A company waiting on someone else's step is not nudged: the row for that goes to the other person.
  const open = lines.filter((l) => !l.waitingOn)
  const lateOnes = open.filter((l) => l.lateDays > 0)
  const pick = lateOnes.length ? lateOnes : open
  if (!pick.length) return null
  const contactIds = [...new Set(pick.map((l) => l.contactId))]
  const asks = !step.loop && step.facts.length > 0 && step.facts.every(theyGive)
  const verb = asks ? 'Ask' : 'Remind'
  const first = pick[0]
  const label = lateOnes.length
    ? `${verb} the ${contactIds.length} late`
    : contactIds.length === 1 && first
      ? `${verb} ${first.firstName ?? first.name}`
      : `${verb} the ${contactIds.length}${asks ? ' for papers' : ''}`
  return { kind: 'nudge', label, contactIds, late: lateOnes.length > 0 }
}

export interface BoardChip {
  line: BoardLine
  /** The day in words; empty when the group names the day they share. */
  words: string
}

/** The chips of one job in the per-job lane, the job named once with the day they share. */
export interface ChipGroup {
  jobId: string | null
  /** The job's name; null on a Once step, or for a customer whose job carries its own name. */
  label: string | null
  /** The day every chip in the group is due, when they share one and none is late. */
  sharedDue: string | null
  chips: BoardChip[]
}

export interface RowHead {
  count: number
  /** "ask" on a step that repeats, so the count reads "2 asks". */
  unit: string | null
  ours: boolean
  late: number
  lapsed: number
  over: number
  waiting: number
  usual: number | null
}

export type BoardRow =
  | { kind: 'step'; step: FlowStep; head: RowHead; groups: ChipGroup[]; press: RowPress | null; lands: string | null }
  | { kind: 'folded'; steps: FlowStep[]; lands: string; press: RowPress | null }

export interface BoardLaneRows {
  lane: Lane
  words: string
  rows: BoardRow[]
}

export interface BoardRows {
  lanes: BoardLaneRows[]
  off: OffCompany[]
}

const UNIT_PLURAL: Readonly<Record<string, string>> = { addendum: 'addenda' }
/** A loop that repeats by the calendar names no thing to count: a pay application each month reads "1", not "1 month". */
const PERIODS = new Set(['day', 'week', 'month', 'year'])

function head(step: FlowStep, lines: readonly BoardLine[], usual: number | null): RowHead {
  const loopNoun = step.loop ? step.loop.replace(/^each /, '') : null
  const unit = loopNoun && !PERIODS.has(loopNoun) ? loopNoun : null
  return {
    count: lines.length,
    unit: unit && lines.length !== 1 ? (UNIT_PLURAL[unit] ?? `${unit}s`) : unit,
    ours: step.who === 'us' && !step.loop,
    late: lines.filter((l) => l.tone === 'late').length,
    lapsed: lines.filter((l) => l.tone === 'lapsed').length,
    over: lines.filter((l) => l.tone === 'over').length,
    waiting: lines.filter((l) => l.tone === 'wait').length,
    usual,
  }
}

/** Under the step's name: ["2 asks", "1 late", "usually 6 d"], or ["nobody"]. The screen joins them. */
export function rowHeadParts(h: RowHead): string[] {
  if (!h.count) return ['nobody']
  const parts = [h.unit ? `${h.count} ${h.unit}` : String(h.count)]
  if (h.ours) parts.push('ours')
  if (h.late) parts.push(`${h.late} late`)
  if (h.lapsed) parts.push(`${h.lapsed} lapsed`)
  if (h.over) parts.push(`${h.over} over usual`)
  if (h.waiting) parts.push(`${h.waiting} waiting`)
  if (h.usual != null) parts.push(`usually ${h.usual} d`)
  return parts
}

function groupsOf(ctx: BoardContext, lane: Lane, lines: readonly BoardLine[]): ChipGroup[] {
  const chip = (l: BoardLine, shared: string | null): BoardChip => ({ line: l, words: shared && l.due === shared && (l.tone === '' || l.tone === 'over') ? '' : lineDayWords(l, ctx) })
  if (lane !== 'per_job') return lines.length ? [{ jobId: null, label: null, sharedDue: null, chips: lines.map((l) => chip(l, null)) }] : []
  const byJob = new Map<string | null, BoardLine[]>()
  for (const l of lines) byJob.set(l.jobId, [...(byJob.get(l.jobId) ?? []), l])
  return [...byJob.entries()].map(([jobId, group]) => {
    const dues = [...new Set(group.filter((l) => !l.lateDays).map((l) => l.due))]
    const sharedDue = dues.length === 1 && dues[0] ? dues[0] : null
    const name = jobId ? (ctx.jobs[jobId]?.name ?? null) : null
    const label = name && group.some((l) => l.name !== name) ? name : null
    return { jobId, label, sharedDue, chips: group.map((l) => chip(l, sharedDue)) }
  })
}

/** The rows in the flow's order, the lanes named. A run of empty steps folds to one row; a lane's last step keeps its own. */
export function boardRows(ctx: BoardContext, companies: readonly BoardCompany[], f: BoardFilter = NO_FILTER): BoardRows {
  const lanes = ctx.flow.lanes.map((laneDef): BoardLaneRows => {
    const rows: BoardRow[] = []
    let run: FlowStep[] = []
    const row = (step: FlowStep, lines: BoardLine[]): BoardRow => ({
      kind: 'step',
      step,
      head: head(step, lines, ctx.usual[step.id] ?? null),
      groups: groupsOf(ctx, laneDef.lane, lines),
      press: rowPress(step, lines),
      lands: lines.length ? null : landsWords(step.id),
    })
    const flush = () => {
      const [first] = run
      if (first && run.length === 1) rows.push(row(first, []))
      else if (first) rows.push({ kind: 'folded', steps: run, lands: landsWords(first.id, true), press: rowPress(first, []) })
      run = []
    }
    laneDef.steps.forEach((step, i) => {
      const lines = boardLines(ctx, companies, step).filter((l) => boardPasses(l, f))
      if (!lines.length && i < laneDef.steps.length - 1) {
        run.push(step)
        return
      }
      flush()
      rows.push(row(step, lines))
    })
    flush()
    return { lane: laneDef.lane, words: LANE_WORDS[laneDef.lane], rows }
  })
  return { lanes, off: offCompanies(companies, f) }
}

// ---------------------------------------------------------------------------------------------------
// By trade: one row per trade, A to Z, each company a chip with the step it is on.

export const NO_TRADE = 'No trade yet'

/**
 * The place a company's one chip shows: the latest late one, else a Once step on now, else its default
 * job's, else its first job's. Late comes first so a company setting up never hides a late quote.
 */
export function shownPlace(flow: FlowDef, c: BoardCompany): StepPlace | null {
  const order = flat(flow).map((s) => s.id)
  const now = c.places.filter((p) => p.state === 'now').sort((a, b) => order.indexOf(a.stepId) - order.indexOf(b.stepId))
  const late = now.filter((p) => (p.lateDays ?? 0) > 0).sort((a, b) => (b.lateDays ?? 0) - (a.lateDays ?? 0))
  return late[0] ?? now.find((p) => p.jobId == null) ?? now.find((p) => p.jobId === c.defaultJobId) ?? now[0] ?? null
}

/** A company's first lapsed step in the flow's order. */
function firstLapsed(flow: FlowDef, c: BoardCompany): StepPlace | null {
  const order = flat(flow).map((s) => s.id)
  return c.places.filter((p) => p.state === 'lapsed').sort((a, b) => order.indexOf(a.stepId) - order.indexOf(b.stepId))[0] ?? null
}

export interface TradeChip {
  contactId: string
  name: string
  step: FlowStep | null
  /** The job, when the step shown is in the per-job lane. */
  jobId: string | null
  /** Late on the step shown, then lapsed anywhere, then the step's own day as the board reads it; empty when set up and on no step. */
  words: string
  tone: LineTone
  off: { since: string; why: string } | null
}

export interface TradeRow {
  trade: string
  companies: number
  onAJob: number
  late: number
  lapsed: number
  off: number
  chips: TradeChip[]
}

function tradeChip(ctx: BoardContext, c: BoardCompany): TradeChip {
  if (c.off) return { contactId: c.contactId, name: c.name, step: null, jobId: null, words: 'off the flow', tone: '', off: c.off }
  const p = shownPlace(ctx.flow, c)
  const step = p ? (flat(ctx.flow).find((s) => s.id === p.stepId) ?? null) : null
  const line = p && step ? lineOf(ctx, c, p, step, laneOf(ctx.flow, step.id) ?? 'once') : null
  const lapsed = firstLapsed(ctx.flow, c)
  const jobId = line && line.lane === 'per_job' ? line.jobId : null
  const chip = { contactId: c.contactId, name: c.name, step, jobId, off: null }
  if (line?.lateDays) return { ...chip, words: lineDayWords(line, ctx), tone: 'late' }
  if (lapsed) return { ...chip, words: lapsedWords(lapsed.lapsedPaper), tone: 'lapsed' }
  return { ...chip, words: line ? lineDayWords(line, ctx) : '', tone: line?.tone ?? '' }
}

export function byTrade(ctx: BoardContext, companies: readonly BoardCompany[]): TradeRow[] {
  const by = new Map<string, BoardCompany[]>()
  for (const c of companies) for (const t of c.trades.length ? c.trades : [NO_TRADE]) by.set(t, [...(by.get(t) ?? []), c])
  const trades = [...by.keys()].sort((a, b) => (a === NO_TRADE ? 1 : b === NO_TRADE ? -1 : a.localeCompare(b)))
  return trades.map((trade) => {
    const cs = by.get(trade) ?? []
    const chips = cs.map((c) => tradeChip(ctx, c))
    const rank = (x: TradeChip) => (x.tone === 'late' ? 0 : x.off ? 2 : 1)
    chips.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    return {
      trade,
      companies: cs.length,
      onAJob: cs.filter((c) => !c.off && c.jobIds.length).length,
      late: chips.filter((x) => x.tone === 'late').length,
      lapsed: cs.filter((c) => !c.off && c.places.some((p) => p.state === 'lapsed')).length,
      off: cs.filter((c) => c.off).length,
      chips,
    }
  })
}

// ---------------------------------------------------------------------------------------------------
// By company: one row per company, the Once lane as a track, the step on now in words, one line per job.

export type TrackMark = 'done' | 'now' | 'lapsed' | ''

export interface CompanyRow {
  contactId: string
  name: string
  /** Under the name: "Sitework · Greg Paulk". */
  sub: string
  /** The Once lane as marks; empty for a flow with no Once lane. */
  track: { stepId: string; name: string; mark: TrackMark }[]
  /** On now: a lapsed step first, then the step its chip shows, else set up. */
  now: { stepId: string | null; name: string; small: string[]; tone: 'lapsed' | 'over' | '' }
  jobs: CompanyJobLine[]
}

/** One of a company's jobs on By company: the step on it with its day, how its lane ended, done, or not started. */
export interface CompanyJobLine {
  jobId: string
  name: string
  words: string
  lateDays: number
  /** The way out of a fork that ended the job's lane, so the screen can mute the line. */
  ended: FactId | null
}

/** How a lane that ended at a fork reads on its job's line. */
const ENDED_WORDS: Readonly<Partial<Record<FactId, string>>> = { declined: 'declined', not_carried: 'not carried' }

/** A company's jobs, one line each: the step on it, else how its lane ended, else done or not started. */
export function companyJobLines(ctx: BoardContext, c: BoardCompany): CompanyJobLine[] {
  const steps = flat(ctx.flow)
  return c.jobIds.flatMap((jobId) => {
    const job = ctx.jobs[jobId]
    if (!job) return []
    const p = c.places.find((x) => x.jobId === jobId && x.state === 'now') ?? c.places.find((x) => x.jobId === jobId)
    const step = p ? steps.find((s) => s.id === p.stepId) : undefined
    if (!p || !step) {
      const ended = c.jobsEnded?.[jobId] ?? null
      const words = ended ? (ENDED_WORDS[ended] ?? factById(ended)?.text ?? ended) : c.jobsDone.includes(jobId) ? 'done' : 'not started'
      return [{ jobId, name: job.name, words, lateDays: 0, ended }]
    }
    const l = lineOf(ctx, c, p, step, 'per_job')
    const day = l.lateDays ? `late ${plural(l.lateDays, 'day')}` : l.due ? `due ${dueWords(l.due, ctx.today)}` : l.days != null ? `${l.days} d` : ''
    return [{ jobId, name: job.name, words: day ? `${step.name} · ${day}` : step.name, lateDays: l.lateDays, ended: null }]
  })
}

function whoWords(ctx: BoardContext, l: BoardLine): string {
  if (l.waitingOn) return `waiting on ${ctx.firstNames[l.waitingOn.contactId] ?? 'someone else'}`
  return l.step.who === 'us' ? 'ours' : l.step.who === 'them' ? 'their move' : 'both'
}

function companyRow(ctx: BoardContext, c: BoardCompany): CompanyRow {
  const steps = flat(ctx.flow)
  const stepOf = (id: string) => steps.find((s) => s.id === id)
  const once = ctx.flow.lanes.find((l) => l.lane === 'once')?.steps ?? []
  const track = once.map((s) => {
    const p = c.places.find((x) => x.stepId === s.id && x.jobId == null)
    const mark: TrackMark = p?.state === 'lapsed' ? 'lapsed' : p ? 'now' : c.onceDone.includes(s.id) ? 'done' : ''
    return { stepId: s.id, name: s.name, mark }
  })
  const lapsed = firstLapsed(ctx.flow, c)
  const shown = shownPlace(ctx.flow, c)
  const shownStep = shown ? stepOf(shown.stepId) : undefined
  let now: CompanyRow['now']
  if (lapsed) now = { stepId: lapsed.stepId, name: stepOf(lapsed.stepId)?.name ?? lapsed.stepId, small: [lapsedWords(lapsed.lapsedPaper)], tone: 'lapsed' }
  else if (shown && shownStep) {
    const l = lineOf(ctx, c, shown, shownStep, laneOf(ctx.flow, shownStep.id) ?? 'once')
    const small = [whoWords(ctx, l)]
    if (l.days != null) small.push(`${l.days} d`)
    if (l.overUsual) small.push('over usual')
    else if (l.usual != null && l.days != null) small.push(`usually ${l.usual}`)
    now = { stepId: shownStep.id, name: shownStep.name, small, tone: l.overUsual ? 'over' : '' }
  } else now = { stepId: null, name: '', small: ['set up'], tone: '' }
  return { contactId: c.contactId, name: c.name, sub: [c.trades.join(', '), c.personName].filter(Boolean).join(' · '), track, now, jobs: companyJobLines(ctx, c) }
}

/** One row per company on the flow, in the order given; companies off the flow are left out. */
export function companyTable(ctx: BoardContext, companies: readonly BoardCompany[]): CompanyRow[] {
  return companies.filter((c) => !c.off).map((c) => companyRow(ctx, c))
}
