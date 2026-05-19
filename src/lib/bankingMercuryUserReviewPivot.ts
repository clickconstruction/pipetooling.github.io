import type { Database } from '../types/database'

export type UserReviewMercuryTxRow = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'id' | 'amount'
>

export type UserReviewLabelRow = {
  id: string
  name: string
  default_key: string | null
  sort_order: number
}

export const USER_REVIEW_UNASSIGNED_USER_KEY = '__unassigned__'
export const USER_REVIEW_UNLABELED_COL_KEY = '__unlabeled__'

export type UserReviewRow = {
  /** Stable key — user id, person id, or sentinel. */
  rowKey: string
  /** Source of attribution. */
  source: 'user' | 'person' | 'unassigned'
  /** Original id (null only for unassigned). */
  sourceId: string | null
  displayName: string
}

export type UserReviewColumn = {
  /** Stable key — label id or sentinel. */
  colKey: string
  /** null only for the synthetic Unlabeled column. */
  labelId: string | null
  displayName: string
  defaultKey: string | null
  sortOrder: number
}

export type UserReviewCellTotals = {
  count: number
  totalAmount: number
}

export type UserReviewCell = UserReviewCellTotals & {
  rowKey: string
  colKey: string
  txIds: string[]
}

export type UserReviewPivot = {
  rows: UserReviewRow[]
  columns: UserReviewColumn[]
  cells: Map<string, UserReviewCell>
  rowTotals: Map<string, UserReviewCellTotals>
  colTotals: Map<string, UserReviewCellTotals>
  grandTotal: UserReviewCellTotals
}

function cellKey(rowKey: string, colKey: string): string {
  return `${rowKey}\u0000${colKey}`
}

/**
 * Resolve the row key for a transaction based on user (preferred) → person → unassigned.
 * Returned key is always non-empty; sentinel is used for unassigned.
 */
export function resolveUserReviewRowKeyForTx(args: {
  txId: string
  userIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  personIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  userNameById: Record<string, string>
  personNameById: Record<string, string>
}): UserReviewRow {
  const uid = args.userIdByTxId.get(args.txId) ?? null
  if (uid && uid.trim() !== '') {
    const nm = args.userNameById[uid]?.trim() ?? ''
    return {
      rowKey: `u:${uid}`,
      source: 'user',
      sourceId: uid,
      displayName: nm !== '' ? nm : 'Unknown user',
    }
  }
  const pid = args.personIdByTxId.get(args.txId) ?? null
  if (pid && pid.trim() !== '') {
    const nm = args.personNameById[pid]?.trim() ?? ''
    return {
      rowKey: `p:${pid}`,
      source: 'person',
      sourceId: pid,
      displayName: nm !== '' ? nm : 'Unknown person',
    }
  }
  return {
    rowKey: USER_REVIEW_UNASSIGNED_USER_KEY,
    source: 'unassigned',
    sourceId: null,
    displayName: 'Unassigned',
  }
}

export function resolveUserReviewColumnForTx(args: {
  txId: string
  labelIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  labelById: Map<string, UserReviewLabelRow> | ReadonlyMap<string, UserReviewLabelRow>
}): UserReviewColumn {
  const lid = args.labelIdByTxId.get(args.txId) ?? null
  if (lid && lid.trim() !== '') {
    const lbl = args.labelById.get(lid)
    if (lbl) {
      return {
        colKey: `l:${lbl.id}`,
        labelId: lbl.id,
        displayName: lbl.name,
        defaultKey: lbl.default_key,
        sortOrder: lbl.sort_order,
      }
    }
    return {
      colKey: `l:${lid}`,
      labelId: lid,
      displayName: 'Unknown label',
      defaultKey: null,
      sortOrder: Number.POSITIVE_INFINITY,
    }
  }
  return {
    colKey: USER_REVIEW_UNLABELED_COL_KEY,
    labelId: null,
    displayName: 'Unlabeled',
    defaultKey: null,
    sortOrder: Number.POSITIVE_INFINITY,
  }
}

function compareColumns(a: UserReviewColumn, b: UserReviewColumn): number {
  // Unlabeled always last
  if (a.colKey === USER_REVIEW_UNLABELED_COL_KEY && b.colKey !== USER_REVIEW_UNLABELED_COL_KEY) return 1
  if (b.colKey === USER_REVIEW_UNLABELED_COL_KEY && a.colKey !== USER_REVIEW_UNLABELED_COL_KEY) return -1
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
}

