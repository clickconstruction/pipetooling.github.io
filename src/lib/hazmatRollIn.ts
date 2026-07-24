/**
 * Hazmat roll-in (v2.1002): when the office bills a job's PRIMARY invoice and
 * the job still has UNSENT hazmat rider invoices, the Bill Customer modal
 * offers (default ON) to fold each rider into the final bill as its own
 * labeled Stripe line item instead of sending a separate rider invoice.
 *
 * A rider is eligible only when ALL hold:
 * - it is linked from `job_hazmat_incidents.invoice_id`
 * - it is NOT the invoice being billed (billing the rider itself keeps the
 *   existing separate-notice flow)
 * - status is draft or ready_to_bill
 * - it has never reached the customer: no stripe_invoice_id, never sent
 *   (`sent_to_customer_at` null, no external send channel)
 * - amount > 0
 *
 * After the Stripe invoice succeeds the caller repoints the incident to the
 * final invoice and deletes the rider row, so job balance math counts the fee
 * exactly once (repoint FIRST — a dangling incident → deleted-invoice link is
 * worse than a leftover draft row).
 */

export type HazmatRollInInvoice = {
  id: string
  amount: number | string | null
  status: string | null
  stripe_invoice_id: string | null
  sent_to_customer_at: string | null
  external_send_channel: string | null
}

export type HazmatRollInIncident = {
  id: string
  invoice_id: string | null
  incident_at: string | null
}

export type HazmatRollInLine = {
  incidentId: string
  invoiceId: string
  amountDollars: number
  amountCents: number
  /** Stripe line description, e.g. "Biohazard remediation fee — incident 07/20/2026". */
  description: string
}

function formatIncidentDate(iso: string | null): string {
  const t = (iso ?? '').trim()
  if (!t) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (!m) return ''
  return `${m[2]}/${m[3]}/${m[1]}`
}

export function eligibleHazmatRollIns(params: {
  billingInvoiceId: string
  incidents: readonly HazmatRollInIncident[]
  invoices: readonly HazmatRollInInvoice[]
}): HazmatRollInLine[] {
  const { billingInvoiceId, incidents, invoices } = params
  const byId = new Map(invoices.map((i) => [i.id, i]))
  const out: HazmatRollInLine[] = []
  const seenInvoiceIds = new Set<string>()
  for (const inc of incidents) {
    const invId = (inc.invoice_id ?? '').trim()
    if (!invId || invId === billingInvoiceId || seenInvoiceIds.has(invId)) continue
    const inv = byId.get(invId)
    if (!inv) continue
    const status = (inv.status ?? '').trim()
    if (status !== 'draft' && status !== 'ready_to_bill') continue
    if (inv.stripe_invoice_id?.trim()) continue
    if (inv.sent_to_customer_at?.trim()) continue
    if (inv.external_send_channel?.trim()) continue
    const amount = Number(inv.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    seenInvoiceIds.add(invId)
    const date = formatIncidentDate(inc.incident_at)
    out.push({
      incidentId: inc.id,
      invoiceId: invId,
      amountDollars: amount,
      amountCents: Math.round(amount * 100),
      description: date
        ? `Biohazard remediation fee — incident ${date}`
        : 'Biohazard remediation fee',
    })
  }
  return out
}

/** Sum in dollars for the checkbox label ("Include hazmat fee ($500)…"). */
export function hazmatRollInTotalDollars(lines: readonly HazmatRollInLine[]): number {
  return lines.reduce((a, l) => a + l.amountDollars, 0)
}
