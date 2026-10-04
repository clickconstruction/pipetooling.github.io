/**
 * Choose what the GC sees (2026-10-02): each takeoff fixture is one of three — the GC sees it,
 * order only (bought, never shown to the GC), or left out (not submitted, not ordered). The window
 * holds one pick per fixture, the fixtures already on the draft included; this kernel says where a
 * fixture starts, what a set of picks changes on the revision, and how to say it.
 */
import { withProductKeys, type ProductPiece, type TakeoffCandidate } from './takeoffCandidates'

export type FixturePick = 'gc' | 'order' | 'out'

export const PICK_LABELS: Record<FixturePick, string> = { gc: 'GC sees it', order: 'Order only', out: 'Left out' }

/** Where a fixture stands before anything is clicked: as it sits on the draft, else as the bid remembers it, else its group's rule. */
export function startingPick(c: Pick<TakeoffCandidate, 'onAs' | 'ticked' | 'storedOrderOnly'>): FixturePick {
  if (c.onAs) return c.onAs
  return c.ticked ? (c.storedOrderOnly ? 'order' : 'gc') : 'out'
}

/**
 * Approved on an earlier revision and left alone here (2026-10-03). After a resubmit the draft
 * holds only the rows that went on; a fixture the GC approved stands on its revision and on the
 * procurement log. It is not one of the three picks: the window shows it locked, and only a click
 * on its Ask again puts it back in front of the GC. Before this it opened lit "GC sees it" with
 * Update live, so one press asked the GC about an approved fixture a second time.
 */
export function standsApproved(c: Pick<TakeoffCandidate, 'onAs' | 'standsOn' | 'countRowId'>, picks: ReadonlyMap<string, FixturePick>): boolean {
  return !c.onAs && c.standsOn != null && !picks.has(c.countRowId)
}

export function pickOf(c: TakeoffCandidate, picks: ReadonlyMap<string, FixturePick>): FixturePick {
  return picks.get(c.countRowId) ?? startingPick(c)
}

/** The same three for one part of a fixture. */
export type PiecePick = FixturePick

/** Every line under the fixture, in takeoff order: its pieces and the ones left off. */
export function allPiecesOf(c: Pick<TakeoffCandidate, 'pieces' | 'allPieces'>): ProductPiece[] {
  return [...(c.allPieces ?? c.pieces)]
}

/**
 * Where each part starts. On the draft, as the row holds it: a part the row has is the GC's or
 * order only; a line the row does not have is left out. Off the draft, as the takeoff's rule and
 * the bid's memory say: the product's pieces are the GC's, the lines left off are left out, the
 * rest (trim) are order only.
 */
export function startingPiecePicks(c: TakeoffCandidate): Map<string, PiecePick> {
  const out = new Map<string, PiecePick>()
  const on = c.onAs && c.onParts ? new Map(c.onParts.map((p) => [p.key, p.onSubmittal] as const)) : null
  const off = new Set((c.leftOutPieces ?? []).map((p) => p.key))
  for (const p of allPiecesOf(c)) {
    if (on) out.set(p.key, on.has(p.key) ? (on.get(p.key) ? 'gc' : 'order') : 'out')
    else out.set(p.key, off.has(p.key) ? 'out' : c.productKeys.includes(p.key) ? 'gc' : 'order')
  }
  return out
}

/** The picks for one fixture's parts: what was clicked over where each started. */
export function piecePicksOf(c: TakeoffCandidate, clicked: ReadonlyMap<string, PiecePick> | undefined): Map<string, PiecePick> {
  const out = startingPiecePicks(c)
  if (clicked) for (const [k, v] of clicked) if (out.has(k)) out.set(k, v)
  return out
}

/** The fixture as its parts are picked: the lines kept are its pieces, the GC's are its product, the rest are set aside. */
export function withPiecePicks(c: TakeoffCandidate, picks: ReadonlyMap<string, PiecePick>): TakeoffCandidate {
  const all = allPiecesOf(c)
  const pieces = all.filter((p) => picks.get(p.key) !== 'out')
  const leftOutPieces = all.filter((p) => picks.get(p.key) === 'out')
  return { ...withProductKeys({ ...c, pieces }, pieces.filter((p) => picks.get(p.key) === 'gc').map((p) => p.key)), leftOutPieces, allPieces: all }
}

