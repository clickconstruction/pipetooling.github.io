/**
 * Draft price rows for the Add Part modal's Prices section (PartFormModal).
 *
 * The fast-entry contract (v2.1325): the list always ends with one blank row,
 * so tabbing through the last filled row lands in a ready blank one — no
 * "+ Add another price" click. Blank rows are dropped on save (the save filter
 * requires supply_house_id AND price, unchanged from the pre-refresh modal).
 */

export type PartPriceRowDraft = {
  supply_house_id: string
  price: string
  effective_date: string
}

export function makeBlankPartPriceRow(): PartPriceRowDraft {
  return { supply_house_id: '', price: '', effective_date: '' }
}

export function isBlankPartPriceRow(row: PartPriceRowDraft): boolean {
  return row.supply_house_id === '' && row.price.trim() === '' && row.effective_date === ''
}

/**
 * Ensure the list ends with exactly one trailing blank row. Returns the input
 * array unchanged (same reference) when it already does — safe to call from
 * every setState without churning renders.
 */
export function withTrailingBlankPartPriceRow(rows: PartPriceRowDraft[]): PartPriceRowDraft[] {
  const last = rows[rows.length - 1]
  if (last && isBlankPartPriceRow(last)) return rows
  return [...rows, makeBlankPartPriceRow()]
}
