import { describe, expect, it } from 'vitest'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { billedBreakdownTotal, buildBilledByCustomerBreakdown } from './billedByCustomerBreakdown'

const NOW = new Date('2026-08-20T12:00:00Z')

function job(overrides: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'j1',
    job_name: 'Job',
    customer_id: 'c1',
    customer_name: 'Acme GC',
    hcp_number: '100',
    click_number: null,
    revenue: 10_000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...overrides,
  } as unknown as JobWithDetails
}

function invRow(
  j: JobWithDetails,
  overrides: Partial<Record<string, unknown>> & { id: string; amount: number },
): StageRow {
  return {
    kind: 'invoice',
    job: j,
    inv: {
      job_id: j.id,
      status: 'billed',
      sequence_order: 0,
      billed_at: null,
      estimated_bill_date: null,
      is_primary_rtb_bundle: false,
      ...overrides,
    },
  } as unknown as StageRow
}

describe('buildBilledByCustomerBreakdown', () => {
  it('groups bills by customer, sums remainders, tracks worst age, sorts groups by total desc', () => {
    const acmeJobA = job({ id: 'ja', job_name: 'Tower A', hcp_number: '101' })
    const acmeJobB = job({ id: 'jb', job_name: 'Tower B', hcp_number: '102' })
    const zeta = job({ id: 'jz', customer_id: 'c2', customer_name: 'Zeta Homes', job_name: 'Zeta job', hcp_number: '200' })
    const rows = [
      invRow(acmeJobA, { id: 'i1', amount: 1000, estimated_bill_date: '2026-08-15' }), // 5d
      invRow(acmeJobB, { id: 'i2', amount: 2000, estimated_bill_date: '2026-05-01' }), // 111d
      invRow(zeta, { id: 'i3', amount: 5000, estimated_bill_date: '2026-08-01' }), // 19d
    ]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups.map((g) => g.customerName)).toEqual(['Zeta Homes', 'Acme GC'])
    const acme = groups[1]!
    expect(acme.total).toBe(3000)
    expect(acme.count).toBe(2)
    expect(acme.worstAgeDays).toBe(111)
    // Oldest first within the group.
    expect(acme.bills.map((b) => b.invoiceId)).toEqual(['i2', 'i1'])
    expect(billedBreakdownTotal(groups)).toBe(8000)
  })

  it('bill amounts net payments applied to that invoice; fully-applied rows drop out', () => {
    const j = job({
      id: 'jp',
      payments: [
        { invoice_id: 'i1', amount: 400 },
        { invoice_id: 'i2', amount: 1000 },
      ] as unknown as JobWithDetails['payments'],
    })
    const rows = [invRow(j, { id: 'i1', amount: 1000 }), invRow(j, { id: 'i2', amount: 1000 })]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.bills).toHaveLength(1)
    expect(groups[0]!.bills[0]!.amount).toBe(600)
  })

  it('job-shell rows use revenue − payments and jump by jobId; undated bills sort last with null age', () => {
    const shellJob = job({ id: 'js', revenue: 4000, payments_made: 1000 })
    const rows: StageRow[] = [
      { kind: 'job', job: shellJob } as unknown as StageRow,
      invRow(shellJob, { id: 'i9', amount: 500, estimated_bill_date: '2026-08-10' }),
    ]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    const bills = groups[0]!.bills
    expect(bills.map((b) => b.invoiceId)).toEqual(['i9', null])
    expect(bills[1]!.jobId).toBe('js')
    expect(bills[1]!.amount).toBe(3000)
    expect(bills[1]!.ageDays).toBeNull()
    expect(groups[0]!.worstAgeDays).toBe(10)
  })

  it('ages by billed_at when no est. bill date is set; a hand-set date wins and is flagged (v2.2130)', () => {
    const j = job({ id: 'jf' })
    const rows = [
      invRow(j, { id: 'b1', amount: 1000, billed_at: '2026-07-04T15:00:00Z' }), // 47d, app-stamped
      invRow(j, { id: 'b2', amount: 1000, billed_at: '2026-08-18T15:00:00Z', estimated_bill_date: '2026-03-01' }), // 172d, hand-set
      invRow(j, { id: 'b3', amount: 1000 }), // nothing → no date
    ]
    const g = buildBilledByCustomerBreakdown(rows, NOW)[0]!
    expect(g.bills.map((b) => [b.invoiceId, b.ageDays, b.ageHandSet])).toEqual([
      ['b2', 172, true],
      ['b1', 47, false],
      ['b3', null, false],
    ])
    expect(g.worstAgeDays).toBe(172)
    expect(g.worstAgeHandSet).toBe(true)
  })

  it('missing customer groups under "No customer" keyed by name; blank name jobs merge there', () => {
    const a = job({ id: 'n1', customer_id: null, customer_name: '', job_name: 'Orphan 1' })
    const b = job({ id: 'n2', customer_id: null, customer_name: null, job_name: 'Orphan 2' })
    const rows = [invRow(a, { id: 'i1', amount: 100 }), invRow(b, { id: 'i2', amount: 200 })]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.customerName).toBe('No customer')
    expect(groups[0]!.total).toBe(300)
  })
})
