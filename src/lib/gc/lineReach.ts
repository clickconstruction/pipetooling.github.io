/**
 * GC mode, the real build, step 6: what a scope line reads from, moved from the prototype
 * (branch spike/gc-mode, `gcNewProject.ts` and `gcPlans.ts`). A line names its sheets and
 * sections, or the office said nothing and the guess stands; a line that names none reads its
 * trade as a whole (the owner, 2026-10-02: count those lines as touched when any of the trade's
 * sheets changes). These read the project the mapper gives (`GcProjectView`): its sheets and
 * sections as they stand after the newest set, and its trades with their scope.
 */
import { guessLineSheets, guessLineSpecs, tradeForSpec, tradesForSheets } from './plans'
import type { PlanSheet, SpecSection } from './types'

export interface ReachLine {
  id: string
  label: string
  /** The sheets the office tied to the line. Null or missing: follow the guess. Empty: the trade as a whole. */
  sheets?: string[] | null
  specs?: string[] | null
}

export interface ReachTrade {
  id: string
  trade: string
  scope: ReachLine[]
}

/** What the reach reads of a project: the index and the manual as they stand, and the trades. */
export interface ReachProject {
  sheets: PlanSheet[]
  specs: SpecSection[]
  trades: ReachTrade[]
}

const bare = (x: string) => x.toUpperCase().replace(/[-.\s]/g, '')

/**
 * A sheet number as the project's index writes it: "A101" in the notes is "A-101" in a set that
 * uses dashes. A sheet the index does not have is written the way the index writes its others.
 */
export function sheetAsIndexed(project: ReachProject, id: string, added: PlanSheet[] = []): string {
  const known = [...project.sheets, ...added].find((s) => bare(s.id) === bare(id))
  if (known) return known.id
  const upper = id.toUpperCase()
  const dashed = project.sheets.filter((s) => s.id.includes('-')).length > project.sheets.length / 2
  return dashed && !upper.includes('-') ? upper.replace(/^([A-Z]+)/, '$1-') : upper
}

/** The sheets of the index that suggest a trade, with their titles, and any a set is adding. */
export function tradeSheets(project: ReachProject, trade: string, added: PlanSheet[] = []): PlanSheet[] {
  const index = [...project.sheets, ...added.filter((a) => !project.sheets.some((x) => x.id === a.id))]
  const from = tradesForSheets(index).find((g) => g.trade === trade)?.from ?? []
  return index.filter((s) => from.includes(s.id))
}

/** The sheets one scope line reads from: what the office said, or the guess when it said nothing. */
export function lineSheets(project: ReachProject, pkg: ReachTrade, item: ReachLine, added: PlanSheet[] = []): { sheets: string[]; guessed: boolean } {
  if (item.sheets) return { sheets: item.sheets, guessed: false }
  return { sheets: guessLineSheets(item.label, tradeSheets(project, pkg.trade, added)), guessed: true }
}

/** Every sheet one scope line reads from. A line that names no sheet reads every sheet of its trade (`wholeTrade`). */
export function lineReads(project: ReachProject, pkg: ReachTrade, item: ReachLine, added: PlanSheet[] = []): { sheets: string[]; guessed: boolean; wholeTrade: boolean } {
  const said = lineSheets(project, pkg, item, added)
  if (said.sheets.length > 0) return { ...said, wholeTrade: false }
  return { sheets: tradeSheets(project, pkg.trade, added).map((s) => s.id), guessed: said.guessed, wholeTrade: true }
}

/** The scope lines of a trade that read from any of these sheets, a line that names no sheet included. */
export function linesOnSheets(project: ReachProject, pkg: ReachTrade, sheetIds: string[], added: PlanSheet[] = []): ReachLine[] {
  return pkg.scope.filter((item) => lineReads(project, pkg, item, added).sheets.some((id) => sheetIds.includes(id)))
}

/** The trades on a project that a set's sheets most likely change. A sheet the set adds brings its own title. */
export function packagesForSheets(project: ReachProject, sheets: string[], added: PlanSheet[] = []): string[] {
  const named: PlanSheet[] = sheets.map((id) => added.find((s) => s.id === id) ?? project.sheets.find((s) => s.id === id) ?? { id, title: '' })
  const trades = new Set(tradesForSheets(named).map((g) => g.trade))
  return project.trades.filter((p) => trades.has(p.trade)).map((p) => p.id)
}

/** The sections of the manual that point at a trade, with any a set is adding. */
export function tradeSpecs(project: ReachProject, trade: string, added: SpecSection[] = []): SpecSection[] {
  const all = [...project.specs, ...added.filter((a) => !project.specs.some((x) => x.id === a.id))]
  return all.filter((x) => tradeForSpec(x.id) === trade)
}

/** The sections one scope line reads from: what the office said, or the guess when it said nothing. */
export function lineSpecs(project: ReachProject, pkg: ReachTrade, item: ReachLine, added: SpecSection[] = []): { specs: string[]; guessed: boolean } {
  if (item.specs) return { specs: item.specs, guessed: false }
  return { specs: guessLineSpecs(item.label, tradeSpecs(project, pkg.trade, added)), guessed: true }
}

/** Whether a line reads from a section. A line that names no section stands for the whole trade, so any section of its trade counts. */
export function lineReadsSpec(project: ReachProject, pkg: ReachTrade, item: ReachLine, specId: string, added: SpecSection[] = []): boolean {
  const said = lineSpecs(project, pkg, item, added).specs
  return said.length > 0 ? said.includes(specId) : tradeForSpec(specId) === pkg.trade
}

/** The scope lines of a trade that read from any of these sections, a line that names none included. */
export function linesOnSpecs(project: ReachProject, pkg: ReachTrade, specIds: string[], added: SpecSection[] = []): ReachLine[] {
  return pkg.scope.filter((item) => specIds.some((id) => lineReadsSpec(project, pkg, item, id, added)))
}

/** The trades on a project that a set's sections change: each section's trade, read from its number. */
export function packagesForSpecs(project: ReachProject, specIds: string[]): string[] {
  const trades = new Set(specIds.map(tradeForSpec).filter((t): t is string => t !== null))
  return project.trades.filter((p) => trades.has(p.trade)).map((p) => p.id)
}

/** A scope line a set leaves with nothing to read: every sheet it read, or every section, goes. */
export interface LineLeftBehind {
  packageId: string
  item: ReachLine
  /** Its sheets all go. */
  sheets: string[]
  /** Its sections all go. */
  specs: string[]
}

/**
 * The scope lines a set leaves behind: lines that read from sheets or sections, and every one of
 * them is taken out. A line that names none reads its trade as a whole, so it is never left.
 */
export function linesLeftBehind(project: ReachProject, goneSheets: string[], goneSpecs: string[]): LineLeftBehind[] {
  if (goneSheets.length + goneSpecs.length === 0) return []
  const out: LineLeftBehind[] = []
  for (const pkg of project.trades) {
    for (const item of pkg.scope) {
      const sheets = lineSheets(project, pkg, item).sheets
      const specs = lineSpecs(project, pkg, item).specs
      const noSheets = sheets.length > 0 && sheets.every((id) => goneSheets.includes(id))
      const noSpecs = specs.length > 0 && specs.every((id) => goneSpecs.includes(id))
      if (noSheets || noSpecs) out.push({ packageId: pkg.id, item, sheets: noSheets ? sheets : [], specs: noSpecs ? specs : [] })
    }
  }
  return out
}
