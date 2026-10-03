import { describe, expect, it } from 'vitest'
import { buildGcReviewRollup, GC_REVIEW_NO_DEVELOPMENT_KEY, GC_REVIEW_NO_GC_KEY } from './gcReviewRollup'
import type { StageRow } from './jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

const NOW = new Date('2026-07-31T12:00:00Z')

/** Fixture jobs with a GC are GC-pays jobs (v2.3346) unless the test says otherwise. */
function job(over: Partial<JobWithDetails> & Pick<JobWithDetails, 'id'>): JobWithDetails {
  return {
    status: 'billed',
    ...(over.gcCustomer ? { gc_customer_id: over.gcCustomer.id, bill_to_party: 'gc' } : {}),
    hcp_number: '100',
    click_number: '',
    job_name: 'Job',
    customer_name: 'Cust',
    revenue: 1000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...over,
  } as JobWithDetails
}

function invRow(over: Partial<Record<string, unknown>> & { id: string; job: JobWithDetails; amount: number }): StageRow {
  const { job: j, ...invOver } = over
  return {
    kind: 'invoice',
    job: j,
    inv: {
      job_id: j.id,
      status: 'billed',
      sequence_order: 0,
      billed_at: '2026-07-01T17:00:00Z',
      estimated_bill_date: null,
      ...invOver,
    } as never,
  }
}

const KNIGHT = { id: 'gc-knight', name: 'Knight Contracting' }
const LOBERG = { id: 'gc-loberg', name: 'Loberg Contracting' }

