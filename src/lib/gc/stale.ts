/**
 * GC mode, the real build, the Board's B2b-vi: what changed under a quote priced on older plans, moved word for word from the
 * GC mode prototype (branch spike/gc-mode, `gcStale.ts`) but one line. The prototype reads New project's `lineReads` over its own
 * project, walking its sets from the first index; main reads `lineReach.ts` over the board's project through `reachOf`, the index
 * and manual as they stand after the newest set (`GcProject.index`, mapped from the view). The plan is
 * to-dos/gc-mode/mockups/board-b2b-vi.md on that branch (call E3').
 */
import { lineReads, type ReachProject } from './lineReach'
import type { GcProject, Invite, PlanSet, ScopeItem, TradePackage } from './types'

/** What one newer set did to the trade. */
export interface StaleSetChange {
  set: PlanSet
  /** Lines whose own sheets this set changed. */
  named: ScopeItem[]
  /** A touched line names no sheet: the change reaches the trade as a whole. */
  wholeTrade: boolean
  /** Lines this set added to the trade. */
  added: ScopeItem[]
}

export interface StaleChange {
  /** The newer sets that touched this trade since the quote's set, oldest first. */
  sets: StaleSetChange[]
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * Main's own (the one difference from the prototype, call E3'): what `lineReads` reads of the board's project. The index and
 * manual as they stand after the newest set, and the trades with their lines. A project mapped with no index guesses no sheet:
 * only a line that names its own sheets is named, and the words fall back to the trade's sheets.
 */
export function reachOf(project: GcProject): ReachProject {
  return { sheets: project.index?.sheets ?? [], specs: project.index?.specs ?? [], trades: project.packages }
}

/** Null when the quote is on the newest plans for this trade (or there is no quote). */
export function staleChange(project: GcProject, pkg: TradePackage, invite: Invite): StaleChange | null {
  const bid = invite.bid
  if (!bid) return null
  const sets = project.planSets.filter((s) => s.rev > bid.basedOnRev && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev)
  if (sets.length === 0) return null
  return {
    sets: sets.map((set) => {
      const changed = new Set(set.changedSheets)
      // A revised section of the project manual reaches the lines tied to it (Board item 4).
      const revised = new Set(set.changedSpecs ?? [])
      const addedIds = new Set((set.addedLines ?? []).filter((l) => l.packageId === pkg.id).map((l) => l.scopeId))
      const named: ScopeItem[] = []
      let wholeTrade = false
      for (const item of pkg.scope) {
        if (addedIds.has(item.id)) continue
        if ((item.specs ?? []).some((id) => revised.has(id))) {
          named.push(item)
          continue
        }
        const reads = lineReads(reachOf(project), pkg, item)
        if (!reads.sheets.some((id) => changed.has(id))) continue
        if (reads.wholeTrade) wholeTrade = true
        else named.push(item)
      }
      return { set, named, wholeTrade, added: pkg.scope.filter((i) => addedIds.has(i.id)) }
    }),
  }
}

/**
 * The change in plain sentences, one per set: "Addendum 1 changed panels and feeders, and the
 * trade as a whole." · "Addendum 2 changed the HVAC sheets." · "Addendum 2 added detention pond."
 */
export function staleWords(pkg: TradePackage, change: StaleChange): string {
  const out: string[] = []
  for (const c of change.sets) {
    const lines = listWords(c.named.map((i) => i.label.toLowerCase()))
    if (lines) out.push(`${c.set.label} changed ${lines}${c.wholeTrade ? ', and the trade as a whole' : ''}.`)
    else if (c.wholeTrade || c.added.length === 0) out.push(`${c.set.label} changed the ${pkg.trade} sheets.`)
    if (c.added.length > 0) out.push(`${c.set.label} added ${listWords(c.added.map((i) => i.label.toLowerCase()))}.`)
  }
  return out.join(' ')
}
