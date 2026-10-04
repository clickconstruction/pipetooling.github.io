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
import type { Draw, GcAction, GcProject, GcState, PromiseKind, TradePackage, TradePromise } from './gcTypes'
import { addDays, tradeCloseout } from './gcBuilding'
import { punchItems, punchState } from './gcBuildingPunch'
import { submittalState } from './gcBuildingSubmittals'

/** Building's kinds. */
export type BuildingPromiseKind = Extract<PromiseKind, 'start' | 'submittals' | 'delivery' | 'payApp' | 'punch' | 'closeout'>

/** A promise a move keeps. `on`: the day it came, when that is not today (a daily log caught up late). */
export interface BuildingPromiseMatch {
  partnerId: string
  kind: BuildingPromiseKind
  projectId: string
  packageId: string
  on?: string
}

/** Start dates this many days out, or passed, ask for the day the trade gives. */
export const START_ASK_DAYS = 14

function awardedPartnerId(pkg: TradePackage | undefined): string | null {
  return pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null
}

/** The first day the daily log has the trade's crew on site. Null: not yet. */
export function firstOnSite(project: GcProject, packageId: string): string | null {
  const days = (project.dailyLogs ?? []).filter((l) => l.crews.some((c) => c.packageId === packageId && c.workers > 0)).map((l) => l.date)
  return days.length === 0 ? null : days.reduce((m, d) => (d < m ? d : m))
}

/** A trade we hire whose work starts soon and has not shown on the job yet. */
export interface StartToPromise {
  pkg: TradePackage
  partnerId: string
  /** The first start of its work on the schedule. */
  start: string
  /** The day they said their crew will be on site. Null: none written down. */
  promisedBy: string | null
}

/**
 * The trades whose first start on the schedule is within `START_ASK_DAYS`, or passed, with no
 * crew on the daily log and nothing reported done. Soonest first, each with the day they gave.
 */
export function startsToPromise(project: GcProject, today: string, promises: TradePromise[] = []): StartToPromise[] {
  if (project.stage !== 'building') return []
  const acts = project.schedule?.activities ?? []
  const out: StartToPromise[] = []
  for (const pkg of project.packages) {
    const partnerId = awardedPartnerId(pkg)
    if (pkg.selfPerform || !partnerId || !pkg.sow) continue
    const lineIds = new Set(pkg.sow.sov.map((l) => l.id))
    const starts = acts.filter((a) => lineIds.has(a.lineId) && !a.inspection).map((a) => a.start)
    if (starts.length === 0) continue
    const start = starts.reduce((m, d) => (d < m ? d : m))
    if (start > addDays(today, START_ASK_DAYS)) continue
    if (firstOnSite(project, pkg.id) || pkg.sow.sov.some((l) => l.pctReported > 0)) continue
    const promise = promises.find((p) => !p.keptOn && p.kind === 'start' && p.partnerId === partnerId && p.projectId === project.id && p.packageId === pkg.id)
    out.push({ pkg, partnerId, start, promisedBy: promise?.by ?? null })
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

/** The papers a trade owes us: an unconditional waiver for each paid draw, and the final pay application once it can ask. */
export interface PapersOwed {
  waivers: Draw[]
  finalApp: boolean
}

export function papersOwed(project: GcProject, pkg: TradePackage, today: string): PapersOwed {
  const sow = pkg.sow
  if (!sow) return { waivers: [], finalApp: false }
  return {
    waivers: sow.draws.filter((d) => d.status === 'paid' && d.waiver !== 'unconditional'),
    finalApp: tradeCloseout(sow, project, today).canAskFinal,
  }
}

/** "the unconditional waiver on draw 2" · "the final pay application and the unconditional waiver on draw 3". Null: none owed. */
export function papersOwedWords(owed: PapersOwed): string | null {
  const parts: string[] = []
  if (owed.finalApp) parts.push('the final pay application')
  const final = owed.waivers.find((d) => d.final)
  const others = owed.waivers.filter((d) => !d.final).map((d) => d.number)
  if (others.length === 1) parts.push(`the unconditional waiver on draw ${others[0]}`)
  if (others.length > 1) parts.push(`the unconditional waivers on draws ${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`)
  if (final) parts.push('the unconditional final release of lien')
  if (parts.length === 0) return null
  return parts.length === 1 ? (parts[0] ?? null) : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * What a move keeps of Building's kinds (the before-state, as the Board's `promisesKeptBy` gets it):
 * - a daily log with the trade's crew on site keeps its start, on the log's day;
 * - a submittal sent keeps "their submittals" once none waits on the trade;
 * - a pay application sent keeps "the fixed pay application";
 * - a punch item marked fixed keeps "the punch items fixed" once none is left to fix;
 * - the final pay application, or an unconditional waiver, keeps "their closeout papers" once none is owed.
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
      const left = owed.finalApp || owed.waivers.some((d) => d.id !== action.drawId)
      return left ? [] : match(project, pkg.id, 'closeout')
    }
    default:
      return []
  }
}
