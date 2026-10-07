/**
 * GC mode, the real build, the Building lane's U2: Building's kinds on the Board's promise record, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingPromises.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
// `buildingPromisesKeptBy` reads the prototype's reducer's actions, so it stays on the spike: its rules are SQL
// in the real build (BUILDING_REAL_BUILD.md, decision 9).
import { addDays, tradeCloseout } from './building'
import type { Draw, GcProject, PromiseKind, TradePackage, TradePromise } from './types'

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
