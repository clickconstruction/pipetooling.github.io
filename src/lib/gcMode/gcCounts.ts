/**
 * GC mode design spike: the counts (the lead's go, 2026-10-06; `to-dos/gc-mode/mockups/counts.md`).
 * The schedule's reasons on the board row, Follow up and Needs you, each from its own kernel's read.
 *
 * - A company's move becomes a reason under that company (`scheduleReasons`): the board row's pill,
 *   Follow up's badge and rows, and Needs you's names count it. One call covers every reason, so a
 *   company counts once, however many bars.
 * - Our move becomes a line on the ring's card and one Needs you line for every job
 *   (`ourScheduleMoves`, `gcScheduleMovesNeedsYou`). It stays out of the people count.
 *
 * The first part is lifted out of the call list (G-115) as it was, so the counts and By company say
 * the same words: new dates told and not answered (G-113), a first day nobody confirmed (G-114),
 * and a short crew that alone moves the finish (G-57). The call list calls these.
 *
 * Its own file, out of the barrel. Nothing imported here is read when the module loads: the people
 * kernel reaches it through an import loop that works only at call time.
 */
import type { GcProject, GcState } from './gcTypes'
import { projectFollowPeople, projectPeople } from './gcProjectPeople'
import { callListFollowPeople } from './gcCallList'
import type { FollowPerson } from './gcFollowUpSheet'
import { weekdayDate } from './gcWords'
import { notReadyBars, type NotReadyBar, type StartGap } from './gcNotReady'
import { logChartGaps } from './gcLogVsChart'
import { chartHolds } from './gcChartHolds'
import { lateFinish } from './gcLateFinish'
import { crowdedSpells, crowdedWeeks, placeRows, placesSummary } from './gcPlaces'
import { lineLabel } from './gcSplitBars'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { gapIsTheirs } from '../gc/schedule/counts'
export type { BarCode, BarReason, DatesLine, DatesRef, ScheduleReason } from '../gc/schedule/counts'
export { CALL_LIST_SAYS, CONFIRM_WITHIN_DAYS, REASON_GROUPS, barReasons, crewCalls, gapIsTheirs, reasonGroup, scheduleReasons, unconfirmedDates, unconfirmedStarts, uninsuredReasons } from '../gc/schedule/counts'

// ---------------------------------------------------------------------------------------------
// The counts: a company's reasons from the schedule, and our own moves
// ---------------------------------------------------------------------------------------------

/** The codes the counts add to a company's reasons. */
export type ScheduleCode = 'notReady' | 'confirm' | 'pushedBack' | 'log' | 'crew' | 'crowded'

/** One of our own moves on a job's schedule: a line on the ring's card, and a sentence on Needs you. */
export interface OurMove {
  kind: 'finish' | 'award' | 'newPapers' | 'papers' | 'log' | 'crowd'
  /** The ring card's line. */
  words: string
  /** Needs you's sentence, after the job's name: "finishes 7 days past the contract." for the finish, else a sentence of its own. */
  short: string
  tone: 'red' | 'amber'
  lineId?: string
}

/**
 * Kept by the state and the job, both as they are: the reducer makes new ones on every change, so a
 * kept answer is never stale. The board's rows, Follow up, Needs you and the ring card read the same
 * job many times for one state, and the crews' projection under it is slow (G-57).
 */
function kept<T>(cache: WeakMap<GcState, WeakMap<GcProject, T>>, state: GcState, project: GcProject, make: () => T): T {
  let byJob = cache.get(state)
  if (!byJob) {
    byJob = new WeakMap()
    cache.set(state, byJob)
  }
  const hit = byJob.get(project)
  if (hit !== undefined) return hit
  const value = make()
  byJob.set(project, value)
  return value
}
const MOVES = new WeakMap<GcState, WeakMap<GcProject, OurMove[]>>()

/** A job whose schedule counts: being built, not closed or lost, with bars. A closed job counts nothing, as Follow up has it. */
function counts(project: GcProject): boolean {
  return project.stage === 'building' && !project.closedOn && !project.lostOn && (project.schedule?.activities.length ?? 0) > 0
}

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** "a, b and c". A name with its own "and" gets a comma before the last: "Panels and feeders, and Lighting". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  const glue = words.some((w) => w.includes(' and ')) ? ', and ' : ' and '
  return `${words.slice(0, -1).join(', ')}${glue}${words[words.length - 1]}`
}

