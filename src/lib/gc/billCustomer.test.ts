/**
 * The state our money screens read (./billCustomer.ts): billing laid over the board's projects, each job with
 * its own copy of its customer carrying the job's retainage and the customer's usual days to pay.
 */
import { describe, expect, it } from 'vitest'
import { type BillingRows, type OwnerTermsRow, billingStateFor, billingStateForAll, contractWorthFromRows, jobCustomerId } from './billCustomer'
import { allJobsMoney, ownerPayApp, ownerRetainageWords } from './ownerBilling'
import type { OwnerBillingRows } from './ownerBillingRows'
import { initialGcState } from './schedule/testState'

const terms = (projectId: string, over: Partial<OwnerTermsRow> = {}): OwnerTermsRow => ({
  project_id: projectId,
  owner_retainage_pct: 10,
  owner_retainage_step_at_pct: null,
  owner_retainage_step_to_pct: null,
  owner_retainage_step_way: null,
  owner_pay_days: null,
  billing_job_id: null,
  property_owner_customer_id: null,
  ...over,
})

const none: OwnerBillingRows = { payApps: [], lines: [], reminders: [], interestBills: [], acceptance: null }

describe('the state our money screens read', () => {
  it('keys the signed price the kernels\' way, and reads nothing signed as not signed', () => {
    expect(
      contractWorthFromRows([
        { project_id: 'p', line: 'trade', package_id: 'pkg-1', worth: 100000 },
        { project_id: 'p', line: 'gc', package_id: null, worth: 10000 },
        { project_id: 'p', line: 'fee', package_id: null, worth: 8800 },
      ]),
    ).toEqual({ 'pkg-1': 100000, gc: 10000, fee: 8800 })
    expect(contractWorthFromRows([])).toBeUndefined()
  })

  it('gives two jobs of one customer each its own retainage, and the customer\'s days to pay to both', () => {
    const s = initialGcState()
    const rows: BillingRows = {
      terms: [terms('fairoaksd', { owner_retainage_pct: 5, owner_retainage_step_at_pct: 50, owner_retainage_step_to_pct: 2.5, owner_retainage_step_way: 'after', property_owner_customer_id: 'hc' }), terms('helotes')],
      contract: [{ project_id: 'fairoaksd', line: 'gc', package_id: null, worth: 1 }],
      billing: new Map([['fairoaksd', none]]),
      names: { hc: 'Hill Country Holdings' },
      payDays: { cibolo: 41 },
    }
    const laid = billingStateForAll(s, rows)
    const fair = laid.projects.find((p) => p.id === 'fairoaksd')!
    const helotes = laid.projects.find((p) => p.id === 'helotes')!
    expect(fair.customerId).toBe(jobCustomerId('cibolo', 'fairoaksd'))
    expect(laid.customers.find((c) => c.id === fair.customerId)).toMatchObject({ name: 'Cibolo Creek Partners', retainagePct: 5, payDays: 41 })
    // Raman has never paid us in the app: no usual days, never the company's.
    expect(laid.customers.find((c) => c.id === helotes.customerId)).toMatchObject({ retainagePct: 10, payDays: null })
    expect(fair.ownerContractWorth).toEqual({ gc: 1 })
    expect(fair.propertyOwner).toBe('Hill Country Holdings')
    expect(fair.ownerBilling).toBeNull()
    expect(ownerRetainageWords(ownerPayApp(laid, fair).retainagePct, fair.ownerRetainageStep)).toBe('5% until the work is half done, then 2.5% on the rest')
    // The jobs not laid, and the customers the board had, are as they were.
    expect(laid.projects.filter((p) => p.id !== 'fairoaksd' && p.id !== 'helotes')).toEqual(s.projects.filter((p) => p.id !== 'fairoaksd' && p.id !== 'helotes'))
    expect(laid.customers.slice(0, s.customers.length)).toEqual(s.customers)
  })

  it('lays one job for Bill the customer, and Money reads every job laid', () => {
    const s = initialGcState()
    const rows: BillingRows = { terms: [terms('fairoaksd'), terms('stoneoak')], contract: [], billing: new Map(), names: {}, payDays: {} }
    expect(billingStateFor(s, 'fairoaksd', rows).projects.find((p) => p.id === 'stoneoak')).toEqual(s.projects.find((p) => p.id === 'stoneoak'))
    const money = allJobsMoney(billingStateForAll(s, rows))
    // No bill went on either in the app: nothing owed, nothing paid.
    expect(money.owed).toEqual([])
    expect(money.totals.paidIn).toBe(0)
  })
})
