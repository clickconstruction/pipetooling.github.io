import { describe, expect, it } from 'vitest'
import { findRecordedPaymentCollisions, type CollisionPaymentSlice } from './arLinkCollision'

const pay = (payment_id: string, job_id: string, amount: number | string, paid_on: string | null = null): CollisionPaymentSlice => ({
  payment_id,
  job_id,
  amount,
  paid_on,
})

describe('findRecordedPaymentCollisions', () => {
  const payments = [
    pay('p1', 'job-883', 2918.22, '2026-08-26'),
    pay('p2', 'job-883', 500),
    pay('p3', 'job-999', 2918.22),
    pay('p4', 'job-883', '-2918.22'),
  ]

  it('returns same-job payments equal to the allocation to the cent (sign-insensitive)', () => {
    const hits = findRecordedPaymentCollisions('job-883', 2918.22, payments)
    expect(hits.map((p) => p.payment_id)).toEqual(['p1', 'p4'])
  })

  it('different job or different amount is no collision', () => {
    expect(findRecordedPaymentCollisions('job-883', 2918.23, payments)).toEqual([])
    expect(findRecordedPaymentCollisions('job-000', 2918.22, payments)).toEqual([])
  })

  it('non-positive or NaN allocation amounts return []', () => {
    expect(findRecordedPaymentCollisions('job-883', 0, payments)).toEqual([])
    expect(findRecordedPaymentCollisions('job-883', -5, payments)).toEqual([])
    expect(findRecordedPaymentCollisions('job-883', Number.NaN, payments)).toEqual([])
  })
})
