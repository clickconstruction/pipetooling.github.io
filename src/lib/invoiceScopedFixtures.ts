/**
 * Which line items belong on a bill (v2.1133). Invoices created from segment
 * selection link their fixtures (jobs_ledger_fixtures.invoice_id) — the bill
 * must list exactly those lines, not the whole job. Invoices carved by dollar
 * amount link nothing, so they keep the historical whole-job proration.
 *
 * Mirrored in supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts
 * (scopeFixturesToInvoice) — the edge functions are authoritative for what
 * Stripe renders; this client copy keeps previews and physical PDFs aligned.
 */
export function fixturesForInvoiceBill<T extends { invoice_id?: string | null }>(
  fixtures: T[] | null | undefined,
  invoiceId: string | null | undefined,
): T[] {
  const all = fixtures ?? []
  if (!invoiceId) return all
  const linked = all.filter((f) => (f.invoice_id ?? null) === invoiceId)
  return linked.length > 0 ? linked : all
}
