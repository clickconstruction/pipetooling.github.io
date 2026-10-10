/**
 * GC mode — design spike. The one company window: an owner's and an architect's summary.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { customerSummary, ownerMoney, priceToOwner } from '../gc/customers'

export type { ArchitectSummary, CustomerSummary } from '../gc/customers'
export { architectSummary } from '../gc/customers'
