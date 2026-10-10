/**
 * One customer's money in their window (the Board's B2b-v-iii; gc 5, Owner Billing's read): each job keeps its own
 * copy of the customer as Bill the customer reads it, so a job's due days and what it holds are Bill the customer's own,
 * and the customer's totals are the jobs' sums. Played on the made-up data with Dr. Raman's Helotes moved to Cibolo
 * Creek, so Cibolo has two jobs of ours: Fair Oaks at 10% retainage and 30 days to pay, Helotes at 5% and 45. Cibolo
 * usually pays in 20 days, which each job's copy carries and the customer record does not.
 */
import { describe, expect, it } from 'vitest'
import { billingStateFor, jobCustomerId, type BillingRows, type OwnerTermsRow } from './billCustomer'
import { customerBilledJobIds, customerMoneyActivity, customerMoneyDocuments, customerMoneyView } from './customerMoney'
import { customerActivity } from './companyFile'
import { customerSummary } from './customers'
import { ownerAccount, ownerPayAppsSent, ownerPayDue } from './ownerBilling'
import type { OwnerBillingRows, OwnerPayAppRow } from './ownerBillingRows'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const terms = (projectId: string, retainage: number, payDays: number): OwnerTermsRow => ({
  project_id: projectId,
  owner_retainage_pct: retainage,
  owner_retainage_step_at_pct: null,
  owner_retainage_step_to_pct: null,
  owner_retainage_step_way: null,
  owner_pay_days: payDays,
  owner_late_interest_pct_per_month: null,
  owner_late_finish_per_day: null,
  billing_job_id: null,
  property_owner_customer_id: null,
})
const app = (projectId: string, over: Partial<OwnerPayAppRow>): OwnerPayAppRow => ({
  id: `${projectId}-a1`,
  project_id: projectId,
  number: 1,
  final: false,
  period_to: '2026-08-31',
  sent_on: '2026-08-31',
  sent_by: null,
  retainage_pct: 10,
  retainage_step_at_pct: null,
  retainage_step_to_pct: null,
  retainage_step_way: null,
  retainage: 0,
  work_to_date: 0,
  due: 0,
  certified: null,
  certified_on: null,
  certified_note: '',
  certified_by: null,
  invoice_id: null,
  conditional_waiver_id: null,
  created_at: '2026-08-31T15:00:00Z',
  ...over,
})
const bills = (payApps: OwnerPayAppRow[]): OwnerBillingRows => ({ payApps, lines: [], reminders: [], interestBills: [], acceptance: null })

/** Cibolo Creek with Fair Oaks (building) and Helotes (buying out) ours, and its two bids still out. */
function board(): GcState {
  const s = initialGcState()
  const cibolo = s.projects.find((p) => p.id === 'fairoaksd')!.customerId
  return { ...s, projects: s.projects.map((p) => (p.id === 'helotes' ? { ...p, customerId: cibolo } : p)) }
}
const rows: BillingRows = {
  terms: [terms('fairoaksd', 10, 30), terms('helotes', 5, 45)],
  contract: [],
  billing: new Map([
    ['fairoaksd', bills([app('fairoaksd', { retainage_pct: 10, work_to_date: 100000, retainage: 10000, due: 90000, certified: 90000, certified_on: '2026-08-31', sent_on: '2026-08-31' })])],
    ['helotes', bills([app('helotes', { retainage_pct: 5, work_to_date: 40000, retainage: 2000, due: 38000, certified: 38000, certified_on: '2026-09-12', sent_on: '2026-09-10' })])],
  ]),
  names: {},
  payDays: { cibolo: 20 },
}

