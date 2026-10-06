/**
 * GC mode design spike: a trade's own crew count, from its portal (G-142; mock-up
 * `to-dos/gc-mode/mockups/G-142.md`). Beside its weekly look-ahead marks, a trade says how many
 * people a day it will have on site each coming week, one count a trade the way the daily log counts
 * them. The superintendent's morning list (G-118) reads it beside the log's count, so a short crew,
 * a missing one or a cut count is news; G-84's people-per-week strip reads the same record.
 *
 * One record on the project (`crewCounts`, newest first): the newest for a trade and week is the one
 * that counts, and the ones before it say when a count was cut.
 *
 * Its own file, out of the barrel: the reducer, the portal and the morning list read it.
 */
import type { CrewCount, GcProject, GcState, Partner } from './gcTypes'
import { addDays } from './gcBuilding'
import { LOOKAHEAD_WEEKS, mondayOf } from './gcBuildingSchedule'
import { portalLookAhead } from './gcPortal'
import { shortDate, weekdayDate } from './gcWords'
import type { PortalKey } from './gcPortalI18n'

/** The most people a day a count can say. */
export const CREW_MAX = 50

/** The Mondays a count can be for: this week and the next two, the look-ahead's own weeks. */
export function crewWeeks(today: string): string[] {
  const first = mondayOf(today)
  return Array.from({ length: LOOKAHEAD_WEEKS }, (_, i) => addDays(first, i * 7))
}

/** Whether a company may give a count for a trade and week: its own awarded trade, on a job being built, in one of the coming weeks. */
export function crewCountAllowed(state: GcState, project: GcProject, partnerId: string, packageId: string, weekOf: string): boolean {
  if (project.stage !== 'building') return false
  const pkg = project.packages.find((k) => k.id === packageId)
  if (!pkg || pkg.selfPerform) return false
  if (pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId !== partnerId) return false
  return crewWeeks(state.today).includes(weekOf)
}

/** What is wrong with a count, in the portal's words: a whole number from 0 to 50. Null: it can go. */
export function crewCountProblem(count: number): PortalKey | null {
  return Number.isInteger(count) && count >= 0 && count <= CREW_MAX ? null : 'crewWhole'
}

/** The count that counts for one trade and week: the newest. G-84's people-per-week strip reads these; the shape stays. */
export interface CrewCountNow {
  packageId: string
  partnerId: string
  /** The Monday of the week. */
  weekOf: string
  /** People a day. 0: nobody that week. */
  count: number
  /** The day they said it. */
  on: string
}

/** The newest count for each trade and week, by week, then in the job's trade order. */
export function crewCountsNow(project: GcProject): CrewCountNow[] {
  const seen = new Set<string>()
  const out: CrewCountNow[] = []
  for (const c of project.crewCounts ?? []) {
    const key = `${c.packageId}|${c.weekOf}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ packageId: c.packageId, partnerId: c.partnerId, weekOf: c.weekOf, count: c.count, on: c.on })
  }
  const order = new Map(project.packages.map((k, i) => [k.id, i]))
  return out.sort((a, b) => a.weekOf.localeCompare(b.weekOf) || (order.get(a.packageId) ?? 0) - (order.get(b.packageId) ?? 0))
}

/** A trade's word for the week a day falls in, and the higher count it replaced (a cut). */
export interface CrewSaid {
  count: number
  on: string
  /** The count it lowered, when it was lowered. Null: not a cut. */
  cutFrom: { count: number; on: string } | null
}

/** The trade's count for the week of a day. Null: it gave none. */
export function crewCountOn(project: GcProject, packageId: string, day: string): CrewSaid | null {
  const week = mondayOf(day)
  const all = (project.crewCounts ?? []).filter((c) => c.packageId === packageId && c.weekOf === week)
  const now = all[0]
  if (!now) return null
  const before = all[1]
  return { count: now.count, on: now.on, cutFrom: before && before.count > now.count ? { count: before.count, on: before.on } : null }
}

/**
 * The morning list's line when the trade gave a count (G-118's line otherwise), and its tone:
 * - before the day's log: "They said 4 a day this week. Last on the log Thu Oct 1 with 4."
 * - fewer on the log: "On today's log with 2 of the 4 they said." (amber, a short crew)
 * - as many or more: "On today's log with 4. They said 4." (green)
 * - not on it: "Not on today's log. They said 4 a day this week." (red)
 * A cut or a count of nobody reads amber before the log has its say.
 */
export function crewLogWords(said: CrewSaid, onTheDay: number | null, lastOnLog: { on: string; workers: number } | null, dayLogName: string): { words: string; tone: 'red' | 'amber' | 'green' | 'grey' } {
  const theySaid =
    said.count === 0
      ? 'They said nobody this week.'
      : said.cutFrom
        ? `They said ${said.count} a day this week, down from ${said.cutFrom.count} on ${weekdayDate(said.on)}.`
        : `They said ${said.count} a day this week.`
  if (onTheDay === null) {
    const last = lastOnLog ? `Last on the log ${weekdayDate(lastOnLog.on)} with ${lastOnLog.workers}.` : 'Not on the daily log before.'
    return { words: `${theySaid} ${last}`, tone: said.count === 0 || said.cutFrom ? 'amber' : 'grey' }
  }
  if (onTheDay === 0) return { words: `Not on ${dayLogName}. ${theySaid}`, tone: said.count === 0 ? 'grey' : 'red' }
  if (onTheDay < said.count) return { words: `On ${dayLogName} with ${onTheDay} of the ${said.count} they said.`, tone: 'amber' }
  return { words: `On ${dayLogName} with ${onTheDay}. ${said.count === 0 ? 'They said nobody this week.' : `They said ${said.count}.`}`, tone: 'green' }
}

/** The portal's asks: each coming week with work, each of the company's trades in it, and its count so far. */
export interface PortalCrewWeek {
  weekOf: string
  trades: { packageId: string; trade: string; now: CrewCountNow | null }[]
}

export function portalCrewAsks(state: GcState, partnerId: string, project: GcProject): PortalCrewWeek[] {
  const allowed = crewWeeks(state.today)
  const now = crewCountsNow(project)
  return portalLookAhead(state, partnerId, project)
    .filter((w) => w.when !== 'last' && w.items.length > 0 && allowed.includes(w.weekOf))
    .map((w) => {
      const pkgs = [...new Map(w.items.map((i) => [i.row.pkg.id, i.row.pkg])).values()]
      return {
        weekOf: w.weekOf,
        trades: pkgs.map((pkg) => ({ packageId: pkg.id, trade: pkg.trade, now: now.find((c) => c.packageId === pkg.id && c.weekOf === w.weekOf) ?? null })),
      }
    })
}

/** The log's line when a trade gives a count: "Summit Roofing says 4 a day on Roofing at Fair Oaks Shops, Building D, the week of Sep 28." */
export function crewCountLogWords(project: GcProject, partner: Partner, count: CrewCount): string {
  const trade = project.packages.find((k) => k.id === count.packageId)?.trade ?? 'its trade'
  const how = count.count === 0 ? 'nobody' : `${count.count} a day`
  return `${partner.company} says ${how} on ${trade} at ${project.name}, the week of ${shortDate(count.weekOf)}.`
}