function compareRows(a: UserReviewRow, b: UserReviewRow): number {
  // Unassigned always last
  if (a.rowKey === USER_REVIEW_UNASSIGNED_USER_KEY && b.rowKey !== USER_REVIEW_UNASSIGNED_USER_KEY) return 1
  if (b.rowKey === USER_REVIEW_UNASSIGNED_USER_KEY && a.rowKey !== USER_REVIEW_UNASSIGNED_USER_KEY) return -1
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
}

export type BuildUserReviewPivotArgs = {
  transactions: UserReviewMercuryTxRow[]
  userIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  personIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  userNameById: Record<string, string>
  personNameById: Record<string, string>
  labelIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  /** All labels available in the org. Drives the canonical column set. */
  allLabels: UserReviewLabelRow[]
  /**
   * When true, only columns with at least one transaction in the visible set are kept
   * (besides the Unlabeled column, which only appears when there are unlabeled txs).
   * Defaults to false — show every label column even if empty so users can scan all categories.
   */
  hideEmptyLabelColumns?: boolean
}

export function buildUserReviewPivot(args: BuildUserReviewPivotArgs): UserReviewPivot {
  const labelById = new Map<string, UserReviewLabelRow>()
  for (const l of args.allLabels) labelById.set(l.id, l)

  const rowByKey = new Map<string, UserReviewRow>()
  const colByKey = new Map<string, UserReviewColumn>()
  const cells = new Map<string, UserReviewCell>()
  const rowTotals = new Map<string, UserReviewCellTotals>()
  const colTotals = new Map<string, UserReviewCellTotals>()
  const grandTotal: UserReviewCellTotals = { count: 0, totalAmount: 0 }

  // Seed the canonical column set from the org labels (preserves empty columns when not hiding).
  if (args.hideEmptyLabelColumns !== true) {
    for (const lbl of args.allLabels) {
      const col = resolveUserReviewColumnForTx({
        txId: '__seed__',
        labelIdByTxId: new Map([['__seed__', lbl.id]]),
        labelById,
      })
      colByKey.set(col.colKey, col)
    }
  }

  for (const tx of args.transactions) {
    const row = resolveUserReviewRowKeyForTx({
      txId: tx.id,
      userIdByTxId: args.userIdByTxId,
      personIdByTxId: args.personIdByTxId,
      userNameById: args.userNameById,
      personNameById: args.personNameById,
    })
    const col = resolveUserReviewColumnForTx({
      txId: tx.id,
      labelIdByTxId: args.labelIdByTxId,
      labelById,
    })

    rowByKey.set(row.rowKey, row)
    colByKey.set(col.colKey, col)

    const amt: number = Number.isFinite(tx.amount) ? tx.amount : 0
    const key = cellKey(row.rowKey, col.colKey)
    const existing = cells.get(key)
    if (existing) {
      existing.count += 1
      existing.totalAmount += amt
      existing.txIds.push(tx.id)
    } else {
      cells.set(key, {
        rowKey: row.rowKey,
        colKey: col.colKey,
        count: 1,
        totalAmount: amt,
        txIds: [tx.id],
      })
    }

    const rt = rowTotals.get(row.rowKey)
    if (rt) {
      rt.count += 1
      rt.totalAmount += amt
    } else {
      rowTotals.set(row.rowKey, { count: 1, totalAmount: amt })
    }

    const ct = colTotals.get(col.colKey)
    if (ct) {
      ct.count += 1
      ct.totalAmount += amt
    } else {
      colTotals.set(col.colKey, { count: 1, totalAmount: amt })
    }

    grandTotal.count += 1
    grandTotal.totalAmount += amt
  }

  const rows = [...rowByKey.values()].sort(compareRows)
  const columns = [...colByKey.values()].sort(compareColumns)

  return { rows, columns, cells, rowTotals, colTotals, grandTotal }
}

export function userReviewPivotCellTotals(
  pivot: UserReviewPivot,
  rowKey: string,
  colKey: string,
): UserReviewCellTotals | null {
  return pivot.cells.get(cellKey(rowKey, colKey)) ?? null
}

export function userReviewPivotCellTxIds(
  pivot: UserReviewPivot,
  rowKey: string,
  colKey: string,
): string[] {
  return pivot.cells.get(cellKey(rowKey, colKey))?.txIds ?? []
}
