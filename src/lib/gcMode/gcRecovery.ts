/**
 * GC mode design spike: how to get days back, the Gantt's G-82 (`to-dos/gc-mode/GANTT_PLAN.md`,
 * mock-up `to-dos/gc-mode/mockups/G-82.md`). On a job past its contract, the bars on the red chain
 * that could come in, with the days each would give back:
 *
 * - **Side by side**: the next trade starts before the one ahead of it finishes, a gap below zero
 *   on its wait. Two trades, nothing holding the second, no gap there already (cure or lead time).
 * - **A second crew**: the days left done in two thirds the time. A bar has dates and a percent, no
 *   crew, so this is our rule, said on every offer (`CREW_RULE`).
 *
 * Each offer is the schedule as it would stand, the work right behind brought in by G-37's rules
 * (`pullBehind`), and read on the projected finish, so an offer that only moves the plan while the
 * work's pace sets the finish is not offered. Nothing moves until the office saves one: one move,
 * its reason *Getting days back*, its words, Undo and Redo, Tell the trades.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it.
 */
import type { GcProject, GcState, Partner, ProjectSchedule, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, lagOf, projectedFinish, scheduleMeasures, type ScheduleItem } from './gcBuildingSchedule'
import { TIGHT_SPARE_DAYS } from './gcGantt'
import { chartHolds } from './gcChartHolds'
import { PULL_SOONEST_DAYS, pullBehind, type PullLine, type PullSpan, type PullStay } from './gcPullEarlier'
import { openLateNotices } from './gcLateNotices'
import { datesAsksOpen } from './gcTellTrades'
import { scheduleFinish } from './gcScheduleMoves'
import { lateFinish } from './gcLateFinish'
import { partnerById } from './gcLookups'
import { partnerReach, type FollowItem, type FollowPerson } from './gcFollowUpSheet'
import { pWeekday } from './gcPortalI18n'
import { money, weekdayDate } from './gcWords'

/** Days the next trade may start before the one ahead of it finishes, side by side. My default. */
export const OVERLAP_DAYS = 3
/** A second crew does the days left in this share of the time: two thirds, not half, since two crews get in each other's way. My default. */
export const SECOND_CREW_SHARE = 2 / 3
/** A bar with fewer days left than this does not split between two crews. */
export const CREW_MIN_DAYS = 3
/** The crew rule, said on every crew offer so nobody takes it for a fact. */
export const CREW_RULE = 'Our rule: a second crew does the days left in two thirds the time.'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** "3 days before TPO membrane finishes": a side-by-side start, the same words on the offer and in the editor. */
export function sideBySideWords(n: number, work: string): string {
  return `${days(n)} before ${work} finishes`
}

/** Who has to agree to an offer: a company we hire, or our own crew (our call). */
export interface RecoveryWho {
  partner: Partner | null
  company: string
  /** "Andre Wallace", or "Our own crew". */
  name: string
  first: string
  phone: string | null
}

export interface RecoveryOffer {
  /** What the reducer re-plans by: `side:<line>:<wait>` or `crew:<line>`. */
  key: string
  how: 'side' | 'crew'
  /** The bar that changes, and its own name: "Sheet metal and flashing". */
  lineId: string
  name: string
  /** Side by side: the work it now starts beside. */
  after?: string
  afterName?: string
  from: PullSpan
  to: PullSpan
  /** Side by side: its gap on that wait before and after. */
  gapWas?: number
  gap?: number
  /** The work right behind it that comes in, and what keeps its dates and why (G-37's rules). */
  pulls: PullLine[]
  stays: PullStay[]
  /** The whole schedule as it would stand. */
  activities: ScheduleActivity[]
  /** The projected finish before and after. */
  finishFrom: string
  finishTo: string
  daysBack: number
  /** Days still past the contract after it. 0: inside. */
  lateAfter: number
  /** What it saves at the contract's fee a day. Null: no fee typed. */
  saves: number | null
  who: RecoveryWho[]
  words: {
    /** "A second crew on Test and balance." */
    title: string
    /** "It would finish Sat Dec 12, not Sun Dec 13. Our rule: …" */
    detail: string
    /** "Cool Breeze Mechanical has to agree: Andre Wallace." */
    who: string
    /** "1 day back brings the finish to Mon Dec 14, still 3 days past the contract." */
    worth: string
  }
  /** The move's sentence, filled in for the window: the office changes it after the call. */
  note: string
}

