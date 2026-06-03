/** Accounting classification for a Category (mercury_drag_sort_labels.account_type). */
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'transfer'

/** Dropdown options (order shown in the Category detail modal). */
export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string; hint: string }> = [
  { value: 'income', label: 'Income', hint: 'Revenue (P&L)' },
  { value: 'expense', label: 'Expense', hint: 'Costs (P&L)' },
  { value: 'asset', label: 'Asset', hint: 'Balance sheet' },
  { value: 'liability', label: 'Liability', hint: 'Balance sheet' },
  { value: 'equity', label: 'Equity', hint: 'Owner contributions / draws (balance sheet)' },
  { value: 'transfer', label: 'Transfer', hint: 'Between own accounts — excluded from both statements' },
]

const LABELS: Record<AccountType, string> = {
  income: 'Income',
  expense: 'Expense',
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  transfer: 'Transfer',
}

export function accountTypeLabel(t: string | null | undefined): string {
  if (t && t in LABELS) return LABELS[t as AccountType]
  return 'Unclassified'
}

export function isAccountType(v: unknown): v is AccountType {
  return typeof v === 'string' && v in LABELS
}
