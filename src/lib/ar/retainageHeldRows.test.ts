import { describe, expect, it } from 'vitest'
import { assembleRetainageHeld, retainageJobFacts, type RetainageJobRow } from './retainageHeldRows'

const job = (partial: Partial<RetainageJobRow> & { id: string }): RetainageJobRow => ({
  hcp_number: 'JP1385',
  click_number: null,
  job_name: 'Granite Shoals',
  job_address: '2740 Granite Shoals Dr, Haltom City',
  status: 'billed',
  customer_name: 'Owner LLC',
  gc_customer_id: 'gc1',
  lien_retainage_held: '6400.00',
  lien_contract_ended_on: null,
  gc: { name: 'Bluebonnet Commercial Builders' },
  ...partial,
})

describe('assembleRetainageHeld', () => {
  it('folds a job’s live applications and bills into one kernel input, numbers as numbers', () => {
    const { inputs, facts } = assembleRetainageHeld(
      [job({ id: 'j1', lien_contract_ended_on: '2026-09-30T00:00:00' })],
      [
        { job_id: 'j1', application_number: '2', retainage_held: '5840.00', updated_at: '2026-10-18T17:00:00Z', invoice_id: null },
        { job_id: 'j1', application_number: 1, retainage_held: 2920, updated_at: '2026-09-18T17:00:00Z', invoice_id: 'b1' },
        { job_id: 'other', application_number: 1, retainage_held: 10, updated_at: null },
      ],
      [
        { id: 'b1', job_id: 'j1', amount: '9660.00', status: 'billed' },
        { id: 'bx', job_id: 'other', amount: 1, status: 'paid' },
      ],
    )
    expect(inputs).toEqual([
      {
        jobId: 'j1',
        applications: [
          { applicationNumber: 2, retainageHeld: 5840, updatedAt: '2026-10-18T17:00:00Z', invoiceId: null },
          { applicationNumber: 1, retainageHeld: 2920, updatedAt: '2026-09-18T17:00:00Z', invoiceId: 'b1' },
        ],
        typedHeld: 6400,
        finishedOn: '2026-09-30',
        bills: [{ id: 'b1', amount: 9660, status: 'billed' }],
        releaseBillId: null,
      },
    ])
    expect(facts.get('j1')).toEqual({ jobId: 'j1', label: 'JP1385', name: 'Granite Shoals', address: '2740 Granite Shoals Dr, Haltom City', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', billCount: 1 })
  })

  it('a job with nothing typed reads null, not zero; a duplicate row is folded once', () => {
    const { inputs } = assembleRetainageHeld([job({ id: 'j1', lien_retainage_held: null }), job({ id: 'j1' })], [], [])
    expect(inputs).toHaveLength(1)
    expect(inputs[0]?.typedHeld).toBeNull()
    expect(inputs[0]?.finishedOn).toBeNull()
  })

  it('an application whose invoice column was not read carries a null tie', () => {
    const { inputs } = assembleRetainageHeld([job({ id: 'j1' })], [{ job_id: 'j1', application_number: 1, retainage_held: 5, updated_at: null }], [])
    expect(inputs[0]?.applications[0]?.invoiceId).toBeNull()
  })
})

describe('assembleRetainageHeld · the release mark', () => {
  it('the newest marked bill is the release; an unmarked job, or a read without the column, has none', () => {
    const { inputs } = assembleRetainageHeld(
      [job({ id: 'j1' }), job({ id: 'j2' }), job({ id: 'j3' })],
      [],
      [
        { id: 'old', job_id: 'j1', amount: 100, status: 'paid', sequence_order: 0, retainage_release: true },
        { id: 'new', job_id: 'j1', amount: 100, status: 'ready_to_bill', sequence_order: 2, retainage_release: true },
        { id: 'mid', job_id: 'j1', amount: 100, status: 'billed', sequence_order: 1, retainage_release: false },
        { id: 'plain', job_id: 'j2', amount: 100, status: 'billed', sequence_order: 0, retainage_release: false },
        { id: 'nocol', job_id: 'j3', amount: 100, status: 'billed' },
      ],
    )
    expect(inputs.map((i) => [i.jobId, i.releaseBillId])).toEqual([
      ['j1', 'new'],
      ['j2', null],
      ['j3', null],
    ])
  })
})

describe('retainageJobFacts', () => {
  it('labels the job by HCP number, then Click number, then the id; names who holds the money', () => {
    expect(retainageJobFacts(job({ id: 'abcdefgh-1234', hcp_number: ' ', click_number: 'C1385' })).label).toBe('C1385')
    expect(retainageJobFacts(job({ id: 'abcdefgh-1234', hcp_number: null, click_number: null })).label).toBe('abcdefgh')
    expect(retainageJobFacts(job({ id: 'j', gc: null })).heldBy).toBe('Owner LLC')
    expect(retainageJobFacts(job({ id: 'j', gc: null, customer_name: null })).heldBy).toBe('')
    expect(retainageJobFacts(job({ id: 'j', gc: { name: '  Lampasas Builders JV ' } })).heldBy).toBe('Lampasas Builders JV')
  })
})