function whoOf(state: GcState, item: ScheduleItem): RecoveryWho {
  const pkg = item.pkg
  const invite = pkg && !pkg.selfPerform ? pkg.invites.find((i) => i.id === pkg.awardedInviteId) : undefined
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  if (!partner) return { partner: null, company: 'Our own crew', name: 'Our own crew', first: '', phone: null }
  const reach = partnerReach(partner)
  return { partner, company: partner.company, name: reach.name, first: reach.first, phone: reach.phone }
}

function whoWords(who: RecoveryWho[]): string {
  const hired = who.filter((w) => w.partner)
  if (hired.length === 0) return 'It is our own crew: our call.'
  if (hired.length === 1) return `${hired[0]?.company} has to agree: ${hired[0]?.name}.`
  return `${hired.map((w) => w.company).join(' and ')} have to agree: ${hired.map((w) => w.name).join(' and ')}.`
}

/** An activity with new dates, and a new gap on one wait (0: none). */
function withSpan(a: ScheduleActivity, to: PullSpan, gap?: { after: string; days: number }): ScheduleActivity {
  const next = { ...a, start: to.start, finish: to.finish }
  if (!gap) return next
  const { lag: _was, ...rest } = next
  const lag = { ...(a.lag ?? {}) }
  if (gap.days === 0) delete lag[gap.after]
  else lag[gap.after] = gap.days
  return Object.keys(lag).length > 0 ? { ...rest, lag } : rest
}

/**
 * On a job past its contract: every offer that brings the projected finish in, the most days back
 * first. Empty: on time, or nothing on the red chain can come in.
 */
