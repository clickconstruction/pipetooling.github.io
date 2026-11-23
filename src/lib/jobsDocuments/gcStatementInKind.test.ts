import { describe, expect, it } from 'vitest'
import { buildGcReviewShareAllEmailHtml, buildGcReviewShareAllEmailText, buildGcStatementEmailHtml, buildGcStatementEmailText } from './gcStatementEmail'
import { buildGcStatementReportHtml } from './gcStatementReport'
import {
  applyPaymentRule,
  attachJobTotals,
  payloadJobIds,
  renderGcShareAllHtml,
  renderGcShareAllText,
  renderGcStatementHtml,
  renderGcStatementText,
  setInKindApart,
  type GcStatementPayload,
  type GcStatementPayloadGroup,
  type GcStatementPayloadRow,
} from '../../../supabase/functions/gc-statement-email-dispatch/render'
import { statementInKindLine } from '../../../supabase/functions/_shared/gcStatementByProperty'
import { gcStatementGate } from '../../../supabase/functions/_shared/gcStatementGate'
import type { GcReviewGroup } from '../gcReviewRollup'

/**
 * A GC's statement leaves out a bill an in kind deal pays (v2.8309, punch list #301; the owner's call of
 * 2026-11-22). The payload RPC keeps such a bill off `rows` and every sum, in `in_kind_rows`
 * (migration 20261123010000), and GC Review's rollup leaves it out of a group and counts it in `inKind`.
 * Both lanes then say one line under the total, in the same words the office reads.
 */

const DATE = 'Nov 22, 2026'
const LINE = '$1,200 on 2 bills is scheduled in kind, not money owed.'

const moneyBill = [{ id: 'i1', amount: 800, status: 'billed', sequence_order: 1, billed_at: '2026-10-20' }]
/** Job 3 is on a deal. Its $900 bill has a $200 credit linked to it and $100 put on the job with no bill picked. */
const dealBills = [{ id: 'i3', amount: 900, status: 'billed', sequence_order: 1, billed_at: '2026-09-01' }]
const dealPayments = [
  { invoice_id: 'i3', amount: 200, paid_on: '2026-10-01', payment_type: 'in_kind', reference_number: null, sequence_order: 1 },
  { invoice_id: null, amount: 100, paid_on: '2026-10-05', payment_type: 'in_kind', reference_number: null, sequence_order: 2 },
]

const row = (over: Partial<GcStatementPayloadRow> & Pick<GcStatementPayloadRow, 'job_id' | 'remaining'>): GcStatementPayloadRow => ({
  row_key: over.invoice_id ?? over.job_id,
  display_number: '900',
  job_name: 'Rough in',
  job_address: '12 Larch Way, Austin TX',
  customer_name: 'Kestrin',
  ref_date: '2026-10-20',
  ref_is_estimate: false,
  age_days: 33,
  in_collections: false,
  ...over,
})

/** The payload as the RPC answers it: the money bill in `rows`, the deal's two in `in_kind_rows`, sums of the money alone. */
function payload(): GcStatementPayload {
  const kestrin: GcStatementPayloadGroup = {
    entity_id: 'gc-1',
    entity_name: 'Kestrin Contracting',
    is_no_entity: false,
    job_count: 1,
    subtotal: 800,
    oldest_age_days: 33,
    rows: [row({ job_id: 'j1', remaining: 800, invoice_id: 'i1', invoice_amount: 800, job_bills: moneyBill, job_payments: [] })],
    in_kind_rows: [
      // By the RPC's own netting (linked money only) this row is $700 open; the rule makes it $600.
      row({ job_id: 'j3', remaining: 700, invoice_id: 'i3', invoice_amount: 900, job_bills: dealBills, job_payments: dealPayments, ref_date: '2026-09-01', age_days: 82 }),
      row({ job_id: 'j4', remaining: 600, row_key: 'j4', ref_date: null, age_days: null }),
    ],
    in_kind: { count: 2, dollars: 1300 },
  }
  /** A GC whose every bill is on a deal: the RPC keeps the group with no rows. */
  const lowbeck: GcStatementPayloadGroup = {
    entity_id: 'gc-2',
    entity_name: 'Lowbeck Contracting',
    is_no_entity: false,
    job_count: 0,
    subtotal: 0,
    oldest_age_days: null,
    rows: [],
    in_kind_rows: [row({ job_id: 'j5', remaining: 450, row_key: 'j5' })],
    in_kind: { count: 1, dollars: 450 },
  }
  return { generated_at: '2026-11-22T15:00:00Z', group_by: 'gc', include_collections: false, grand_total: 800, groups: [kestrin, lowbeck], in_kind: { count: 3, dollars: 1750 } }
}

/** The dispatcher's steps on a payload: each job's total read beside it, the payment rule, then the deal's bills counted. */
function built(): GcStatementPayload {
  const p = payload()
  attachJobTotals(p, { j1: 800, j3: 900, j4: 600, j5: 450 })
  applyPaymentRule(p)
  setInKindApart(p)
  return p
}

/** The same payer as GC Review's rollup hands it over: the money bill in `rows`, the deal's two counted. */
const clientGroup: GcReviewGroup = {
  key: 'gc-1',
  gcId: 'gc-1',
  gcName: 'Kestrin Contracting',
  isNoGc: false,
  jobCount: 1,
  subtotal: 800,
  oldestAgeDays: 33,
  rows: [{ key: 'i1', jobId: 'j1', hcp: '900', jobName: 'Rough in', jobAddress: '12 Larch Way, Austin TX', customerName: 'Kestrin', referenceDateDisplay: 'Oct 20, 2026', referenceYmd: '2026-10-20', referenceIsEstimate: false, ageDays: 33, remaining: 800, inCollections: false, paidBy: 'Nothing applied yet', propertyId: null, billed: 800, billPayments: [], retainageHeld: null, unmatchedOnJob: 0 }],
  inKind: { count: 2, dollars: 1200 },
}

