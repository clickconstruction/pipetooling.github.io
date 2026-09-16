/**
 * The Accounts Receivable button's title / aria-label on the Billed Awaiting Payment
 * header. Four sentences, chosen by who is looking and what is waiting; lifted from a
 * `useMemo` in `JobsStagesTab` (Stage A of the Stages decomposition train).
 */
export function accountsReceivableButtonName(input: {
  canRecordPayments: boolean
  unallocatedCount: number | null | undefined
  billedRowCount: number
}): string {
  if (!input.canRecordPayments) return 'Only dev, leader, assistant, and primary can record payments'
  const n = input.unallocatedCount
  if (typeof n === 'number' && n > 0) {
    return `Accounts Receivable, ${n} unallocated bank transaction${n === 1 ? '' : 's'}`
  }
  if (input.billedRowCount === 0) return 'No billed rows'
  return 'Accounts Receivable: apply bank deposits to billed lines (non-Stripe)'
}
