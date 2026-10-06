/**
 * GC mode design spike: By company as a call list, the Gantt's G-115 (`to-dos/gc-mode/GANTT_PLAN.md`,
 * mock-up `to-dos/gc-mode/mockups/G-115.md`). The office groups the chart by company because it is
 * about to pick up the phone. This is the list it works from: one row per person whose answer moves
 * the chart, every reason under their name, with Follow up's own Call and Follow up on each.
 *
 * - A hired trade, for its bars: an inspection that failed on its work, a bar late, due today or
 *   behind, new dates told and not answered or answered with another day, a first day nobody
 *   confirmed.
 * - Whoever owes what holds a bar. Every hold on it counts, not only the one the chart's pill shows:
 *   a submittal, an RFI and a wait from their own records, any other kind (G-77's paperwork, one
 *   added later) from the chart's own map. The rule is keyed by the hold's kind and who owes it; a
 *   kind it does not know is the trade's own, worded as the chart words it. A hold that waits on
 *   us, the city or the utility is an aside under the trade, never a row: nobody to call.
 * - Then everything else they owe on this job (`projectPeople`'s reasons): one call covers it all.
 *
 * Its own file, out of the barrel: it reads the schedule, the chart's holds and Follow up.
 */
import type { GcAction, GcCustomer, GcProject, GcState, Partner, ScheduleMove, Submittal, TradePackage } from './gcTypes'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { partnerById } from './gcLookups'
import { daysBetween, scheduleMeasures, type ScheduleItem } from './gcBuildingSchedule'
import { ganttBars, type GanttBar, type GanttHold } from './gcGantt'
import { submittalHolding, submittalNeededBy, submittalState } from './gcBuildingSubmittals'
import { notReadyBars, type NotReadyBar } from './gcNotReady'
import { rfiRows, type RfiRow } from './gcBuildingRfis'
import { waitRows, type WaitRow } from './gcScheduleWaits'
import { companiesToTell, datesAsksOpen, untoldMoves } from './gcTellTrades'
import { startsToPromise } from './gcBuildingPromises'
import { tradePromisesOf, tradePromiseState } from './gcPromises'
import { customerAsPerson, projectFollowPeople, projectPeople, type PeopleTone, type PersonReason, type ProjectPerson } from './gcProjectPeople'
import { partnerReach, type FollowItem, type FollowPerson } from './gcFollowUpSheet'
import { pWeekday, type PortalLang } from './gcPortalI18n'

/** A company has this many days to answer its new dates before a call is due. The new start this close, it is late. */
export const CONFIRM_WITHIN_DAYS = 3

/** What a line on the call list is about on the schedule, for the Follow up sheet and the call's answer. */
export interface CallRef {
  kind: 'failed' | 'late' | 'due' | 'behind' | 'dates' | 'asked' | 'start' | 'held' | 'notice' | 'bar'
  /** A held bar's hold, as the chart has it: 'submittal', 'rfi', 'delivery', … or a kind added later. */
  hold?: string
  lineId?: string
  packageId?: string
  moveId?: string
  waitId?: string
  /** What the Follow up sheet calls it, where the bar's name is not the thing asked about: "Submittal 23 09 23-01". */
  label?: string
}

type Words = Record<PortalLang, { about: string; detail: string; ask: string }>

/** A reason on the call list: Follow up's reason, plus the bar it is about and the words a message uses. */
export interface CallReason extends PersonReason {
  /** Unset: one of Follow up's own reasons on this job, merged under the name. */
  call?: CallRef
  words?: Words
}

export interface CallPerson extends ProjectPerson {
  reasons: CallReason[]
}

export interface CallList {
  people: CallPerson[]
  count: number
  /** People with a day passed (a red reason). */
  late: number
  tone: PeopleTone | null
}

/**
 * A trade's word, from its portal, that a bar will be late (G-117, Helper 4's row). The call list
 * reads it once that row lands: `openLateNotices(project)` goes in `callList`'s last argument.
 */
export interface LateNotice {
  partnerId: string
  lineId: string
  /** The day they asked for. Null: none given. */
  day: string | null
  reason: string | null
}

const RANK: Record<PeopleTone, number> = { red: 0, amber: 1, grey: 2 }
const KIND_ORDER: Record<ProjectPerson['kind'], number> = { trade: 0, customer: 1, architect: 2 }
const NO_CALLS: CallList = { people: [], count: 0, late: 0, tone: null }

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** A line's name inside a sentence: "panels and feeders", but "TPO membrane" keeps its capitals. */
function inSentence(name: string): string {
  return /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name
}

/** A trade's line as a message names it: "structural steel erection", "roofing TPO membrane". */
function workWords(trade: string, label: string): string {
  return label.toLowerCase().startsWith(trade.toLowerCase()) ? inSentence(label) : `${inSentence(trade)} ${inSentence(label)}`
}

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The day's tone the way the RFIs tab gives it (`neededTone`): passed or today red, within three days amber. */
function neededTone(on: string | null, today: string): PeopleTone {
  if (!on) return 'grey'
  const left = daysUntil(on, today)
  return left <= 0 ? 'red' : left <= 3 ? 'amber' : 'grey'
}

/** "needed today", "needed by Fri Oct 9", "2 days late". */
function neededWords(on: string, today: string): string {
  const left = daysUntil(on, today)
  return left < 0 ? `${days(-left)} late` : left === 0 ? 'needed today' : `needed by ${weekdayDate(on)}`
}

