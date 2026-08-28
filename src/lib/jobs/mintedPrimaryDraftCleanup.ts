/**
 * The Bill Customer cancel-leak guard (v2.2464).
 *
 * Opening Bill Customer for a job runs the ensure RPC, which can INSERT the
 * primary Ready-to-Bill remainder draft ("auto") — and closing the modal
 * without billing used to leave that row behind forever (it planted the
 * confusing full-remainder draft on Taunya's job 978). The modal now remembers
 * when the open MINTED the row (the RPC's `created: true`) and deletes it
 * again on close — but only when this predicate says the row is still exactly
 * what the mint left behind.
 *
 * "Untouched" means: still a Ready-to-Bill primary, never pushed toward any
 * billing channel (no Stripe object, no hosted URL, never sent/billed, no
 * outside-send record), no bill-to override configured, and no payment
 * recorded against it. Any of those set means a human or a submit path did
 * something with the row — keep it.
 */
export type MintedPrimaryDraftRow = {
  status: string
  is_primary_rtb_bundle: boolean | null
  stripe_invoice_id: string | null
  stripe_invoice_status: string | null
  hosted_invoice_url: string | null
  sent_to_customer_at: string | null
  billed_at: string | null
  external_send_channel: string | null
  bill_to_name: string | null
  bill_to_email: string | null
  bill_to_phone: string | null
  bill_to_stripe_customer_id: string | null
}

function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim() === ''
}

export function isMintedPrimaryDraftStillUntouched(
  row: MintedPrimaryDraftRow | null | undefined,
  paymentsCount: number,
): boolean {
  if (!row) return false
  if (row.status !== 'ready_to_bill') return false
  if (row.is_primary_rtb_bundle !== true) return false
  if (paymentsCount > 0) return false
  return (
    isBlank(row.stripe_invoice_id) &&
    isBlank(row.stripe_invoice_status) &&
    isBlank(row.hosted_invoice_url) &&
    isBlank(row.sent_to_customer_at) &&
    isBlank(row.billed_at) &&
    isBlank(row.external_send_channel) &&
    isBlank(row.bill_to_name) &&
    isBlank(row.bill_to_email) &&
    isBlank(row.bill_to_phone) &&
    isBlank(row.bill_to_stripe_customer_id)
  )
}
