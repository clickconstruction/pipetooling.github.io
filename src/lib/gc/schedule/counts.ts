/**
 * GC mode, the real build, the schedule's PR 7c-i: what the call list and its rows read from the counts (G-146): the reasons a bar, the schedule and an uninsured trade give, and how they group, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCounts.ts`); the plan is to-dos/gc-mode/mockups/schedule-pr7c.md on that branch.
 */
import { startsToPromise } from '../buildingPromises'
import { partnerById } from '../lookups'
import type { PortalLang } from '../portalI18n'
import { pDate, pWeekday } from '../portalI18n'
import type { PeopleTone, PersonReason, ProjectPerson } from '../projectPeople'
import { tradePromisesOf } from '../promises'
import type { CallReason } from './callList'
import { callRows } from './callList'
import { chartHolds } from './chartHolds'
import { finishOutlook, shortCrewDetail, shortCrewReason } from './finishOutlook'
import { lateDayChanged, lateNoticeState } from './lateNotices'
import { logChartGaps } from './logVsChart'
import type { NotReadyBar, StartGap } from './notReady'
import { lapsedInsuranceWords, notReadyBars, uninsuredBars } from './notReady'
import { crowdedCalls } from './places'
import type { ScheduleItem } from './schedule'
import { mondayOf, scheduleMeasures } from './schedule'
import { lineLabel } from './splitBars'
import { companiesToTell } from './tellTrades'
import type { GcProject, GcState, Partner, TradePackage } from '../types'
import { daysUntil, weekdayDate } from '../words'

/** A company has this many days to answer its new dates before a call is due. The new start this close, it is late. */
export const CONFIRM_WITHIN_DAYS = 3

/** What a lifted line is about, in the call list's own shape (its `CallRef`). */
export interface DatesRef {
  kind: 'dates' | 'start' | 'crew'
  moveId?: string
  packageId?: string
  lineId?: string
  label?: string
}

/** A line about a company's dates or its crew, as the call list says it, with the words a message uses. */
export interface DatesLine {
  partner: Partner
  trade: string
  reason: PersonReason & { call: DatesRef; words: Record<PortalLang, { about: string; detail: string; ask: string }> }
}

function line(partner: Partner, trade: string, reason: DatesLine['reason']): DatesLine {
  return { partner, trade, reason }
}

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The hired company on a trade. Never our own crew. */
function hiredPartner(state: GcState, pkg: TradePackage | null | undefined): Partner | undefined {
  if (!pkg || pkg.selfPerform) return undefined
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

function tradeOfLine(project: GcProject, lineId: string | undefined): string {
  const a = lineId ? project.schedule?.activities.find((x) => x.lineId === lineId) : undefined
  return project.packages.find((k) => k.id === a?.packageId)?.trade ?? 'trade'
}

/** New dates told and not answered (G-113), one line per company and move. */
export function unconfirmedDates(state: GcState, project: GcProject): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const move of project.schedule?.moves ?? []) {
    if (move.undoneOn || !move.toldOn) continue
    for (const company of companiesToTell(state, project, [move])) {
      if (!move.toldTo?.includes(company.partner.id) || move.answers?.some((x) => x.partnerId === company.partner.id)) continue
      const works = company.lines.map((l) => l.work)
      const said3 = works.length > 2 ? `${works[0]} and ${works.length - 1} more` : andList(works)
      const start = company.lines.reduce((min, l) => (l.to.start < min ? l.to.start : min), company.lines[0]?.to.start ?? today)
      const toldDays = -daysUntil(move.toldOn, today)
      const tone: PeopleTone = daysUntil(start, today) <= CONFIRM_WITHIN_DAYS ? 'red' : toldDays >= CONFIRM_WITHIN_DAYS ? 'amber' : 'grey'
      const first = company.lines[0]
      out.push(line(company.partner, tradeOfLine(project, first?.lineId), {
        text: `New dates for ${said3} went out ${weekdayDate(move.toldOn)}. No answer yet.`,
        tone,
        ...(first ? { lineId: first.lineId } : {}),
        code: 'schedule',
        call: { kind: 'dates', moveId: move.id, ...(first ? { lineId: first.lineId } : {}) },
        words: {
          en: { about: `your new dates on ${name}`, detail: `We sent them ${weekdayDate(move.toldOn)}. ${company.lines.map((l) => `${l.work} is now ${weekdayDate(l.to.start)} to ${weekdayDate(l.to.finish)}`).join('. ')}`, ask: 'Do they work? You can answer in your portal.' },
          es: { about: `sus nuevas fechas en ${name}`, detail: `Se las enviamos el ${pWeekday('es', move.toldOn)}. ${company.lines.map((l) => `${l.work} ahora es del ${pWeekday('es', l.to.start)} al ${pWeekday('es', l.to.finish)}`).join('. ')}`, ask: '¿Le funcionan? Puede contestar en su portal.' },
        },
      }))
    }
  }
  return out
}