function samePicks(a: ReadonlyMap<string, PiecePick>, b: ReadonlyMap<string, PiecePick>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/** "3 the GC sees · 3 order only · 1 left out" over a fixture's parts. */
export function piecePicksLine(picks: ReadonlyMap<string, PiecePick>): string {
  const n = (v: PiecePick) => [...picks.values()].filter((x) => x === v).length
  return [n('gc') > 0 ? `${n('gc')} the GC sees` : '', n('order') > 0 ? `${n('order')} order only` : '', n('out') > 0 ? `${n('out')} left out` : ''].filter(Boolean).join(' · ')
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
  /** Fixtures on the draft whose parts were picked differently: each as it should now read, for the row's parts to follow. */
  parts: Array<{ countRowId: string; candidate: TakeoffCandidate }>
  /** For every fixture whose parts were touched: the lines the GC sees and the lines left off, to remember. */
  productKeys: Map<string, string[]>
  leftOut: Map<string, string[]>
}

/** What the picks change. A fixture left where it stands changes nothing but is still remembered. */
export function planTakeoffPicks(cands: ReadonlyArray<TakeoffCandidate>, picks: ReadonlyMap<string, FixturePick>, splits?: ReadonlyMap<string, boolean>, piecePicks?: ReadonlyMap<string, ReadonlyMap<string, PiecePick>>): TakeoffPlan {
  const plan: TakeoffPlan = { add: [], toOrderOnly: [], toGc: [], remove: [], ticks: new Map(), orderOnly: new Map(), parts: [], productKeys: new Map(), leftOut: new Map() }
  for (const given of cands) {
    // Approved on an earlier revision and not touched: no row, and what the bid remembers stays as it is.
    if (standsApproved(given, picks)) continue
    const now = pickOf(given, picks)
    // The parts as picked: a fixture nobody opened reads as it stood.
    const clicked = piecePicks?.get(given.countRowId)
    const pp = clicked ? piecePicksOf(given, clicked) : null
    const moved = pp != null && !samePicks(pp, startingPiecePicks(given))
    const c = moved ? withPiecePicks(given, pp!) : given
    if (moved) {
      plan.productKeys.set(c.countRowId, [...c.productKeys])
      plan.leftOut.set(c.countRowId, (c.leftOutPieces ?? []).map((p) => p.key))
      // A row staying on the draft takes its parts as picked; one coming on is built from them; one coming off needs none.
      if (given.onAs && now !== 'out') plan.parts.push({ countRowId: c.countRowId, candidate: c })
    }
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
  return plan.add.length === 0 && plan.toOrderOnly.length === 0 && plan.toGc.length === 0 && plan.remove.length === 0 && plan.parts.length === 0 && plan.leftOut.size === 0
}

export type PickCounts = { gc: number; order: number; out: number; /** approved on an earlier revision, left alone */ stands: number }

/** How many fixtures stand in each of the three, as picked, and how many stand approved on an earlier revision. */
export function pickCounts(cands: ReadonlyArray<TakeoffCandidate>, picks: ReadonlyMap<string, FixturePick>): PickCounts {
  const n: PickCounts = { gc: 0, order: 0, out: 0, stands: 0 }
  for (const c of cands) {
    if (standsApproved(c, picks)) n.stands += 1
    else n[pickOf(c, picks)] += 1
  }
  return n
}

/** "Approved on Rev 3" · "Part approved on Rev 3": the locked line on a fixture that stands. */
export function standsWords(standsOn: { rev: number; whole: boolean }): string {
  return `${standsOn.whole ? 'Approved' : 'Part approved'} on Rev ${standsOn.rev}`
}

/** "2 approved on Rev 3" · "3 approved on earlier revisions" under the rows, beside the Left out line; '' when none stand. */
export function standsLine(cands: ReadonlyArray<Pick<TakeoffCandidate, 'onAs' | 'standsOn'>>): string {
  const revs = cands.filter((c) => !c.onAs && c.standsOn != null).map((c) => c.standsOn!.rev)
  if (revs.length === 0) return ''
  return revs.every((r) => r === revs[0]) ? `${revs.length} approved on Rev ${revs[0]}` : `${revs.length} approved on earlier revisions`
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
    plan.parts.length > 0 ? `parts change on ${many(plan.parts.length, 'fixture', 'fixtures')}` : '',
  ].filter(Boolean).join(' · ')
}

/** One fixture's line under its name when its pick moved it: what the click will do on the draft. */
export function pickChangeWords(c: Pick<TakeoffCandidate, 'onAs' | 'standsOn'>, now: FixturePick, revLabel: string): string {
  const on = c.onAs ?? null
  // Asked again: an approved fixture going back on the draft.
  if (on == null && c.standsOn != null && now !== 'out') return now === 'gc' ? `${standsWords(c.standsOn)}. It goes on ${revLabel} and the GC is asked again.` : `${standsWords(c.standsOn)}. It goes on ${revLabel} as order only.`
  if (on == null || on === now) return ''
  if (now === 'out') return `On ${revLabel} now. It comes off ${revLabel} and off the procurement log.`
  return now === 'order' ? `On ${revLabel} now. It moves to order only: off the GC’s list, still on the log.` : `Order only now. It goes back on the GC’s list.`
}
