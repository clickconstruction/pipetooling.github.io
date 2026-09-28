/**
 * Estimate → job import, the shaping: the estimate's lines as the form's line items, and the
 * customer fields the form shows. Pure — the job form reads the estimate and the customer.
 */
import type { FixtureRow } from './jobFormTypes'

/**
 * The estimate's lines as line items, each with a new id; one blank row when the estimate has
 * none, so the form never opens with an empty list.
 */
export function estimateImportFixtureRows(
  payload: ReadonlyArray<{ name: string; count: number; line_unit_price: number | null; line_description?: string | null }>,
  newId: () => string,
): FixtureRow[] {
  if (payload.length === 0) return [{ id: newId(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }]
  return payload.map((p) => ({
    id: newId(),
    name: p.name,
    count: p.count,
    line_unit_price: p.line_unit_price,
    line_description: p.line_description ?? '',
    invoice_id: null,
  }))
}

/**
 * What the form's customer fields read after the import. With the customer's row: its name, its
 * contact and the day it was met (the date alone). Without one — no customer on the estimate,
 * or a row that could not be read — only the estimate's own email is kept.
 */
export function estimateImportCustomerFields(
  customer: { name?: string | null; date_met?: string | null; contact_info?: unknown } | null | undefined,
  estimateEmail: string | null | undefined,
): { customerName: string; customerEmail: string; customerPhone: string; dateMet: string } {
  if (!customer) return { customerName: '', customerEmail: (estimateEmail ?? '').trim(), customerPhone: '', dateMet: '' }
  const ci = customer.contact_info as { phone?: string; email?: string } | null
  return {
    customerName: customer.name ?? '',
    customerEmail: ci ? (ci.email ?? '') : '',
    customerPhone: ci ? (ci.phone ?? '') : '',
    dateMet: customer.date_met ? (customer.date_met.split('T')[0] ?? '') : '',
  }
}
