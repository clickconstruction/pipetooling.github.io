import { describe, expect, it } from 'vitest'
import type { PortalBill } from './portalPayload'
import {
  groupPortalBillsByJob,
  portalBillBilledAmount,
  portalPaymentMethodLabel,
} from './portalJobGroups'

const bill = (over: Partial<PortalBill>): PortalBill => ({
  jobLabel: 'Job',
  jobNumber: '',
  jobName: null,
  serviceTag: null,
  jobAddress: null,
  amount: 100,
  billedOn: '2026-08-01',
  payUrl: null,
  checkRef: '',
  asGc: false,
  ownerName: null,
  payments: [],
  totalPaid: 0,
  ...over,
})

describe('portalPaymentMethodLabel', () => {
  it('maps blank and "other" to Payment, keeps real methods', () => {
    expect(portalPaymentMethodLabel('')).toBe('Payment')
    expect(portalPaymentMethodLabel('  ')).toBe('Payment')
    expect(portalPaymentMethodLabel('other')).toBe('Payment')
    expect(portalPaymentMethodLabel('Other')).toBe('Payment')
    expect(portalPaymentMethodLabel('check · 1042')).toBe('check · 1042')
    expect(portalPaymentMethodLabel('card')).toBe('card')
  })
})

describe('portalBillBilledAmount', () => {
  it('is the open amount plus what was paid, rounded to cents', () => {
    expect(portalBillBilledAmount(bill({ amount: 8317.18, totalPaid: 6433.2 }))).toBe(14750.38)
    expect(portalBillBilledAmount(bill({ amount: 0.1, totalPaid: 0.2 }))).toBe(0.3)
  })
})

describe('groupPortalBillsByJob', () => {
  it('groups bills sharing a job number; different jobs stay apart', () => {
    const groups = groupPortalBillsByJob([
      bill({ jobNumber: '813', billedOn: '2026-08-06', amount: 8317.18 }),
      bill({ jobNumber: '663', billedOn: '2026-07-06', amount: 1828.71 }),
      bill({ jobNumber: '813', billedOn: '2026-07-02', amount: 2384.62 }),
    ])
    expect(groups.map((g) => g.jobNumber)).toEqual(['813', '663'])
    expect(groups[0]?.bills.map((b) => b.billedOn)).toEqual(['2026-08-06', '2026-07-02'])
    expect(groups[0]?.balance).toBe(10701.8)
  })

  it('computes billed-to-date from balance + cached totals and merges payments oldest first', () => {
    const groups = groupPortalBillsByJob([
      bill({
        jobNumber: '813',
        billedOn: '2026-08-06',
        amount: 8317.18,
        totalPaid: 6433.2,
        payments: [{ date: '2026-07-31', method: 'other', amount: 6433.2 }],
      }),
      bill({
        jobNumber: '813',
        billedOn: '2026-07-02',
        amount: 2384.62,
        totalPaid: 5000,
        payments: [{ date: '2026-07-15', method: 'check · 1042', amount: 5000 }],
      }),
    ])
    const g = groups[0]
    expect(g?.totalPaid).toBe(11433.2)
    expect(g?.paymentRowsTotal).toBe(11433.2)
    expect(g?.billedToDate).toBe(22135)
    expect(g?.payments.map((p) => [p.date, p.method])).toEqual([
      ['2026-07-15', 'check · 1042'],
      ['2026-07-31', 'Payment'],
    ])
  })

  it('orders groups by their newest bill, undated floating first like the flat sort', () => {
    const groups = groupPortalBillsByJob([
      bill({ jobNumber: '1', billedOn: '2026-07-01' }),
      bill({ jobNumber: '2', billedOn: '2026-08-01' }),
      bill({ jobNumber: '3', billedOn: null }),
    ])
    expect(groups.map((g) => g.jobNumber)).toEqual(['3', '2', '1'])
  })

  it('shows the recap only when money landed or several bills need a closing line', () => {
    const groups = groupPortalBillsByJob([
      bill({ jobNumber: '1' }),
      bill({ jobNumber: '2', totalPaid: 50, payments: [{ date: null, method: 'card', amount: 50 }] }),
      bill({ jobNumber: '3', billedOn: '2026-08-02' }),
      bill({ jobNumber: '3', billedOn: '2026-08-03' }),
    ])
    const byNum = new Map(groups.map((g) => [g.jobNumber, g]))
    expect(byNum.get('1')?.showRecap).toBe(false)
    expect(byNum.get('2')?.showRecap).toBe(true)
    expect(byNum.get('3')?.showRecap).toBe(true)
  })

  it('recap still carries an aggregate-only total (no payment rows)', () => {
    const groups = groupPortalBillsByJob([bill({ jobNumber: '9', amount: 400, totalPaid: 150 })])
    expect(groups[0]?.payments).toEqual([])
    expect(groups[0]?.paymentRowsTotal).toBe(0)
    expect(groups[0]?.totalPaid).toBe(150)
    expect(groups[0]?.billedToDate).toBe(550)
    expect(groups[0]?.showRecap).toBe(true)
  })

  it('falls back to label + address for unnumbered bills', () => {
    const groups = groupPortalBillsByJob([
      bill({ jobLabel: 'Repipe', jobAddress: '1 Main St', billedOn: '2026-08-02' }),
      bill({ jobLabel: 'Repipe', jobAddress: '1 Main St', billedOn: '2026-08-01' }),
      bill({ jobLabel: 'Repipe', jobAddress: '2 Oak Ave' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.jobAddress === '1 Main St')?.bills).toHaveLength(2)
  })

  it('propagates As GC and the first known owner name', () => {
    const groups = groupPortalBillsByJob([
      bill({ jobNumber: '7', billedOn: '2026-08-02', asGc: false, ownerName: null }),
      bill({ jobNumber: '7', billedOn: '2026-08-01', asGc: true, ownerName: 'Dana Fields' }),
    ])
    expect(groups[0]?.asGc).toBe(true)
    expect(groups[0]?.ownerName).toBe('Dana Fields')
  })
})