/** A first day on site within two weeks, or passed, that nobody confirmed (G-114). `items`: the schedule's, when the caller has them. */
export function unconfirmedStarts(state: GcState, project: GcProject, items: ScheduleItem[] = scheduleMeasures(state, project).items): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const s of startsToPromise(project, today, tradePromisesOf(state))) {
    if (s.promisedBy) continue
    const partner = partnerById(state, s.partnerId)
    if (!partner) continue
    const lineId = items.find((i) => i.pkg?.id === s.pkg.id && i.activity.start === s.start)?.activity.lineId
    const left = daysUntil(s.start, today)
    out.push(line(partner, s.pkg.trade, {
      text:
        left > 0
          ? `Their first day on site is ${weekdayDate(s.start)}. They have not said their crew will be there.`
          : left === 0
            ? 'Their first day on site is today. Nobody from them is on the daily log yet.'
            : `Their first day on site was ${weekdayDate(s.start)}. Nobody from them is on the daily log yet.`,
      tone: left < 0 ? 'red' : 'amber',
      ...(lineId ? { lineId } : {}),
      code: 'schedule',
      call: { kind: 'start', packageId: s.pkg.id, ...(lineId ? { lineId } : {}) },
      words: {
        en: { about: `your start on ${name}`, detail: `Your first day on our schedule is ${weekdayDate(s.start)}`, ask: 'Will your crew be there?' },
        es: { about: `su inicio en ${name}`, detail: `Su primer día en nuestro cronograma es el ${pWeekday('es', s.start)}`, ask: '¿Estará su cuadrilla ahí?' },
      },
    }))
  }
  return out
}

/** A short crew that alone moves the finish (G-57's pick 2), one line per trade. */
export function crewCalls(state: GcState, project: GcProject): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const c of finishOutlook(state, project)?.crews.short ?? []) {
    const pkg = project.packages.find((k) => k.id === c.packageId)
    const partner = hiredPartner(state, pkg)
    if (c.days <= 0 || !partner || !pkg) continue
    const ahora = c.said === null ? `Tiene ${c.now} en la obra esta semana` : `Nos dijo ${c.now} al día ${c.said === mondayOf(today) ? 'esta semana' : `la semana del ${pDate('es', c.said)}`}`
    out.push(line(partner, pkg.trade, {
      text: shortCrewReason(c, today),
      tone: 'amber',
      lineId: c.lineId,
      code: 'schedule',
      call: { kind: 'crew', lineId: c.lineId, packageId: c.packageId, label: 'Crew on site' },
      words: {
        en: { about: `your crew on ${name}`, detail: shortCrewDetail(c, today), ask: 'Can you bring it back up to size?' },
        es: { about: `su cuadrilla en ${name}`, detail: `${ahora}, frente a ${c.soFar} al día hasta ahora`, ask: '¿Puede volver a completarla?' },
      },
    }))
  }
  return out
}

/** The codes By company says in its own lines (G-115): its merge of Follow up's reasons skips them, so each is said once. G-146 adds its bar reasons. */
export const CALL_LIST_SAYS: readonly string[] = ['late', 'notReady', 'confirm', 'crew', 'crowded', 'failed', 'overdue', 'dueToday', 'behind', 'held']

