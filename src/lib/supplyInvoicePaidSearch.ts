/**
 * Paid-state words in a supply-invoice search (Documents → Supply houses): `paid` finds the paid
 * bills, `unpaid` or `open` the unpaid ones. Whole words only — "unpaid" contains "paid", so the
 * old substring test made a search for "unpaid" match every invoice (v2.3829).
 */
export function supplyInvoicePaidWordMatches(query: string, isPaid: boolean): boolean {
  const words = query.trim().toLowerCase().split(/\s+/)
  if (isPaid) return words.includes('paid')
  return words.includes('unpaid') || words.includes('open')
}