/** The hired company on a trade. Never our own crew. */
function hiredPartner(state: GcState, pkg: TradePackage | null | undefined): Partner | undefined {
  if (!pkg || pkg.selfPerform) return undefined
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

/** The last thing said with them: this job's asks and the company's own record, newest first. */
function lastWord(state: GcState, project: GcProject, person: { partnerId?: string; customerId?: string }): string | null {
  const said: { on: string; line: string }[] = []
  if (person.partnerId) {
    const partner = partnerById(state, person.partnerId)
    for (const pkg of project.packages) {
      for (const invite of pkg.invites) {
        if (invite.partnerId !== person.partnerId) continue
        for (const c of invite.contacts ?? []) said.push({ on: c.on, line: `${shortDate(c.on)} · ${c.how === 'portal' ? 'in their portal' : c.how === 'call' ? `${c.by} called` : `${c.by}, by ${c.how}`}: ${c.note}` })
      }
    }
    for (const c of partner?.contacts ?? []) said.push({ on: c.on, line: `${shortDate(c.on)} · ${c.by}: ${c.note}` })
  } else if (person.customerId) {
    const customer = state.customers.find((c) => c.id === person.customerId)
    for (const c of customer?.contacts ?? []) said.push({ on: c.on, line: `${shortDate(c.on)} · ${c.by}: ${c.note}` })
  }
  return said.sort((a, b) => b.on.localeCompare(a.on))[0]?.line ?? null
}

/** A spare-days clause for work that sets the finish or nearly does. */
function tightWords(bar: GanttBar): string {
  if (!bar.tight) return ''
  return bar.spare <= 0 ? ' It has no spare days.' : ` It has ${bar.spare} spare ${bar.spare === 1 ? 'day' : 'days'}.`
}

/** The people the call list collects into, each once. */
class Rows {
  private byKey = new Map<string, CallPerson>()
  constructor(
    private state: GcState,
    private project: GcProject,
    private tradeOrder: (partnerId: string) => number,
  ) {}

  trade(partner: Partner, tag: string, reason: CallReason): void {
    this.add({ key: `partner:${partner.id}`, kind: 'trade', name: partner.contact || partner.company, company: partner.company, tag, partnerId: partner.id, phone: partnerReach(partner).phone }, reason)
  }

  customer(customer: GcCustomer, kind: 'architect' | 'customer', reason: CallReason): void {
    this.add(
      { key: `customer:${customer.id}`, kind, name: customer.contact || customer.name, company: customer.name, tag: kind, customerId: customer.id, phone: customer.phone || partnerReach(customerAsPerson(customer)).phone },
      reason,
    )
  }

  private add(base: Omit<CallPerson, 'reasons' | 'tone' | 'last'>, reason: CallReason): void {
    const found = this.byKey.get(base.key)
    if (found) {
      if (!found.reasons.some((r) => r.text === reason.text)) found.reasons.push(reason)
      return
    }
    this.byKey.set(base.key, { ...base, reasons: [reason], tone: reason.tone, last: null })
  }

  /** Everyone with a reason that is theirs, Follow up's reasons on this job merged under the name, worst first. */
  done(): CallList {
    const followUp = new Map(projectPeople(this.state, this.project).people.map((p) => [p.key, p]))
    const theirs = (p: CallPerson) => p.reasons.filter((r) => !r.aside)
    const people = [...this.byKey.values()]
      .filter((p) => theirs(p).length > 0)
      .map((p): CallPerson => {
        const merged = [...p.reasons]
        for (const r of followUp.get(p.key)?.reasons ?? []) if (!merged.some((x) => x.text === r.text)) merged.push(r)
        const mine = merged.filter((r) => !r.aside).sort((a, b) => RANK[a.tone] - RANK[b.tone])
        const asides = merged.filter((r) => r.aside)
        const tone = mine.reduce<PeopleTone>((w, r) => (RANK[r.tone] < RANK[w] ? r.tone : w), 'grey')
        return { ...p, reasons: [...mine, ...asides], tone, last: followUp.get(p.key)?.last ?? lastWord(this.state, this.project, p) }
      })
      .sort(
        (a, b) =>
          RANK[a.tone] - RANK[b.tone] ||
          theirs(b).length - theirs(a).length ||
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
          (a.partnerId ? this.tradeOrder(a.partnerId) : 999) - (b.partnerId ? this.tradeOrder(b.partnerId) : 999),
      )
    const late = people.filter((p) => p.tone === 'red').length
    return { people, count: people.length, late, tone: people[0]?.tone ?? null }
  }
}

/** One hold on a bar, with what the call list needs to say who owes it. */
interface HoldOnBar {
  lineId: string
  hold: GanttHold
  /** The record behind it, when it has one: the wait (a delivery, a decision, a permit, the utility), the RFI, the submittal. */
  wait?: WaitRow
  rfi?: RfiRow
  submittal?: Submittal
}

/** What a resolver gets: the bar, the hold, the trade doing the bar, and where to put the reasons. */
interface HoldCtx {
  state: GcState
  project: GcProject
  item: ScheduleItem
  on: HoldOnBar
  trade: Partner | undefined
  rows: Rows
  /** The bars a trade is not ready to start (G-77), each with the papers it waits on. */
  notReady: NotReadyBar[]
}

/** The work's own name: "Sheet metal and flashing", or an inspection's. */
function workOf(item: ScheduleItem): string {
  return item.label
}

/** An aside under the trade doing the bar: said so the caller knows, not theirs to do. */
function aside(ctx: HoldCtx, text: string): void {
  if (ctx.trade) ctx.rows.trade(ctx.trade, ctx.item.trade, { text, tone: 'grey', aside: true, lineId: ctx.on.lineId, code: 'schedule' })
}

/** The default: what holds the bar is the trade's own to clear, worded the way the chart words it. */
function holdIsTheTrades(ctx: HoldCtx): void {
  if (!ctx.trade) return
  const work = workOf(ctx.item)
  const project = ctx.project.name
  ctx.rows.trade(ctx.trade, ctx.item.trade, {
    text: `${work} waits on ${ctx.on.hold.words}.`,
    tone: ctx.on.hold.late ? 'red' : 'amber',
    lineId: ctx.on.lineId,
    code: 'schedule',
    call: { kind: 'held', hold: ctx.on.hold.kind, lineId: ctx.on.lineId, ...(ctx.item.pkg ? { packageId: ctx.item.pkg.id } : {}) },
    words: {
      en: { about: `your ${workWords(ctx.item.trade, work)} on ${project}`, detail: `It waits on ${ctx.on.hold.words}`, ask: 'Could you take care of it this week?' },
      es: { about: `su trabajo de ${inSentence(work)} en ${project}`, detail: `Está detenido por ${ctx.on.hold.words}`, ask: '¿Lo puede resolver esta semana?' },
    },
  })
}

/**
 * Who owes each kind of hold, and the words. A kind not here is the trade's own (`holdIsTheTrades`):
 * G-77's paperwork reaches the trade's row with no change here.
 */
const HOLD_OWNERS: Partial<Record<string, (ctx: HoldCtx) => void>> = {
  submittal: (ctx) => {
    const s = ctx.on.submittal ?? submittalHolding(ctx.project, ctx.on.lineId)
    if (!s) return holdIsTheTrades(ctx)
    const work = workOf(ctx.item)
    const today = ctx.state.today
    const needed = submittalNeededBy(ctx.project, s)
    const st = submittalState(s)
    if (st === 'us') return aside(ctx, `${work} waits on submittal ${s.number}. It is with us to review${needed ? `, ${neededWords(needed, today)}` : ''}.`)
    if (st === 'architect') {
      aside(ctx, `${work} waits on submittal ${s.number}. It is with the architect.`)
      const architect = ctx.state.customers.find((c) => c.id === ctx.project.architectId)
      if (!architect) return
      const left = needed ? daysUntil(needed, today) : null
      const back = !needed || left === null ? '' : left < 0 ? ` It was needed back ${weekdayDate(needed)}.` : left === 0 ? ' It is needed back today.' : ` It is needed back by ${weekdayDate(needed)}.`
      ctx.rows.customer(architect, 'architect', {
        text: `Submittal ${s.number} holds ${work}, which starts ${weekdayDate(ctx.item.activity.start)}.${back}`,
        tone: neededTone(needed, today),
        lineId: ctx.on.lineId,
        code: 'schedule',
        call: { kind: 'held', hold: 'submittal', lineId: ctx.on.lineId, label: `Submittal ${s.number}` },
        words: {
          en: { about: `submittal ${s.number} for ${work} on ${ctx.project.name}`, detail: `${work} waits on your review and starts ${weekdayDate(ctx.item.activity.start)}`, ask: needed ? `Could you send it back by ${weekdayDate(needed)}?` : 'Could you send it back this week?' },
          es: { about: `el documento para aprobación ${s.number} de ${work} en ${ctx.project.name}`, detail: `${work} espera su revisión y empieza el ${pWeekday('es', ctx.item.activity.start)}`, ask: needed ? `¿Lo puede devolver para el ${pWeekday('es', needed)}?` : '¿Lo puede devolver esta semana?' },
        },
      })
      return
    }
    // The trade's own move: a submittal not sent, or sent back to revise.
    if (!ctx.trade) return
    const left = needed ? daysUntil(needed, today) : null
    const when = !needed || left === null ? '.' : left < 0 ? `. It was needed ${weekdayDate(needed)}.` : left === 0 ? ', needed today.' : `, needed by ${weekdayDate(needed)}.`
    const promise = tradePromisesOf(ctx.state).find((p) => !p.keptOn && p.kind === 'submittals' && p.partnerId === ctx.trade?.id && p.projectId === ctx.project.id && p.packageId === s.packageId)
    const word = promise && tradePromiseState(promise, today).state === 'pending' ? ` They said they will send it ${weekdayDate(promise.by)}.` : ''
    ctx.rows.trade(ctx.trade, ctx.item.trade, {
      text: `${work} waits on their submittal ${s.number}${when}${word}`,
      tone: neededTone(needed, today),
      lineId: ctx.on.lineId,
      code: 'schedule',
      call: { kind: 'held', hold: 'submittal', lineId: ctx.on.lineId, packageId: s.packageId, label: `Submittal ${s.number}` },
      words: {
        en: { about: `your submittal ${s.number} for ${inSentence(work)}`, detail: `${work} cannot start without it${needed ? `. We need it by ${weekdayDate(needed)}` : ''}`, ask: 'When can you send it?' },
        es: { about: `su documento para aprobación ${s.number} de ${inSentence(work)}`, detail: `${work} no puede empezar sin él${needed ? `. Lo necesitamos para el ${pWeekday('es', needed)}` : ''}`, ask: '¿Para cuándo lo puede enviar?' },
      },
    })
  },

  rfi: (ctx) => {
    const r = ctx.on.rfi
    if (!r) return holdIsTheTrades(ctx)
    const work = workOf(ctx.item)
    if (r.state === 'us') return aside(ctx, `${work} waits on ${r.label}. It is with us${r.needed ? `, ${r.needed}` : ''}.`)
    aside(ctx, `${work} waits on ${r.label}. It is with the architect.`)
    const architect = ctx.state.customers.find((c) => c.id === ctx.project.architectId)
    if (!architect) return
    ctx.rows.customer(architect, 'architect', {
      text: `${r.label} holds ${work}, which starts ${weekdayDate(ctx.item.activity.start)}.${r.needed ? ` The answer is ${r.needed}.` : ''}`,
      tone: r.neededTone,
      lineId: ctx.on.lineId,
      code: 'schedule',
      call: { kind: 'held', hold: 'rfi', lineId: ctx.on.lineId, label: r.label },
      words: {
        en: { about: `${r.label} on ${ctx.project.name}`, detail: `${work} waits on your answer and starts ${weekdayDate(ctx.item.activity.start)}`, ask: 'Could you answer it this week?' },
        es: { about: `la pregunta ${r.label} de ${ctx.project.name}`, detail: `${work} espera su respuesta y empieza el ${pWeekday('es', ctx.item.activity.start)}`, ask: '¿La puede contestar esta semana?' },
      },
    })
  },

  delivery: (ctx) => {
    const w = ctx.on.wait
    if (!w) return holdIsTheTrades(ctx)
    const pkg = ctx.project.packages.find((k) => k.id === w.wait.packageId)
    const owner = hiredPartner(ctx.state, pkg)
    const work = workOf(ctx.item)
    if (!owner || !pkg) return aside(ctx, `${work} waits on a delivery: ${w.wait.title}, expected ${weekdayDate(w.wait.expectedOn)} from ${w.wait.who}.`)
    const today = ctx.state.today
    const passed = today > w.wait.expectedOn
    const after = daysBetween(ctx.item.activity.start, w.wait.expectedOn)
    // "its delivery" when the delivery is named like the work; "their supplier" on the trade's own row.
    const what = w.wait.title.trim().toLowerCase() === work.trim().toLowerCase() ? 'its delivery' : `a delivery of ${inSentence(w.wait.title)}`
    const who = w.wait.who === `${owner.company}'s supplier` ? 'their supplier' : w.wait.who
    const text = passed
      ? `${work} waits on ${what}, due ${weekdayDate(w.wait.expectedOn)} and not in.`
      : `${work} waits on ${what}, expected ${weekdayDate(w.wait.expectedOn)} from ${who}. ${after > 0 ? `That is ${days(after)} after it starts.` : 'That is the day it starts.'}`
    ctx.rows.trade(owner, pkg.trade, {
      text,
      tone: 'red',
      lineId: ctx.on.lineId,
      code: 'schedule',
      call: { kind: 'held', hold: 'delivery', lineId: ctx.on.lineId, packageId: pkg.id, waitId: w.wait.id },
      words: {
        en: { about: `the delivery of ${inSentence(w.wait.title)} for ${ctx.project.name}`, detail: `It is expected ${weekdayDate(w.wait.expectedOn)}, and ${work} starts ${weekdayDate(ctx.item.activity.start)}`, ask: 'Can your supplier ship it sooner?' },
        es: { about: `la entrega de ${w.wait.title} para ${ctx.project.name}`, detail: `Se espera el ${pWeekday('es', w.wait.expectedOn)}, y ${work} empieza el ${pWeekday('es', ctx.item.activity.start)}`, ask: '¿Su proveedor la puede enviar antes?' },
      },
    })
  },

  decision: (ctx) => {
    const w = ctx.on.wait
    const customer = ctx.state.customers.find((c) => c.id === ctx.project.customerId)
    if (!w || !customer) return holdIsTheTrades(ctx)
    const work = workOf(ctx.item)
    aside(ctx, `${work} waits on the customer's decision on ${w.wait.title}.`)
    const passed = ctx.state.today > w.wait.expectedOn
    ctx.rows.customer(customer, 'customer', {
      text: passed
        ? `${work} waits on their decision on ${w.wait.title}. It was expected ${weekdayDate(w.wait.expectedOn)}.`
        : `${work} waits on their decision on ${w.wait.title}, expected ${weekdayDate(w.wait.expectedOn)}. ${work} starts ${weekdayDate(ctx.item.activity.start)}.`,
      tone: 'red',
      lineId: ctx.on.lineId,
      code: 'schedule',
      call: { kind: 'held', hold: 'decision', lineId: ctx.on.lineId, waitId: w.wait.id, label: `Decision on ${w.wait.title}` },
      words: {
        en: { about: `your decision on ${w.wait.title}`, detail: `${work} waits on it and starts ${weekdayDate(ctx.item.activity.start)}`, ask: 'Could you let us know this week?' },
        es: { about: `su decisión sobre ${w.wait.title}`, detail: `${work} la espera y empieza el ${pWeekday('es', ctx.item.activity.start)}`, ask: '¿Nos puede avisar esta semana?' },
      },
    })
  },

  // A trade not ready to start (G-77): its own papers, by name. The chart folds a hold already on the
  // bar into the same words ("current insurance and submittal 28 31 11-01"); that hold reaches its
  // own owner from its record, so the trade is not asked for the architect's submittal.
  paperwork: (ctx) => {
    const bar = ctx.notReady.find((b) => b.lineId === ctx.on.lineId)
    if (!bar) return holdIsTheTrades(ctx)
    holdIsTheTrades({ ...ctx, on: { ...ctx.on, hold: { ...ctx.on.hold, words: andList(bar.gaps.map((g) => g.noun)), late: bar.late } } })
  },

  // The city and the utility: nobody to call from here, so the trade hears it as an aside.
  permit: (ctx) => {
    if (ctx.on.wait) aside(ctx, `${workOf(ctx.item)} waits on ${ctx.on.wait.wait.title} from ${ctx.on.wait.wait.who}.`)
  },
  utility: (ctx) => {
    if (ctx.on.wait) aside(ctx, `${workOf(ctx.item)} waits on ${ctx.on.wait.wait.title} from ${ctx.on.wait.wait.who}.`)
  },
}

/** The holds with a record of their own: each reaches its owner from the record, whichever took the chart's pill. */
const RECORD_KINDS = new Set<string>(['rfi', 'submittal', 'delivery', 'decision', 'permit', 'utility'])

/**
 * Every hold on a bar. The chart draws one a bar, so a bar held by a submittal and an RFI shows
 * one of them, and G-77 folds both into its paperwork words. Here a submittal, an RFI and a wait
 * come from their own records, by the chart's own rules, and every other kind from the chart's map.
 */
function holdsOnBars(state: GcState, project: GcProject, holds: Map<string, GanttHold>, rfis: RfiRow[]): HoldOnBar[] {
  const out: HoldOnBar[] = []
  for (const r of rfis) {
    if (r.state === 'answered') continue
    for (const h of r.holds) out.push({ lineId: h.lineId, hold: { kind: 'rfi', words: `${r.label}, ${r.stateWords}`, late: r.late }, rfi: r })
  }
  for (const a of project.schedule?.activities ?? []) {
    const s = submittalHolding(project, a.lineId)
    if (!s) continue
    const needed = submittalNeededBy(project, s)
    out.push({ lineId: a.lineId, hold: { kind: 'submittal', words: `submittal ${s.number}`, late: needed !== null && needed < state.today }, submittal: s })
  }
  for (const r of waitRows(state, project)) {
    if (r.state === 'done' || !r.late) continue
    for (const h of r.holds) out.push({ lineId: h.lineId, hold: { kind: r.wait.kind, words: r.wait.title, late: true }, wait: r })
  }
  for (const [lineId, hold] of holds) if (!RECORD_KINDS.has(hold.kind)) out.push({ lineId, hold })
  return out
}

/**
 * Everyone whose answer moves this chart, worst first, with everything they owe on this job. Only a
 * job being built: while the schedule is drawn, nothing is late yet. `holds` is the chart's own map
 * (the Schedule tab's `holdsOf`, with G-77's `withNotReady`): a hold kind added to the chart reaches
 * the list with it.
 */
export function callList(state: GcState, project: GcProject, holds: Map<string, GanttHold>, lateNotices: LateNotice[] = []): CallList {
  if (project.stage !== 'building' || project.closedOn || project.lostOn || !project.schedule || project.schedule.activities.length === 0) return NO_CALLS
  const today = state.today
  const m = scheduleMeasures(state, project)
  // Where each bar stands without its holds: a held bar can be behind too, and the hold has its own line.
  const bars = ganttBars(m.items, m.float, new Map(), today, true)
  const order = new Map<string, number>()
  m.items.forEach((item, i) => {
    const p = hiredPartner(state, item.pkg)
    if (p && !order.has(p.id)) order.set(p.id, i)
  })
  const rows = new Rows(state, project, (id) => order.get(id) ?? 998)
  const name = project.name
  const noticeFor = (partnerId: string, lineId: string) => lateNotices.find((n) => n.partnerId === partnerId && n.lineId === lineId)
  const noticeWords = (n: LateNotice | undefined) => (n ? ` They told us in their portal it will be ${n.day ? weekdayDate(n.day) : 'later'}${n.reason ? `: “${n.reason}”` : '.'}` : '')
  const said = new Set<string>()

  for (const bar of bars) {
    const item = bar.item
    const a = item.activity
    if (bar.status === 'done' || a.added) continue
    // An inspection that failed on a trade's work: the trade fixes it, not the city.
    if (bar.status === 'failed' && a.inspection) {
      const fail = (a.inspection.failed ?? [])[(a.inspection.failed ?? []).length - 1]
      if (!fail) continue
      const again = fail.reinspectOn === today ? 'The city sees it again today.' : fail.reinspectOn > today ? `The city sees it again ${weekdayDate(fail.reinspectOn)}.` : `It was to be seen again ${weekdayDate(fail.reinspectOn)}.`
      for (const pkgId of fail.packageIds ?? []) {
        const pkg = project.packages.find((k) => k.id === pkgId)
        const partner = hiredPartner(state, pkg)
        if (!partner || !pkg) continue
        rows.trade(partner, pkg.trade, {
          text: `${item.label} failed ${weekdayDate(fail.on)}. ${again}${fail.note ? ` What failed: “${fail.note}”` : ''}`,
          tone: 'red',
          lineId: a.lineId,
          code: 'schedule',
          call: { kind: 'failed', lineId: a.lineId, packageId: pkg.id },
          words: {
            en: { about: `the ${item.label.toLowerCase()} on ${name}`, detail: `It failed ${weekdayDate(fail.on)}. ${again.replace(/\.$/, '')}`, ask: 'Will it be fixed for the inspector?' },
            es: { about: `la inspección de ${name}`, detail: `No pasó el ${pWeekday('es', fail.on)}. La ciudad vuelve a revisar ${fail.reinspectOn === today ? 'hoy' : `el ${pWeekday('es', fail.reinspectOn)}`}`, ask: '¿Quedará corregido para el inspector?' },
          },
        })
      }
      continue
    }
    const partner = hiredPartner(state, item.pkg)
    if (!partner || !item.pkg) continue
    const work = item.label
    const pct = Math.round(item.actual)
    const planned = Math.round(item.plannedToday)
    const notice = noticeFor(partner.id, a.lineId)
    const ref = { lineId: a.lineId, packageId: item.pkg.id }
    if (bar.status === 'late') {
      said.add(`${partner.id}:${a.lineId}`)
      rows.trade(partner, item.pkg.trade, {
        text: `${work} is ${days(bar.daysLate)} late and ${pct}% done.${tightWords(bar)}${noticeWords(notice)}`,
        tone: 'red',
        lineId: a.lineId,
        code: 'schedule',
        call: { kind: 'late', ...ref },
        words: {
          en: { about: `your ${workWords(item.trade, work)} on ${name}`, detail: `It was due ${weekdayDate(a.finish)} and is ${pct}% done`, ask: 'When will it be done?' },
          es: { about: `su trabajo de ${inSentence(work)} en ${name}`, detail: `Debía terminar el ${pWeekday('es', a.finish)} y va en ${pct}%`, ask: '¿Para cuándo estará terminado?' },
        },
      })
    } else if (bar.status === 'behind') {
      said.add(`${partner.id}:${a.lineId}`)
      const due = a.finish === today
      rows.trade(partner, item.pkg.trade, {
        text: due
          ? `${work} is due today and ${pct}% done.${tightWords(bar)}${noticeWords(notice)}`
          : `${work} is behind: ${pct}% done against ${planned}% in the plan. It is due ${weekdayDate(a.finish)}.${tightWords(bar)}${noticeWords(notice)}`,
        tone: 'amber',
        lineId: a.lineId,
        code: 'schedule',
        call: { kind: due ? 'due' : 'behind', ...ref },
        words: due
          ? {
              en: { about: `your ${workWords(item.trade, work)} on ${name}`, detail: `It is due today and ${pct}% done`, ask: 'Will it be done today?' },
              es: { about: `su trabajo de ${inSentence(work)} en ${name}`, detail: `Debe terminar hoy y va en ${pct}%`, ask: '¿Quedará terminado hoy?' },
            }
          : {
              en: { about: `your ${workWords(item.trade, work)} on ${name}`, detail: `It is ${pct}% done, and our plan had ${planned}% by today`, ask: 'When will it be done?' },
              es: { about: `su trabajo de ${inSentence(work)} en ${name}`, detail: `Va en ${pct}% y nuestro plan tenía ${planned}% para hoy`, ask: '¿Para cuándo estará terminado?' },
            },
      })
    }
  }

  // New dates told and not answered (G-113): the call is to hear the yes or the other day.
  for (const move of project.schedule.moves ?? []) {
    if (move.undoneOn || !move.toldOn) continue
    for (const company of companiesToTell(state, project, [move])) {
      if (!move.toldTo?.includes(company.partner.id) || move.answers?.some((x) => x.partnerId === company.partner.id)) continue
      const works = company.lines.map((l) => l.work)
      const said3 = works.length > 2 ? `${works[0]} and ${works.length - 1} more` : andList(works)
      const start = company.lines.reduce((min, l) => (l.to.start < min ? l.to.start : min), company.lines[0]?.to.start ?? today)
      const toldDays = -daysUntil(move.toldOn, today)
      const tone: PeopleTone = daysUntil(start, today) <= CONFIRM_WITHIN_DAYS ? 'red' : toldDays >= CONFIRM_WITHIN_DAYS ? 'amber' : 'grey'
      const first = company.lines[0]
      const notice = first ? noticeFor(company.partner.id, first.lineId) : undefined
      rows.trade(company.partner, tradeOfLine(project, first?.lineId), {
        text: `New dates for ${said3} went out ${weekdayDate(move.toldOn)}. No answer yet.${noticeWords(notice)}`,
        tone,
        ...(first ? { lineId: first.lineId } : {}),
        code: 'schedule',
        call: { kind: 'dates', moveId: move.id, ...(first ? { lineId: first.lineId } : {}) },
        words: {
          en: { about: `your new dates on ${name}`, detail: `We sent them ${weekdayDate(move.toldOn)}. ${company.lines.map((l) => `${l.work} is now ${weekdayDate(l.to.start)} to ${weekdayDate(l.to.finish)}`).join('. ')}`, ask: 'Do they work? You can answer in your portal.' },
          es: { about: `sus nuevas fechas en ${name}`, detail: `Se las enviamos el ${pWeekday('es', move.toldOn)}. ${company.lines.map((l) => `${l.work} ahora es del ${pWeekday('es', l.to.start)} al ${pWeekday('es', l.to.finish)}`).join('. ')}`, ask: '¿Le funcionan? Puede contestar en su portal.' },
        },
      })
    }
  }

  // A company that asked for another day (Follow up's own reason, the owner's OK 2026-10-06): until the bar moves again.
  for (const ask of datesAsksOpen(state, project)) {
    const lineId = ask.move.lineId
    rows.trade(ask.partner, ask.trade, {
      text: ask.words,
      tone: ask.day && ask.day < today ? 'red' : 'amber',
      lineId,
      code: 'dates',
      call: { kind: 'asked', moveId: ask.move.id, lineId },
      words: {
        en: { about: `the day you asked for on ${name}`, detail: `You asked for ${ask.day ? weekdayDate(ask.day) : 'another day'} after we moved your dates`, ask: 'Is that day still the one you need?' },
        es: { about: `el día que pidió en ${name}`, detail: `Pidió ${ask.day ? `el ${pWeekday('es', ask.day)}` : 'otro día'} después de que movimos sus fechas`, ask: '¿Ese día sigue siendo el que necesita?' },
      },
    })
  }

  // Moves nobody has been told of yet: the caller should know, Tell the trades does the telling.
  for (const move of untoldMoves(project)) {
    for (const company of companiesToTell(state, project, [move])) {
      const works = company.lines.map((l) => l.work)
      rows.trade(company.partner, tradeOfLine(project, company.lines[0]?.lineId), {
        text: `New dates for ${works.length > 2 ? `${works[0]} and ${works.length - 1} more` : andList(works)} are not sent yet. Tell the trades sends them.`,
        tone: 'grey',
        aside: true,
        ...(company.lines[0] ? { lineId: company.lines[0].lineId } : {}),
        code: 'schedule',
      })
    }
  }

  // A first day on site within two weeks, or passed, that nobody confirmed (G-114's office half).
  for (const s of startsToPromise(project, today, tradePromisesOf(state))) {
    if (s.promisedBy) continue
    const partner = partnerById(state, s.partnerId)
    if (!partner) continue
    const lineId = m.items.find((i) => i.pkg?.id === s.pkg.id && i.activity.start === s.start)?.activity.lineId
    const left = daysUntil(s.start, today)
    rows.trade(partner, s.pkg.trade, {
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
    })
  }

  // What holds the bars, each to whoever owes it.
  const items = new Map(m.items.map((i) => [i.activity.lineId, i]))
  const doneIds = new Set(bars.filter((b) => b.status === 'done').map((b) => b.id))
  const notReady = notReadyBars(state, project)
  for (const on of holdsOnBars(state, project, holds, rfiRows(state, project))) {
    const item = items.get(on.lineId)
    if (!item || doneIds.has(on.lineId)) continue
    const ctx: HoldCtx = { state, project, item, on, trade: hiredPartner(state, item.pkg), rows, notReady }
    const owner = HOLD_OWNERS[on.hold.kind] ?? holdIsTheTrades
    owner(ctx)
  }

  // A trade's word that a bar will be late, on a bar the list says nothing about yet (G-117's slot).
  for (const n of lateNotices) {
    if (said.has(`${n.partnerId}:${n.lineId}`)) continue
    const item = items.get(n.lineId)
    const partner = partnerById(state, n.partnerId)
    if (!item || !partner || doneIds.has(n.lineId)) continue
    rows.trade(partner, item.trade, {
      text: `They told us in their portal that ${item.label} will be late. They gave ${n.day ? weekdayDate(n.day) : 'no day'}.${n.reason ? ` Why: “${n.reason}”` : ''}`,
      tone: 'amber',
      lineId: n.lineId,
      code: 'schedule',
      call: { kind: 'notice', lineId: n.lineId, ...(item.pkg ? { packageId: item.pkg.id } : {}) },
      words: {
        en: { about: `your ${workWords(item.trade, item.label)} on ${name}`, detail: `You told us it will be late${n.day ? `, ${weekdayDate(n.day)}` : ''}`, ask: 'Can we talk through the new day?' },
        es: { about: `su trabajo de ${inSentence(item.label)} en ${name}`, detail: `Nos dijo que va a tardar${n.day ? `, hasta el ${pWeekday('es', n.day)}` : ''}`, ask: '¿Podemos hablar del nuevo día?' },
      },
    })
  }

  return rows.done()
}

function tradeOfLine(project: GcProject, lineId: string | undefined): string {
  const a = lineId ? project.schedule?.activities.find((x) => x.lineId === lineId) : undefined
  return project.packages.find((k) => k.id === a?.packageId)?.trade ?? 'trade'
}

/** The sheet's id for a person: the company, or the architect or customer as `customer:<id>`. */
export function callSheetId(person: ProjectPerson): string {
  return person.partnerId ?? `customer:${person.customerId ?? ''}`
}

/**
 * The call list for the Follow up sheet, in its order: this job's Follow up items first, then one
 * item for each reason from the schedule, ticked when red or amber. `alsoLineId`: an opened bar's
 * company that is not on the list gets a row with that bar, so its Call and Follow up still work.
 */
export function callListFollowPeople(state: GcState, project: GcProject, holds: Map<string, GanttHold>, alsoLineId?: string | null, lateNotices: LateNotice[] = []): FollowPerson[] {
  const list = callList(state, project, holds, lateNotices)
  const jobs = new Map(projectFollowPeople(state, project).map((fp) => [fp.partner.id, fp]))
  const labels = new Map(scheduleMeasures(state, project).items.map((i) => [i.activity.lineId, i.label]))
  const out = list.people.flatMap((person): FollowPerson[] => {
    const id = callSheetId(person)
    const partner = person.partnerId ? partnerById(state, person.partnerId) : (() => {
      const c = state.customers.find((x) => x.id === person.customerId)
      return c ? customerAsPerson(c) : undefined
    })()
    if (!partner) return []
    const items: FollowItem[] = [...(jobs.get(id)?.items ?? [])]
    for (const r of person.reasons) {
      if (r.aside || !r.call || !r.words) continue
      const item = scheduleItem(project, labels, r.call, r.words, r.text, r.tone)
      if (!items.some((i) => i.key === item.key)) items.push(item)
    }
    return items.length > 0 ? [{ partner, reach: partnerReach(partner), items }] : []
  })
  if (alsoLineId) {
    const extra = barFollowPerson(state, project, alsoLineId)
    if (extra && !out.some((p) => p.partner.id === extra.partner.id)) out.push(extra)
  }
  return out
}

function scheduleItem(project: GcProject, labels: Map<string, string>, call: CallRef, words: Words, why: string, tone: PeopleTone): FollowItem {
  const label = call.label ?? (call.kind === 'dates' ? 'New dates' : call.kind === 'start' ? 'Start on site' : (call.lineId ? labels.get(call.lineId) : undefined) ?? 'The schedule')
  return {
    key: `schedule-${call.kind}-${call.hold ?? ''}-${call.lineId ?? ''}-${call.moveId ?? call.waitId ?? ''}`,
    kind: 'schedule',
    label: `${label} · ${project.name}`,
    why,
    tone: tone === 'red' ? 'red' : 'amber',
    last: null,
    due: tone !== 'grey',
    projectId: project.id,
    ...(call.packageId ? { packageId: call.packageId } : {}),
    schedule: { ...call },
    words,
  }
}

/** One opened bar's company as a sheet row with that bar to ask about. Null: no company to call, or the work is done. */
function barFollowPerson(state: GcState, project: GcProject, lineId: string): FollowPerson | null {
  const all = scheduleMeasures(state, project).items
  const item = all.find((i) => i.activity.lineId === lineId)
  const partner = item ? hiredPartner(state, item.pkg) : undefined
  if (!item || !partner || item.actual >= 100) return null
  const a = item.activity
  const started = a.start <= state.today
  const pct = Math.round(item.actual)
  const words: Words = started
    ? {
        en: { about: `your ${workWords(item.trade, item.label)} on ${project.name}`, detail: `It is ${pct}% done and due ${weekdayDate(a.finish)}`, ask: 'How is it going?' },
        es: { about: `su trabajo de ${inSentence(item.label)} en ${project.name}`, detail: `Va en ${pct}% y debe terminar el ${pWeekday('es', a.finish)}`, ask: '¿Cómo va?' },
      }
    : {
        en: { about: `your ${workWords(item.trade, item.label)} on ${project.name}`, detail: `It starts ${weekdayDate(a.start)}`, ask: 'Are you still set to start then?' },
        es: { about: `su trabajo de ${inSentence(item.label)} en ${project.name}`, detail: `Empieza el ${pWeekday('es', a.start)}`, ask: '¿Sigue en pie para empezar ese día?' },
      }
  const why = started ? `${item.label} is ${pct}% done and due ${weekdayDate(a.finish)}.` : `${item.label} starts ${weekdayDate(a.start)}.`
  const call: CallRef = { kind: 'bar', lineId, ...(item.pkg ? { packageId: item.pkg.id } : {}) }
  const labels = new Map(all.map((i) => [i.activity.lineId, i.label]))
  return { partner, reach: partnerReach(partner), items: [{ ...scheduleItem(project, labels, call, words, why, 'amber'), due: true }] }
}

/** One bar's company and its word on the bar's dates, for the opened activity (G-115's pick 1). Null: no company to call. */
export interface BarCaller {
  partner: Partner
  name: string
  first: string
  phone: string
  /** Their word on this bar's newest dates: "New dates went out Fri Oct 2. No answer yet." Null: no new dates told. */
  word: string | null
}

export function barCaller(state: GcState, project: GcProject, lineId: string): BarCaller | null {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  if (!a || a.inspection || a.added) return null
  const pkg = project.packages.find((k) => k.id === a.packageId)
  const partner = hiredPartner(state, pkg)
  if (!partner) return null
  const reach = partnerReach(partner)
  // The newest standing move told to them that changed this bar's days.
  const touched = (m: ScheduleMove) => m.lineId === lineId || m.pushed.some((p) => p.lineId === lineId)
  const move = [...(project.schedule?.moves ?? [])].reverse().find((m) => !m.undoneOn && m.toldOn && m.toldTo?.includes(partner.id) && touched(m))
  const answer = move?.answers?.find((x) => x.partnerId === partner.id)
  const word = !move
    ? null
    : !answer
      ? `New dates went out ${weekdayDate(move.toldOn ?? '')}. No answer yet.`
      : answer.ok
        ? `They said the dates work, ${weekdayDate(answer.on)}.`
        : `They asked for ${answer.day ? weekdayDate(answer.day) : 'another day'}, ${weekdayDate(answer.on)}.`
  return { partner, name: reach.name, first: reach.first, phone: reach.phone, word }
}

/** The answer to new dates, picked on the call form. */
export type DatesAnswer = 'none' | 'work' | 'another'

/**
 * What a saved call does past logging it (G-115's pick 2), each through an action that exists:
 * new dates answered as the portal would; a day given on a delivery or a decision becomes its
 * expected day, with who said it; a day given on a submittal or a start becomes their word, which
 * Follow up chases and Building keeps. A day on late work is only logged with the call (G-117).
 */
export function callListCallActions(person: FollowPerson, items: FollowItem[], answer: { dates: DatesAnswer; day: string | null; said: string; by: string }): GcAction[] {
  const out: GcAction[] = []
  const seen = new Set<string>()
  const once = (key: string, action: GcAction) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push(action)
  }
  const note = answer.said.trim()
  for (const i of items) {
    const s = i.schedule
    if (i.kind !== 'schedule' || !s || !i.projectId) continue
    if (s.kind === 'dates' && s.moveId && answer.dates !== 'none') {
      once(`dates:${s.moveId}`, {
        type: 'tradeAnswerDates',
        projectId: i.projectId,
        partnerId: person.partner.id,
        moveId: s.moveId,
        ok: answer.dates === 'work',
        ...(answer.dates === 'another' && answer.day ? { day: answer.day } : {}),
        ...(note ? { note } : {}),
      })
      continue
    }
    if (!answer.day) continue
    if (s.kind === 'held' && (s.hold === 'delivery' || s.hold === 'decision') && s.waitId) {
      once(`wait:${s.waitId}`, { type: 'setScheduleWaitStep', projectId: i.projectId, waitId: s.waitId, step: 'expected', on: answer.day, note: `${person.reach.first} said so on a call with ${answer.by}.` })
    } else if (s.kind === 'held' && s.hold === 'submittal' && s.packageId && !person.partner.id.startsWith('customer:')) {
      once(`submittals:${s.packageId}`, { type: 'recordPromise', partnerId: person.partner.id, kind: 'submittals', projectId: i.projectId, packageId: s.packageId, by: answer.day, from: 'office' })
    } else if (s.kind === 'start' && s.packageId) {
      once(`start:${s.packageId}`, { type: 'recordPromise', partnerId: person.partner.id, kind: 'start', projectId: i.projectId, packageId: s.packageId, by: answer.day, from: 'office' })
    }
  }
  return out
}

/** The first words of the list's head: "6 to call about the schedule". */
export function callListTitle(list: CallList): string {
  return list.count === 0 ? 'Nobody to call about the schedule.' : `${list.count} to call about the schedule`
}