describe('a customer’s money across their jobs', () => {
  const s = board()
  const cibolo = s.customers.find((c) => c.id === s.projects.find((p) => p.id === 'fairoaksd')!.customerId)!
  const view = customerMoneyView(s, rows, cibolo)

  it('lays the billing on their jobs of ours and finds every job of theirs by the board’s customer, the copies kept', () => {
    expect(customerBilledJobIds(s, cibolo.id).sort()).toEqual(['fairoaksd', 'helotes'])
    expect(view.jobs.map((p) => p.id).sort()).toEqual(s.projects.filter((p) => p.customerId === cibolo.id).map((p) => p.id).sort())
    for (const id of ['fairoaksd', 'helotes']) expect(view.jobs.find((p) => p.id === id)!.customerId).toBe(jobCustomerId(cibolo.id, id))
    expect(['fairoaksd', 'helotes'].map((id) => view.state.customers.find((c) => c.id === jobCustomerId(cibolo.id, id))!.retainagePct)).toEqual([10, 5])
  })

  it('gives each job the due day and the holding Bill the customer gives it', () => {
    for (const id of ['fairoaksd', 'helotes']) {
      const alone = billingStateFor(s, id, rows)
      const there = alone.projects.find((p) => p.id === id)!
      const here = view.jobs.find((p) => p.id === id)!
      const sent = ownerPayAppsSent(here)[0]!
      expect(ownerPayDue(view.state, here, sent)).toEqual(ownerPayDue(alone, there, ownerPayAppsSent(there)[0]!))
      expect(ownerAccount(here)).toEqual(ownerAccount(there))
    }
    const fair = view.jobs.find((p) => p.id === 'fairoaksd')!
    expect(ownerPayDue(view.state, fair, ownerPayAppsSent(fair)[0]!).on).toBe('2026-09-20')
  })

  it('would lose the customer’s days to pay if the copies were mapped back to the customer (gc 5’s catch)', () => {
    expect(cibolo.id).toBe('cibolo')
    const mapped: GcState = { ...view.state, projects: view.state.projects.map((p) => ({ ...p, customerId: s.projects.find((b) => b.id === p.id)!.customerId })) }
    const fair = mapped.projects.find((p) => p.id === 'fairoaksd')!
    // Mapped back, a job reads the customer record's own days to pay, not the 20 the billing gave its copy.
    const due = ownerPayDue(mapped, fair, ownerPayAppsSent(fair)[0]!).on
    expect(due).not.toBe('2026-09-20')
    expect(cibolo.payDays).not.toBe(20)
  })

  it('sums the jobs: what they owe, what they hold and what is billed; their bids and their record counted once', () => {
    const accounts = ['fairoaksd', 'helotes'].map((id) => ownerAccount(billingStateFor(s, id, rows).projects.find((p) => p.id === id)!)!)
    expect(view.summary.retainageHeld).toBe(accounts.reduce((t, a) => t + a.retainageHeld, 0))
    expect(view.summary.owed).toBe(accounts.reduce((t, a) => t + a.owed, 0))
    expect(view.summary.billed).toBe(accounts.reduce((t, a) => t + a.billed, 0))
    expect(view.summary.retainageHeld).toBe(12000)
    const before = customerSummary(s, cibolo)
    expect(view.summary.inFront).toBe(before.inFront)
    expect(view.summary.underContract).toBe(before.underContract)
    expect([view.summary.asked, view.summary.won]).toEqual([before.asked, before.won])
  })

  it('lists each job’s money papers after our contract, the late bill on Fair Oaks and none on Helotes', () => {
    const docs = customerMoneyDocuments(view, cibolo)
    const fair = docs.groups.find((g) => g.docs.some((d) => d.projectId === 'fairoaksd'))!
    const helotes = docs.groups.find((g) => g.docs.some((d) => d.projectId === 'helotes'))!
    expect(fair.docs.map((d) => d.key)).toEqual(['contract-fairoaksd', 'owner-payapps-fairoaksd', 'payapp-fairoaksd-1'])
    expect(helotes.docs.map((d) => d.key)).toEqual(['contract-helotes', 'owner-payapps-helotes'])
    expect(fair.docs[2]!.meta).toContain('$90,000 open')
  })

  it('Activity adds each job’s pay applications once, to everything the board knows, their calls once', () => {
    const events = customerMoneyActivity(view, cibolo)
    const board = customerActivity(s, cibolo)
    expect(events.filter((e) => e.kind !== 'money')).toEqual(board.filter((e) => e.kind !== 'money'))
    expect(events.filter((e) => e.text.startsWith('Pay application 1 sent')).map((e) => e.projectId).sort()).toEqual(['fairoaksd', 'helotes'])
    expect(events.map((e) => e.on)).toEqual([...events.map((e) => e.on)].sort().reverse())
  })
})
