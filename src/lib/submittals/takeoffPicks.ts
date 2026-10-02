/**
 * Choose what the GC sees (2026-10-02): each takeoff fixture is one of three — the GC sees it,
 * order only (bought, never shown to the GC), or left out (not submitted, not ordered). The window
 * holds one pick per fixture, the fixtures already on the draft included; this kernel says where a
 * fixture starts, what a set of picks changes on the revision, and how to say it.
 */
import type { TakeoffCandidate } from './takeoffCandidates'

export type FixturePick = 'gc' | 'order' | 'out'

export const PICK_LABELS: Record<FixturePick, string> = { gc: 'GC sees it', order: 'Order only', out: 'Left out' }

/** Where a fixture stands before anything is clicked: as it sits on the draft, else as the bid remembers it, else its group's rule. */
export function startingPick(c: Pick<TakeoffCandidate, 'onAs' | 'ticked' | 'storedOrderOnly'>): FixturePick {
  if (c.onAs) return c.onAs
  return c.ticked ? (c.storedOrderOnly ? 'order' : 'gc') : 'out'
}

export function pickOf(c: TakeoffCandidate, picks: ReadonlyMap<string, FixturePick>): FixturePick {
  return picks.get(c.countRowId) ?? startingPick(c)
}

export type TakeoffPlan = {
  /** Fixtures coming onto the revision: a row the GC sees, or an order-only row. */
  add: Array<{ candidate: TakeoffCandidate; orderOnly: boolean }>
  /** Count rows whose rows on the draft become order only. */
  toOrderOnly: string[]
  /** Count rows whose order-only rows go back to the GC. */
  toGc: string[]
  /** Count rows whose rows leave the draft. */
  remove: string[]
  /** What the bid remembers for every fixture shown: on a revision or not, and order only or not. */
  ticks: Map<string, boolean>
  orderOnly: Map<string, boolean>
}

/** What the picks change. A fixture left where it stands changes nothing but is still remembered. */
export function planTakeoffPicks(cands: ReadonlyArray<TakeoffCandidate>, picks: ReadonlyMap<string, FixturePick>, splits?: ReadonlyMap<string, boolean>): TakeoffPlan {
  const plan: TakeoffPlan = { add: [], toOrderOnly: [], toGc: [], remove: [], ticks: new Map(), orderOnly: new Map() }
  for (const c of cands) {
    const now = pickOf(c, picks)
    plan.ticks.set(c.countRowId, now !== 'out')
    plan.orderOnly.set(c.countRowId, now === 'order')
    const on = c.onAs ?? null
    if (on == null) {
      if (now !== 'out') plan.add.push({ candidate: { ...c, split: c.canSplit && (splits?.get(c.countRowId) ?? c.split) }, orderOnly: now === 'order' })
    } else if (now === 'out') plan.remove.push(c.countRowId)
    else if (now !== on) (now === 'order' ? plan.toOrderOnly : plan.toGc).push(c.countRowId)
  }
  return plan
}

/** The rows the plan puts on the revision: a split fixture counts once per tag. */
export function planRowsAdded(plan: TakeoffPlan): number {
  return plan.add.reduce((n, a) => n + (a.candidate.split && a.candidate.canSplit ? a.candidate.tags.length : 1), 0)
}

export function planIsEmpty(plan: TakeoffPlan): boolean {
  return plan.add.length === 0 && plan.toOrderOnly.length === 0 && plan.toGc.length === 0 && plan.remove.length === 0
}

export type PickCounts = { gc: number; order: number; out: number }

/** How many fixtures stand in each of the three, as picked. */
export function pickCounts(cands: ReadonlyArray<TakeoffCandidate>, picks: ReadonlyMap<string, FixturePick>): PickCounts {
  const n: PickCounts = { gc: 0, order: 0, out: 0 }
  for (const c of cands) n[pickOf(c, picks)] += 1
  return n
}

const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`

/** "2 rows go on Rev 1 · 1 fixture moves to order only · 1 comes off Rev 1" — '' when nothing changes. */
export function planSummary(plan: TakeoffPlan, revLabel: string): string {
  const rows = planRowsAdded(plan)
  const rowsOf = (a: TakeoffPlan['add'][number]) => (a.candidate.split && a.candidate.canSplit ? a.candidate.tags.length : 1)
  const asOrder = plan.add.filter((a) => a.orderOnly).reduce((n, a) => n + rowsOf(a), 0)
  const toType = plan.add.filter((a) => !a.candidate.product && !a.orderOnly).reduce((n, a) => n + rowsOf(a), 0)
  const notes = [asOrder > 0 ? `${asOrder} order only` : '', toType > 0 ? `${toType} to type with Edit` : ''].filter(Boolean).join(', ')
  return [
    rows > 0 ? `${many(rows, 'row goes', 'rows go')} on ${revLabel}${notes ? ` (${notes})` : ''}` : '',
    plan.toOrderOnly.length > 0 ? `${many(plan.toOrderOnly.length, 'fixture moves', 'fixtures move')} to order only` : '',
    plan.toGc.length > 0 ? `${many(plan.toGc.length, 'fixture goes', 'fixtures go')} back to the GC` : '',
    plan.remove.length > 0 ? `${many(plan.remove.length, 'comes', 'come')} off ${revLabel}` : '',
  ].filter(Boolean).join(' · ')
}

/** One fixture's line under its name when its pick moved it: what the click will do on the draft. */
export function pickChangeWords(c: Pick<TakeoffCandidate, 'onAs'>, now: FixturePick, revLabel: string): string {
  const on = c.onAs ?? null
  if (on == null || on === now) return ''
  if (now === 'out') return `On ${revLabel} now. It comes off ${revLabel} and off the procurement log.`
  return now === 'order' ? `On ${revLabel} now. It moves to order only: off the GC’s list, still on the log.` : `Order only now. It goes back on the GC’s list.`
}
