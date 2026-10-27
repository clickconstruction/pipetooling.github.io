import { describe, expect, it } from 'vitest'
import { filterUndatedBills, parseUndatedBillWorklist, sortUndatedBillsOldestFirst, undatedBillAge, undatedBillClue } from './quickfillUndatedBills'

const raw = {
  noCountDate: '2026-08-01',
  bills: [
    {
      invoiceId: 'i1',
      amount: 350,
      status: 'paid',
      createdYmd: '2026-08-20',
      customerName: 'City of Seguin',
      jobId: 'j1',
      jobName: 'Seguin Wave Pool',
      address: '1 Wave Pool Dr, Seguin, TX',
      hcpNumber: '812',
      payments: [{ paidYmd: '2026-08-24', amount: 350 }],
    },
    {
      invoiceId: 'i2',
      amount: 11736,
      status: 'paid',
      createdYmd: '2026-08-10',
      customerName: 'Summit General Contractors',
      jobId: 'j2',
      jobName: 'Summit GC - Auto Zone',
      address: '3915 N Loop 1604 E, San Antonio, TX',
      hcpNumber: '903',
      payments: [
        { paidYmd: '2026-08-19', amount: 6000 },
        { paidYmd: '2026-08-12', amount: 5736 },
      ],
    },
    {
      invoiceId: 'i3',
      amount: 1711,
      status: 'billed',
      createdYmd: '2026-08-12',
      customerName: 'Nick Frantzen',
      jobId: 'j3',
      jobName: 'Frantzen Water Heater',
      address: '204 Wingate Court, Seguin, TX',
      hcpNumber: '918',
      payments: [],
    },
    { invoiceId: '', amount: 1 }, // malformed → dropped
  ],
}

describe('parseUndatedBillWorklist', () => {
  it('parses bills + noCountDate, dropping malformed rows', () => {
    const d = parseUndatedBillWorklist(raw)!
    expect(d.bills).toHaveLength(3)
    expect(d.noCountDate).toBe('2026-08-01')
    expect(d.bills[1]!.payments).toHaveLength(2)
    expect(parseUndatedBillWorklist(null)).toBeNull()
    expect(parseUndatedBillWorklist({ bills: 'x' })).toBeNull()
  })
  it('tolerates a missing noCountDate and junk payments', () => {
    const d = parseUndatedBillWorklist({ bills: [{ invoiceId: 'a', amount: 5, payments: [null, { paidYmd: 'bad' }] }] })!
    expect(d.noCountDate).toBeNull()
    expect(d.bills[0]!.payments).toHaveLength(0)
  })
})

describe('undatedBillClue', () => {
  const d = parseUndatedBillWorklist(raw)!
  it('leads with the newest payment date', () => {
    expect(undatedBillClue(d.bills[0]!)).toBe('paid 08/24')
    expect(undatedBillClue(d.bills[1]!)).toBe('paid 08/19 + 1 more')
  })
  it('falls back to created date for unpaid bills', () => {
    expect(undatedBillClue(d.bills[2]!)).toBe('billed, unpaid · created 08/12')
    expect(undatedBillClue({ ...d.bills[2]!, createdYmd: null })).toBe('billed, unpaid')
  })
  it('names the contradiction on billed-after-paid rows (v2.2337 guard)', () => {
    const bad = { ...d.bills[0]!, billedYmd: '2026-08-30' }
    expect(undatedBillClue(bad)).toBe('billed 08/30 after paid 08/24')
    // earliest contradicted payment wins, not the newest
    const multi = { ...d.bills[1]!, billedYmd: '2026-08-15' }
    expect(undatedBillClue(multi)).toBe('billed 08/15 after paid 08/12')
  })
})

describe('filterUndatedBills', () => {
  const d = parseUndatedBillWorklist(raw)!
  it('searches customer, job, address, and HCP number', () => {
    expect(filterUndatedBills(d.bills, 'seguin')).toHaveLength(2)
    expect(filterUndatedBills(d.bills, '903')).toHaveLength(1)
    expect(filterUndatedBills(d.bills, 'water heater')).toHaveLength(1)
    expect(filterUndatedBills(d.bills, '')).toHaveLength(3)
    expect(filterUndatedBills(d.bills, 'zzz')).toHaveLength(0)
  })
})

describe('oldest first, with an age chip (punch list #184 sweep B)', () => {
  const d = parseUndatedBillWorklist(raw)!
  it('the bill made longest ago leads; a bill with no made date sinks last; the worklist is not touched', () => {
    const undated = { ...d.bills[0]!, invoiceId: 'i0', createdYmd: null }
    const tie = { ...d.bills[2]!, invoiceId: 'i3b' }
    const list = [undated, ...d.bills, tie]
    expect(sortUndatedBillsOldestFirst(list).map((b) => b.invoiceId)).toEqual(['i2', 'i3', 'i3b', 'i1', 'i0'])
    expect(list.map((b) => b.invoiceId)).toEqual(['i0', 'i1', 'i2', 'i3', 'i3b'])
  })
  it('the chip counts whole days since the bill was made, amber at 3, red at 7', () => {
    expect(undatedBillAge({ createdYmd: '2026-08-20' }, '2026-08-20')).toEqual({ days: 0, state: 'fresh', label: 'today' })
    expect(undatedBillAge({ createdYmd: '2026-08-20' }, '2026-08-22')).toEqual({ days: 2, state: 'fresh', label: '2 days waiting' })
    expect(undatedBillAge({ createdYmd: '2026-08-20' }, '2026-08-23')).toEqual({ days: 3, state: 'amber', label: '3 days waiting' })
    expect(undatedBillAge({ createdYmd: '2026-08-20' }, '2026-08-27')).toEqual({ days: 7, state: 'red', label: '7 days waiting' })
    expect(undatedBillAge({ createdYmd: null }, '2026-08-27')).toBeNull()
  })
})
