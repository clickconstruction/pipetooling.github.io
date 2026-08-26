/**
 * Multi-add picker for the bid's "Also sent to" row (Edit Bid): which customers
 * are offerable, and what the commit button says as GCs get ticked.
 */

export type PickableGcLike = {
  id: string
  name: string
  address?: string | null
}

/** Customers offered by the picker: not the bid's GC, not already a recipient, matching the search on name or address. */
export function filterPickableGcs<T extends PickableGcLike>(
  customers: ReadonlyArray<T>,
  opts: { bidCustomerId: string | null; recipientIds: ReadonlySet<string>; search: string },
): T[] {
  const q = opts.search.trim().toLowerCase()
  return customers.filter((c) => {
    if (c.id === opts.bidCustomerId || opts.recipientIds.has(c.id)) return false
    return !q || c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
  })
}

/** The commit button: "Add" until more than one is ticked, then it counts — "Add 3 GCs". */
export function addGcsButtonLabel(tickedCount: number): string {
  return tickedCount > 1 ? `Add ${tickedCount} GCs` : 'Add'
}

/** The footer's running tally next to the commit button. */
export function tickedSummary(tickedCount: number): string {
  return tickedCount === 0 ? 'Nothing ticked yet' : `${tickedCount} ticked`
}
