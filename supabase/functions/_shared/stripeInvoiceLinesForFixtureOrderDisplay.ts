/**
 * Normalize Stripe **`lines.data`** / **`listLineItems`** payloads for staff previews and **`get-stripe-invoice-details`**.
 *
 * **`buildStripeInvoiceItemsFromFixtures`** emits **`invoice_items`** in **`jobs_ledger_fixtures.sequence_order`** ascending
 * (**Physical** / Edit Job parity). Hosted **invoice.stripe.com** renders that logical order on the finalized invoice,
 * but Stripe’s **`lines.data`** ( **`invoices.createPreview`**) / **`listLineItems`** arrays can ship **multi-line**
 * payloads in an order that disagrees with the hosted/customer-visible row sequence.
 *
 * For **`data.length > 1`**, return **`[...data].reverse()`** so **`preview-stripe-invoice`**, **`stripeInvoiceSnapshot`**
 * (**`invoice_preview`**), and **`get-stripe-invoice-details`** show the same **top-to-bottom** order as Stripe hosted.
 * Single-line: return **`data`** unchanged.
 */
export function stripeInvoiceLinesDataForFixtureOrderDisplay<T>(data: T[]): T[] {
  if (data.length <= 1) return data
  return [...data].reverse()
}
