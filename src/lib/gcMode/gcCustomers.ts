/**
 * GC mode — design spike. The one company window: an owner's and an architect's summary.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcCustomer, GcProject, GcState } from './gcTypes'
import { proposalTotals } from './gcBids'
import { ownerAccount, ownerContractPrice, signedChangeOrders } from './gcOwnerBilling'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { CustomerSummary } from '../gc/customers'
export type { ArchitectSummary, CustomerSummary } from '../gc/customers'
export { architectSummary } from '../gc/customers'

/**
 * What a project's owner has been billed, has paid and is holding. Our sent pay applications when
 * any went (`ownerAccount`, the owner's ask 2026-10-03); before the first one, the record's
 * made-up `ownerBilling`. Null when neither: nothing billed yet.
 */
export function ownerMoney(project: GcProject): { billed: number; paid: number; retainageHeld: number; owed: number } | null {
  // Owed is the account's own (asked less paid): once the architect certifies less than we asked,
  // billed - held - paid would count the cut twice, since the cut comes back on the next bill.
  const account = ownerAccount(project)
  if (account) return { billed: account.billed, paid: account.paid, retainageHeld: account.retainageHeld, owed: account.owed }
  const record = project.ownerBilling
  return record
    ? { billed: record.billed, paid: record.paid, retainageHeld: record.retainageHeld, owed: record.billed - record.retainageHeld - record.paid }
    : null
}

/**
 * What the owner pays us for the job. Once our contract with them is signed: the price they signed
 * plus their signed change orders (the owner, 2026-10-04, in Owner Billing), so buying a trade out
 * cheaper or dearer moves our margin, not their price. Before that: the price we carry today.
 */
export function priceToOwner(project: GcProject): { price: number; signed: boolean; changeOrders: number } {
  if (!project.ownerContractSignedOn) return { price: proposalTotals(project).price, signed: false, changeOrders: 0 }
  const signed = signedChangeOrders(project)
  return { price: ownerContractPrice(project) + signed.reduce((t, co) => t + co.price, 0), signed: true, changeOrders: signed.length }
}

/** One customer across every project: what is live, what is owed, how often they pick us. */
export function customerSummary(state: GcState, customer: GcCustomer): CustomerSummary {
  const live = state.projects.filter((p) => p.customerId === customer.id)
  const sum: CustomerSummary = {
    live,
    inFront: 0,
    underContract: 0,
    billed: 0,
    paid: 0,
    owed: 0,
    retainageHeld: 0,
    asked: live.length + customer.past.length,
    won: customer.past.filter((p) => p.outcome === 'built').length,
  }
  for (const project of live) {
    const price = priceToOwner(project).price
    // A lost bid is no longer in front of them (owner, 2026-10-03); the window counts it as a loss.
    if (project.lostOn) continue
    if (project.stage === 'pursuing') sum.inFront += price
    else {
      sum.underContract += price
      sum.won += 1
    }
    const money = ownerMoney(project)
    if (money) {
      sum.billed += money.billed
      sum.paid += money.paid
      sum.retainageHeld += money.retainageHeld
      sum.owed += money.owed
    }
  }
  return sum
}
