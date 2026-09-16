/**
 * What kind of paper a `supply_house_invoices` row is, and the two places a credit must not go.
 *
 * A credit memo is stored with a NEGATIVE amount (v2.3500–v2.3502), which is what lets every reader
 * that sums `amount × pct` credit the right job without learning anything new. Two paths cannot
 * take that for granted, so they refuse a credit outright rather than quietly mishandling it.
 */

const EPSILON = 0.005

/** A credit memo: a return or a price correction the house issued, stored negative. */
export function isSupplyCredit(amount: number | null | undefined): boolean {
  return Number(amount ?? 0) < -EPSILON
}

/**
 * Workflow / Projects forecast step line items COPY the amount into `workflow_step_line_items`,
 * whose FK back to the invoice is `ON DELETE SET NULL`. A copied negative would outlive the document
 * it came from, in a table that has no idea a credit exists.
 */
export const SUPPLY_CREDIT_NOT_ON_STEP =
  'This is a credit memo, not an invoice. Credits stay on the supply house so they come off that job’s cost once — adding one to a step would copy the amount here as well.'

/**
 * A card charge linked to a credit would be excluded from the job's parts cost (v2.2692 counts an
 * invoice-linked charge once, through the invoice) AND carry the credit's negative allocation — the
 * same money off the job twice.
 */
export const SUPPLY_CREDIT_NOT_LINKABLE =
  'This is a credit memo, not an invoice. A card charge can only be linked to what it paid for — linking it here would take the money off the job twice.'
