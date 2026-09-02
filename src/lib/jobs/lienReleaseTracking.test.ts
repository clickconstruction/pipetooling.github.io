import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  computeLienUnconditionalOwed,
  isLienWaiverFormType,
  lienReleaseClearance,
  lienReleaseFieldsFromSnapshot,
  lienReleaseFormLabel,
  lienReleasesOwingUnconditional,
  liveLienReleases,
  type JobLienReleaseRow,
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
