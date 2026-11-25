/**
 * The memo a Stripe bill carries (punch list #343, the live walk of 2026-11-24). Pure, no imports: Bill Customer's
 * face of the bill reads it in the browser, so the face shows the words the made bill will hold.
 *
 * Since v2.1001 `create-stripe-invoice` leads the memo with the job's service address, because Stripe's email card
 * shows the memo and never the custom fields. The office's own memo follows after a blank line, unchanged. The face
 * drew the office's memo alone, so the made bill opened with a line the face had not shown.
 */

/** The label the made bill puts before the job's address. */
export const STRIPE_BILL_SERVICE_ADDRESS_LABEL = 'Service address'

/** The memo as the made bill holds it: the service address line, a blank line, then the office's memo. Null when both are empty. */
export function stripeBillMemoWithServiceAddress(jobAddress: string | null | undefined, memo: string | null | undefined): string | null {
  const addr = typeof jobAddress === 'string' ? jobAddress.trim() : ''
  const parts = [addr ? `${STRIPE_BILL_SERVICE_ADDRESS_LABEL}: ${addr}` : '', typeof memo === 'string' ? memo.trim() : ''].filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}
