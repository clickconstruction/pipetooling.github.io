import type { Database } from '../types/database'
import {
  USER_REVIEW_UNLABELED_COL_KEY,
  type UserReviewLabelRow,
} from './bankingMercuryUserReviewPivot'

export type CategoryReviewMercuryTxRow = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'id' | 'amount'
>

export type CategoryReviewEntry = {
  /** Stable key — `l:<labelId>` for real categories, the Unlabeled sentinel for the unlabeled bucket. */
  colKey: string
  /** null only for the synthetic Unlabeled bucket. */
  labelId: string | null
  displayName: string
  defaultKey: string | null
  isUnlabeled: boolean
  sortOrder: number
  count: number
  totalAmount: number
  /** Original transaction ids in insertion order. */
  txIds: string[]
}

export type CategoryReviewSort = 'name_asc' | 'amount_desc' | 'amount_abs_desc' | 'count_desc' | 'category_order'

export type CategoryReviewTotals = {
  count: number
  totalAmount: number
}

export type BuildCategoryReviewArgs = {
  transactions: CategoryReviewMercuryTxRow[]
  labelIdByTxId: Map<string, string | null> | ReadonlyMap<string, string | null>
  /** Canonical org-wide label set. Drives the column set when `hideEmptyCategories` is false. */
  allLabels: UserReviewLabelRow[]
  /** Default false — show every label so reviewers can see zero-balance buckets. */
  hideEmptyCategories?: boolean
}

/**
 * Group transactions by accounting category. Returns entries in canonical column order
 * (`sort_order` asc, name asc; Unlabeled always last). Use `sortCategoryReviewEntries`
 * to re-order for display.
 */
export function buildCategoryReviewEntries(args: BuildCategoryReviewArgs): CategoryReviewEntry[] {
  const labelById = new Map<string, UserReviewLabelRow>()
  for (const l of args.allLabels) labelById.set(l.id, l)

  const entryByKey = new Map<string, CategoryReviewEntry>()

  if (args.hideEmptyCategories !== true) {
    for (const lbl of args.allLabels) {
      const key = `l:${lbl.id}`
      entryByKey.set(key, {
        colKey: key,
        labelId: lbl.id,
        displayName: lbl.name,
        defaultKey: lbl.default_key,
        isUnlabeled: false,
        sortOrder: lbl.sort_order,
        count: 0,
        totalAmount: 0,
        txIds: [],
      })
    }
  }

  for (const tx of args.transactions) {
    const lid = args.labelIdByTxId.get(tx.id) ?? null
    let entry: CategoryReviewEntry | undefined
    if (lid && lid.trim() !== '') {
      const key = `l:${lid}`
      entry = entryByKey.get(key)
      if (!entry) {
        const lbl = labelById.get(lid)
        entry = {
          colKey: key,
          labelId: lid,
          displayName: lbl?.name ?? 'Unknown label',
          defaultKey: lbl?.default_key ?? null,
          isUnlabeled: false,
          sortOrder: lbl?.sort_order ?? Number.POSITIVE_INFINITY,
          count: 0,
          totalAmount: 0,
          txIds: [],
        }
        entryByKey.set(key, entry)
      }
    } else {
      entry = entryByKey.get(USER_REVIEW_UNLABELED_COL_KEY)
      if (!entry) {
        entry = {
          colKey: USER_REVIEW_UNLABELED_COL_KEY,
          labelId: null,
          displayName: 'Unlabeled',
          defaultKey: null,
          isUnlabeled: true,
          sortOrder: Number.POSITIVE_INFINITY,
          count: 0,
          totalAmount: 0,
          txIds: [],
        }
        entryByKey.set(USER_REVIEW_UNLABELED_COL_KEY, entry)
      }
    }

    const amt: number = Number.isFinite(tx.amount) ? tx.amount : 0
    entry.count += 1
    entry.totalAmount += amt
    entry.txIds.push(tx.id)
  }

  const out = [...entryByKey.values()]

  if (args.hideEmptyCategories === true) {
    return sortCategoryReviewEntries(
      out.filter((e) => e.count > 0),
      'category_order',
    )
  }

  return sortCategoryReviewEntries(out, 'category_order')
}

export function sortCategoryReviewEntries(
  entries: CategoryReviewEntry[],
  sort: CategoryReviewSort,
): CategoryReviewEntry[] {
  const copy = [...entries]
  copy.sort((a, b) => {
    if (a.isUnlabeled && !b.isUnlabeled) return 1
    if (b.isUnlabeled && !a.isUnlabeled) return -1
    if (sort === 'name_asc') {
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    }
    if (sort === 'amount_desc') {
      if (a.totalAmount !== b.totalAmount) return b.totalAmount - a.totalAmount
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    }
    if (sort === 'amount_abs_desc') {
      const av = Math.abs(a.totalAmount)
      const bv = Math.abs(b.totalAmount)
      if (av !== bv) return bv - av
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    }
    if (sort === 'count_desc') {
      if (a.count !== b.count) return b.count - a.count
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    }
    // category_order
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })
  return copy
}

export function totalsForCategoryReviewEntries(entries: CategoryReviewEntry[]): CategoryReviewTotals {
  let count = 0
  let totalAmount = 0
  for (const e of entries) {
    count += e.count
    totalAmount += e.totalAmount
  }
  return { count, totalAmount }
}