/** A reason on a company, from the schedule. */
export interface ScheduleReason {
  partner: Partner
  trade: string
  reason: PersonReason
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

const REASONS = new WeakMap<GcState, WeakMap<GcProject, ScheduleReason[]>>()

/** A job whose schedule counts: being built, not closed or lost, with bars. A closed job counts nothing, as Follow up has it. */
function counts(project: GcProject): boolean {
  return project.stage === 'building' && !project.closedOn && !project.lostOn && (project.schedule?.activities.length ?? 0) > 0
}

/** "a, b and c". A name with its own "and" gets a comma before the last: "Panels and feeders, and Lighting". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  const glue = words.some((w) => w.includes(' and ')) ? ', and ' : ' and '
  return `${words.slice(0, -1).join(', ')}${glue}${words[words.length - 1]}`
}

/** A start gap (G-77) waits on the company: insurance, a W-9, a paper sent and not signed. Else on us: the award, a paper not sent, or one on older plans. */
export function gapIsTheirs(gap: StartGap, bar: NotReadyBar): boolean {
  if (gap.kind === 'insurance' || gap.kind === 'w9') return true
  if (gap.kind === 'msa') return bar.partner?.msa === 'sent'
  if (gap.kind === 'sow') return bar.pkg.sow?.status === 'sent'
  return false
}

/**
 * A company's reasons from the schedule, each from its kernel's own read: not ready to start on the
 * papers that are theirs (G-77), its word on its dates (G-116's early warnings), the log against the
 * chart with no reason given (G-60), a crew too short to hold the finish (G-57), and a crowded place
 * it has not given its count for (G-83). At work uninsured (G-138) is the insurance reason's own
 * words: `uninsuredReason`.
 */
export function scheduleReasons(state: GcState, project: GcProject): ScheduleReason[] {
  return kept(REASONS, state, project, () => readReasons(state, project))
}

function readReasons(state: GcState, project: GcProject): ScheduleReason[] {
  if (!counts(project)) return []
  const today = state.today
  const out: ScheduleReason[] = []
  const add = (partner: Partner, trade: string, reason: PersonReason) => out.push({ partner, trade, reason })

  // Not ready to start (G-77), on the papers that are theirs: one reason a company, its bars by name, the first with its start.
  const waiting = new Map<string, { partner: Partner; trade: string; bars: NotReadyBar[]; nouns: string[] }>()
  for (const bar of notReadyBars(state, project)) {
    const theirs = bar.gaps.filter((g) => gapIsTheirs(g, bar))
    if (!bar.partner || theirs.length === 0) continue
    const w = waiting.get(bar.partner.id) ?? { partner: bar.partner, trade: bar.pkg.trade, bars: [], nouns: [] }
    w.bars.push(bar)
    for (const g of theirs) if (!w.nouns.includes(g.noun)) w.nouns.push(g.noun)
    waiting.set(bar.partner.id, w)
  }
  for (const w of waiting.values()) {
    // In the order they start, so the first named is the one that starts first.
    const bars = [...w.bars].sort((a, b) => a.start.localeCompare(b.start))
    const first = bars[0]
    if (!first) continue
    const names = bars.map((b) => lineLabel(project, b.lineId))
    const said = names.length > 2 ? `${names[0]} and ${names.length - 1} more` : listWords(names)
    add(w.partner, w.trade, {
      text: `${said} ${names.length === 1 ? 'waits' : 'wait'} on ${listWords(w.nouns)}. ${lineLabel(project, first.lineId)} starts ${weekdayDate(first.start)}.`,
      tone: w.bars.some((b) => b.late) ? 'red' : 'amber',
      code: 'notReady',
      lineId: first.lineId,
    })
  }

  // Their word on their dates (G-116's early warnings, G-113 and G-114): new dates not answered, a first day not confirmed.
  for (const l of [...unconfirmedDates(state, project), ...unconfirmedStarts(state, project)]) {
    add(l.partner, l.trade, { text: l.reason.text, tone: l.reason.tone, code: 'confirm', ...(l.reason.lineId ? { lineId: l.reason.lineId } : {}) })
  }
  // A push back of ours on their late notice (G-117) that they have not answered.
  for (const n of project.schedule?.lateNotices ?? []) {
    if (!n.pushedBack || lateNoticeState(project, n) !== 'pushedBack') continue
    const partner = partnerById(state, n.partnerId)
    if (!partner) continue
    add(partner, tradeOfLine(project, n.lineId), {
      text: `We pushed back on their new day for ${lineLabel(project, n.lineId)} on ${weekdayDate(n.pushedBack.on)}. They have not answered.`,
      tone: lateDayChanged(n) < today ? 'red' : 'amber',
      code: 'pushedBack',
      lineId: n.lineId,
    })
  }

  // The log and the chart (G-60): a company's bars ran with nobody from it on the log, and the log gave no reason.
  for (const gap of logChartGaps(state, project, chartHolds(state, project))) {
    if (gap.kind !== 'absent' || !gap.partnerId || (gap.said ?? []).length > 0) continue
    const partner = partnerById(state, gap.partnerId)
    const first = gap.running[0]
    if (partner) add(partner, gap.pkg.trade, { text: gap.words, tone: 'amber', code: 'log', ...(first ? { lineId: first.lineId } : {}) })
  }

  // A short crew that alone moves the finish (G-57).
  for (const l of crewCalls(state, project)) add(l.partner, l.trade, { text: l.reason.text, tone: l.reason.tone, code: 'crew', ...(l.reason.lineId ? { lineId: l.reason.lineId } : {}) })

  // Too many trades in one place (G-83): a hired company in a crowded week that has not said how many it will have.
  for (const c of crowdedCalls(state, project)) {
    const partner = partnerById(state, c.partnerId)
    if (partner) add(partner, c.trade, { text: c.text, tone: c.tone, code: 'crowded', lineId: c.lineId })
  }
  return out
}

/**
 * The companies at work uncovered on this job (G-138), by id: each one's insurance reason in G-138's
 * words, with the bars under way. Companies, not bars. A renewal promise not yet due does not take
 * it off: the work going on today is not covered.
 */
export function uninsuredReasons(state: GcState, project: GcProject): Map<string, PersonReason> {
  const out = new Map<string, PersonReason>()
  if (!counts(project)) return out
  const bars = uninsuredBars(state, project)
  for (const partner of new Map(bars.map((b) => [b.partner.id, b.partner])).values()) {
    const words = lapsedInsuranceWords(partner, state.today)
    const names = bars.filter((b) => b.partner.id === partner.id).map((b) => lineLabel(project, b.lineId))
    // Words only, as the insurance reason has always been: the bars are named, and the paper is the company's, not a bar's.
    if (words) out.set(partner.id, { text: `${words} They are at work on ${listWords(names)}.`, tone: 'red', code: 'insurance', atWork: true })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// G-146: the call list's own bar reasons on the count, and the board row's sheet
// ---------------------------------------------------------------------------------------------

/** The call list's bar reasons as the count codes them (G-146). */
export type BarCode = 'failed' | 'overdue' | 'dueToday' | 'behind' | 'held'

/** The call list's kinds to the count's codes: its `late` is `overdue`, so a trade's own word that it will be late (G-117's `late`) never clashes. */
const BAR_CODE: Partial<Record<string, BarCode>> = { failed: 'failed', late: 'overdue', due: 'dueToday', behind: 'behind', held: 'held' }

/** A bar reason on the count, under whoever owes the call: the trade doing the bar, the company bringing a delivery, the architect, the customer. */
export interface BarReason {
  person: Omit<ProjectPerson, 'reasons' | 'tone' | 'last'>
  /** The call list's own line, its words kept for the sheet, with the count's code. */
  reason: CallReason
}

const BARS = new WeakMap<GcState, WeakMap<GcProject, BarReason[]>>()

/**
 * The call list's own bar reasons (G-146), read from `callRows`: an inspection failed on their work,
 * a bar past its finish, due today or behind, and a bar held by what someone owes, under whoever owes
 * it. An aside never counts: it waits on us, the city or the utility. G-77's paperwork holds are the
 * counts' `notReady` already, one per company, so they are not counted again.
 */
export function barReasons(state: GcState, project: GcProject): BarReason[] {
  return kept(BARS, state, project, () => {
    if (!counts(project)) return []
    return callRows(state, project, chartHolds(state, project)).flatMap((p) => {
      const person = { key: p.key, kind: p.kind, name: p.name, company: p.company, tag: p.tag, phone: p.phone, ...(p.partnerId ? { partnerId: p.partnerId } : {}), ...(p.customerId ? { customerId: p.customerId } : {}) }
      return p.reasons.flatMap((r): BarReason[] => {
        if (r.aside || !r.call || (r.call.kind === 'held' && r.call.hold === 'paperwork')) return []
        const code = BAR_CODE[r.call.kind]
        return code ? [{ person, reason: { ...r, code } }] : []
      })
    })
  })
}

/** The codes of a person's reasons that come from the schedule: the call list's, the counts', a late notice, another day asked for. */
const SCHEDULE_CODES: readonly string[] = ['failed', 'overdue', 'dueToday', 'behind', 'held', 'notReady', 'confirm', 'pushedBack', 'log', 'crew', 'crowded', 'late', 'dates', 'schedule']

/** Which group a person's reason shows in (G-146): on the schedule, or owed to us (papers, answers, money). */
export function reasonGroup(code: string | undefined): 'schedule' | 'owed' {
  return SCHEDULE_CODES.includes(code ?? '') ? 'schedule' : 'owed'
}

/** The two groups' words, in the order they show. */
export const REASON_GROUPS: readonly { key: 'schedule' | 'owed'; words: string }[] = [
  { key: 'schedule', words: 'On the schedule' },
  { key: 'owed', words: 'Owed to us' },
]
