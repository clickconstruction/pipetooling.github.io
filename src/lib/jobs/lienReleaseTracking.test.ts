import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  appliedByInvoiceIdFromPayments,
  buildLienUnconditionalQueue,
  computeLienUnconditionalOwed,
  isLienWaiverFormType,
  lienQueuePaymentLabel,
  lienReleaseClearance,
  lienReleaseFieldsFromSnapshot,
  lienReleaseFormLabel,
  lienReleasesOwingUnconditional,
  liveLienReleases,
  type JobLienReleaseRow,
  type LienQueuePayment,
} from './lienReleaseTracking'

function release(partial: Partial<JobLienReleaseRow>): JobLienReleaseRow {
  return {
    id: 'r1',
    job_id: 'job-1',
    invoice_ids: [],
    form_type: 'conditional_progress',
    amount: 1000,
    through_date: null,
    signed_date: null,
    fields: {},
    created_by: null,
    created_at: '2026-09-01T12:00:00Z',
    voided_at: null,
    ...partial,
  } as JobLienReleaseRow
}

function jobPayments(payments: { invoice_id: string | null; amount: number }[], paymentsMade = 0) {
  return { payments: payments as JobWithDetails['payments'], payments_made: paymentsMade }
}

describe('form type guards and labels', () => {
  it('recognizes the three form types, labels unknown values verbatim', () => {
    expect(isLienWaiverFormType('conditional_progress')).toBe(true)
    expect(isLienWaiverFormType('something_else')).toBe(false)
    expect(lienReleaseFormLabel('unconditional_final')).toBe('Unconditional · final')
    expect(lienReleaseFormLabel('legacy_kind')).toBe('legacy_kind')
  })
})

describe('lienReleaseFieldsFromSnapshot', () => {
  it('extracts known string fields and ignores junk', () => {
    expect(lienReleaseFieldsFromSnapshot({ checkFrom: 'Knight', amount: '2200', bogus: 1, signerName: 42 })).toEqual({
      checkFrom: 'Knight',
      amount: '2200',
    })
    expect(lienReleaseFieldsFromSnapshot(null)).toEqual({})
    expect(lienReleaseFieldsFromSnapshot([1, 2])).toEqual({})
  })
})

describe('lienReleaseClearance', () => {
  it('unconditional forms have nothing to wait on', () => {
    expect(lienReleaseClearance(release({ form_type: 'unconditional_final' }), jobPayments([]))).toBe('not_applicable')
  })
  it('waits until payments applied to the covered lines reach the amount', () => {
    const r = release({ invoice_ids: ['inv-a'], amount: 1000 })
    expect(lienReleaseClearance(r, jobPayments([{ invoice_id: 'inv-a', amount: 400 }]))).toBe('waiting')
    expect(
      lienReleaseClearance(
        r,
        jobPayments([
          { invoice_id: 'inv-a', amount: 400 },
          { invoice_id: 'inv-a', amount: 600 },
        ]),
      ),
    ).toBe('cleared')
  })
  it('payments on other lines do not count', () => {
    const r = release({ invoice_ids: ['inv-a'], amount: 1000 })
    expect(lienReleaseClearance(r, jobPayments([{ invoice_id: 'inv-b', amount: 5000 }]))).toBe('waiting')
  })
  it('no line snapshot falls back to job payments_made', () => {
    const r = release({ invoice_ids: [], amount: 1000 })
    expect(lienReleaseClearance(r, jobPayments([], 999))).toBe('waiting')
    expect(lienReleaseClearance(r, jobPayments([], 1000))).toBe('cleared')
  })
})

describe('liveLienReleases', () => {
  it('drops voided rows and sorts newest first', () => {
    const rows = [
      release({ id: 'old', created_at: '2026-08-01T00:00:00Z' }),
      release({ id: 'voided', voided_at: '2026-08-02T00:00:00Z' }),
      release({ id: 'new', created_at: '2026-09-01T00:00:00Z' }),
    ]
    expect(liveLienReleases(rows).map((r) => r.id)).toEqual(['new', 'old'])
  })
})

