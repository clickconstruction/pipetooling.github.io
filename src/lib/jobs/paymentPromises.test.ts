import { describe, expect, it } from 'vitest'
import {
  BROKEN_AFTER_DAYS,
  KEPT_GRACE_BUSINESS_DAYS,
  addBusinessDaysYmd,
  buildCustomerPromiseRecords,
  classifyPromises,
  formatKeptRecord,
  formatUsualSlip,
  paidOffYmd,
  parsePaymentPromisesRpc,
  parsePromiseRecordsRpc,
  promiseDeadlineYmd,
  type PromiseRecordInput,
} from './paymentPromises'

const TODAY = '2026-09-11'

function rec(over: Partial<PromiseRecordInput> & { id: string }): PromiseRecordInput {
  return {
    jobId: 'j1',
    customerId: 'c1',
    promisedYmd: '2026-09-04', // a Friday
    createdAt: '2026-08-28T15:00:00Z',
    source: 'office',
    billedTotal: 250,
    payments: [],
    ...over,
  }
}

describe('business-day grace', () => {
  it('skips weekends', () => {
    // Fri Sep 4 + 3 business days = Wed Sep 9
    expect(addBusinessDaysYmd('2026-09-04', 3)).toBe('2026-09-09')
    // Wed Sep 2 + 3 = Mon Sep 7
    expect(addBusinessDaysYmd('2026-09-02', 3)).toBe('2026-09-07')
    expect(addBusinessDaysYmd('2026-09-02', 0)).toBe('2026-09-02')
    expect(addBusinessDaysYmd('garbage', 3)).toBe('garbage')
  })
  it('the deadline is the promised date plus the grace', () => {
    expect(KEPT_GRACE_BUSINESS_DAYS).toBe(3)
    expect(promiseDeadlineYmd('2026-09-04')).toBe('2026-09-09')
  })
})

describe('paidOffYmd', () => {
  it('is the day cumulative payments cover the billed total', () => {
    expect(paidOffYmd(250, [{ paidOn: '2026-09-01', amount: 100 }, { paidOn: '2026-09-08', amount: 150 }])).toBe('2026-09-08')
  })
  it('tolerates a dollar of rounding', () => {
    expect(paidOffYmd(250, [{ paidOn: '2026-09-08', amount: 249.4 }])).toBe('2026-09-08')
    expect(paidOffYmd(250, [{ paidOn: '2026-09-08', amount: 200 }])).toBeNull()
  })
  it('counts payments made before the promise', () => {
    expect(paidOffYmd(1000, [{ paidOn: '2026-08-01', amount: 900 }, { paidOn: '2026-09-05', amount: 100 }])).toBe('2026-09-05')
  })
  it('nothing billed → the first payment (or null)', () => {
    expect(paidOffYmd(0, [])).toBeNull()
    expect(paidOffYmd(0, [{ paidOn: '2026-09-02', amount: 50 }])).toBe('2026-09-02')
  })
})

describe('classifyPromises — the one rule', () => {
  it('kept: paid on the promised day', () => {
    const [o] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-04', amount: 250 }] })], TODAY)
    expect(o!.state).toBe('kept')
    expect(o!.daysLate).toBe(0)
    expect(o!.paidOffYmd).toBe('2026-09-04')
    expect(o!.deadlineYmd).toBe('2026-09-09')
  })
  it('kept: paid inside the mail grace, and the slip is still recorded', () => {
    const [o] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-08', amount: 250 }] })], TODAY)
    expect(o!.state).toBe('kept')
    expect(o!.daysLate).toBe(4)
  })
  it('kept: paid early counts as kept with a negative slip', () => {
    const [o] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-01', amount: 250 }] })], TODAY)
    expect(o!.state).toBe('kept')
    expect(o!.daysLate).toBe(-3)
  })
  it('late: paid after the grace', () => {
    const [o] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-10', amount: 250 }] })], TODAY)
    expect(o!.state).toBe('late')
    expect(o!.daysLate).toBe(6)
  })
  it('a partial payment is never kept', () => {
    const [o] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-04', amount: 100 }] })], '2026-09-10')
    expect(o!.state).toBe('open')
    expect(o!.paidOffYmd).toBeNull()
    const [later] = classifyPromises([rec({ id: 'p', payments: [{ paidOn: '2026-09-04', amount: 100 }] })], '2026-10-01')
    expect(later!.state).toBe('broken')
  })
  it('open while unpaid inside the chase grace, broken after it', () => {
    expect(BROKEN_AFTER_DAYS).toBe(7)
    const [open] = classifyPromises([rec({ id: 'p' })], '2026-09-10')
    expect(open!.state).toBe('open')
    const [broken] = classifyPromises([rec({ id: 'p' })], '2026-09-11')
    expect(broken!.state).toBe('broken')
    expect(broken!.rePromised).toBe(false)
  })
  it('a newer promise on the same job breaks the older one, whatever the date', () => {
    const out = classifyPromises(
      [
        rec({ id: 'first', promisedYmd: '2026-09-25', createdAt: '2026-09-01T10:00:00Z' }),
        rec({ id: 'second', promisedYmd: '2026-10-02', createdAt: '2026-09-10T10:00:00Z' }),
      ],
      TODAY,
    )
    const first = out.find((o) => o.id === 'first')!
    const second = out.find((o) => o.id === 'second')!
    expect(first.state).toBe('broken')
    expect(first.rePromised).toBe(true)
    expect(first.promiseIndexOnJob).toBe(0)
    expect(second.state).toBe('open')
    expect(second.promiseIndexOnJob).toBe(1)
  })
  it('a re-promised job that was eventually paid still marks the earlier promise broken', () => {
    const pay = [{ paidOn: '2026-10-01', amount: 250 }]
    const out = classifyPromises(
      [
        rec({ id: 'first', promisedYmd: '2026-09-04', createdAt: '2026-08-28T10:00:00Z', payments: pay }),
        rec({ id: 'second', promisedYmd: '2026-09-30', createdAt: '2026-09-12T10:00:00Z', payments: pay }),
      ],
      '2026-10-05',
    )
    // The money did arrive — the first promise reads late (27 days), not broken:
    // a paid-off promise is judged by when the money came, re-promised or not.
    expect(out.find((o) => o.id === 'first')!.state).toBe('late')
    expect(out.find((o) => o.id === 'first')!.daysLate).toBe(27)
    expect(out.find((o) => o.id === 'second')!.state).toBe('kept')
  })
  it('promises on different jobs never affect each other', () => {
    const out = classifyPromises(
      [rec({ id: 'a', jobId: 'j1', createdAt: '2026-09-01T10:00:00Z' }), rec({ id: 'b', jobId: 'j2', createdAt: '2026-09-02T10:00:00Z' })],
      '2026-09-05',
    )
    expect(out.every((o) => o.state === 'open' && !o.rePromised)).toBe(true)
  })
})

