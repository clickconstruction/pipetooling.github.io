import { describe, expect, it } from 'vitest'
import { filterBills, filterTxns, lensCounts, parsePaySpeedTransactions } from './paySpeedTransactions'

const raw = {
  payments: [
    { paymentId: 'p1', paidYmd: '2026-08-14', amount: 8450, paymentType: 'check', customerName: 'Knight Contracting', jobId: 'j1', jobName: 'Panel swap', address: '1207 Kingsbury Ln', billedYmd: '2026-07-21', gapDays: 24, status: 'measurable' },
    { paymentId: 'p2', paidYmd: '2026-08-11', amount: 1290, paymentType: null, customerName: 'Michael Holub', jobId: 'j2', jobName: 'Water softener', address: '44 Cibolo Trace', billedYmd: null, gapDays: null, status: 'unlinked' },
    { paymentId: 'p3', paidYmd: '2026-07-29', amount: 2140, paymentType: 'hcp', customerName: 'RMC- Dudley Mason', jobId: 'j3', jobName: 'Slab rough-in', address: '8110 FM 1044', billedYmd: '2026-07-29', gapDays: 0, status: 'quarantined' },
    { paymentId: 'p4', paidYmd: '2026-07-18', amount: 620, paymentType: null, customerName: 'Aaron Berg', jobId: 'j4', jobName: null, address: null, billedYmd: null, gapDays: null, status: 'excluded' },
    { paymentId: '', paidYmd: 'nope', amount: 1, status: 'measurable' }, // malformed → dropped
  ],
  undatedInvoices: [
    { invoiceId: 'i1', amount: 32108, status: 'billed', customerName: 'Southern Post Construction', jobId: 'j9', jobName: 'Phase 1', address: '900 Commerce Pk' },
  ],
}

describe('parsePaySpeedTransactions', () => {
  it('parses payments + undated bills, dropping malformed rows', () => {
    const d = parsePaySpeedTransactions(raw)!
    expect(d.payments).toHaveLength(4)
    expect(d.undatedBills).toHaveLength(1)
    expect(d.payments[0]!.gapDays).toBe(24)
    expect(parsePaySpeedTransactions(null)).toBeNull()
    expect(parsePaySpeedTransactions({ payments: 'x' })).toBeNull()
  })
})

describe('lensCounts / filters', () => {
  const d = parsePaySpeedTransactions(raw)!
  it('counts every bucket plus the undated backlog', () => {
    expect(lensCounts(d)).toEqual({ all: 4, measurable: 1, unlinked: 1, quarantined: 1, excluded: 1, undated: 1 })
  })
  it('filters by lens and by search across customer, job, and address', () => {
    expect(filterTxns(d, 'unlinked', '')).toHaveLength(1)
    expect(filterTxns(d, 'all', 'kingsbury')).toHaveLength(1)
    expect(filterTxns(d, 'all', 'kingsbury')[0]!.paymentId).toBe('p1')
    expect(filterTxns(d, 'undated', '')).toHaveLength(0)
    expect(filterBills(d, 'southern')).toHaveLength(1)
    expect(filterBills(d, 'zzz')).toHaveLength(0)
  })
})
