import { describe, expect, it } from 'vitest'
import { buildGcReviewRollup, GC_REVIEW_NO_DEVELOPMENT_KEY, GC_REVIEW_NO_GC_KEY } from './gcReviewRollup'
import type { StageRow } from './jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

const NOW = new Date('2026-07-31T12:00:00Z')

function job(over: Partial<JobWithDetails> & Pick<JobWithDetails, 'id'>): JobWithDetails {
  return {
    status: 'billed',
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
      billed_at: '2026-07-01T00:00:00Z',
      estimated_bill_date: null,
      ...invOver,
    } as never,
  }
}

const KNIGHT = { id: 'gc-knight', name: 'Knight Contracting' }
const LOBERG = { id: 'gc-loberg', name: 'Loberg Contracting' }

describe('buildGcReviewRollup', () => {
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
    expect(rollup.groups[2]!.gcName).toBe('No GC set')
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
        invRow({ id: 'i1', job: a, amount: 100, billed_at: '2026-07-01T00:00:00Z' }),
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
