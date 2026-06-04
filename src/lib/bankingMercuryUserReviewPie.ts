import { INTERNAL_TRANSFERS_DEFAULT_KEY } from './dragSortDefaultLabels'
import {
  resolveUserReviewColumnForTx,
  resolveUserReviewRowKeyForTx,
  type UserReviewLabelRow,
} from './bankingMercuryUserReviewPivot'

/**
 * Pure aggregation for the User Review "Pie Chart View". Reuses the pivot's
 * person/category resolvers so the buckets (incl. Unassigned / Unlabeled) match
 * the table exactly. React/recharts-free.
 *
 * A pie needs same-sign magnitudes, so each slice measures one direction:
 *   - 'out' = money spent (Mercury outflows are negative amounts) → magnitude of negatives
 *   - 'in'  = money received → magnitude of positives
 */
export type PieDirection = 'out' | 'in'

export type PieSlice = {
  /** Stable key for color + React key (the dimension key at this level, or '__other__'). */
  key: string
  name: string
  value: number
  /** Set when this slice maps to a person (top-level person, or a category drill leaf). */
  personKey?: string
  /** Set when this slice maps to a category (top-level category, or a person drill leaf). */
  categoryKey?: string
}

export type UserReviewPieData = {
  personSlices: PieSlice[]
  categorySlices: PieSlice[]
  /** personKey → that person's spending/income broken down by category. */
  drillByPerson: Map<string, PieSlice[]>
  /** categoryKey → that category's spending/income broken down by person. */
  drillByCategory: Map<string, PieSlice[]>
  grandTotal: number
}

/** Pie inputs need `kind` (to drop Mercury internal transfers) on top of id/amount. */
export type UserReviewPieTx = { id: string; amount: number; kind?: string | null }

export type BuildUserReviewPieArgs = {
  transactions: UserReviewPieTx[]
  userIdByTxId: ReadonlyMap<string, string | null>
  personIdByTxId: ReadonlyMap<string, string | null>
  userNameById: Record<string, string>
  personNameById: Record<string, string>
  labelIdByTxId: ReadonlyMap<string, string | null>
  allLabels: UserReviewLabelRow[]
  direction: PieDirection
  /** Slices beyond this many (by value, desc) collapse into a non-drillable "Other". */
  topN?: number
}

export const PIE_OTHER_KEY = '__other__'
const DEFAULT_TOP_N = 12

export function magnitudeForDirection(amount: number, direction: PieDirection): number {
  if (!Number.isFinite(amount)) return 0
  if (direction === 'out') return amount < 0 ? -amount : 0
  return amount > 0 ? amount : 0
}

type Node = { name: string; total: number; children: Map<string, { name: string; value: number }> }

function addToNested(
  map: Map<string, Node>,
  key: string,
  name: string,
  childKey: string,
  childName: string,
  value: number,
): void {
  let node = map.get(key)
  if (!node) {
    node = { name, total: 0, children: new Map() }
    map.set(key, node)
  }
  node.total += value
  const child = node.children.get(childKey)
  if (child) child.value += value
  else node.children.set(childKey, { name: childName, value })
}

/** Sort desc by value, drop zeros, collapse the tail beyond topN into "Other". */
function collapseTopN(slices: PieSlice[], topN: number): PieSlice[] {
  const nonZero = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  if (nonZero.length <= topN) return nonZero
  const head = nonZero.slice(0, topN)
  const tail = nonZero.slice(topN)
  const otherValue = tail.reduce((s, x) => s + x.value, 0)
  if (otherValue > 0) {
    head.push({ key: PIE_OTHER_KEY, name: `Other (${tail.length})`, value: Math.round(otherValue * 100) / 100 })
  }
  return head
}

export function buildUserReviewPieData(args: BuildUserReviewPieArgs): UserReviewPieData {
  const topN = args.topN ?? DEFAULT_TOP_N
  const labelById = new Map<string, UserReviewLabelRow>()
  for (const l of args.allLabels) labelById.set(l.id, l)

  const byPerson = new Map<string, Node>()
  const byCategory = new Map<string, Node>()
  let grandTotal = 0

  for (const tx of args.transactions) {
    // Internal transfers move money between the company's own accounts — not real
    // spending/income — so they're excluded from the pie (by Mercury kind and by
    // the Internal Transfers category, covering labeled and unlabeled transfers).
    if (tx.kind === 'internalTransfer') continue
    const value = magnitudeForDirection(Number(tx.amount), args.direction)
    if (value <= 0) continue
    const category = resolveUserReviewColumnForTx({
      txId: tx.id,
      labelIdByTxId: args.labelIdByTxId,
      labelById,
    })
    if (category.defaultKey === INTERNAL_TRANSFERS_DEFAULT_KEY) continue
    const person = resolveUserReviewRowKeyForTx({
      txId: tx.id,
      userIdByTxId: args.userIdByTxId,
      personIdByTxId: args.personIdByTxId,
      userNameById: args.userNameById,
      personNameById: args.personNameById,
    })
    grandTotal += value
    addToNested(byPerson, person.rowKey, person.displayName, category.colKey, category.displayName, value)
    addToNested(byCategory, category.colKey, category.displayName, person.rowKey, person.displayName, value)
  }

  const round = (n: number) => Math.round(n * 100) / 100

  const personSlices = collapseTopN(
    [...byPerson.entries()].map(([key, node]) => ({ key, name: node.name, value: round(node.total), personKey: key })),
    topN,
  )
  const categorySlices = collapseTopN(
    [...byCategory.entries()].map(([key, node]) => ({ key, name: node.name, value: round(node.total), categoryKey: key })),
    topN,
  )

  const drillByPerson = new Map<string, PieSlice[]>()
  for (const [personKey, node] of byPerson.entries()) {
    drillByPerson.set(
      personKey,
      collapseTopN(
        [...node.children.entries()].map(([catKey, c]) => ({
          key: catKey,
          name: c.name,
          value: round(c.value),
          personKey,
          categoryKey: catKey,
        })),
        topN,
      ),
    )
  }

  const drillByCategory = new Map<string, PieSlice[]>()
  for (const [categoryKey, node] of byCategory.entries()) {
    drillByCategory.set(
      categoryKey,
      collapseTopN(
        [...node.children.entries()].map(([personKey, c]) => ({
          key: personKey,
          name: c.name,
          value: round(c.value),
          personKey,
          categoryKey,
        })),
        topN,
      ),
    )
  }

  return { personSlices, categorySlices, drillByPerson, drillByCategory, grandTotal: round(grandTotal) }
}
