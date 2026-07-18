/**
 * Customer soft-archive kernel (v2.735).
 *
 * A customer is archived when `customers.archived_at` is a non-empty value.
 * All helpers tolerate rows where the column is missing entirely (undefined) —
 * the client can ship before the migration is applied without crashing — and
 * treat such rows as active.
 *
 * Policy encoded here (see the migration comment on customers.archived_at):
 * archived customers are hidden from the Customers list by default and excluded
 * from pickers that link NEW records; existing links keep working, so pickers
 * that double as display lookups keep the currently-linked row via `keepId`.
 */

export type CustomerArchiveFields = {
  id?: string
  archived_at?: string | null
}

/** True when the row carries a non-null, non-empty archived_at. Missing column ⇒ active. */
export function isCustomerArchived(row: CustomerArchiveFields | null | undefined): boolean {
  if (!row) return false
  const at = row.archived_at
  return typeof at === 'string' && at.trim() !== ''
}

/** Split rows into active/archived, preserving order within each bucket. */
export function partitionCustomersByArchived<T extends CustomerArchiveFields>(
  rows: readonly T[],
): { active: T[]; archived: T[] } {
  const active: T[] = []
  const archived: T[] = []
  for (const row of rows) {
    if (isCustomerArchived(row)) archived.push(row)
    else active.push(row)
  }
  return { active, archived }
}

/**
 * Rows eligible for a picker that links NEW records: drops archived customers,
 * except the currently-linked row (`keepId`) so an existing link stays
 * selectable/renderable while editing.
 */
export function filterActiveCustomersForPicker<T extends CustomerArchiveFields>(
  rows: readonly T[],
  keepId?: string | null,
): T[] {
  return rows.filter((row) => !isCustomerArchived(row) || (keepId != null && row.id === keepId))
}