describe('lienReleasesOwingUnconditional', () => {
  const cleared = release({ id: 'c1', invoice_ids: ['inv-a'], amount: 1000, created_at: '2026-08-10T00:00:00Z' })
  const paid = jobPayments([{ invoice_id: 'inv-a', amount: 1000 }])

  it('flags a cleared conditional with no unconditional follow-up', () => {
    expect(lienReleasesOwingUnconditional([cleared], paid).map((r) => r.id)).toEqual(['c1'])
  })
  it('does not flag while the payment is still outstanding', () => {
    expect(lienReleasesOwingUnconditional([cleared], jobPayments([]))).toEqual([])
  })
  it('a later unconditional on the same line settles the debt', () => {
    const uncond = release({
      id: 'u1',
      form_type: 'unconditional_progress',
      invoice_ids: ['inv-a'],
      created_at: '2026-08-20T00:00:00Z',
    })
    expect(lienReleasesOwingUnconditional([cleared, uncond], paid)).toEqual([])
  })
  it('an unconditional on a different line does not settle it', () => {
    const otherLine = release({
      id: 'u2',
      form_type: 'unconditional_progress',
      invoice_ids: ['inv-z'],
      created_at: '2026-08-20T00:00:00Z',
    })
    expect(lienReleasesOwingUnconditional([cleared, otherLine], paid).map((r) => r.id)).toEqual(['c1'])
  })
  it('rolls up owed releases across jobs from a payments map', () => {
    const rows = [
      release({ id: 'a', job_id: 'j1', invoice_ids: ['inv-1'], amount: 500 }),
      release({ id: 'b', job_id: 'j2', invoice_ids: ['inv-2'], amount: 700 }),
      release({ id: 'c', job_id: 'j3', invoice_ids: [], amount: 900 }), // no snapshot → skipped
      release({ id: 'd', job_id: 'j1', form_type: 'unconditional_final', invoice_ids: ['inv-1'], created_at: '2026-09-02T00:00:00Z' }),
    ]
    const applied = new Map([
      ['inv-1', 500],
      ['inv-2', 700],
    ])
    // j1's cleared conditional is settled by the later final; j2 is owed.
    const owed = computeLienUnconditionalOwed(rows, applied)
    expect(owed.count).toBe(1)
    expect(owed.total).toBe(700)
    expect(owed.jobIds).toEqual(['j2'])
  })

  it('an uncleared conditional never rolls up as owed', () => {
    const rows = [release({ id: 'a', job_id: 'j1', invoice_ids: ['inv-1'], amount: 500 })]
    expect(computeLienUnconditionalOwed(rows, new Map([['inv-1', 100]])).count).toBe(0)
  })

  it('a voided unconditional does not settle it', () => {
    const voided = release({
      id: 'u3',
      form_type: 'unconditional_progress',
      invoice_ids: ['inv-a'],
      created_at: '2026-08-20T00:00:00Z',
      voided_at: '2026-08-21T00:00:00Z',
    })
    expect(lienReleasesOwingUnconditional([cleared, voided], paid).map((r) => r.id)).toEqual(['c1'])
  })
})

