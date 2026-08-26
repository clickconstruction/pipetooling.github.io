import { describe, expect, it } from 'vitest'
import { filterBills, filterTxns, isBilledAfterPaid, lensCounts, missingInfoLabel, parsePaySpeedTransactions } from './paySpeedTransactions'

const raw = {
  payments: [
    { paymentId: 'p1', paidYmd: '2026-08-14', amount: 8450, paymentType: 'check', customerName: 'Knight Contracting', jobId: 'j1', jobName: 'Panel swap', address: '1207 Kingsbury Ln', billedYmd: '2026-07-21', gapDays: 24, status: 'measurable' },
    { paymentId: 'p2', paidYmd: '2026-08-11', amount: 1290, paymentType: null, customerName: 'Michael Holub', jobId: 'j2', jobName: 'Water softener', address: '44 Cibolo Trace', billedYmd: null, gapDays: null, status: 'unlinked' },
    { paymentId: 'p5', paidYmd: '2026-08-10', amount: 350, paymentType: null, customerName: 'City of Seguin', jobId: 'j5', jobName: 'Wave pool', address: '1 Wave Pool Dr', invoiceId: 'i5', billedYmd: null, gapDays: null, status: 'unlinked' },
    { paymentId: 'p3', paidYmd: '2026-07-29', amount: 2140, paymentType: 'hcp', customerName: 'RMC- Dudley Mason', jobId: 'j3', jobName: 'Slab rough-in', address: '8110 FM 1044', billedYmd: '2026-07-29', gapDays: 0, status: 'quarantined' },
    { paymentId: 'p4', paidYmd: '2026-07-18', amount: 620, paymentType: null, customerName: 'Aaron Berg', jobId: 'j4', jobName: null, address: null, billedYmd: null, gapDays: null, status: 'excluded' },
    { paymentId: 'p6', paidYmd: '2026-08-14', amount: 5983, paymentType: 'Card (external)', customerName: 'Tyler Moore', jobId: 'j6', jobName: 'Yogo Studio', address: '3556 FM 78', invoiceId: 'i6', billedYmd: '2026-08-19', gapDays: null, status: 'unlinked' },
    { paymentId: '', paidYmd: 'nope', amount: 1, status: 'measurable' }, // malformed → dropped
  ],
  undatedInvoices: [
    { invoiceId: 'i1', amount: 32108, status: 'billed', customerName: 'Southern Post Construction', jobId: 'j9', jobName: 'Phase 1', address: '900 Commerce Pk' },
  ],
}

describe('parsePaySpeedTransactions', () => {
  it('parses payments + undated bills, dropping malformed rows', () => {
    const d = parsePaySpeedTransactions(raw)!
    expect(d.payments).toHaveLength(6)
    expect(d.undatedBills).toHaveLength(1)
    expect(d.payments[0]!.gapDays).toBe(24)
    expect(parsePaySpeedTransactions(null)).toBeNull()
    expect(parsePaySpeedTransactions({ payments: 'x' })).toBeNull()
  })
  it('carries invoiceId when present, null on pre-v4 payloads', () => {
    const d = parsePaySpeedTransactions(raw)!
    expect(d.payments.find((t) => t.paymentId === 'p5')!.invoiceId).toBe('i5')
    expect(d.payments.find((t) => t.paymentId === 'p2')!.invoiceId).toBeNull()
  })
})

describe('missingInfoLabel', () => {
  const d = parsePaySpeedTransactions(raw)!
  it('splits the bucket: no bill (nothing linked) vs no bill date (linked, undated)', () => {
    expect(missingInfoLabel(d.payments.find((t) => t.paymentId === 'p2')!)).toBe('no bill')
    expect(missingInfoLabel(d.payments.find((t) => t.paymentId === 'p5')!)).toBe('no bill date')
  })
  it('flags a bill date after the payment as billed after paid (v2.2337 guard)', () => {
    const p6 = d.payments.find((t) => t.paymentId === 'p6')!
    expect(isBilledAfterPaid(p6)).toBe(true)
    expect(missingInfoLabel(p6)).toBe('billed after paid')
    expect(isBilledAfterPaid(d.payments.find((t) => t.paymentId === 'p1')!)).toBe(false)
  })
})

describe('lensCounts / filters', () => {
  const d = parsePaySpeedTransactions(raw)!
  it('counts every bucket plus the undated backlog', () => {
    expect(lensCounts(d)).toEqual({ all: 6, measurable: 1, unlinked: 3, quarantined: 1, excluded: 1, undated: 1 })
  })
  it('filters by lens and by search across customer, job, and address', () => {
    expect(filterTxns(d, 'unlinked', '')).toHaveLength(3)
    expect(filterTxns(d, 'all', 'kingsbury')).toHaveLength(1)
    expect(filterTxns(d, 'all', 'kingsbury')[0]!.paymentId).toBe('p1')
    expect(filterTxns(d, 'undated', '')).toHaveLength(0)
    expect(filterBills(d, 'southern')).toHaveLength(1)
    expect(filterBills(d, 'zzz')).toHaveLength(0)
  })
})
