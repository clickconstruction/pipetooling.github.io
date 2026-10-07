/**
 * GC mode — design spike: Building's kinds on the Board's promise record (the owner, 2026-10-04,
 * question 8). A trade's start on site, its submittals, a material delivery, a pay application fixed
 * and sent again, its punch items, and its closeout papers and lien waivers. Each but the delivery
 * is kept when the thing happens: `buildingPromisesKeptBy` names the moves, and the Board's
 * `promisesKeptBy` (gcPromises.ts) reads it. A delivery the app cannot see arrive: the office marks it.
 * Their words are the Board's `PROMISE_WHAT`.
 *
 * Import from `./gcModel`.
 */
import type { GcAction, GcProject, GcState, TradePackage } from './gcTypes'
import { punchItems, punchState } from './gcBuildingPunch'
import { submittalState } from './gcBuildingSubmittals'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { BuildingPromiseKind, BuildingPromiseMatch } from '../gc/buildingPromises'
import { papersOwed } from '../gc/buildingPromises'
export type { BuildingPromiseKind, BuildingPromiseMatch, PapersOwed, StartToPromise } from '../gc/buildingPromises'
export { START_ASK_DAYS, firstOnSite, papersOwed, papersOwedWords, startsToPromise } from '../gc/buildingPromises'

function awardedPartnerId(pkg: TradePackage | undefined): string | null {
  return pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null
}

/**
 * What a move keeps of Building's kinds (the before-state, as the Board's `promisesKeptBy` gets it):
 * - a daily log with the trade's crew on site keeps its start, on the log's day;
 * - a submittal sent keeps "their submittals" once none waits on the trade;
 * - a pay application sent keeps "the fixed pay application";
 * - a punch item marked fixed keeps "the punch items fixed" once none is left to fix;
 * - the final pay application, or an unconditional waiver, keeps "their closeout papers" once none is owed;
 *   a promise for the waivers alone is kept once the waivers are in.
 */
export function buildingPromisesKeptBy(state: GcState, action: GcAction): BuildingPromiseMatch[] {
  const projectOf = (id: string) => state.projects.find((p) => p.id === id)
  const match = (project: GcProject, packageId: string, kind: BuildingPromiseKind, on?: string): BuildingPromiseMatch[] => {
    const partnerId = awardedPartnerId(project.packages.find((k) => k.id === packageId))
    return partnerId ? [{ partnerId, kind, projectId: project.id, packageId, ...(on ? { on } : {}) }] : []
  }
  switch (action.type) {
    case 'saveDailyLog': {
      const project = projectOf(action.projectId)
      if (!project) return []
      return action.log.crews.filter((c) => c.workers > 0).flatMap((c) => match(project, c.packageId, 'start', action.log.date))
    }
    case 'tradeSendSubmittal': {
      const project = projectOf(action.projectId)
      const sub = project?.submittals?.find((s) => s.id === action.submittalId)
      if (!project || !sub || submittalState(sub) !== 'trade') return []
      const others = (project.submittals ?? []).some((s) => s.id !== sub.id && s.packageId === sub.packageId && submittalState(s) === 'trade')
      return others ? [] : match(project, sub.packageId, 'submittals')
    }
    case 'tradeSendPayApp': {
      const project = projectOf(action.projectId)
      return project ? match(project, action.packageId, 'payApp') : []
    }
    case 'tradeFixPunchItem': {
      const project = projectOf(action.projectId)
      const item = project?.punch?.find((i) => i.id === action.itemId)
      if (!project || !item || punchState(item) !== 'open') return []
      const left = punchItems(project, item.packageId).some((i) => i.id !== item.id && punchState(i) === 'open')
      return left ? [] : match(project, item.packageId, 'punch')
    }
    case 'tradeSendFinalPayApp': {
      const project = projectOf(action.projectId)
      const pkg = project?.packages.find((k) => k.id === action.packageId)
      if (!project || !pkg) return []
      return papersOwed(project, pkg, state.today).waivers.length === 0 ? match(project, pkg.id, 'closeout') : []
    }
    case 'tradeSignUnconditional': {
      const project = projectOf(action.projectId)
      const pkg = project?.packages.find((k) => k.id === action.packageId)
      if (!project || !pkg) return []
      const owed = papersOwed(project, pkg, state.today)
      if (!owed.waivers.some((d) => d.id === action.drawId)) return []
      // A promise for the waivers alone (the Board's "Ask for the waiver") is kept once they are all
      // in, even while the final pay application is still owed; one for every paper waits for it too.
      const open = (state.tradePromises ?? []).find((p) => !p.keptOn && p.kind === 'closeout' && p.projectId === project.id && p.packageId === pkg.id)
      const waiversOnly = open !== undefined && !/final pay application/i.test(open.what)
      const left = owed.waivers.some((d) => d.id !== action.drawId) || (owed.finalApp && !waiversOnly)
      return left ? [] : match(project, pkg.id, 'closeout')
    }
    default:
      return []
  }
}
