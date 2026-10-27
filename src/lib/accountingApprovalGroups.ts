/**
 * Pure grouping/filtering helpers for the Accounting tab's **Approvals** section.
 *
 * The Approvals backlog can be thousands of pending rule suggestions. The grouped
 * view buckets them by their suggested accounting label so the user can triage a
 * whole category at once. These functions are intentionally free of React,
 * Supabase, and label/allocation lookups — the component projects its
 * `PendingApproval[]` into `ApprovalGroupItem[]` and supplies the precomputed set
 * of conflicting suggestion ids.
 *
 * Punch list #184 sweep B: the groups stay by label (the design), and they are
 * ordered by their OLDEST suggestion, so the label holding the longest wait
 * leads; each header carries that suggestion's age on the `LABEL_APPROVAL_AGE`
 * scale.
 */
import { compareOldestFirst, describeAge, LABEL_APPROVAL_AGE, type AgeDescription } from './ageState'

/** One pending suggestion, projected down to what grouping/filtering needs. */
export type ApprovalGroupItem = {
  suggestionId: string
  txId: string
  suggestedLabelId: string
  suggestedLabelName: string
  ruleName: string
  /** `tx.amount` as a number, or null when the transaction isn't loaded. */
  amount: number | null
  counterpartyName: string | null
  /** When the rule made the suggestion (the wait starts here); null when unknown. */
  createdAt: string | null
}

/** A bucket of pending suggestions sharing one suggested label. */
export type ApprovalGroup = {
  labelId: string
  labelName: string
  count: number
  /** Signed sum over items with a known amount (debits negative, like Mercury). */
  totalAmount: number
  /** Items flagged as conflicts (Internal Transfers on a transaction with splits). */
  conflictCount: number
  /** The group's oldest suggestion, the one that has waited longest; null when none is stamped. */
  oldestCreatedAt: string | null
  items: ApprovalGroupItem[]
}

/**
 * Case-insensitive substring match across counterparty, suggested label, and rule
 * name. An empty/whitespace query returns the list unchanged.
 */
export function filterApprovalItems(items: ApprovalGroupItem[], query: string): ApprovalGroupItem[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return items
  return items.filter((it) => {
    const cp = it.counterpartyName?.toLowerCase() ?? ''
    const label = it.suggestedLabelName.toLowerCase()
    const rule = it.ruleName.toLowerCase()
    return cp.includes(q) || label.includes(q) || rule.includes(q)
  })
}

/**
 * Groups items by `suggestedLabelId`, sorted by the group's OLDEST suggestion first
 * (punch list #184 sweep B; a group with no stamp sinks last), then count
 * descending, then label name ascending (stable, locale-aware).
 * `conflictSuggestionIds` flags rows that can't be auto-approved (Internal
 * Transfers with job splits); they still appear in the group but are counted
 * separately so the UI can warn and exclude them.
 */
export function groupApprovalItemsByLabel(
  items: ApprovalGroupItem[],
  conflictSuggestionIds: ReadonlySet<string>,
): ApprovalGroup[] {
  const byLabel = new Map<string, ApprovalGroup>()
  for (const it of items) {
    let g = byLabel.get(it.suggestedLabelId)
    if (!g) {
      g = {
        labelId: it.suggestedLabelId,
        labelName: it.suggestedLabelName,
        count: 0,
        totalAmount: 0,
        conflictCount: 0,
        oldestCreatedAt: null,
        items: [],
      }
      byLabel.set(it.suggestedLabelId, g)
    }
    g.items.push(it)
    g.count += 1
    if (it.amount !== null && Number.isFinite(it.amount)) g.totalAmount += it.amount
    if (conflictSuggestionIds.has(it.suggestionId)) g.conflictCount += 1
    if (it.createdAt && compareOldestFirst(it.createdAt, g.oldestCreatedAt) < 0) g.oldestCreatedAt = it.createdAt
  }
  return [...byLabel.values()].sort(
    (a, b) =>
      compareOldestFirst(a.oldestCreatedAt, b.oldestCreatedAt) ||
      b.count - a.count ||
      a.labelName.localeCompare(b.labelName),
  )
}

/** The group header's chip: how long its oldest suggestion has waited, on the LABEL_APPROVAL_AGE scale; null with no stamp. */
export function approvalGroupAge(group: Pick<ApprovalGroup, 'oldestCreatedAt'>, now?: Date | number): AgeDescription | null {
  return describeAge(group.oldestCreatedAt, now, LABEL_APPROVAL_AGE)
}