export function recoveryOffers(state: GcState, project: GcProject): RecoveryOffer[] {
  const schedule = project.schedule
  if (project.stage !== 'building' || !schedule || schedule.activities.length === 0) return []
  const late = lateFinish(state, project)
  const now = projectedFinish(project, state.today)
  if (!late.late || late.late <= 0 || !now) return []
  const today = state.today
  const soonest = addDays(today, PULL_SOONEST_DAYS)
  const m = scheduleMeasures(state, project)
  const items = new Map(m.items.map((i) => [i.activity.lineId, i]))
  const onChain = (id: string) => (m.float.get(id) ?? Number.POSITIVE_INFINITY) <= TIGHT_SPARE_DAYS
  const holds = chartHolds(state, project)
  // A trade's own word that it starts later stands until the office answers it (G-117, G-113): no offer moves that bar.
  const said = new Set<string>([...openLateNotices(project).map((n) => n.lineId), ...datesAsksOpen(state, project).map((a) => a.move.lineId)])
  const contract = late.risk.contract
  // A bar that already has a second crew on a standing move gets no third: the rule is for one more crew, not many.
  const crewed = new Set((schedule.moves ?? []).filter((mv) => !mv.undoneOn && mv.recovery?.how === 'crew').map((mv) => mv.lineId))
  const offers: RecoveryOffer[] = []

  const evaluate = (item: ScheduleItem, to: PullSpan, how: 'side' | 'crew', wait?: { item: ScheduleItem; gapWas: number; gap: number }) => {
    const b = item.activity
    const gap = wait ? { after: wait.item.activity.lineId, days: wait.gap } : undefined
    // The cascade reads the dates as drawn and the seed's new span apart, the way G-37's planPull seeds it.
    const { pulls, stays } = pullBehind(state, project, new Map([[b.lineId, to]]))
    const seeded = schedule.activities.map((a) => (a.lineId === b.lineId ? withSpan(a, to, gap) : a))
    const pulled = new Map(pulls.map((p) => [p.lineId, p.to]))
    const activities = seeded.map((a) => {
      const s = pulled.get(a.lineId)
      return s ? { ...a, start: s.start, finish: s.finish } : a
    })
    const after = projectedFinish({ ...project, schedule: { ...schedule, activities } }, today)
    if (!after) return
    const daysBack = daysBetween(after.on, now.on)
    if (daysBack <= 0) return
    const lateAfter = contract ? Math.max(0, daysBetween(contract.on, after.on)) : 0
    const saves = late.perDay ? (late.late ?? 0) * late.perDay - lateAfter * late.perDay : null
    const who = wait ? [whoOf(state, item), whoOf(state, wait.item)] : [whoOf(state, item)]
    const n = wait ? -wait.gap : 0
    const title = wait ? `${item.label} starts ${sideBySideWords(n, wait.item.label)}.` : `A second crew on ${item.label}.`
    const detail = wait
      ? `Two trades, and nothing holds ${item.label}. They work side by side for ${days(n)}.`
      : `It would finish ${weekdayDate(to.finish)}, not ${weekdayDate(b.finish)}. ${CREW_RULE}`
    const worth = `${days(daysBack)} back brings the finish to ${weekdayDate(after.on)}, ${lateAfter === 0 ? 'inside the contract' : `still ${days(lateAfter)} past the contract`}.${saves && late.perDay ? ` At ${money(late.perDay)} a day, that saves ${money(saves)}.` : ''}`
    offers.push({
      key: wait ? `side:${b.lineId}:${wait.item.activity.lineId}` : `crew:${b.lineId}`,
      how,
      lineId: b.lineId,
      name: item.label,
      ...(wait ? { after: wait.item.activity.lineId, afterName: wait.item.label, gapWas: wait.gapWas, gap: wait.gap } : {}),
      from: { start: b.start, finish: b.finish },
      to,
      pulls,
      stays,
      activities,
      finishFrom: now.on,
      finishTo: after.on,
      daysBack,
      lateAfter,
      saves,
      who,
      words: { title, detail, who: whoWords(who), worth },
      note: wait ? `${item.label} starts ${sideBySideWords(n, wait.item.label)}, the two trades side by side.` : `A second crew on ${item.label}, to finish it ${weekdayDate(to.finish)}.`,
    })
  }

  for (const item of m.items) {
    const b = item.activity
    if (!onChain(b.lineId) || b.inspection || b.added || item.actual >= 100) continue

    // Side by side: it has not started, nothing holds it, and its trade has not said it starts later.
    if (item.actual === 0 && !b.actualStart && b.start > today && !holds.has(b.lineId) && !said.has(b.lineId)) {
      for (const id of b.after) {
        const ahead = items.get(id)
        const a = ahead?.activity
        if (!ahead || !a || a.inspection || a.added || ahead.actual >= 100 || !onChain(id)) continue
        // Two trades, and no gap there already: a gap is cure or lead time, and stays.
        if (a.packageId === b.packageId || (b.lag?.[id] ?? 0) !== 0) continue
        // The days of it left to share, never starting before it does.
        const left = daysBetween(a.start > today ? a.start : today, a.finish) + 1
        const n = Math.min(OVERLAP_DAYS, left - 1)
        if (n < 1) continue
        // Never before tomorrow, its Not before day, what else it waits on, or a wait's expected day.
        const floors = [soonest, ...(b.notBefore ? [b.notBefore] : [])]
        for (const other of b.after) {
          const w = schedule.activities.find((x) => x.lineId === other)
          if (w && other !== id) floors.push(addDays(w.finish, 1 + lagOf(b, other)))
        }
        for (const w of project.waits ?? []) if (!w.doneOn && w.lineIds.includes(b.lineId)) floors.push(addDays(w.expectedOn, 1))
        const want = addDays(a.finish, 1 - n)
        const start = floors.reduce((m2, f) => (f > m2 ? f : m2), want)
        const gap = daysBetween(addDays(a.finish, 1), start)
        if (start >= b.start || gap >= 0) continue
        evaluate(item, { start, finish: addDays(b.finish, -daysBetween(start, b.start)) }, 'side', { item: ahead, gapWas: 0, gap })
      }
    }

    // A second crew: the days left in two thirds the time, on work nothing holds, once.
    if (holds.has(b.lineId) || crewed.has(b.lineId)) continue
    const from = b.start > today ? b.start : today
    const left = daysBetween(from, b.finish) + 1
    if (left < CREW_MIN_DAYS) continue
    const finish = addDays(from, Math.ceil(left * SECOND_CREW_SHARE) - 1)
    if (finish >= b.finish) continue
    evaluate(item, { start: b.start, finish }, 'crew')
  }

  return offers.sort((a, b) => b.daysBack - a.daysBack || a.pulls.length - b.pulls.length || a.key.localeCompare(b.key))
}