describe('the payload with a deal\'s bills set apart', () => {
  it('reads the totals of the deal\'s jobs too, so its bills are netted by the same rule', () => {
    expect(payloadJobIds(payload()).sort()).toEqual(['j1', 'j3', 'j4', 'j5'])
  })

  it('counts each group by the payment rule, and the payload as their sum', () => {
    const p = built()
    // $900 less the $200 linked and the $100 on the job is $600, with the $600 job balance beside it.
    expect(p.groups[0]!.in_kind).toEqual({ count: 2, dollars: 1200 })
    expect(p.in_kind).toEqual({ count: 3, dollars: 1650 })
  })

  it('leaves the money alone: the same rows, subtotal and grand total', () => {
    const p = built()
    expect(p.groups[0]!.rows.map((r) => r.job_id)).toEqual(['j1'])
    expect(p.groups[0]!.subtotal).toBe(800)
    expect(p.grand_total).toBe(800)
  })

  it('drops a payer whose every bill is on a deal: nothing is owed, so no statement and no section', () => {
    expect(built().groups.map((g) => g.entity_id)).toEqual(['gc-1'])
  })

  it('a bill a credit has paid off is not counted', () => {
    const p = payload()
    p.groups[0]!.in_kind_rows = [row({ job_id: 'j4', remaining: 0, row_key: 'j4' })]
    applyPaymentRule(p)
    setInKindApart(p)
    expect(p.groups[0]!.in_kind).toEqual({ count: 0, dollars: 0 })
  })

  it('a payload from before the migration sets nothing apart', () => {
    const p = payload()
    for (const g of p.groups) {
      delete g.in_kind_rows
      delete g.in_kind
    }
    p.groups = p.groups.filter((g) => g.rows.length > 0)
    delete p.in_kind
    applyPaymentRule(p)
    setInKindApart(p)
    expect(p.in_kind).toEqual({ count: 0, dollars: 0 })
    expect(renderGcStatementText(p.groups[0]!, DATE)).not.toContain('in kind')
  })

  it('the week\'s check compares the money bills alone, so a checked statement is not held over a deal\'s bill', () => {
    const live = built().groups[0]!.rows.map((r) => ({ jobId: r.job_id, remaining: r.remaining }))
    const cert = { certified_at: '2026-11-18T15:00:00Z', total: 800, snapshot: { rows: [{ key: 'i1', jobId: 'j1', remaining: 800 }] } }
    expect(gcStatementGate(live, [cert]).ok).toBe(true)
  })
})

describe('the statement says one line, the same in every lane', () => {
  it('the words', () => {
    expect(statementInKindLine({ count: 2, dollars: 1200 })).toBe(LINE)
    expect(statementInKindLine({ count: 1, dollars: 450.4 })).toBe('$450 on 1 bill is scheduled in kind, not money owed.')
    expect(statementInKindLine({ count: 0, dollars: 0 })).toBe('')
    expect(statementInKindLine(null)).toBe('')
  })

  it('HTML: Draft Message == the scheduled dispatcher, with the line once under the total', () => {
    const client = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE })
    const server = renderGcStatementHtml(built().groups[0]!, DATE)
    expect(client).toBe(server)
    expect(client.split(LINE).length - 1).toBe(1)
    expect(client.indexOf(LINE)).toBeGreaterThan(client.indexOf('Total owed'))
  })

  it('text: the plain twins match, and the deal\'s bills are listed nowhere', () => {
    const client = buildGcStatementEmailText(clientGroup, { dateStr: DATE })
    const server = renderGcStatementText(built().groups[0]!, DATE)
    expect(client).toBe(server)
    expect(client).toContain(['Total owed: $800.00', LINE].join('\n'))
    expect(client).toContain('Owed now: $800.00')
    expect(client).not.toContain('$600.00')
  })

  it('the whole report: both lanes say the line for the sections they print', () => {
    const p = built()
    const report = { groups: [clientGroup], grandTotal: 800 }
    for (const body of [buildGcReviewShareAllEmailHtml(report, { dateStr: DATE }), renderGcShareAllHtml({ ...p, in_kind: p.groups[0]!.in_kind }, DATE)]) {
      expect(body.split(LINE).length - 1).toBe(1)
      expect(body).not.toContain('Lowbeck')
    }
    for (const body of [buildGcReviewShareAllEmailText(report, { dateStr: DATE }), renderGcShareAllText({ ...p, in_kind: p.groups[0]!.in_kind }, DATE)]) {
      expect(body).toContain(['Total owed: $800.00', LINE].join('\n'))
    }
  })

  it('a payer with no deal reads as before: no line in any lane', () => {
    const plain: GcReviewGroup = { ...clientGroup, inKind: { count: 0, dollars: 0 } }
    for (const body of [
      buildGcStatementEmailHtml(plain, { dateStr: DATE }),
      buildGcStatementEmailText(plain, { dateStr: DATE }),
      buildGcReviewShareAllEmailHtml({ groups: [plain], grandTotal: 800 }, { dateStr: DATE }),
      buildGcReviewShareAllEmailText({ groups: [plain], grandTotal: 800 }, { dateStr: DATE }),
      buildGcStatementReportHtml([plain]),
    ]) {
      expect(body).not.toContain('in kind')
    }
  })

  it('the printed sheet says it too', () => {
    expect(buildGcStatementReportHtml([clientGroup])).toContain(LINE)
  })
})