describe('buildCustomerPromiseRecords', () => {
  it('rolls kept / late / broken / open into a record with kept rate and usual slip', () => {
    const outcomes = classifyPromises(
      [
        rec({ id: 'k1', jobId: 'j1', payments: [{ paidOn: '2026-09-04', amount: 250 }] }),
        rec({ id: 'k2', jobId: 'j2', payments: [{ paidOn: '2026-09-07', amount: 250 }] }), // kept, slip 3
        rec({ id: 'l1', jobId: 'j3', payments: [{ paidOn: '2026-09-20', amount: 250 }] }), // late, slip 16
        rec({ id: 'b1', jobId: 'j4', promisedYmd: '2026-08-20' }), // broken (unpaid, 22d)
        rec({ id: 'b2', jobId: 'j5', promisedYmd: '2026-08-20', createdAt: '2026-08-10T10:00:00Z' }),
        rec({ id: 'b2b', jobId: 'j5', promisedYmd: '2026-09-30', createdAt: '2026-09-01T10:00:00Z' }), // re-promise, open
      ],
      TODAY,
    )
    const rec1 = buildCustomerPromiseRecords(outcomes).get('c1')!
    expect(rec1.decided).toBe(5)
    expect(rec1.kept).toBe(2)
    expect(rec1.late).toBe(1)
    expect(rec1.broken).toBe(2)
    expect(rec1.open).toBe(1)
    expect(rec1.rePromised).toBe(1)
    expect(rec1.openBroken).toBe(1)
    expect(rec1.keptRate).toBeCloseTo(0.4)
    expect(rec1.usualSlipDays).toBe(3) // median of 0, 3, 16
    expect(rec1.lastPromisedYmd).toBe('2026-09-30')
    expect(formatKeptRecord(rec1)).toBe('keeps 2 of 5')
    expect(formatUsualSlip(rec1)).toBe('slips ~3d')
  })
  it('skips promises with no customer and reads "kept N of N" when perfect', () => {
    const outcomes = classifyPromises(
      [
        rec({ id: 'x', customerId: null, payments: [{ paidOn: '2026-09-04', amount: 250 }] }),
        rec({ id: 'y', jobId: 'j9', customerId: 'c2', payments: [{ paidOn: '2026-09-04', amount: 250 }] }),
      ],
      TODAY,
    )
    const recs = buildCustomerPromiseRecords(outcomes)
    expect(recs.has('c1')).toBe(false)
    const c2 = recs.get('c2')!
    expect(formatKeptRecord(c2)).toBe('kept 1 of 1')
    expect(formatUsualSlip(c2)).toBeNull()
    expect(formatKeptRecord({ kept: 0, decided: 0 })).toBeNull()
  })
})

describe('parsers', () => {
  it('parsePaymentPromisesRpc keeps well-formed rows and defaults the rest', () => {
    const rows = parsePaymentPromisesRpc([
      { id: 'a', jobId: 'j', customerId: 'c', promisedYmd: '2026-09-04', saidBy: ' Tanya ', heardByName: 'Taunya', channel: 'phone', source: 'office', note: '', createdAt: '2026-09-01T00:00:00Z' },
      { id: 'b', jobId: 'j', promisedYmd: '2026-09-12', channel: 'carrier-pigeon', source: 'customer', createdAt: '2026-09-02T00:00:00Z' },
      { id: 'bad', jobId: 'j', promisedYmd: 'soon', createdAt: '2026-09-02T00:00:00Z' },
      null,
    ])!
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ saidBy: 'Tanya', heardByName: 'Taunya', channel: 'phone', source: 'office', note: null })
    expect(rows[1]).toMatchObject({ customerId: null, channel: null, source: 'customer', heardByName: null })
    expect(parsePaymentPromisesRpc(null)).toBeNull()
    expect(parsePaymentPromisesRpc({})).toBeNull()
  })
  it('parsePromiseRecordsRpc coerces numbers and sorts payments', () => {
    const rows = parsePromiseRecordsRpc([
      {
        id: 'a', jobId: 'j', customerId: 'c', promisedYmd: '2026-09-04', createdAt: '2026-09-01T00:00:00Z', source: 'office',
        billedTotal: '250.00',
        payments: [{ paidOn: '2026-09-08', amount: '150' }, { paidOn: '2026-09-01', amount: 100 }, { paidOn: 'nope', amount: 1 }],
      },
    ])!
    expect(rows[0]!.billedTotal).toBe(250)
    expect(rows[0]!.payments.map((p) => p.paidOn)).toEqual(['2026-09-01', '2026-09-08'])
    expect(parsePromiseRecordsRpc('x')).toBeNull()
  })
})