/** Why a late job has no offer, in a sentence for the card. */
export function recoveryNoneWords(state: GcState, project: GcProject): string {
  const finish = projectedFinish(project, state.today)
  return finish?.from === 'pace' ? "The work's pace sets the finish, not the plan." : "The work on it is held, started, or one trade's own."
}

/**
 * The move one offer saves: its bar's own dates, the work it pulls in riding in `pushed` (so Undo
 * and Redo put them all back), and `recovery` with the gap it changed (so Undo puts that back too).
 */
export function recoveryMove(schedule: ProjectSchedule, offer: RecoveryOffer, why: { reason: ScheduleMoveReason; note: string; by: string }, today: string): ScheduleMove {
  return {
    id: `move-${(schedule.moves ?? []).length + 1}`,
    on: today,
    by: why.by,
    lineId: offer.lineId,
    from: offer.from,
    to: offer.to,
    reason: why.reason,
    note: why.note.trim(),
    pushed: offer.pulls.map((p) => ({ lineId: p.lineId, from: p.from, to: p.to })),
    finishFrom: scheduleFinish(schedule.activities),
    finishTo: scheduleFinish(offer.activities),
    recovery: { how: offer.how, ...(offer.after !== undefined ? { after: offer.after, gapWas: offer.gapWas ?? 0, gap: offer.gap ?? 0 } : {}) },
  }
}

/**
 * Who has to agree, for the Follow up sheet (G-82's pick 2, on G-115's sheet): each company with one
 * item, the days back it is asked about, in its language. Our own crew is our call, not a call.
 */
export function recoveryFollowPeople(state: GcState, project: GcProject, key: string): FollowPerson[] {
  const offer = recoveryOffers(state, project).find((o) => o.key === key)
  if (!offer) return []
  return offer.who.flatMap((w, i): FollowPerson[] => {
    if (!w.partner) return []
    const name = project.name
    const side = offer.how === 'side'
    const ahead = i === 1
    const n = side ? -(offer.gap ?? 0) : 0
    const words: FollowItem['words'] = !side
      ? {
          en: { about: `a second crew on your ${offer.name} on ${name}`, detail: `It would finish ${weekdayDate(offer.to.finish)}, not ${weekdayDate(offer.from.finish)}, and bring our finish in ${days(offer.daysBack)}`, ask: 'Could you bring a second crew for it?' },
          es: { about: `una segunda cuadrilla en su trabajo de ${offer.name} en ${name}`, detail: `Terminaría el ${pWeekday('es', offer.to.finish)} y no el ${pWeekday('es', offer.from.finish)}`, ask: '¿Puede traer una segunda cuadrilla?' },
        }
      : ahead
        ? {
            en: { about: `${offer.name} starting beside your ${offer.afterName ?? ''} on ${name}`, detail: `Their crew would start ${weekdayDate(offer.to.start)}, ${days(n)} before you finish`, ask: 'Could your crews share the space for those days?' },
            es: { about: `${offer.name} empezando junto a su trabajo de ${offer.afterName ?? ''} en ${name}`, detail: `Su cuadrilla empezaría el ${pWeekday('es', offer.to.start)}, antes de que usted termine`, ask: '¿Pueden compartir el espacio esos días?' },
          }
        : {
            en: { about: `starting your ${offer.name} beside ${offer.afterName ?? ''} on ${name}`, detail: `It would start ${weekdayDate(offer.to.start)}, ${days(n)} before ${offer.afterName ?? ''} finishes`, ask: 'Could your crew work beside theirs for those days?' },
            es: { about: `empezar su trabajo de ${offer.name} junto a ${offer.afterName ?? ''} en ${name}`, detail: `Empezaría el ${pWeekday('es', offer.to.start)}, antes de que terminen`, ask: '¿Puede su cuadrilla trabajar junto a la de ellos esos días?' },
          }
    const item: FollowItem = {
      key: `recovery-${offer.key}`,
      kind: 'schedule',
      label: `Days back · ${name}`,
      why: offer.words.title,
      tone: 'amber',
      last: null,
      due: true,
      projectId: project.id,
      schedule: { kind: 'recovery', lineId: offer.lineId },
      words,
    }
    return [{ partner: w.partner, reach: partnerReach(w.partner), items: [item] }]
  })
}
