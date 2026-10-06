/**
 * GC mode design spike: a trade tells us it will be late, the Gantt's Phase 3 (G-117; mock-up
 * `to-dos/gc-mode/mockups/G-117.md`). From its own chart in its portal, a company sends the day it
 * will finish (or start, for work not started) and why, while the day is still ahead. The office
 * reads it as a move to take or push back on: taking it saves an ordinary move that carries the
 * trade's reason and words; pushing back sends the office's words to the portal, and the company
 * answers that it will make the day or sends another.
 *
 * Where a notice stands is read each time from the schedule, never copied: a standing move that
 * carries it, a newer notice, the bar's dates, the office's answer.
 *
 * Its own file, out of the barrel: the reducer, the portal, Follow up and the walk read it.
 */
import type { GcProject, GcState, LateNotice, LookAheadReason, Partner, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleRows, type ScheduleRow } from './gcBuildingSchedule'
import { GC_COMPANY } from './gcFixture'
import { partnerById } from './gcLookups'
import { MOVE_NOTE_MIN, moveActivityName, moveReasonLabel, planMove } from './gcScheduleMoves'
import { weekdayDate } from './gcWords'
import type { PortalKey } from './gcPortalI18n'

/** Why it will be late: the look-ahead's reasons, each a move's reason too, in the order offered. */
export const LATE_REASONS: LookAheadReason[] = ['weather', 'trade before', 'materials', 'crew', 'other']

/** A bar a company may send a notice on: its own trade's line on a job being built, not finished. */
export interface LateDoor {
  row: ScheduleRow
  /** Under way (it reported work, or has an actual start): a notice gives a new finish. Not started: a new start. */
  started: boolean
  /** The day a notice would change: the finish, or the start. */
  day: string
}

export function lateDoor(state: GcState, project: GcProject, partnerId: string, lineId: string): LateDoor | null {
  if (project.stage !== 'building' || !project.schedule) return null
  const row = scheduleRows(state, project).find((r) => r.activity.lineId === lineId)
  if (!row || row.pkg.selfPerform || row.activity.inspection || row.activity.added) return null
  if (row.pkg.invites.find((i) => i.id === row.pkg.awardedInviteId)?.partnerId !== partnerId) return null
  if (row.actual >= 100 || row.activity.actualFinish) return null
  const started = row.actual > 0 || Boolean(row.activity.actualStart)
  return { row, started, day: started ? row.activity.finish : row.activity.start }
}

/** The dates a new day asks for: work under way keeps its start; work not started moves whole, keeping its length. */
export function lateTarget(activity: ScheduleActivity, started: boolean, day: string): { start: string; finish: string } {
  return started ? { start: activity.start, finish: day } : { start: day, finish: addDays(day, daysBetween(activity.start, activity.finish)) }
}

/** What stops a notice from going, in the portal's words: the key, and the day it names. Null: it can go. */
export function lateNoticeProblem(door: LateDoor, today: string, day: string, reason: LookAheadReason | null, note: string): { key: PortalKey; day?: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { key: 'latePickDay' }
  if (day <= door.day) return { key: 'lateLaterDay', day: door.day }
  if (day < today) return { key: 'lateFromToday' }
  if (!reason || !LATE_REASONS.includes(reason)) return { key: 'latePickWhy' }
  if (note.trim().length < MOVE_NOTE_MIN) return { key: 'lateNote' }
  return null
}

/** The next notice's id on a schedule. */
export function nextLateNoticeId(project: GcProject): string {
  return `late-${(project.schedule?.lateNotices ?? []).length + 1}`
}

export type LateNoticeState = 'open' | 'taken' | 'replaced' | 'moved' | 'pushedBack' | 'kept'

/**
 * Where a notice stands, in this order: taken (a standing move carries it; undoing the move opens
 * it again), replaced (a newer notice from the same company on the same bar), moved (the bar's
 * dates are not the ones it was sent against), pushed back or kept (the office answered, and the
 * company said it will make the day), else open: waiting on the office.
 */
