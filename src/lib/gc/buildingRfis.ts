/**
 * GC mode, the real build, the Building lane's U2: questions during construction (RFIs), moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingRfis.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
import { addDays } from './building'
import { partnerById } from './lookups'
import { activityName, scheduleRows } from './schedule/schedule'
import type { GcProject, GcState, Rfi, RfiImpact } from './types'
import { daysUntil, money, shortDate, weekdayDate } from './words'

/** The answer is needed this many days before the work it holds starts (the owner, 2026-10-05). */
export const RFI_NEEDED_DAYS = 3

/** "RFI-003". */
export function rfiLabel(rfi: Rfi): string {
  return `RFI-${String(rfi.number).padStart(3, '0')}`
}

/** Whose move it is: ours to send or answer, the architect's, or answered. */
export type RfiState = 'us' | 'architect' | 'answered'

export function rfiState(rfi: Rfi): RfiState {
  if (rfi.answer) return 'answered'
  return rfi.sentToArchitectOn ? 'architect' : 'us'
}

/** The held work's names and starts, soonest first, from the job's schedule. */
export function rfiHolds(state: GcState, project: GcProject, rfi: Rfi): { lineId: string; name: string; start: string }[] {
  const rows = scheduleRows(state, project)
  return rfi.holds
    .flatMap((lineId) => {
      const row = rows.find((r) => r.activity.lineId === lineId)
      return row ? [{ lineId, name: activityName(row), start: row.activity.start }] : []
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * The day the answer is needed: the first held work's start, less the RFI's days, and never before
 * the day it was asked (work already under way needs it now). Null: it holds nothing on the schedule.
 */
export function rfiNeededBy(state: GcState, project: GcProject, rfi: Rfi): string | null {
  const first = rfiHolds(state, project, rfi)[0]
  if (!first) return null
  const day = addDays(first.start, -rfi.neededDays)
  return day < rfi.askedOn ? rfi.askedOn : day
}

/**
 * The work a trade asks about from its portal: its next activity on the job that has not started,
 * or, when all of it has, the one under way. Nothing left: it holds nothing.
 */
export function rfiDefaultHolds(state: GcState, project: GcProject, packageId: string): string[] {
  const open = scheduleRows(state, project)
    .filter((r) => r.pkg.id === packageId && r.actual < 100)
    .sort((a, b) => a.activity.start.localeCompare(b.activity.start))
  const next = open.find((r) => r.activity.start > state.today) ?? open[0]
  return next ? [next.activity.lineId] : []
}

/** What an answer changes, in words: "no change", "changes the plans", "adds $3,800 and 2 days". */
export function rfiImpactWords(impact: RfiImpact, cost: number, days: number): string {
  if (impact === 'none') return 'no change'
  if (impact === 'plans') return 'changes the plans'
  const parts = [cost > 0 ? money(cost) : '', days > 0 ? (days === 1 ? '1 day' : `${days} days`) : ''].filter(Boolean)
  return parts.length > 0 ? `adds ${parts.join(' and ')}` : 'adds cost or days'
}

export interface RfiRow {
  rfi: Rfi
  label: string
  state: RfiState
  /** "waiting on us", "with the architect", "answered". */
  stateWords: string
  stateTone: 'amber' | 'blue' | 'green'
  /** The open question's day: "needed today", "needed by Fri Oct 9", "2 days late". Null: answered, or it holds nothing. */
  needed: string | null
  neededTone: 'red' | 'amber' | 'grey'
  late: boolean
  /** "Summit Roofing" or "Our superintendent". */
  askedBy: string
  holds: { lineId: string; name: string; start: string }[]
  /** Answered with a cost and no change order yet: Start a change order. */
  canStartChangeOrder: boolean
  /** The change order it started: its number. Null: none. */
  changeOrderNumber: number | null
}

/** The job's RFIs, open first (the most urgent first), then answered, newest first. */
export function rfiRows(state: GcState, project: GcProject): RfiRow[] {
  const rows = (project.rfis ?? []).map((rfi): RfiRow & { sortDay: string } => {
    const st = rfiState(rfi)
    const neededBy = st === 'answered' ? null : rfiNeededBy(state, project, rfi)
    const left = neededBy ? daysUntil(neededBy, state.today) : null
    const needed = neededBy === null || left === null ? null : left < 0 ? `${-left === 1 ? '1 day' : `${-left} days`} late` : left === 0 ? 'needed today' : `needed by ${weekdayDate(neededBy)}`
    const co = rfi.changeOrderId ? project.changeOrders?.find((c) => c.id === rfi.changeOrderId) : undefined
    return {
      rfi,
      label: rfiLabel(rfi),
      state: st,
      stateWords: st === 'us' ? 'waiting on us' : st === 'architect' ? 'with the architect' : 'answered',
      stateTone: st === 'us' ? 'amber' : st === 'architect' ? 'blue' : 'green',
      needed,
      neededTone: left === null ? 'grey' : left <= 0 ? 'red' : left <= RFI_NEEDED_DAYS ? 'amber' : 'grey',
      late: left !== null && left < 0,
      askedBy: rfi.partnerId ? (partnerById(state, rfi.partnerId)?.company ?? 'A trade') : 'Our superintendent',
      holds: rfiHolds(state, project, rfi),
      canStartChangeOrder: rfi.answer?.impact === 'cost' && rfi.changeOrderId === null && project.stage !== 'pursuing',
      changeOrderNumber: co?.number ?? null,
      sortDay: neededBy ?? '9999-12-31',
    }
  })
  const open = rows.filter((r) => r.state !== 'answered').sort((a, b) => a.sortDay.localeCompare(b.sortDay) || a.rfi.number - b.rfi.number)
  const done = rows.filter((r) => r.state === 'answered').sort((a, b) => b.rfi.number - a.rfi.number)
  return [...open, ...done].map(({ sortDay: _sortDay, ...row }) => row)
}

/** The counts on the tab's bar: waiting on us, with the architect, answered, and late or due today. */
export function rfiCounts(state: GcState, project: GcProject): { us: number; architect: number; answered: number; dueNow: number } {
  const rows = rfiRows(state, project)
  return {
    us: rows.filter((r) => r.state === 'us').length,
    architect: rows.filter((r) => r.state === 'architect').length,
    answered: rows.filter((r) => r.state === 'answered').length,
    dueNow: rows.filter((r) => r.neededTone === 'red').length,
  }
}

/** The change order an answer starts: what changes, from the RFI and its answer. */
export function rfiChangeOrderDescription(rfi: Rfi): string {
  const answer = (rfi.answer?.text ?? '').trim().replace(/^["“]|["”]$/g, '').replace(/\.$/, '')
  return `${rfiLabel(rfi)}: ${answer}${rfi.sheets.length > 0 ? ` (${rfi.sheets.join(', ')})` : ''}`
}

/** The log's line for an answer: "RFI-002 answered by Marsh & Vale Architects: no change." */
export function rfiAnsweredWords(project: GcProject, rfi: Rfi): string {
  const a = rfi.answer
  if (!a) return ''
  const by = a.by === 'architect' ? project.architect : 'us'
  return `${rfiLabel(rfi)} answered by ${by} ${shortDate(a.on)}: ${rfiImpactWords(a.impact, a.cost, a.days)}.`
}

/** A trade's own RFIs on a job, and those about its trade, for its portal. Newest first. */
export function portalRfis(project: GcProject, packageId: string, partnerId: string): Rfi[] {
  return (project.rfis ?? []).filter((r) => r.partnerId === partnerId || r.packageId === packageId).sort((a, b) => b.number - a.number)
}

/** A trade asks from its portal on a job that is ours and being built, on a trade it was awarded. */
export function portalCanAskRfi(project: GcProject, packageId: string, partnerId: string): boolean {
  if (project.stage !== 'building' || project.closedOn) return false
  const pkg = project.packages.find((k) => k.id === packageId)
  return Boolean(pkg && pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === partnerId))
}
