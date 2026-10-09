/**
 * The state our money screens read (./billCustomer.ts): billing laid over the board's projects, each job with
 * its own copy of its customer carrying the job's retainage and the customer's usual days to pay. And what
 * Bill the customer's Send hands the database, read back as the record it went as.
 */
import { describe, expect, it } from 'vitest'
import { type BillingRows, type OwnerTermsRow, billingStateFor, billingStateForAll, contractWorthFromRows, jobCustomerId, payAppSendPayload } from './billCustomer'
import { allJobsMoney, ownerPayApp, ownerPayAppToSend, ownerRetainageWords } from './ownerBilling'
import { type OwnerBillingRows, ownerBillingFromRows } from './ownerBillingRows'
import { initialGcState } from './schedule/testState'

const terms = (projectId: string, over: Partial<OwnerTermsRow> = {}): OwnerTermsRow => ({
  project_id: projectId,
  owner_retainage_pct: 10,
  owner_retainage_step_at_pct: null,
  owner_retainage_step_to_pct: null,
  owner_retainage_step_way: null,
  owner_pay_days: null,
  owner_late_interest_pct_per_month: null,
  owner_late_finish_per_day: null,
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

  it('lays the interest and the late fee on a job that has them, and none on one that does not (O6b-1)', () => {
    const s = initialGcState()
    const rows: BillingRows = {
      terms: [terms('fairoaksd', { owner_late_interest_pct_per_month: 1.5, owner_late_finish_per_day: 500 }), terms('helotes')],
      contract: [],
      billing: new Map(),
      names: {},
      payDays: {},
    }
    const laid = billingStateForAll(s, rows)
    const fair = laid.projects.find((p) => p.id === 'fairoaksd')!
    const helotes = laid.projects.find((p) => p.id === 'helotes')!
    expect([fair.ownerLateInterest, fair.ownerLateFinish]).toEqual([{ pctPerMonth: 1.5 }, { perDay: 500 }])
    expect([helotes.ownerLateInterest, helotes.ownerLateFinish]).toEqual([s.projects.find((p) => p.id === 'helotes')!.ownerLateInterest, s.projects.find((p) => p.id === 'helotes')!.ownerLateFinish])
  })

  it('lays the contract\'s days to pay on each job, standing in while the customer has never paid us (O5d)', () => {
    const s = initialGcState()
    const rows: BillingRows = { terms: [terms('fairoaksd', { owner_pay_days: 30 }), terms('helotes', { owner_pay_days: 45 })], contract: [], billing: new Map(), names: {}, payDays: { cibolo: 41 } }
    const laid = billingStateForAll(s, rows)
    expect(['fairoaksd', 'helotes'].map((id) => laid.projects.find((p) => p.id === id)!.ownerPayDays)).toEqual([30, 45])
    expect(billingStateForAll(s, { ...rows, terms: [terms('fairoaksd')] }).projects.find((p) => p.id === 'fairoaksd')!.ownerPayDays).toBeNull()
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

describe('the pay application Send hands the database', () => {
  const PROJECT = 'fairoaksd'
  const TODAY = '2026-10-25'

  /** The payload as `gc_send_owner_pay_app` inserts it: one pay application and its lines in order. */
  function rowsFromSend(projectId: string, send: ReturnType<typeof payAppSendPayload>): OwnerBillingRows {
    const id = `app-${send.number}`
    return {
      payApps: [
        {
          id,
          project_id: projectId,
          number: send.number,
          final: send.final,
          period_to: send.periodTo,
          sent_on: send.sentOn,
          sent_by: null,
          retainage_pct: send.retainagePct,
          retainage_step_at_pct: send.retainageStep?.atPct ?? null,
          retainage_step_to_pct: send.retainageStep?.toPct ?? null,
          retainage_step_way: send.retainageStep?.way ?? null,
          retainage: send.retainage,
          work_to_date: send.workToDate,
          due: send.due,
          certified: null,
          certified_on: null,
          certified_note: '',
          certified_by: null,
          invoice_id: null,
          conditional_waiver_id: null,
          created_at: `${send.sentOn}T15:00:00Z`,
        },
      ],
      lines: send.lines.map((l, i) => ({
        id: `${id}-${i}`,
        pay_app_id: id,
        position: i + 1,
        line: l.line,
        package_id: l.packageId,
        change_order_id: l.changeOrderId,
        label: l.label,
        worth: l.worth,
        done_to_date: l.doneToDate,
        stored: l.stored,
      })),
      reminders: [],
      interestBills: [],
      acceptance: null,
    }
  }

  it('sends the draft as it will read back: the record ownerPayAppToSend makes, line for line', () => {
    const s = initialGcState()
    const project = s.projects.find((p) => p.id === PROJECT)!
    const draft = ownerPayApp(s, project)
    const send = payAppSendPayload(draft, TODAY)
    // The server checks this sum against the lines.
    expect(Math.abs(send.workToDate - send.lines.reduce((t, l) => t + l.doneToDate + l.stored, 0))).toBeLessThan(0.01)
    expect(send.lines.map((l) => l.line)).toEqual(draft.lines.map((l) => ({ trade: 'trade', self: 'self', generalConditions: 'gc', contingency: 'contingency', fee: 'fee', changeOrder: 'change_order' })[l.kind]))
    expect(send.lines.filter((l) => l.line === 'gc' || l.line === 'fee').every((l) => l.packageId === null && l.changeOrderId === null)).toBe(true)

    const back = ownerBillingFromRows(rowsFromSend(PROJECT, send))!.payApps![0]!
    const record = ownerPayAppToSend(draft, TODAY)
    expect(back).toEqual({ ...record, certified: null, certifiedOn: null })
  })
})