export function lateNoticeState(project: GcProject, notice: LateNotice): LateNoticeState {
  const schedule = project.schedule
  if ((schedule?.moves ?? []).some((m) => m.lateNoticeId === notice.id && !m.undoneOn)) return 'taken'
  const notices = schedule?.lateNotices ?? []
  const at = notices.findIndex((n) => n.id === notice.id)
  // Read the notice as the schedule keeps it: a copy taken before the office answered says less.
  const stored = notices[at] ?? notice
  if (notices.slice(0, Math.max(0, at)).some((n) => n.partnerId === stored.partnerId && n.lineId === stored.lineId)) return 'replaced'
  const a = schedule?.activities.find((x) => x.lineId === stored.lineId)
  if (!a || a.start !== stored.was.start || a.finish !== stored.was.finish) return 'moved'
  if (stored.pushedBack) return stored.kept ? 'kept' : 'pushedBack'
  return 'open'
}

/** The day a notice changes: the bar's finish when it was under way, its start when not. */
export function lateDayChanged(notice: LateNotice): string {
  return notice.started ? notice.was.finish : notice.was.start
}

/** The day a notice asks for: the new finish, or the new start. */
export function lateDayAsked(notice: LateNotice): string {
  return notice.started ? notice.to.finish : notice.to.start
}

/**
 * The open notices on a job, newest first: a company's own word that it will be late, not yet
 * taken or pushed back. Helper 3's By company list (G-115) reads it, so its shape stays.
 */
export interface OpenLateNotice {
  id: string
  partnerId: string
  lineId: string
  /** The day asked for: the new finish for work under way, the new start for work not started. */
  day: string
  /** Under way: `day` is a finish. Not started: a start. */
  started: boolean
  reason: LookAheadReason
  /** What happened, in their words. */
  note: string
  /** The day it was sent. */
  on: string
}

