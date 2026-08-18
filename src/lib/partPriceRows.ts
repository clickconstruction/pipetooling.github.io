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
 * Apply an edit to a draft row, defaulting the effective date to today the
 * moment the row first becomes active (v2.1792): when a row with no supply
 * house and no price gains either, an empty effective date fills with
 * `todayYmd` — visible immediately and still editable/clearable. Rows the user
 * already touched never get re-defaulted (clearing the date sticks), and
 * untouched trailing blank rows stay fully blank so they still drop on save.
 */
export function applyPartPriceRowPatch(
  row: PartPriceRowDraft,
  patch: Partial<PartPriceRowDraft>,
  todayYmd: string,
): PartPriceRowDraft {
  const next = { ...row, ...patch }
  const wasInactive = row.supply_house_id === '' && row.price.trim() === ''
  const isActive = next.supply_house_id !== '' || next.price.trim() !== ''
  if (wasInactive && isActive && patch.effective_date === undefined && next.effective_date === '') {
    next.effective_date = todayYmd
  }
  return next
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
