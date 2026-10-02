import { describe, expect, it } from 'vitest'
import { paySpeedPayer } from './jobs/billToParty'
import { billedExpectedPayModel, type PaySpeedData } from './jobs/billedExpectedPay'
import { expectedPayModel, rowPaySpeedKey, type PayloadRow } from '../../supabase/functions/_shared/paymentForecastCore'

/**
 * v2.4365: an estimate reads the pace of whoever the bill went to (the GC on a GC-billed bill),
 * the same payer `pay_speed_samples()` counts payments for (v2.4362). Job 1009's shape: the owner
 * Umar Khan as customer, RMC- Dudley Mason as GC on the gc rule, billed Sep 3.
 */
const DUDLEY = 'gc-dudley'
const UMAR = 'cust-umar'
const job1009 = { customer_id: UMAR, gc_customer_id: DUDLEY, bill_to_party: 'gc', customer_name: 'Umar Khan', gcCustomer: { name: 'RMC- Dudley Mason' } }
const speeds: PaySpeedData = {
  company: { medianDays: 6, samples: 227 },
  customers: { [DUDLEY]: { medianDays: 35, samples: 4 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
} as unknown as PaySpeedData

describe('paySpeedPayer', () => {
  it('names the GC on a GC-billed bill and the customer otherwise', () => {
    expect(paySpeedPayer(job1009, null)).toEqual({ id: DUDLEY, name: 'RMC- Dudley Mason' })
    expect(paySpeedPayer({ ...job1009, bill_to_party: 'customer' }, null)).toEqual({ id: UMAR, name: 'Umar Khan' })
  })
  it('follows an invoice pick and treats a GC job with no customer as the GC', () => {
    expect(paySpeedPayer({ ...job1009, bill_to_party: 'split' }, { bill_to_party: 'gc' })).toEqual({ id: DUDLEY, name: 'RMC- Dudley Mason' })
    expect(paySpeedPayer({ ...job1009, customer_id: null, customer_name: null, bill_to_party: 'customer' }, null).id).toBe(DUDLEY)
  })
  it('a bill typed to someone else has no payer of its own', () => {
    expect(paySpeedPayer(job1009, { bill_to_email: 'tenant@example.com' })).toEqual({ id: null, name: null })
  })
})

describe('the estimate reads the payer', () => {
  it('job 1009: Dudley’s 35 days, named in the hover', () => {
    const payer = paySpeedPayer(job1009, null)
    const m = billedExpectedPayModel({ billedAtIso: '2026-09-03T15:00:00Z', estBillYmd: null, customerId: payer.id, payerName: payer.name }, speeds, '2026-10-01')
    expect(m?.expectedYmd).toBe('2026-10-08')
    expect(m?.source).toBe('customer')
    expect(m?.state).toBe('upcoming')
    expect(m?.title).toBe("Billed Sep 3 + RMC- Dudley Mason's median pay speed (~35 days over 4 payments, last 12 months) → expected Oct 8")
  })
  it('one payment is enough (v2.4376): TF Harper’s single 74-day payment sets the date, and the hover says so', () => {
    const one = { ...speeds, customers: { ...speeds.customers, 'gc-harper': { medianDays: 74, samples: 1 } } } as PaySpeedData
    const m = billedExpectedPayModel({ billedAtIso: '2026-07-12T15:00:00Z', estBillYmd: null, customerId: 'gc-harper', payerName: 'TF Harper' }, one, '2026-10-01')
    expect(m?.source).toBe('customer')
    expect(m?.expectedYmd).toBe('2026-09-24')
    expect(m?.daysLate).toBe(7)
    expect(m?.title).toContain("TF Harper's median pay speed (~74 days over 1 payment, last 12 months)")
  })
  it('no history at all falls back to the company and says whose history is thin', () => {
    const m = billedExpectedPayModel({ billedAtIso: '2026-09-03T15:00:00Z', estBillYmd: null, customerId: 'gc-thin', payerName: 'Southern Post Construction' }, speeds, '2026-10-01')
    expect(m?.source).toBe('company')
    expect(m?.title).toContain('Southern Post Construction has too little payment history')
    const unnamed = billedExpectedPayModel({ billedAtIso: '2026-09-03T15:00:00Z', estBillYmd: null, customerId: null }, speeds, '2026-10-01')
    expect(unnamed?.title).toContain('this customer has too little payment history')
  })
})

describe('the forecast email kernel reads the payer', () => {
  const row: PayloadRow = { invoice_id: 'i', job_id: 'j', display_number: '1009', job_name: 'Lenox Check PU', customer_id: UMAR, customer_name: 'Umar Khan', billed_at: '2026-09-03T15:00:00Z', est_bill_ymd: null, remaining: 350 }
  const payloadSpeeds = { company: { medianDays: 6, samples: 227 }, customers: { [DUDLEY]: { medianDays: 35, samples: 4 } }, segments: { residential: null, commercial: null }, customerTypes: {} }
  it('keys on payer_id once the payload carries it, else on the job customer', () => {
    expect(rowPaySpeedKey({ ...row, payer_id: DUDLEY })).toBe(DUDLEY)
    expect(rowPaySpeedKey({ ...row, payer_id: null })).toBeNull()
    expect(rowPaySpeedKey(row)).toBe(UMAR)
  })
  it('job 1009 is expected Oct 8 on Dudley’s pace, not Sep 9 on the company’s', () => {
    expect(expectedPayModel({ ...row, payer_id: DUDLEY, payer_name: 'RMC- Dudley Mason' }, payloadSpeeds as never, '2026-10-01', null)?.expectedYmd).toBe('2026-10-08')
    expect(expectedPayModel(row, payloadSpeeds as never, '2026-10-01', null)?.expectedYmd).toBe('2026-09-09')
  })
})