/** "Kendall Air's", "Cedar & Pine Millworks'". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

/** The bar that starts first. */
function earliest(bars: NotReadyBar[]): NotReadyBar | undefined {
  return bars.reduce<NotReadyBar | undefined>((a, b) => (!a || b.start < a.start ? b : a), undefined)
}

/**
 * Our own moves on a job's schedule, in the ring card's order: the finish past the contract (G-98),
 * then papers that wait on us before a bar can start (G-77), the log against the chart when it is
 * ours to fix (G-60), and a crowded place (G-83).
 */
export function ourScheduleMoves(state: GcState, project: GcProject): OurMove[] {
  return kept(MOVES, state, project, () => readMoves(state, project))
}

function readMoves(state: GcState, project: GcProject): OurMove[] {
  if (!counts(project)) return []
  const out: OurMove[] = []

  // The finish past the contract (G-98), with whose days they are when some are the customer's.
  const lf = lateFinish(state, project)
  if (lf.late && lf.late > 0 && lf.risk.schedule && lf.risk.contract) {
    const line = `It finishes ${weekdayDate(lf.risk.schedule.on)}, ${days(lf.late)} past the contract's ${weekdayDate(lf.risk.contract.on)}.`
    out.push({ kind: 'finish', words: lf.split ? `${line} ${lf.split}` : line, short: `finishes ${days(lf.late)} past the contract.`, tone: 'red' })
  }

  // Not ready to start (G-77), on papers that wait on us: no company yet, papers on older plans, papers not sent.
  const award = new Map<string, NotReadyBar[]>()
  const newPapers: NotReadyBar[] = []
  const papers = new Map<string, { kind: StartGap['kind']; bars: NotReadyBar[] }>()
  for (const bar of notReadyBars(state, project)) {
    for (const g of bar.gaps) {
      if (gapIsTheirs(g, bar)) continue
      if (g.kind === 'award') award.set(bar.pkg.trade, [...(award.get(bar.pkg.trade) ?? []), bar])
      else if (g.kind === 'sow' && bar.pkg.sow?.status === 'signed') newPapers.push(bar)
      else if (bar.partner) {
        const key = `${bar.partner.id}|${g.kind}`
        const p = papers.get(key) ?? { kind: g.kind, bars: [] }
        p.bars.push(bar)
        papers.set(key, p)
      }
    }
  }
  const tone = (bars: NotReadyBar[]): 'red' | 'amber' => (bars.some((b) => b.late) ? 'red' : 'amber')
  const starts = (bar: NotReadyBar) => `${lineLabel(project, bar.lineId)} starts ${weekdayDate(bar.start)}.`
  for (const [trade, bars] of award) {
    const first = earliest(bars)
    if (first) out.push({ kind: 'award', words: `${trade} has no company yet. ${starts(first)}`, short: `${trade} has no company yet.`, tone: tone(bars), lineId: first.lineId })
  }
  const firstNew = earliest(newPapers)
  if (firstNew) {
    const companies = [...new Set(newPapers.flatMap((b) => (b.partner ? [b.partner.company] : [])))]
    const one = companies.length === 1
    out.push({
      kind: 'newPapers',
      words: `${listWords(companies)} ${one ? 'needs' : 'need'} a new statement of work. The plans changed after ${one ? 'it' : 'they'} signed. ${starts(firstNew)}`,
      short: one ? `${companies[0] ?? ''} needs a new statement of work.` : `${companies.length} trades need a new statement of work.`,
      tone: tone(newPapers),
      lineId: firstNew.lineId,
    })
  }
  for (const p of papers.values()) {
    const first = earliest(p.bars)
    const company = first?.partner?.company
    if (!first || !company) continue
    const what = p.kind === 'msa' ? `${possessive(company)} master agreement is not sent yet.` : first.pkg.sow ? `${possessive(company)} statement of work is drafted, not sent.` : `${company} has no statement of work yet.`
    out.push({ kind: 'papers', words: `${what} ${starts(first)}`, short: what, tone: tone(p.bars), lineId: first.lineId })
  }

  // The log against the chart (G-60), when it is ours to fix: a company on site with no bar, our own crew away, or the log's own reason.
  for (const gap of logChartGaps(state, project, chartHolds(state, project))) {
    if (gap.kind === 'absent' && gap.partnerId && (gap.said ?? []).length === 0) continue
    const first = gap.running[0] ?? gap.next ?? gap.last
    out.push({
      kind: 'log',
      words: `${gap.words} ${gap.todo}`,
      short: gap.kind === 'noBar' ? `${gap.company} was on site with nothing on the chart.` : `${gap.company} was not on site.`,
      tone: 'amber',
      ...(first ? { lineId: first.lineId } : {}),
    })
  }

  // Too many trades in one place (G-83): each run of crowded days, in G-83's own words.
  const weeks = crowdedWeeks(state, project)
  if (weeks.length > 0) {
    const runs = placesSummary(placeRows(state, project), weeks).filter((l) => l.crowded)
    crowdedSpells(weeks).forEach((spell, i) => {
      const words = runs[i]?.words
      if (words) out.push({ kind: 'crowd', words, short: `${spell.place} has too many trades at once.`, tone: 'amber' })
    })
  }
  return out
}

