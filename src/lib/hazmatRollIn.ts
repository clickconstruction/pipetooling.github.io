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
 * - it has NO bill-to override (v2.1086): a rider billed to someone else —
 *   e.g. the tenant pays the hazmat fee — must never fold back into the job
 *   customer's bill
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
  /** v2.1086: set when this invoice bills an alternate recipient (never rolls in). */
  bill_to_email?: string | null
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
    if (inv.bill_to_email?.trim()) continue
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

export type FoldedHazmatIncident = {
  id: string
  invoice_id: string | null
  incident_at: string | null
  fee_amount: number | string | null
  voided_at?: string | null
}

/**
 * Folded-fee lines (v2.1028, extended v2.1031): when billing a PRIMARY bill,
 * two kinds of incidents split their `fee_amount` out of the total as labeled
 * lines:
 * - incidents LINKED to that bill (`create_hazmat_fee_incident` added the fee
 *   to its amount at creation — mode `folded_into_primary`);
 * - UNLINKED incidents (`invoice_id` null — mode `job_total`: no bill was open
 *   at creation, so only the revenue bump landed and the fee rides in the
 *   billable remainder that priced this bill). The caller repoints these to
 *   the billed invoice after success so they never split twice.
 * Only primary bills qualify: a linked NON-primary invoice is a legacy rider
 * whose entire amount IS the fee (the separate-notice flow handles those).
 */
export function foldedHazmatFeeLines(params: {
  billingInvoice: { id: string; is_primary_rtb_bundle: boolean | null }
  incidents: readonly FoldedHazmatIncident[]
}): HazmatRollInLine[] {
  const { billingInvoice, incidents } = params
  if (billingInvoice.is_primary_rtb_bundle !== true) return []
  const out: HazmatRollInLine[] = []
  for (const inc of incidents) {
    if (inc.voided_at) continue
    const linkedId = (inc.invoice_id ?? '').trim()
    if (linkedId !== billingInvoice.id && linkedId !== '') continue
    const fee = Number(inc.fee_amount)
    if (!Number.isFinite(fee) || fee <= 0) continue
    const date = formatIncidentDate(inc.incident_at)
    out.push({
      incidentId: inc.id,
      invoiceId: billingInvoice.id,
      amountDollars: fee,
      amountCents: Math.round(fee * 100),
      description: date
        ? `Biohazard remediation fee — incident ${date}`
        : 'Biohazard remediation fee',
    })
  }
  return out
}

/**
 * Guard for fee lines riding inside a bill's amount: keeps lines (in order)
 * while their running total stays under `amountDollars`, so the work lines
 * always retain at least a cent. A dropped line isn't lost — its fee is still
 * in the job total and rides on a later bill.
 */
export function hazmatFeeLinesWithinAmount(
  lines: readonly HazmatRollInLine[],
  amountDollars: number,
): HazmatRollInLine[] {
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) return []
  const out: HazmatRollInLine[] = []
  let sum = 0
  for (const l of lines) {
    if (sum + l.amountDollars >= amountDollars) continue
    sum += l.amountDollars
    out.push(l)
  }
  return out
}
