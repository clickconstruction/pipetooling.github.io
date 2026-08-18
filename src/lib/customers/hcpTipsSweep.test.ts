import { describe, expect, it } from 'vitest'
import type { HcpExportRow } from './backfillHcpPayments'
import { planHcpTipsSweep, tipPaymentNote, type TipsSweepJobInput } from './hcpTipsSweep'

function hcp(over: Partial<HcpExportRow>): HcpExportRow {
  return {
    hcpNumber: '584',
    paidOn: '2026-02-23',
    completedOn: '2026-02-16',
    createdOn: '2026-02-09',
    paidAmount: 370,
    jobAmount: 370,
    tipAmount: 10,
    ...over,
  }
}

function job(over: Partial<TipsSweepJobInput>): TipsSweepJobInput {
  return {
    id: 'j1',
    hcp_number: '584',
    click_number: null,
    job_name: 'Henrietta Han',
    customer_name: 'Henrietta Han',
    status: 'paid',
    revenue: 360,
    payments_made: 360,
    created_at: '2026-02-19T10:00:00Z',
    ...over,
  }
}

describe('planHcpTipsSweep', () => {
  it('plans a tip line + payment when revenue equals HCP total minus tip', () => {
    const plan = planHcpTipsSweep([job({})], [hcp({})], new Set())
    expect(plan).toEqual([
      expect.objectContaining({
        state: 'add',
        jobId: 'j1',
        label: '584',
        tip: 10,
        revenueBefore: 360,
        revenueAfter: 370,
        paidOn: '2026-02-23',
        dateSource: 'hcp_paid',
        markPaid: false,
      }),
    ])
  })

  it('ignores export rows without a tip', () => {
    expect(planHcpTipsSweep([job({})], [hcp({ tipAmount: 0 })], new Set())).toEqual([])
  })

  it('marks the tip as included when revenue already equals the HCP total (445 case)', () => {
    const plan = planHcpTipsSweep([job({ revenue: 750.5, payments_made: 750.5 })], [hcp({ jobAmount: 750.5, tipAmount: 20 })], new Set())
    expect(plan[0]).toMatchObject({ state: 'included' })
  })

  it('marks jobs that already carry a tip line as done (safe re-run)', () => {
    const plan = planHcpTipsSweep([job({})], [hcp({})], new Set(['j1']))
    expect(plan[0]).toMatchObject({ state: 'done' })
  })

  it('reports HCP tips whose job number is not in the app', () => {
    const plan = planHcpTipsSweep([], [hcp({})], new Set())
    expect(plan[0]).toMatchObject({ state: 'no_job', jobId: null, label: '584' })
  })

  it('flags a mismatch when revenue reconciles with neither figure', () => {
    const plan = planHcpTipsSweep([job({ revenue: 300 })], [hcp({})], new Set())
    expect(plan[0]).toMatchObject({ state: 'mismatch' })
  })

  it('never guesses between two app jobs sharing a number (033 vs 33)', () => {
    const plan = planHcpTipsSweep(
      [job({ id: 'shell', hcp_number: '33', revenue: null, payments_made: 0 }), job({ id: 'real', hcp_number: '033', revenue: 150 })],
      [hcp({ hcpNumber: '33', jobAmount: 180, tipAmount: 30 })],
      new Set(),
    )
    expect(plan[0]).toMatchObject({ state: 'mismatch' })
  })

  it('matches Excel-quoted, zero-padded job numbers', () => {
    const plan = planHcpTipsSweep([job({ hcp_number: '033' })], [hcp({ hcpNumber: '33', jobAmount: 370 })], new Set())
    expect(plan[0]).toMatchObject({ state: 'add', label: '033' })
  })

  it('sets markPaid only for billed jobs whose payments cover the new total', () => {
    const billedCovered = planHcpTipsSweep([job({ status: 'billed' })], [hcp({})], new Set())
    expect(billedCovered[0]).toMatchObject({ state: 'add', markPaid: true })
    const billedShort = planHcpTipsSweep([job({ status: 'billed', payments_made: 100 })], [hcp({})], new Set())
    expect(billedShort[0]).toMatchObject({ state: 'add', markPaid: false })
    const alreadyPaid = planHcpTipsSweep([job({ status: 'paid' })], [hcp({})], new Set())
    expect(alreadyPaid[0]).toMatchObject({ state: 'add', markPaid: false })
  })

  it('dates fall back paid → completed → created → ledger created', () => {
    const completed = planHcpTipsSweep([job({})], [hcp({ paidOn: null })], new Set())
    expect(completed[0]).toMatchObject({ paidOn: '2026-02-16', dateSource: 'hcp_completed' })
    const created = planHcpTipsSweep([job({})], [hcp({ paidOn: null, completedOn: null })], new Set())
    expect(created[0]).toMatchObject({ paidOn: '2026-02-09', dateSource: 'hcp_created' })
    const ledger = planHcpTipsSweep([job({})], [hcp({ paidOn: null, completedOn: null, createdOn: null })], new Set())
    expect(ledger[0]).toMatchObject({ paidOn: '2026-02-19', dateSource: 'ledger_created' })
  })

  it('sorts newest tips first', () => {
    const plan = planHcpTipsSweep(
      [job({ id: 'a', hcp_number: '1' }), job({ id: 'b', hcp_number: '2' })],
      [hcp({ hcpNumber: '1', paidOn: '2026-01-01' }), hcp({ hcpNumber: '2', paidOn: '2026-03-01' })],
      new Set(),
    )
    expect(plan.map((r) => r.jobId)).toEqual(['b', 'a'])
  })
})

describe('tipPaymentNote', () => {
  it('carries the HCP collected total', () => {
    const plan = planHcpTipsSweep([job({})], [hcp({})], new Set())
    expect(tipPaymentNote(plan[0]!)).toBe('Tip recorded in HouseCall Pro (HCP collected $370.00 total)')
  })
})