/** The ring card's lines for our moves, in order. */
export function ourMoveLines(state: GcState, project: GcProject): string[] {
  return ourScheduleMoves(state, project).map((m) => m.words)
}

/** The finish line, for the ring's card and the board row's block: "It finishes Fri Dec 25, 7 days past the contract's Fri Dec 18." Null: on time. */
export function pastContract(state: GcState, project: GcProject): { days: number; words: string } | null {
  const finish = ourScheduleMoves(state, project).find((m) => m.kind === 'finish')
  const late = finish ? (lateFinish(state, project).late ?? 0) : 0
  return finish && late > 0 ? { days: late, words: finish.words } : null
}

export interface GcScheduleMovesNeedsYou {
  count: number
  late: boolean
  title: string
  detail: string
  /** The first job's, for the press. */
  projectId: string
}

/**
 * Needs you's line for our moves on every job's schedule (the counts): "3 things to do on GC
 * schedules". Its detail is short sentences, the job named in its first. Our move, so not in the
 * people count. Null: nothing waits on us.
 */
export function gcScheduleMovesNeedsYou(state: GcState): GcScheduleMovesNeedsYou | null {
  const jobs = state.projects.map((project) => ({ project, moves: ourScheduleMoves(state, project) })).filter((j) => j.moves.length > 0)
  const first = jobs[0]
  if (!first) return null
  const count = jobs.reduce((n, j) => n + j.moves.length, 0)
  const sentences = jobs.flatMap((j) =>
    j.moves.map((m, i) => (i > 0 ? m.short : m.kind === 'finish' ? `${j.project.name} ${m.short}` : `${j.project.name}: ${m.short}`)),
  )
  return {
    count,
    late: jobs.some((j) => j.moves.some((m) => m.tone === 'red')),
    title: `${count} ${count === 1 ? 'thing' : 'things'} to do on GC schedules`,
    detail: sentences.join(' '),
    projectId: first.project.id,
  }
}

/**
 * The board row's Follow up sheet for a job (G-146): the call list's people with its items, in the
 * call list's own words, and Follow up's other people on the job, in the count's order. It is what
 * the row counts, so a company there only for the schedule has items too. Before, a company on the
 * row only for its dates or its crew had none, and the sheet left it out. Not a job being built:
 * Follow up's own list, as before.
 */
export function boardFollowPeople(state: GcState, project: GcProject): FollowPerson[] {
  const own = projectFollowPeople(state, project)
  if (!counts(project)) return own
  // G-77's paperwork holds are not asked twice: the paper's own item asks for it, as the count says it once.
  const paperwork = (i: FollowPerson['items'][number]) => i.kind === 'schedule' && i.schedule?.kind === 'held' && i.schedule.hold === 'paperwork'
  const calls = new Map(callListFollowPeople(state, project, chartHolds(state, project)).map((fp) => [fp.partner.id, { ...fp, items: fp.items.filter((i) => !paperwork(i)) }]))
  const jobs = new Map(own.map((fp) => [fp.partner.id, fp]))
  const out: FollowPerson[] = []
  for (const p of projectPeople(state, project).people) {
    const fp = calls.get(p.partnerId ?? `customer:${p.customerId ?? ''}`) ?? jobs.get(p.partnerId ?? `customer:${p.customerId ?? ''}`)
    if (fp && !out.includes(fp)) out.push(fp)
  }
  // Anyone either list has that the count does not order is kept, never dropped.
  for (const fp of [...calls.values(), ...jobs.values()]) if (!out.some((x) => x.partner.id === fp.partner.id)) out.push(fp)
  return out
}
