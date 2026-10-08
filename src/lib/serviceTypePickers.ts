/**
 * The service types a person may pick (v2.4958): every type but a billing-only one, which only a GC
 * project's billing job carries (`service_types.billing_only`, General contracting). Pickers for crew
 * work, bids, materials, supply houses, job books and the like read through this. A lookup by id (a job's
 * own type, a ledger prefix) keeps every type, so a billing job never reads a blank type.
 */
export function isPickableServiceType(type: { billing_only?: boolean | null }): boolean {
  return type.billing_only !== true
}

/** The pickable types, in the order given. */
export function pickableServiceTypes<T extends { billing_only?: boolean | null }>(types: readonly T[]): T[] {
  return types.filter(isPickableServiceType)
}
