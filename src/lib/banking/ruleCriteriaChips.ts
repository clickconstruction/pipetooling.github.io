// Turns a rule's criteria into the chips the Rules list draws ("Matches
// when …"), so a rule explains itself without opening it. Pure.

import type { AccountingLabelRuleCriteriaV1 } from '../accountingLabelRuleMatch'
import { resolveAccountingRuleAmountBounds } from '../accountingLabelRuleMatch'
import type { CategoryTagLookups, CategoryTagRow } from './categoryTags'

export type RuleCriteriaChip =
  | { kind: 'text'; key: string; label: string; value: string }
  | { kind: 'tag'; key: string; tag: CategoryTagRow }
  | { kind: 'tag-missing'; key: string; categories: string[] }

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export function describeRuleCriteria(
  criteria: AccountingLabelRuleCriteriaV1 | null,
  lookups: CategoryTagLookups | null,
): RuleCriteriaChip[] {
  if (!criteria) return [{ kind: 'text', key: 'invalid', label: 'criteria', value: 'unreadable' }]
  const out: RuleCriteriaChip[] = []
  const cp = criteria.counterparty
  if (cp && cp.value.trim()) out.push({ kind: 'text', key: 'counterparty', label: `counterparty ${cp.op}`, value: cp.value.trim() })
  const bd = criteria.bankDescription
  if (bd && bd.value.trim()) out.push({ kind: 'text', key: 'bankDescription', label: `bank description ${bd.op}`, value: bd.value.trim() })
  const a = criteria.amount
  if (a && (a.min !== undefined || a.max !== undefined)) {
    const { lower, upper } = resolveAccountingRuleAmountBounds(a)
    const value =
      lower !== undefined && upper !== undefined
        ? `${money(lower)} to ${money(upper)}`
        : lower !== undefined
          ? `≥ ${money(lower)}`
          : `≤ ${money(upper ?? 0)}`
    out.push({ kind: 'text', key: 'amount', label: 'amount', value })
  }
  const bt = criteria.bankTag
  if (bt && bt.tagId.trim()) {
    const tag = lookups?.tagsById.get(bt.tagId) ?? null
    if (tag) out.push({ kind: 'tag', key: 'bankTag', tag })
    else out.push({ kind: 'tag-missing', key: 'bankTag', categories: bt.categories })
  }
  const bc = criteria.bankCategory
  if (bc && bc.value.trim()) out.push({ kind: 'text', key: 'bankCategory', label: `bank category ${bc.op}`, value: bc.value.trim() })
  if (out.length === 0) out.push({ kind: 'text', key: 'none', label: 'no criteria', value: 'never matches' })
  return out
}

/** The tag a rule is filed under for the list's tag filter: its `bankTag`, else the tag of its accounting label. */
export function ruleTagId(
  criteria: AccountingLabelRuleCriteriaV1 | null,
  labelId: string,
  lookups: CategoryTagLookups | null,
): string | null {
  if (!lookups) return null
  const fromClause = criteria?.bankTag?.tagId
  if (fromClause && lookups.tagsById.has(fromClause)) return fromClause
  return lookups.tagIdByLabelId.get(labelId) ?? null
}
