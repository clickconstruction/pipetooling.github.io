/** Made-up deals for the in-kind render tests (punch list #301). Calloway Holdings and Lone Oak Concrete are not real. */
import type { InKindLedgerData, InKindLedgerJob } from '../../lib/inKind/inKindIo'

const job = (id: string, hcp: string, name: string, revenue: number, paid: number, status: string, billedAt: string, arrangementId: string | null): InKindLedgerJob => ({
  id,
  hcp_number: hcp,
  click_number: null,
  job_name: name,
  status,
  revenue,
  payments_made: paid,
  created_at: billedAt,
  in_kind_arrangement_id: arrangementId,
  invoices: [{ id: `inv-${id}`, job_id: id, amount: revenue, status: paid >= revenue ? 'paid' : 'billed', billed_at: billedAt, stripe_invoice_id: null }],
})

/** The landlord: a monthly rent credit, one line by the ledger, one payment typed by hand before it. */
export function rentDeal(): InKindLedgerData {
  const jobs = [
    job('j1', '1101', 'Shop restroom rough-in', 2140, 2140, 'paid', '2026-05-01T12:00:00Z', 'a1'),
    job('j2', '1120', 'Hose bibs and yard line', 1480, 799.5, 'billed', '2026-05-02T12:00:00Z', 'a1'),
    job('j3', '1126', 'Gas line to the shop heater', 1912.4, 0, 'billed', '2026-05-03T12:00:00Z', 'a1'),
  ]
  return {
    arrangement: {
      id: 'a1',
      customer_id: 'c1',
      partner_name: 'Calloway Holdings',
      what_given: 'Rent credit, the shop',
      note: 'We pay half the rent.',
      monthly_amount: 1500,
      monthly_due: 3000,
      bank_payee: 'Calloway',
      starts_on: '2026-09-01',
      ended_at: null,
    },
    jobs,
    lines: [
      { id: 'l1', arrangement_id: 'a1', given_on: '2026-09-03', amount: 1500, memo: 'Rent credit, September 2026', cost_job_id: null, for_month: '2026-09-01', removed_at: null },
      { id: 'l0', arrangement_id: 'a1', given_on: '2026-08-03', amount: 200, memo: 'Entered twice by mistake', cost_job_id: null, for_month: null, removed_at: '2026-08-04T00:00:00Z' },
    ],
    payments: [
      { id: 'p1', job_id: 'j1', invoice_id: 'inv-j1', amount: 700.5, paid_on: '2026-09-03', note: 'Rent credit, September 2026: $700.50 of the $1,500.00 given', line_id: 'l1' },
      { id: 'p2', job_id: 'j2', invoice_id: 'inv-j2', amount: 799.5, paid_on: '2026-09-03', note: 'Rent credit, September 2026: $799.50 of the $1,500.00 given', line_id: 'l1' },
      { id: 'p0', job_id: 'j1', invoice_id: 'inv-j1', amount: 1439.5, paid_on: '2026-05-01', note: 'Rent credit, May 2026', line_id: null },
    ],
    costJobs: new Map(jobs.map((j) => [j.id, { id: j.id, hcp_number: j.hcp_number, click_number: j.click_number, job_name: j.job_name }])),
  }
}

/** A partner who gives as it comes: three loads of concrete, one counted on a job. */
export function concreteDeal(): InKindLedgerData {
  const jobs = [job('j9', '1171', 'Batch plant wash rack', 6800, 3540, 'billed', '2026-09-30T12:00:00Z', 'a2')]
  return {
    arrangement: { id: 'a2', customer_id: 'c2', partner_name: 'Lone Oak Concrete', what_given: 'Concrete, as delivered', note: '', monthly_amount: null, monthly_due: null, bank_payee: '', starts_on: null, ended_at: null },
    jobs,
    lines: [
      { id: 'c3', arrangement_id: 'a2', given_on: '2026-11-04', amount: 885, memo: '6 yards of 3000 psi, the yard pad behind the shop', cost_job_id: null, for_month: null, removed_at: null },
      { id: 'c2', arrangement_id: 'a2', given_on: '2026-10-22', amount: 1475, memo: '10 yards, the slab patch at Oak Hollow', cost_job_id: 'oak', for_month: null, removed_at: null },
      { id: 'c1', arrangement_id: 'a2', given_on: '2026-10-09', amount: 1180, memo: '8 yards of 3000 psi, the shop apron', cost_job_id: null, for_month: null, removed_at: null },
    ],
    payments: [
      { id: 'q3', job_id: 'j9', invoice_id: 'inv-j9', amount: 885, paid_on: '2026-11-04', note: null, line_id: 'c3' },
      { id: 'q2', job_id: 'j9', invoice_id: 'inv-j9', amount: 1475, paid_on: '2026-10-22', note: null, line_id: 'c2' },
      { id: 'q1', job_id: 'j9', invoice_id: 'inv-j9', amount: 1180, paid_on: '2026-10-09', note: null, line_id: 'c1' },
    ],
    costJobs: new Map([
      ['j9', { id: 'j9', hcp_number: '1171', click_number: null, job_name: 'Batch plant wash rack' }],
      ['oak', { id: 'oak', hcp_number: '1158', click_number: null, job_name: 'Oak Hollow Building C' }],
    ]),
  }
}
