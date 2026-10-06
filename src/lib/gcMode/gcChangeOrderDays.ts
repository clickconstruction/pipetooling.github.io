/**
 * GC mode design spike: a signed change order's days on the chart, the Gantt's Phase 4
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-76). When the customer signs a change order that adds days,
 * the contract's finish moves by itself (`substantialCompletionOn` counts the signed orders). The
 * chart did not: the work the change belongs to sat as drawn, and the two disagreed. Here the days
 * are given a home, the trade's bar running the day it was signed, drawn as a tail on that bar
 * until someone puts them on the schedule, and put there as a move like any other, with the change
 * order as its reason, so the trades are told and the customer's What changed says so.
 *
 * Its own file, out of the barrel: it reads the schedule, the moves and Owner Billing's change orders.
 */
import type { ChangeOrder, GcProject, ScheduleActivity, ScheduleMove, ScheduleMoveReason } from './gcTypes'
import { addDays } from './gcBuilding'
import { substantialCompletionOn } from './gcBuildingSchedule'
import { changeOrderDays, signedChangeOrders } from './gcOwnerBilling'
import { moveActivityName } from './gcScheduleMoves'
import { shortDate, weekdayDate } from './gcWords'

export interface ChangeOrderOnChart {
  co: ChangeOrder
  days: number
  /** The bar its days land on. Null: our own work under general conditions, or the trade has no bar. */
  lineId: string | null
  /** "Roofing · TPO membrane". Null with no bar. */
  where: string | null
  /** The standing move that put its days on the schedule. Null: not on the dates yet. */
  landed: ScheduleMove | null
  /** "Change order 2 adds 3 days to Roofing · TPO membrane. Not on the dates yet." */
  words: string
}

/** The day a change order's days count from: the day the customer signed it. */
function signedOn(co: ChangeOrder, today: string): string {
  return co.answeredOn ?? today
}

function daysWords(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Where a change order's work is: the trade's bar running the day it was signed, else the first
 * one to start after that day, else the trade's last bar. That is the bar the tail is drawn on and
 * the days go to; the office can put them on another bar by moving that one with the same reason.
 */
export function whereWorkIs(project: GcProject, co: ChangeOrder, today: string): ScheduleActivity | null {
  if (!co.packageId) return null
  const own = (project.schedule?.activities ?? []).filter((a) => a.packageId === co.packageId && !a.inspection)
  const first = own[0]
  if (!first) return null
  const day = signedOn(co, today)
  const running = own.filter((a) => a.start <= day && a.finish >= day).sort((a, b) => (a.finish < b.finish ? -1 : 1))[0]
  if (running) return running
  const next = own.filter((a) => a.start > day).sort((a, b) => (a.start < b.start ? -1 : 1))[0]
  if (next) return next
  return own.reduce((last, a) => (a.finish > last.finish ? a : last), first)
}

/** The standing move that put a change order's days on the schedule. Null: not yet, or undone. */
export function changeOrderMoveOf(project: GcProject, co: ChangeOrder): ScheduleMove | null {
  return (project.schedule?.moves ?? []).find((m) => m.changeOrderId === co.id && !m.undoneOn) ?? null
}

/**
 * Every signed change order that adds days: where its days land, and whether they are on the schedule
 * yet. Not a time extension (G-141): its days are on the chart already, so it never pushes the bars.
 */
export function changeOrdersOnChart(project: GcProject, today: string): ChangeOrderOnChart[] {
  return signedChangeOrders(project)
    .filter((co) => changeOrderDays(co) > 0 && !co.daysOnChart)
    .map((co) => {
      const days = changeOrderDays(co)
      const landed = changeOrderMoveOf(project, co)
      const activity = landed ? (project.schedule?.activities.find((a) => a.lineId === landed.lineId) ?? null) : whereWorkIs(project, co, today)
      const where = activity ? moveActivityName(project, activity.lineId) : null
      const words = landed
        ? `Change order ${co.number} put ${daysWords(days)} on ${where ?? 'the schedule'}, ${shortDate(landed.on)} by ${landed.by}.`
        : where
          ? `Change order ${co.number} adds ${daysWords(days)} to ${where}. Not on the dates yet.`
          : `Change order ${co.number} adds ${daysWords(days)} to the job. Its work has no bar on the chart, so only the contract's finish moves.`
      return { co, days, lineId: activity?.lineId ?? null, where, landed, words }
    })
}

/** The tails the chart draws: days not on the dates yet, by the bar they land on. Two orders on one bar add up. */
export function changeOrderTails(project: GcProject, today: string): Map<string, { days: number; words: string }> {
  const tails = new Map<string, { days: number; words: string }>()
  for (const r of changeOrdersOnChart(project, today)) {
    if (!r.lineId || r.landed) continue
    const was = tails.get(r.lineId)
    tails.set(r.lineId, { days: (was?.days ?? 0) + r.days, words: was ? `${was.words} ${r.words}` : r.words })
  }
  return tails
}

/** The explanation a change order's move is saved with: the order, the day it was signed, what it is, and its days. */
export function changeOrderMoveNote(co: ChangeOrder, today: string): string {
  return `Change order ${co.number}, signed ${shortDate(signedOn(co, today))}: ${co.description}. It adds ${daysWords(changeOrderDays(co))} to this work.`
}

/** A move ready for Why it moved: the bar's finish out by the order's days, the change order as the reason. Null: on the schedule already, or no bar. */
export function changeOrderMove(
  project: GcProject,
  co: ChangeOrder,
  today: string,
): { lineId: string; start: string; finish: string; after: string[]; why: { reason: ScheduleMoveReason; note: string }; changeOrderId: string } | null {
  const days = changeOrderDays(co)
  if (days <= 0 || changeOrderMoveOf(project, co)) return null
  const a = whereWorkIs(project, co, today)
  if (!a) return null
  return { lineId: a.lineId, start: a.start, finish: addDays(a.finish, days), after: a.after, why: { reason: 'change order', note: changeOrderMoveNote(co, today) }, changeOrderId: co.id }
}

/**
 * For the customer's schedule: what their signed change orders did to their contract's finish, a
 * sentence each and one for the finish. Empty: no signed order adds days.
 */
export function customerContractDays(project: GcProject): string[] {
  const orders = signedChangeOrders(project).filter((co) => changeOrderDays(co) > 0)
  if (orders.length === 0) return []
  const lines = orders.map((co) => `Change order ${co.number} added ${daysWords(changeOrderDays(co))} to your contract.`)
  const contract = substantialCompletionOn(project)
  if (contract && contract.days > 0) lines.push(`Substantial completion is now ${weekdayDate(contract.on)}, ${daysWords(contract.days)} past the ${shortDate(contract.planned)} you signed.`)
  return lines
}
