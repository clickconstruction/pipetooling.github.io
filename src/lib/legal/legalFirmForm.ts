import type { LegalFirmRow } from './legalMatters'

/** The firm card's form on Settings → Collections law firms (v2.5756): the row's fields as strings. */
export type LegalFirmForm = { id: string | null; name: string; handling_name: string; email: string; phone: string; contingency_pct: string; filing_cost: string }

export const EMPTY_FIRM_FORM: LegalFirmForm = { id: null, name: '', handling_name: '', email: '', phone: '', contingency_pct: '33', filing_cost: '350' }

export function firmToForm(row: LegalFirmRow): LegalFirmForm {
  return { id: row.id, name: row.name, handling_name: row.handling_name, email: row.email, phone: row.phone, contingency_pct: String(row.contingency_pct), filing_cost: String(row.filing_cost) }
}
