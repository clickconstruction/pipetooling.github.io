/** Jobs ledger row must be linked to a customers row before Invoice/Update or instant billed. */
export function jobLedgerHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}