export function openLateNotices(project: GcProject): OpenLateNotice[] {
  return (project.schedule?.lateNotices ?? [])
    .filter((n) => lateNoticeState(project, n) === 'open')
    .map((n) => ({ id: n.id, partnerId: n.partnerId, lineId: n.lineId, day: lateDayAsked(n), started: n.started, reason: n.reason, note: n.note, on: n.on }))
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`
}

/** "today", "yesterday", "on Fri Oct 2". */
function whenWords(on: string, today: string): string {
  const days = daysBetween(on, today)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `on ${weekdayDate(on)}`
}

/** "7 days before its finish" · "on its finish day" · "2 days after its finish passed". */
export function lateAheadWords(notice: LateNotice): string {
  const which = notice.started ? 'finish' : 'start'
  const d = daysBetween(notice.on, lateDayChanged(notice))
  if (d === 0) return `on its ${which} day`
  return d > 0 ? `${plural(d, 'day')} before its ${which}` : `${plural(-d, 'day')} after its ${which} passed`
}

/** "Says it will finish Wed Oct 14, not Fri Oct 9. That is 5 days later." · "Says it can start Wed Oct 7, not Mon Oct 5. It would finish Sun Oct 11." */
export function lateSaysWords(notice: LateNotice): string {
  if (notice.started) return `Says it will finish ${weekdayDate(notice.to.finish)}, not ${weekdayDate(notice.was.finish)}. That is ${plural(daysBetween(notice.was.finish, notice.to.finish), 'day')} later.`
  return `Says it can start ${weekdayDate(notice.to.start)}, not ${weekdayDate(notice.was.start)}. It would finish ${weekdayDate(notice.to.finish)}.`
}

/** The explanation a taken notice's move starts with: who said it, when, and their words. The office can change it. */
export function lateMoveNote(state: GcState, notice: LateNotice): string {
  return `${partnerById(state, notice.partnerId)?.company ?? 'The trade'} told us ${weekdayDate(notice.on)}: ${notice.note}`
}

/** A move ready for Why it moved: the dates the notice asks for, the trade's reason and words. Null: not open. */
export function lateNoticeMove(
  state: GcState,
  project: GcProject,
  notice: LateNotice,
): { lineId: string; start: string; finish: string; after: string[]; why: { reason: ScheduleMoveReason; note: string }; lateNoticeId: string } | null {
  const a = project.schedule?.activities.find((x) => x.lineId === notice.lineId)
  if (!a || lateNoticeState(project, notice) !== 'open') return null
  return { lineId: a.lineId, start: notice.to.start, finish: notice.to.finish, after: a.after, why: { reason: notice.reason, note: lateMoveNote(state, notice) }, lateNoticeId: notice.id }
}

/** One notice on the office's card: what it says, when it came, what taking it does, and the office's answer. */
export interface LateNoticeRow {
  notice: LateNotice
  state: 'open' | 'pushedBack' | 'kept'
  partner: Partner
  /** "Roofing · TPO membrane" */
  name: string
  /** The line's own name, for a sentence: "TPO membrane". */
  work: string
  /** "Materials" */
  reason: string
  /** "Sent today, 7 days before its finish." */
  sent: string
  /** It came after the day it changes had passed. */
  late: boolean
  /** "Says it will finish Wed Oct 14, not Fri Oct 9. That is 5 days later." */
  says: string
  /** "If you take it: 2 activities after it move out. The job still finishes Tue Dec 8." Empty unless open. */
  ifTaken: string
  /** Taking it moves the job's finish. */
  finishMoves: boolean
  /** "We asked them today to keep Fri Oct 9. No answer yet." · "They said today they will make Fri Oct 9." Null while open. */
  answer: string | null
}

/**
 * The office's card: open notices, the soonest day first, then push backs still before their day.
 * A notice taken, replaced or overtaken by a move is not on it.
 */
export function lateNoticeRows(state: GcState, project: GcProject): LateNoticeRow[] {
  const rows: LateNoticeRow[] = []
  for (const notice of project.schedule?.lateNotices ?? []) {
    const s = lateNoticeState(project, notice)
    if (s !== 'open' && s !== 'pushedBack' && s !== 'kept') continue
    const day = lateDayChanged(notice)
    if (s !== 'open' && day < state.today) continue
    const partner = partnerById(state, notice.partnerId)
    if (!partner) continue
    const plan = s === 'open' ? planMove(project, notice.lineId, notice.to.start, notice.to.finish) : null
    const ifTaken = plan && !plan.same ? ['If you take it:', plan.problem ?? plan.words, ...plan.warnings].join(' ') : ''
    const answer =
      s === 'pushedBack' && notice.pushedBack
        ? `We asked them ${whenWords(notice.pushedBack.on, state.today)} to keep ${weekdayDate(day)}. No answer yet.`
        : s === 'kept' && notice.kept
          ? `They said ${whenWords(notice.kept.on, state.today)} they will make ${weekdayDate(day)}.`
          : null
    const sentWhen = whenWords(notice.on, state.today)
    rows.push({
      notice,
      state: s,
      partner,
      name: moveActivityName(project, notice.lineId),
      work: lineWork(project, notice.lineId),
      reason: moveReasonLabel(notice.reason),
      sent: `Sent ${sentWhen.replace(/^on /, '')}, ${lateAheadWords(notice)}.`,
      late: day < notice.on,
      says: lateSaysWords(notice),
      ifTaken,
      finishMoves: Boolean(plan && plan.finishDays > 0),
      answer,
    })
  }
  const order = { open: 0, pushedBack: 1, kept: 2 }
  return rows.sort((a, b) => order[a.state] - order[b.state] || (lateDayChanged(a.notice) < lateDayChanged(b.notice) ? -1 : lateDayChanged(a.notice) > lateDayChanged(b.notice) ? 1 : 0))
}

/** The chart's dashed tails: each open notice's new finish on its bar, with what the company said. */
export function lateNoticeTails(state: GcState, project: GcProject): Map<string, { finish: string; words: string }> {
  const tails = new Map<string, { finish: string; words: string }>()
  for (const notice of project.schedule?.lateNotices ?? []) {
    if (tails.has(notice.lineId) || lateNoticeState(project, notice) !== 'open') continue
    const company = partnerById(state, notice.partnerId)?.company ?? 'The trade'
    const why = moveReasonLabel(notice.reason).toLowerCase()
    const words = notice.started
      ? `${company} says it will finish ${weekdayDate(notice.to.finish)}: ${why}. Not on the dates yet.`
      : `${company} says it can start ${weekdayDate(notice.to.start)} and finish ${weekdayDate(notice.to.finish)}: ${why}. Not on the dates yet.`
    tails.set(notice.lineId, { finish: notice.to.finish, words })
  }
  return tails
}

/** A bar that waits on the one a notice would move, and where it would go. */
export interface LateWaiting {
  lineId: string
  /** The work's own name: "Rooftop units", "Rough-in inspection". */
  work: string
  /** Who does it. Null: the same company as the notice. */
  company: string | null
  start: string
  /** How many days later it would start. */
  days: number
}

/**
 * What a new day does to the work waiting on the bar directly (G-117, the second look): each bar
 * that waits on it and would move, the company's own or another's, by the name of the work. The
 * same bars the trade's chart shows under Waiting on you, never a price or the job's finish.
 */
export function lateWaiting(state: GcState, project: GcProject, lineId: string, to: { start: string; finish: string }): LateWaiting[] {
  const activities = project.schedule?.activities ?? []
  const plan = planMove(project, lineId, to.start, to.finish)
  if (!plan || plan.problem) return []
  const direct = new Set(activities.filter((a) => a.after.includes(lineId)).map((a) => a.lineId))
  const rows = new Map(scheduleRows(state, project).map((r) => [r.activity.lineId, r]))
  const mine = rows.get(lineId)
  const owner = (r: ScheduleRow | undefined) => r?.pkg.invites.find((i) => i.id === r.pkg.awardedInviteId)?.partnerId
  return plan.pushed
    .filter((p) => direct.has(p.lineId))
    .map((p) => {
      const a = activities.find((x) => x.lineId === p.lineId)
      const r = rows.get(p.lineId)
      const work = a?.inspection?.label ?? a?.added?.label ?? r?.label ?? p.label
      const company = a?.inspection ? 'the city' : a?.added ? a.added.who : r?.pkg.selfPerform ? GC_COMPANY.shortName : r && owner(r) === owner(mine) ? null : (r?.company ?? null)
      return { lineId: p.lineId, work, company, start: p.to.start, days: p.days }
    })
}

/** A company's newest notice on a bar, and where it stands. Null: it sent none. */
export function companyLateNotice(project: GcProject, partnerId: string, lineId: string): { notice: LateNotice; state: LateNoticeState } | null {
  const notice = (project.schedule?.lateNotices ?? []).find((n) => n.partnerId === partnerId && n.lineId === lineId)
  return notice ? { notice, state: lateNoticeState(project, notice) } : null
}

/**
 * What the portal shows on one of the company's bars: its open notice, the office taking it
 * (while the bar still has those dates), a push back, or its own word that it will make the day.
 * Null: nothing to show, the door alone.
 */
export function portalLateNotice(project: GcProject, partnerId: string, lineId: string): { notice: LateNotice; state: 'open' | 'taken' | 'pushedBack' | 'kept' } | null {
  const found = companyLateNotice(project, partnerId, lineId)
  if (!found) return null
  const { notice, state } = found
  if (state === 'open' || state === 'pushedBack' || state === 'kept') return { notice, state }
  if (state === 'taken') {
    const a = project.schedule?.activities.find((x) => x.lineId === lineId)
    if (a && a.start === notice.to.start && a.finish === notice.to.finish) return { notice, state }
  }
  return null
}

/** The push backs a company has not answered, on every job: its portal's to-do. */
export function lateNoticesToAnswer(state: GcState, partnerId: string): { project: GcProject; notice: LateNotice; work: string }[] {
  return state.projects.flatMap((project) =>
    (project.schedule?.lateNotices ?? [])
      .filter((n) => n.partnerId === partnerId && lateNoticeState(project, n) === 'pushedBack')
      .map((notice) => ({ project, notice, work: lineWork(project, notice.lineId) })),
  )
}

/** The line's own name, without the trade: "TPO membrane". */
function lineWork(project: GcProject, lineId: string): string {
  const name = moveActivityName(project, lineId)
  return name.includes(' · ') ? name.slice(name.indexOf(' · ') + 3) : name
}

/** Follow up's reasons (the owner's call 5, as for another day): one per open notice, on the company, until the office answers or the bar moves. */
export function lateNoticeReasons(state: GcState, project: GcProject): { partner: Partner; trade: string; text: string; tone: 'red' | 'amber' }[] {
  return (project.schedule?.lateNotices ?? []).flatMap((notice) => {
    if (lateNoticeState(project, notice) !== 'open') return []
    const partner = partnerById(state, notice.partnerId)
    if (!partner) return []
    const activity = project.schedule?.activities.find((a) => a.lineId === notice.lineId)
    const trade = project.packages.find((k) => k.id === activity?.packageId)?.trade ?? partner.trades[0] ?? 'trade'
    const work = lineWork(project, notice.lineId)
    const says = notice.started
      ? `Says ${work} will finish ${weekdayDate(notice.to.finish)}, not ${weekdayDate(notice.was.finish)}`
      : `Says ${work} can start ${weekdayDate(notice.to.start)}, not ${weekdayDate(notice.was.start)}`
    // Red once the day it changes has passed with no answer from us.
    return [{ partner, trade, text: `${says}: “${notice.note}”`, tone: lateDayChanged(notice) < state.today ? 'red' : 'amber' }]
  })
}

/** On a move that took a notice: "Summit Roofing asked for this Fri Oct 2, 7 days before its finish." Null: an ordinary move. */
export function lateNoticeMoveWords(state: GcState, project: GcProject, move: ScheduleMove): string | null {
  const notice = move.lateNoticeId ? project.schedule?.lateNotices?.find((n) => n.id === move.lateNoticeId) : undefined
  if (!notice) return null
  return `${partnerById(state, notice.partnerId)?.company ?? 'The trade'} asked for this ${weekdayDate(notice.on)}, ${lateAheadWords(notice)}.`
}

/** The weekly walk's fact on a bar with an open notice: "Summit Roofing said today it will finish Wed Oct 14: materials." Null: none open. */
export function lateWalkFact(project: GcProject, lineId: string, company: string, today: string): string | null {
  const notice = (project.schedule?.lateNotices ?? []).find((n) => n.lineId === lineId && lateNoticeState(project, n) === 'open')
  if (!notice) return null
  const why = moveReasonLabel(notice.reason).toLowerCase()
  return notice.started
    ? `${company} said ${whenWords(notice.on, today)} it will finish ${weekdayDate(notice.to.finish)}: ${why}.`
    : `${company} said ${whenWords(notice.on, today)} it can start ${weekdayDate(notice.to.start)}: ${why}.`
}

/** The log's line when a company sends one: "Summit Roofing says TPO membrane on Fair Oaks Shops, Building D will finish Wed Oct 14, not Fri Oct 9: materials." */
export function lateNoticeLogWords(project: GcProject, partner: Partner, notice: LateNotice): string {
  const work = lineWork(project, notice.lineId)
  const why = moveReasonLabel(notice.reason).toLowerCase()
  return notice.started
    ? `${partner.company} says ${work} on ${project.name} will finish ${weekdayDate(notice.to.finish)}, not ${weekdayDate(notice.was.finish)}: ${why}.`
    : `${partner.company} says ${work} on ${project.name} can start ${weekdayDate(notice.to.start)}, not ${weekdayDate(notice.was.start)}: ${why}.`
}

/** The log's line for a push back: "Robert asked Summit Roofing to keep Fri Oct 9 on TPO membrane: “…”" */
export function latePushBackLogWords(project: GcProject, partner: Partner, notice: LateNotice, by: string, note: string): string {
  return `${by} asked ${partner.company} to keep ${weekdayDate(lateDayChanged(notice))} on ${lineWork(project, notice.lineId)}: “${note}”`
}

/** The log's line when the company answers a push back: "Summit Roofing will make Fri Oct 9 on TPO membrane." */
export function lateKeepLogWords(project: GcProject, partner: Partner, notice: LateNotice): string {
  return `${partner.company} will make ${weekdayDate(lateDayChanged(notice))} on ${lineWork(project, notice.lineId)} at ${project.name}.`
}
