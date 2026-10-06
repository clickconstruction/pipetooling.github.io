/**
 * GC mode design spike: people on site per week, the Gantt's G-84 (the mock-up and plan are
 * `to-dos/gc-mode/mockups/G-84.md`). The office's chart can show, under its rows, each week's
 * busiest day as the plan has it against the busiest day the daily log has, the gap being the news.
 *
 * - **The plan** counts each trade once on each day one of its bars runs by the plan's own dates
 *   (not G-60's `runsOn`: a late bar not done would otherwise fill every week ahead; the log is what
 *   shows a late bar's crew while it is still there). Each trade's number, in order: its own count
 *   for the week (G-142's `crewCountsNow`, the `told` argument), else the daily log's last count for
 *   it, else ASSUMED_CREW, named on the strip. Our own crew counts like any trade;
 *   inspections and added activities have no crew.
 * - **The log**: each week's busiest logged day, its total of every crew, with how many days were
 *   logged. Days without a log are not guessed.
 *
 * Whole job, whatever the chart filters or folds. Its own file, out of the barrel.
 */
import type { DailyLog, GcProject, GcState, TradePackage } from './gcTypes'
import type { CrewCountNow } from './gcCrewCounts'
import { addDays } from './gcBuilding'
import { mondayOf, scheduleItems } from './gcBuildingSchedule'
import { partnerById } from './gcLookups'
import { weekdayDate } from './gcWords'

/** A trade with no count from itself or the log is counted as this many people, named on the strip. */
export const ASSUMED_CREW = 3
/** A week is short when its busiest logged day has this many people fewer than the plan's busiest day. */
export const SHORT_BY = 3

/** Where a trade's number came from: its own word (G-142), the daily log's last count, or the assumption. */
export type CountFrom = 'told' | 'log' | 'assumed'

export interface PeopleWeek {
  /** Monday. */
  weekOf: string
  /** The plan's busiest day: when, how many, and who, each with where its number came from. */
  planned: { on: string | null; count: number; by: { packageId: string; company: string; count: number; from: CountFrom }[] }
  /** The daily log's busiest day that week. Null: no log that week. */
  logged: { on: string; count: number; days: number } | null
  /** The log's busiest day had SHORT_BY or more people fewer than the plan's. */
  short: boolean
  /** The hover card's rows, in plain words: the plan, who, the log, where the counts came from. Who has a line for each company. */
  rows: { label: string; lines: string[] }[]
}

function totalOn(log: DailyLog): number {
  return log.crews.reduce((n, c) => n + Math.max(0, c.workers), 0)
}

function companyOf(state: GcState, pkg: TradePackage): string {
  if (pkg.selfPerform) return 'our own crew'
  const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
  return (partnerId ? partnerById(state, partnerId)?.company : undefined) ?? pkg.trade
}

/** Every week from the one holding `from` to the one holding `to`, Monday to Sunday: the plan's and the log's busiest day. */
export function peopleOnSite(state: GcState, project: GcProject, from: string, to: string, told: CrewCountNow[] = []): PeopleWeek[] {
  if (!project.schedule) return []
  const items = scheduleItems(state, project).filter((it) => it.pkg && !it.activity.inspection && !it.activity.added)
  const logs = [...(project.dailyLogs ?? [])].filter((l) => l.date <= state.today).sort((a, b) => a.date.localeCompare(b.date))
  // The daily log's last count for each trade, up to today.
  const lastLog = new Map<string, number>()
  for (const l of logs) for (const c of l.crews) if (c.workers > 0) lastLog.set(c.packageId, c.workers)
  const out: PeopleWeek[] = []
  for (let week = mondayOf(from); week <= to; week = addDays(week, 7)) {
    const countOf = (packageId: string): { count: number; from: CountFrom } => {
      // `crewCountsNow` keeps one count a trade and week, its newest.
      const own = told.find((c) => c.packageId === packageId && c.weekOf === week)
      if (own) return { count: own.count, from: 'told' }
      const last = lastLog.get(packageId)
      return last !== undefined ? { count: last, from: 'log' } : { count: ASSUMED_CREW, from: 'assumed' }
    }
    // The plan's busiest day: each trade once a day, as the log counts it.
    let best: { on: string | null; count: number; ids: Set<string> } = { on: null, count: 0, ids: new Set() }
    for (let i = 0; i < 7; i++) {
      const day = addDays(week, i)
      const ids = new Set(items.filter((it) => it.activity.start <= day && day <= it.activity.finish).map((it) => it.pkg?.id ?? ''))
      const count = [...ids].reduce((n, id) => n + countOf(id).count, 0)
      if (count > best.count) best = { on: day, count, ids }
    }
    const by = project.packages.filter((k) => best.ids.has(k.id)).map((k) => ({ packageId: k.id, company: companyOf(state, k), ...countOf(k.id) }))
    // The daily log's busiest day that week.
    const weekLogs = logs.filter((l) => l.date >= week && l.date <= addDays(week, 6))
    const busiest = weekLogs.reduce<DailyLog | null>((m, l) => (m === null || totalOn(l) > totalOn(m) ? l : m), null)
    const logged = busiest ? { on: busiest.date, count: totalOn(busiest), days: weekLogs.length } : null
    const short = logged !== null && best.count - logged.count >= SHORT_BY
    const rows: PeopleWeek['rows'] = [
      { label: 'Plan', lines: [best.on ? `${best.count} at the busiest, ${weekdayDate(best.on)}.` : 'Nothing on the plan this week.'] },
      ...(by.length > 0 ? [{ label: 'Who', lines: by.map((b) => `${b.company} ${b.count}${b.from === 'told' ? ', its own count' : b.from === 'assumed' ? ', assumed' : ''}`) }] : []),
      { label: 'Log', lines: [logged ? `${logged.count} at the busiest, ${weekdayDate(logged.on)}, ${logged.days} ${logged.days === 1 ? 'day' : 'days'} logged.` : 'No daily log this week.'] },
      ...(short && logged ? [{ label: 'Short', lines: [`The log had ${best.count - logged.count} fewer people than the plan.`] }] : []),
      {
        label: 'Counts',
        lines: [
          [
            by.some((b) => b.from === 'told') ? "A trade's own count for the week comes first, then the daily log's last count." : "Each is the daily log's last count for that trade.",
            `A trade with no count yet is counted as ${ASSUMED_CREW}.`,
          ].join(' '),
        ],
      },
    ]
    out.push({ weekOf: week, planned: { on: best.on, count: best.count, by }, logged, short, rows })
  }
  return out
}
