import type { Database } from '../types/database'
import type { SearchableSelectSelectableOption } from '../components/SearchableSelect'

export type AccountingDragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

/** Sort labels for pickers: assignment count desc → sort_order → name → id. */
export function buildSortedAccountingLabelRows(
  labels: AccountingDragLabelRow[],
  labelAssignmentCountById: Record<string, number>,
): AccountingDragLabelRow[] {
  const rows = [...labels]
  rows.sort((a, b) => {
    const ca = labelAssignmentCountById[a.id] ?? 0
    const cb = labelAssignmentCountById[b.id] ?? 0
    if (cb !== ca) return cb - ca
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    const nm = a.name.localeCompare(b.name)
    if (nm !== 0) return nm
    return a.id.localeCompare(b.id)
  })
  return rows
}

export function buildSortedAccountingLabelSelectOptions(
  labels: AccountingDragLabelRow[],
  labelAssignmentCountById: Record<string, number>,
): SearchableSelectSelectableOption[] {
  return buildSortedAccountingLabelRows(labels, labelAssignmentCountById).map((L) => ({
    value: L.id,
    label: L.name,
  }))
}

/** Case-insensitive substring match on label name. */
export function filterAccountingLabelsByQuery(
  rows: AccountingDragLabelRow[],
  query: string,
): AccountingDragLabelRow[] {
  const q = query.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter((L) => L.name.toLowerCase().includes(q))
}
