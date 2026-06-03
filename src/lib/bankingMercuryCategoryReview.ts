import type { Database } from '../types/database'
import type { AccountType } from './bankingAccountTypes'
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

// ---------------------------------------------------------------------------
// Financial statement grouping (P&L + cash-basis Balance Sheet).
// Amounts follow the ledger convention: money out is negative, money in positive.
// ---------------------------------------------------------------------------

export type TypedCategoryEntry = CategoryReviewEntry & { accountType: AccountType | null }

export type FinancialSection = { entries: TypedCategoryEntry[]; total: number }

/** Attach each entry's account_type (from the label set); Unlabeled stays null. */
export function attachAccountTypes(
  entries: CategoryReviewEntry[],
  accountTypeByLabelId: ReadonlyMap<string, AccountType | null>,
): TypedCategoryEntry[] {
  return entries.map((e) => ({
    ...e,
    accountType: e.labelId ? accountTypeByLabelId.get(e.labelId) ?? null : null,
  }))
}

function section(entries: TypedCategoryEntry[]): FinancialSection {
  return { entries, total: entries.reduce((s, e) => s + e.totalAmount, 0) }
}

export type ProfitAndLoss = {
  income: FinancialSection
  expense: FinancialSection
  netIncome: number
  /** Categories (and Unlabeled) with no P&L classification — surfaced so they get classified. */
  uncategorized: FinancialSection
}

/** Build a cash-basis P&L from typed entries for a period. Excludes transfer/asset/liability/equity. */
export function buildProfitAndLoss(entries: TypedCategoryEntry[]): ProfitAndLoss {
  const income = entries.filter((e) => e.accountType === 'income')
  const expense = entries.filter((e) => e.accountType === 'expense')
  const uncategorized = entries.filter((e) => e.accountType == null && (e.count > 0 || !e.isUnlabeled))
  const incomeSec = section(income)
  const expenseSec = section(expense)
  return {
    income: incomeSec,
    expense: expenseSec,
    netIncome: incomeSec.total + expenseSec.total,
    uncategorized: section(uncategorized.filter((e) => e.count > 0)),
  }
}

export type BalanceSheet = {
  cash: number
  otherAssets: FinancialSection
  assetsTotal: number
  liabilities: FinancialSection
  liabilitiesTotal: number
  ownersEquity: FinancialSection
  retainedEarnings: number
  equityTotal: number
  liabilitiesPlusEquity: number
  /** Assets − (Liabilities + Equity): nonzero = unreconciled (unlabeled txs / partial history). */
  unreconciled: number
}

/**
 * Build a cash-basis Balance Sheet. `cash` is the live bank balance (assets' cash line);
 * other lines are the all-time net of their account-typed cash flows. Retained earnings =
 * all-time net income from the same entries. Approximate — `unreconciled` exposes the gap.
 */
export function buildBalanceSheet(entries: TypedCategoryEntry[], cash: number): BalanceSheet {
  const otherAssets = section(entries.filter((e) => e.accountType === 'asset'))
  const liabilities = section(entries.filter((e) => e.accountType === 'liability'))
  const ownersEquity = section(entries.filter((e) => e.accountType === 'equity'))
  const income = entries.filter((e) => e.accountType === 'income').reduce((s, e) => s + e.totalAmount, 0)
  const expense = entries.filter((e) => e.accountType === 'expense').reduce((s, e) => s + e.totalAmount, 0)
  const retainedEarnings = income + expense
  const assetsTotal = cash + otherAssets.total
  const equityTotal = ownersEquity.total + retainedEarnings
  const liabilitiesPlusEquity = liabilities.total + equityTotal
  return {
    cash,
    otherAssets,
    assetsTotal,
    liabilities,
    liabilitiesTotal: liabilities.total,
    ownersEquity,
    retainedEarnings,
    equityTotal,
    liabilitiesPlusEquity,
    unreconciled: assetsTotal - liabilitiesPlusEquity,
  }
}
