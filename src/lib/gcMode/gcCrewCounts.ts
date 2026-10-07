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
import type { GcProject, GcState } from './gcTypes'
import { portalLookAhead } from './gcPortal'
import type { PortalKey } from './gcPortalI18n'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PortalCrewWeek } from '../gc/schedule/crewCounts'
import { CREW_MAX, crewCountsNow, crewWeeks } from '../gc/schedule/crewCounts'
export type { CrewCountNow, CrewSaid, PortalCrewWeek } from '../gc/schedule/crewCounts'
export { CREW_MAX, crewCountAllowed, crewCountLogWords, crewCountOn, crewCountsNow, crewLogWords, crewWeeks } from '../gc/schedule/crewCounts'

/** What is wrong with a count, in the portal's words: a whole number from 0 to 50. Null: it can go. */
export function crewCountProblem(count: number): PortalKey | null {
  return Number.isInteger(count) && count >= 0 && count <= CREW_MAX ? null : 'crewWhole'
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
