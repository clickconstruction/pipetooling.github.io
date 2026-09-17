/**
 * The Travel box's ZIP prefill (Pricing train, Stage A — v2.3546): the LAST five-digit
 * run in the customer's address, since ZIPs usually trail the state; '' when there is
 * none. Lifted verbatim from `BidsLaborTab`'s prefill effect (map quirk 12).
 */
export function lastZipInAddress(address: string | null | undefined): string {
  const matches = (address ?? '').match(/\b\d{5}\b/g)
  return matches && matches.length > 0 ? matches[matches.length - 1]! : ''
}
