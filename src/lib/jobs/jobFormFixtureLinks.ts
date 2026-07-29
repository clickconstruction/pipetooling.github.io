/**
 * Job-stages billing (v2.1069): helpers for line items linked to the invoice
 * that bills them (FixtureRow.invoice_id / jobs_ledger_fixtures.invoice_id).
 *
 * A linked row locks in the ① Line Items grid — name/count/price edits and
 * removal are disabled until the invoice is deleted or sent back (which
 * releases the link via ON DELETE SET NULL). Re-ordering stays allowed:
 * order is presentation, not money.
 */

export type FixtureInvoiceLinkChip = {
  label: string
  /** Saturated status colors stay literal per the theme rules. */
  color: string
  background: string
}

/**
 * Chip describing the linked invoice's lifecycle stage, or null when the row
 * is unlinked (or the invoice is not in the job's invoice list — e.g. it was
 * just deleted and the fixture refresh hasn't landed; treat as unlinked
 * rather than inventing a stage).
 */
export function fixtureInvoiceLinkChip(
  invoiceId: string | null,
  invoiceStatusById: Record<string, string>,
): FixtureInvoiceLinkChip | null {
  if (!invoiceId) return null
  const status = invoiceStatusById[invoiceId]
  if (!status) return null
  if (status === 'paid') return { label: 'Invoiced · Paid', color: 'var(--text-green-800)', background: 'var(--bg-green-100)' }
  if (status === 'billed') return { label: 'Invoiced · Billed', color: 'var(--text-blue-800)', background: 'var(--bg-blue-200)' }
  return { label: 'Invoiced · Ready to Bill', color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)' }
}

/** A linked row's identity/money fields are read-only in ① Line Items. */
export function fixtureRowIsLocked(row: { invoice_id: string | null }): boolean {
  return row.invoice_id != null
}
