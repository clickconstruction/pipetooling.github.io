/**
 * Bill the customer's pure part (./billCustomer.ts): the job's billing laid over the board's project, and what
 * Send hands `gc_send_owner_pay_app`. The send is checked as a round trip: the payload written out as the rows
 * the function inserts, read back by O5a's mapper, is the record `ownerPayAppToSend` makes.
 */
import { describe, expect, it } from 'vitest'
import { type ContractLineRow, type OwnerTermsRow, billingStateFor, contractWorthFromRows, payAppSendPayload } from './billCustomer'
import { ownerPayApp, ownerPayAppToSend, ownerRetainageWords } from './ownerBilling'
import { type OwnerBillingRows, ownerBillingFromRows } from './ownerBillingRows'
import { initialGcState } from './schedule/testState'

const PROJECT = 'fairoaksd'
const TODAY = '2026-10-25'

const terms = (over: Partial<OwnerTermsRow> = {}): OwnerTermsRow => ({
  project_id: PROJECT,
  owner_retainage_pct: 5,
  owner_retainage_step_at_pct: null,
  owner_retainage_step_to_pct: null,
  owner_retainage_step_way: null,
  owner_pay_days: 30,
  billing_job_id: null,
  property_owner_customer_id: null,
  ...over,
})

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

describe('Bill the customer', () => {
  it('keys the signed price the kernels\' way, and reads nothing signed as not signed', () => {
    const lines: ContractLineRow[] = [
      { project_id: PROJECT, line: 'trade', package_id: 'pkg-1', worth: 100000 },
      { project_id: PROJECT, line: 'gc', package_id: null, worth: 10000 },
      { project_id: PROJECT, line: 'fee', package_id: null, worth: 8800 },
    ]
    expect(contractWorthFromRows(lines)).toEqual({ 'pkg-1': 100000, gc: 10000, fee: 8800 })
    expect(contractWorthFromRows([])).toBeUndefined()
  })

  it('lays the job\'s retainage, its step, the property\'s owner and its record over the board\'s project', () => {
    const s = initialGcState()
    const project = s.projects.find((p) => p.id === PROJECT)!
    const empty: OwnerBillingRows = { payApps: [], lines: [], reminders: [], interestBills: [], acceptance: null }
    const laid = billingStateFor(
      s,
      PROJECT,
      terms({ owner_retainage_step_at_pct: 50, owner_retainage_step_to_pct: 2.5, owner_retainage_step_way: 'after', property_owner_customer_id: 'cust-hc' }),
      [{ project_id: PROJECT, line: 'gc', package_id: null, worth: 1 }],
      empty,
      { 'cust-hc': 'Hill Country Holdings' },
    )
    const p = laid.projects.find((x) => x.id === PROJECT)!
    expect(laid.customers.find((c) => c.id === project.customerId)?.retainagePct).toBe(5)
    expect(p.ownerRetainageStep).toEqual({ atPct: 50, toPct: 2.5, way: 'after' })
    expect(p.ownerContractWorth).toEqual({ gc: 1 })
    expect(p.propertyOwner).toBe('Hill Country Holdings')
    // No bill went yet: the kernels read no record.
    expect(p.ownerBilling).toBeNull()
    expect(ownerPayApp(laid, p).number).toBe(1)
    expect(ownerRetainageWords(ownerPayApp(laid, p).retainagePct, p.ownerRetainageStep)).toBe('5% until the work is half done, then 2.5% on the rest')
    // Every other project is the board's.
    expect(laid.projects.filter((x) => x.id !== PROJECT)).toEqual(s.projects.filter((x) => x.id !== PROJECT))
  })

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