describe('buildLienUnconditionalQueue (the Dashboard queue)', () => {
  const jobs = new Map([
    ['job-1', { id: 'job-1', hcp_number: '1042', click_number: 'C77', job_name: 'Mission Hills — Bldg C', customer_name: 'Harvey Builders', job_address: '4410 Mission Hills Dr' }],
    ['job-2', { id: 'job-2', hcp_number: '', click_number: 'C88', job_name: 'Lakeline Medical', customer_name: null, job_address: '' }],
  ])
  const payment = (p: Partial<LienQueuePayment> & { invoice_id: string; amount: number }): LienQueuePayment => ({
    id: `p-${p.invoice_id}`,
    paid_on: null,
    payment_type: null,
    reference_number: null,
    created_at: '2026-09-01T12:00:00Z',
    ...p,
  })

  it('one row per owed release with job identity and the clearing payment, oldest cleared first', () => {
    const releases = [
      release({ id: 'r1', job_id: 'job-1', invoice_ids: ['inv-1'], amount: 408, created_at: '2026-08-22T12:00:00Z' }),
      release({ id: 'r2', job_id: 'job-2', invoice_ids: ['inv-2'], amount: 3200, created_at: '2026-08-14T12:00:00Z' }),
    ]
    const payments = [
      payment({ invoice_id: 'inv-1', amount: 408, paid_on: '2026-09-01', payment_type: 'check', reference_number: '4471' }),
      payment({ invoice_id: 'inv-2', amount: 3200, paid_on: '2026-08-29', payment_type: 'ach' }),
    ]
    const rows = buildLienUnconditionalQueue(releases, payments, jobs)
    expect(rows.map((r) => r.releaseId)).toEqual(['r2', 'r1'])
    const r1 = rows[1]!
    expect(r1.jobNumber).toBe('1042')
    expect(r1.jobName).toBe('Mission Hills — Bldg C')
    expect(r1.customerName).toBe('Harvey Builders')
    expect(r1.issuedOn).toBe('2026-08-22')
    expect(r1.clearedOn).toBe('2026-09-01')
    expect(r1.clearedBy).toBe('Check #4471')
    expect(r1.appliedTotal).toBe(408)
    expect(r1.invoiceIds).toEqual(['inv-1'])
    const r2 = rows[0]!
    expect(r2.jobNumber).toBe('C88')
    expect(r2.customerName).toBe('')
    expect(r2.clearedBy).toBe('Ach')
  })

  it('agrees with computeLienUnconditionalOwed: same releases, same total', () => {
    const releases = [
      release({ id: 'r1', job_id: 'job-1', invoice_ids: ['inv-1'], amount: 500 }),
      release({ id: 'r2', job_id: 'job-1', invoice_ids: ['inv-9'], amount: 700 }), // not cleared
      release({ id: 'r3', job_id: 'job-2', invoice_ids: [], amount: 900 }), // no snapshot — skipped
    ]
    const payments = [payment({ invoice_id: 'inv-1', amount: 500 })]
    const rows = buildLienUnconditionalQueue(releases, payments, jobs)
    const owed = computeLienUnconditionalOwed(releases, appliedByInvoiceIdFromPayments(payments))
    expect(rows.map((r) => r.releaseId)).toEqual(['r1'])
    expect(rows.length).toBe(owed.count)
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(owed.total)
  })

  it('drops a release once an unconditional follow-up covers its lines', () => {
    const releases = [
      release({ id: 'r1', job_id: 'job-1', invoice_ids: ['inv-1'], amount: 500, created_at: '2026-08-01T00:00:00Z' }),
      release({ id: 'u1', job_id: 'job-1', form_type: 'unconditional_progress', invoice_ids: ['inv-1'], amount: 500, created_at: '2026-08-05T00:00:00Z' }),
    ]
    expect(buildLienUnconditionalQueue(releases, [payment({ invoice_id: 'inv-1', amount: 500 })], jobs)).toEqual([])
  })

  it('falls back to the payment created date and a plain label when the row is bare; unknown jobs get empty identity', () => {
    const releases = [release({ id: 'r1', job_id: 'job-x', invoice_ids: ['inv-1'], amount: 100 })]
    const rows = buildLienUnconditionalQueue(releases, [payment({ invoice_id: 'inv-1', amount: 100, created_at: '2026-09-03T04:00:00Z' })], jobs)
    expect(rows[0]?.clearedOn).toBe('2026-09-03')
    expect(rows[0]?.clearedBy).toBe('Payment')
    expect(rows[0]?.jobNumber).toBe('')
    expect(rows[0]?.jobName).toBe('')
  })

  it('lienQueuePaymentLabel: type + reference, either alone, or "Payment"', () => {
    expect(lienQueuePaymentLabel({ payment_type: 'check', reference_number: '12' })).toBe('Check #12')
    expect(lienQueuePaymentLabel({ payment_type: 'wire', reference_number: null })).toBe('Wire')
    expect(lienQueuePaymentLabel({ payment_type: null, reference_number: '9' })).toBe('#9')
    expect(lienQueuePaymentLabel({ payment_type: '  ', reference_number: '' })).toBe('Payment')
  })
})
