/** Same fallback as the Rules table Label column when the label row is missing. */
export function accountingRuleLabelDisplayText(labelId: string, labelName: string | undefined): string {
  return labelName ?? labelId.slice(0, 8)
}

/** Subset of rule row fields used for table sort (name/label + stable tie-break). */
export type AccountingRuleSortFields = {
  name: string
  label_id: string
  sort_order: number
  id: string
}

export type AccountingRulesTableSortColumn = 'name' | 'label'

export type AccountingRulesTableSortDirection = 'asc' | 'desc'

/** Comparator for Accounting Rules table when sorting by Name or Label. Tie-break is always sort_order then id ascending. */
export function compareAccountingRulesForTableSort(
  a: AccountingRuleSortFields,
  b: AccountingRuleSortFields,
  column: AccountingRulesTableSortColumn,
  direction: AccountingRulesTableSortDirection,
  labelDisplay: (rule: AccountingRuleSortFields) => string,
): number {
  const sign = direction === 'asc' ? 1 : -1
  if (column === 'name') {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (cmp !== 0) return sign * cmp
  } else {
    const cmp = labelDisplay(a).localeCompare(labelDisplay(b), undefined, { sensitivity: 'base' })
    if (cmp !== 0) return sign * cmp
  }
  if (a.sort_order !== b.sort_order) {
    return a.sort_order < b.sort_order ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortAccountingRulesForTable<T extends AccountingRuleSortFields>(
  rows: readonly T[],
  column: AccountingRulesTableSortColumn,
  direction: AccountingRulesTableSortDirection,
  labelDisplay: (rule: AccountingRuleSortFields) => string,
): T[] {
  const out = [...rows]
  out.sort((x, y) => compareAccountingRulesForTableSort(x, y, column, direction, labelDisplay))
  return out
}

/** Case-insensitive substring match on rule name or label column text. `qNorm` must be non-empty lowercase trimmed query. */
export function accountingRuleRowMatchesSearch(
  ruleName: string,
  labelDisplayText: string,
  qNorm: string,
): boolean {
  return ruleName.toLowerCase().includes(qNorm) || labelDisplayText.toLowerCase().includes(qNorm)
}
