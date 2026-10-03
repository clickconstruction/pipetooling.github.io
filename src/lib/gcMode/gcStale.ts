/**
 * GC mode — design spike. What changed under a quote priced on older plans (the owner's pick,
 * 2026-10-03: a quote that needs confirming names the lines the newer set touched, not only the
 * trade). It reads the New Project lane's line sheets (`lineReads`): a line whose own sheets
 * changed is named; a line that names no sheet counts for the trade as a whole; a line a newer
 * set added is said as added. Set by set, so each set is credited only with what it changed.
 * Its own file, so gcBids does not import gcNewProject (that loops through gcBench to gcBids).
 */
import type { GcProject, Invite, PlanSet, ScopeItem, TradePackage } from './gcTypes'
import { lineReads } from './gcNewProject'

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

/** Null when the quote is on the newest plans for this trade (or there is no quote). */
export function staleChange(project: GcProject, pkg: TradePackage, invite: Invite): StaleChange | null {
  const bid = invite.bid
  if (!bid) return null
  const sets = project.planSets.filter((s) => s.rev > bid.basedOnRev && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev)
  if (sets.length === 0) return null
  return {
    sets: sets.map((set) => {
      const changed = new Set(set.changedSheets)
      const addedIds = new Set((set.addedLines ?? []).filter((l) => l.packageId === pkg.id).map((l) => l.scopeId))
      const named: ScopeItem[] = []
      let wholeTrade = false
      for (const item of pkg.scope) {
        if (addedIds.has(item.id)) continue
        const reads = lineReads(project, pkg, item)
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