describe('buildGcReviewRollup', () => {
  it('each row carries what the statement by property reads: the property, the bill, the payments on it (v2.4255)', () => {
    const payments = [
      { id: 'p1', job_id: 'j1', invoice_id: 'i1', amount: 400, paid_on: '2026-07-10', payment_type: 'check', reference_number: '4821', sequence_order: 1 },
      // On the job, on no bill — the statement cannot count it toward either bill.
      { id: 'p2', job_id: 'j1', invoice_id: null, amount: 250, paid_on: '2025-12-19', payment_type: 'check', reference_number: '3001', sequence_order: 2 },
    ]
    const withBills = job({ id: 'j1', gcCustomer: KNIGHT, customer_address_id: 'prop-1', lien_retainage_held: 100, payments: payments as never })
    const shell = job({ id: 'j2', gcCustomer: KNIGHT, revenue: 900, payments_made: 250, payments: [{ ...payments[1], id: 'p3', job_id: 'j2' }] as never })
    const rollup = buildGcReviewRollup(
      [
        invRow({ id: 'i1', job: withBills, amount: 1000 }),
        invRow({ id: 'i2', job: withBills, amount: 300, billed_at: null, estimated_bill_date: '2026-07-20' }),
        { kind: 'job', job: shell } as StageRow,
      ],
      [],
      { now: NOW },
    )
    const rows = Object.fromEntries(rollup.groups[0]!.rows.map((r) => [r.key, r]))
    expect(rows.i1).toMatchObject({ propertyId: 'prop-1', referenceYmd: '2026-07-01', referenceIsEstimate: false, billed: 1000, remaining: 600, retainageHeld: 100, unmatchedOnJob: 250 })
    expect(rows.i1!.billPayments).toEqual([{ invoice_id: 'i1', amount: 400, paid_on: '2026-07-10', payment_type: 'check', reference_number: '4821', sequence_order: 1 }])
    expect(rows.i2).toMatchObject({ referenceYmd: '2026-07-20', referenceIsEstimate: true, billed: 300, remaining: 300, billPayments: [], unmatchedOnJob: 250 })
    // A job balance with no bill: every payment on the job is its own, and nothing is left unmatched.
    expect(rows.j2).toMatchObject({ propertyId: null, referenceYmd: null, billed: null, remaining: 650, unmatchedOnJob: 0 })
    expect(rows.j2!.billPayments).toHaveLength(1)
  })

  it('files a row under the GC only when the GC pays it (v2.3346)', () => {
    const gcPays = job({ id: 'j1', gcCustomer: KNIGHT })
    const ownerPays = job({ id: 'j2', gcCustomer: KNIGHT, bill_to_party: 'customer', customer_id: 'owner-2' })
    const gcIsCustomer = job({ id: 'j3', gcCustomer: LOBERG, bill_to_party: 'customer', customer_id: LOBERG.id })
    const invoicePick = job({ id: 'j4', gcCustomer: KNIGHT, bill_to_party: 'customer', customer_id: 'owner-4' })
    const tenant = job({ id: 'j5', gcCustomer: KNIGHT })
    const rollup = buildGcReviewRollup(
      [
        invRow({ id: 'i1', job: gcPays, amount: 100 }),
        invRow({ id: 'i2', job: ownerPays, amount: 200 }),
        invRow({ id: 'i3', job: gcIsCustomer, amount: 300 }),
        invRow({ id: 'i4', job: invoicePick, amount: 400, bill_to_party: 'gc' }),
        invRow({ id: 'i5', job: tenant, amount: 500, bill_to_email: 'tenant@x.com' }),
      ],
      [],
      { now: NOW },
    )
    const byKey = Object.fromEntries(rollup.groups.map((g) => [g.key, g.rows.map((r) => r.key)]))
    // rows sort largest-remaining first inside a group on equal dates
    expect(byKey['gc-knight']).toEqual(['i4', 'i1'])
    expect(byKey['gc-loberg']).toEqual(['i3'])
    expect(byKey[GC_REVIEW_NO_GC_KEY]).toEqual(['i5', 'i2'])
    expect(rollup.groups.find((g) => g.isNoGc)?.gcName).toBe('Not billed to a GC')
  })

  it('groups by GC with the No-GC bucket last and reconciling grand total', () => {
    const a = job({ id: 'j1', gcCustomer: KNIGHT, customer_name: 'Rosemary Garza' })
    const b = job({ id: 'j2', gcCustomer: LOBERG })
    const c = job({ id: 'j3' }) // no GC
    const rollup = buildGcReviewRollup(
      [
        invRow({ id: 'i1', job: a, amount: 700 }),
        invRow({ id: 'i2', job: b, amount: 200 }),
        invRow({ id: 'i3', job: c, amount: 500 }),
      ],
      [],
      { now: NOW },
    )
    expect(rollup.groups.map((g) => g.key)).toEqual(['gc-knight', 'gc-loberg', GC_REVIEW_NO_GC_KEY])
    expect(rollup.groups[2]!.gcName).toBe('Not billed to a GC')
    expect(rollup.grandTotal).toBe(1400)
    expect(rollup.groups[0]!.rows[0]!.customerName).toBe('Rosemary Garza')
  })

  it("groupBy: 'development' groups by the job's development with its own bucket label (v2.1204)", () => {
    const SAGE = { id: 'dev-sage', name: 'Sagebrush Phase 2' }
    const a = job({ id: 'j1', development: SAGE, gcCustomer: KNIGHT })
    const b = job({ id: 'j2', gcCustomer: LOBERG }) // GC but no development
    const rollup = buildGcReviewRollup(
      [invRow({ id: 'i1', job: a, amount: 700 }), invRow({ id: 'i2', job: b, amount: 200 })],
      [],
      { now: NOW, groupBy: 'development' },
    )
    expect(rollup.groups.map((g) => g.key)).toEqual(['dev-sage', GC_REVIEW_NO_DEVELOPMENT_KEY])
    expect(rollup.groups[0]!.gcName).toBe('Sagebrush Phase 2')
    expect(rollup.groups[1]!.gcName).toBe('No development set')
    expect(rollup.grandTotal).toBe(900)
  })

  it('counts distinct jobs when one job contributes several invoice rows', () => {
    const a = job({ id: 'j1', gcCustomer: KNIGHT })
    const rollup = buildGcReviewRollup(
      [invRow({ id: 'i1', job: a, amount: 100 }), invRow({ id: 'i2', job: a, amount: 50, sequence_order: 1 })],
      [],
      { now: NOW },
    )
    expect(rollup.groups[0]!.jobCount).toBe(1)
    expect(rollup.groups[0]!.rows).toHaveLength(2)
    expect(rollup.groups[0]!.subtotal).toBe(150)
  })

  it('collections rows are excluded by default but counted for the toggle label', () => {
    const a = job({ id: 'j1', gcCustomer: KNIGHT })
    const coll = job({ id: 'j2', gcCustomer: KNIGHT, collections_at: '2026-07-01' })
    const collectionRows = [invRow({ id: 'i2', job: coll, amount: 999 })]
    const excluded = buildGcReviewRollup([invRow({ id: 'i1', job: a, amount: 100 })], collectionRows, { now: NOW })
    expect(excluded.grandTotal).toBe(100)
    expect(excluded.collectionsCount).toBe(1)
    expect(excluded.collectionsTotal).toBe(999)

    const included = buildGcReviewRollup([invRow({ id: 'i1', job: a, amount: 100 })], collectionRows, {
      now: NOW,
      includeCollections: true,
    })
    expect(included.grandTotal).toBe(1099)
    expect(included.groups[0]!.rows.some((r) => r.inCollections)).toBe(true)
  })

  it('uses the actual billed date with days-since; est fallback is marked', () => {
    const a = job({ id: 'j1', gcCustomer: KNIGHT })
    const rollup = buildGcReviewRollup(
      [
        invRow({ id: 'i1', job: a, amount: 100, billed_at: '2026-07-01T17:00:00Z' }),
        invRow({ id: 'i2', job: a, amount: 50, billed_at: null, estimated_bill_date: '2026-07-21' }),
      ],
      [],
      { now: NOW },
    )
    const rows = rollup.groups[0]!.rows
    expect(rows[0]!.ageDays).toBe(30) // Jul 1 → Jul 31, oldest first
    expect(rows[1]!.ageDays).toBe(10)
    expect(rows[1]!.referenceDateDisplay).toContain('(est.)')
  })

  it('subtracts invoice payments from remaining', () => {
    const a = job({ id: 'j1', gcCustomer: KNIGHT, payments: [{ invoice_id: 'i1', amount: 400 }] as never })
    const rollup = buildGcReviewRollup([invRow({ id: 'i1', job: a, amount: 1000 })], [], { now: NOW })
    expect(rollup.groups[0]!.subtotal).toBe(600)
  })

  it('sorts rows by address A→Z, blank addresses last, age as the tiebreak (v2.1434)', () => {
    const zeta = job({ id: 'j1', gcCustomer: KNIGHT, job_address: '200 Zeta St' })
    const alpha = job({ id: 'j2', gcCustomer: KNIGHT, job_address: '100 Alpha Ave' })
    const blank = job({ id: 'j3', gcCustomer: KNIGHT, job_address: '' })
    const rollup = buildGcReviewRollup(
      [
        // Oldest bill on the blank-address job — address still wins the sort.
        invRow({ id: 'i1', job: blank, amount: 10, billed_at: '2026-06-01T17:00:00Z' }),
        invRow({ id: 'i2', job: zeta, amount: 20, billed_at: '2026-07-01T17:00:00Z' }),
        invRow({ id: 'i3', job: alpha, amount: 30, billed_at: '2026-07-21T17:00:00Z' }),
      ],
      [],
      { now: NOW },
    )
    expect(rollup.groups[0]!.rows.map((r) => r.jobAddress)).toEqual(['100 Alpha Ave', '200 Zeta St', ''])
  })

  it('sorts GC groups by subtotal descending and rows oldest-first', () => {
    const small = job({ id: 'j1', gcCustomer: KNIGHT })
    const big = job({ id: 'j2', gcCustomer: LOBERG })
    const rollup = buildGcReviewRollup(
      [
        invRow({ id: 'i1', job: small, amount: 10 }),
        invRow({ id: 'i2', job: big, amount: 9000 }),
      ],
      [],
      { now: NOW },
    )
    expect(rollup.groups.map((g) => g.gcName)).toEqual(['Loberg Contracting', 'Knight Contracting'])
    expect(rollup.groups[0]!.oldestAgeDays).toBe(30)
  })
})
