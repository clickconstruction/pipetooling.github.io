import { describe, expect, it } from 'vitest'
import {
  PAY_SPEED_MIN_SAMPLES,
  billedExpectedPayModel,
  billedReferenceYmd,
  daysBetweenYmd,
  formatYmdMonthDay,
  parsePaySpeedsRpc,
  parsePromisedPayDatesRpc,
  type PaySpeedData,
} from './billedExpectedPay'
import { billedReferenceYmd as serverBilledReferenceYmd } from '../../../supabase/functions/_shared/paymentForecastCore'
import { buildMoneyWaitingFromPayload } from '../../../supabase/functions/_shared/moneyWaitingCore'

const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: {
    knight: { medianDays: 35, samples: 12 },
    thin: { medianDays: 2, samples: PAY_SPEED_MIN_SAMPLES - 1 },
  },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}

describe('parsePaySpeedsRpc', () => {
  it('parses the RPC shape and drops malformed entries', () => {
    const parsed = parsePaySpeedsRpc({
      company: { medianDays: 27.4, samples: 240 },
      customers: {
        a: { medianDays: 35, samples: 12 },
        bad1: { medianDays: 'x', samples: 3 },
        bad2: { medianDays: 10, samples: 0 },
        bad3: null,
      },
    })
    expect(parsed).toEqual({
      company: { medianDays: 27, samples: 240 },
      customers: { a: { medianDays: 35, samples: 12 } },
      segments: { residential: null, commercial: null },
      customerTypes: {},
      receipts: {},
      quality: null,
    })
  })

  it('parses v3 receipts, dropping malformed entries and empty lists', () => {
    const parsed = parsePaySpeedsRpc({
      company: { medianDays: 11, samples: 5 },
      customers: {},
      receipts: {
        knight: [
          { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: 16, jobId: null, jobName: null, address: null },
          { billedYmd: '2026-03-10', paidYmd: '2026-04-10', gapDays: 30.6 },
          { billedYmd: 'bad', paidYmd: '2026-05-17', gapDays: 16, jobId: null, jobName: null, address: null },
          { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: -2 },
          null,
        ],
        empty: [],
        notAList: { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: 16, jobId: null, jobName: null, address: null },
      },
    })
    expect(parsed?.receipts).toEqual({
      knight: [
        { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: 16, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-03-10', paidYmd: '2026-04-10', gapDays: 31, jobId: null, jobName: null, address: null },
      ],
    })
  })

  it('parses v2 segments and customer types, dropping unknown type values', () => {
    const parsed = parsePaySpeedsRpc({
      company: { medianDays: 27, samples: 240 },
      customers: {},
      segments: { residential: { medianDays: 14, samples: 96 }, commercial: null },
      customerTypes: { a: 'commercial', b: 'residential', c: 'municipal' },
    })
    expect(parsed?.segments).toEqual({ residential: { medianDays: 14, samples: 96 }, commercial: null })
    expect(parsed?.customerTypes).toEqual({ a: 'commercial', b: 'residential' })
  })

  it('parses the v6 quality block and rejects partial ones', () => {
    const ok = parsePaySpeedsRpc({
      company: null,
      quality: { payments12mo: 545, measurable: 238, unlinked: 164, undatedInvoices: 84, quarantined: 70 },
    })
    // pre-v8 payloads have no `excluded` — it defaults to 0 (fail-soft)
    expect(ok?.quality).toEqual({ payments12mo: 545, measurable: 238, unlinked: 164, undatedInvoices: 84, quarantined: 70, excluded: 0 })
    expect(parsePaySpeedsRpc({ company: null, quality: { payments12mo: 545 } })?.quality).toBeNull()
    expect(parsePaySpeedsRpc({ company: null })?.quality).toBeNull()
  })

  it('returns null for gate-refused (null) and malformed payloads', () => {
    expect(parsePaySpeedsRpc(null)).toBeNull()
    expect(parsePaySpeedsRpc('nope')).toBeNull()
  })

  it('clamps negative medians to 0 and tolerates a missing customers map', () => {
    expect(parsePaySpeedsRpc({ company: { medianDays: -3, samples: 5 } })).toEqual({
      company: { medianDays: 0, samples: 5 },
      customers: {},
      segments: { residential: null, commercial: null },
      customerTypes: {},
      receipts: {},
      quality: null,
    })
  })
})

describe('billedReferenceYmd', () => {
  it('prefers billed_at, read as its day in the company zone', () => {
    expect(billedReferenceYmd({ billedAtIso: '2026-08-04T15:22:00+00:00', estBillYmd: '2026-08-01' })).toBe('2026-08-04')
  })

  it('a bill marked billed in a Central evening reads that day, not the UTC date', () => {
    // 7:30 pm CDT on Oct 2, in both the Z shape and the +00:00 shape PostgREST returns.
    expect(billedReferenceYmd({ billedAtIso: '2026-10-03T00:30:00Z', estBillYmd: null })).toBe('2026-10-02')
    expect(billedReferenceYmd({ billedAtIso: '2026-10-03T00:30:00.123+00:00', estBillYmd: '2026-09-30' })).toBe('2026-10-02')
    // 6:30 pm CST on Dec 1.
    expect(billedReferenceYmd({ billedAtIso: '2026-12-02T00:30:00Z', estBillYmd: null })).toBe('2026-12-01')
    // Noon UTC is the morning of its own day.
    expect(billedReferenceYmd({ billedAtIso: '2026-10-03T12:00:00Z', estBillYmd: null })).toBe('2026-10-03')
  })

  it('the server twin (paymentForecastCore, the forecast and Money waiting emails) reads the same day', () => {
    for (const at of ['2026-10-03T00:30:00Z', '2026-10-03T00:30:00.123+00:00', '2026-12-02T00:30:00Z', '2026-10-03T12:00:00Z', '2026-08-04T15:22:00+00:00']) {
      expect(serverBilledReferenceYmd({ billed_at: at, est_bill_ymd: null })).toBe(billedReferenceYmd({ billedAtIso: at, estBillYmd: null }))
    }
    expect(serverBilledReferenceYmd({ billed_at: null, est_bill_ymd: '2026-08-01' })).toBe('2026-08-01')
    expect(serverBilledReferenceYmd({ billed_at: 'not a time', est_bill_ymd: '2026-08-01' })).toBe('2026-08-01')
    expect(serverBilledReferenceYmd({ billed_at: null, est_bill_ymd: null })).toBeNull()
  })

  it('falls back to the est. bill date', () => {
    expect(billedReferenceYmd({ billedAtIso: null, estBillYmd: '2026-08-01' })).toBe('2026-08-01')
    expect(billedReferenceYmd({ billedAtIso: '  ', estBillYmd: '2026-08-01' })).toBe('2026-08-01')
  })

  it('returns null with no usable date', () => {
    expect(billedReferenceYmd({ billedAtIso: null, estBillYmd: null })).toBeNull()
    expect(billedReferenceYmd({ billedAtIso: null, estBillYmd: 'soon' })).toBeNull()
  })
})

describe('daysBetweenYmd / formatYmdMonthDay', () => {
  it('counts calendar days across month and DST boundaries', () => {
    expect(daysBetweenYmd('2026-08-30', '2026-09-02')).toBe(3)
    expect(daysBetweenYmd('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetweenYmd('2026-09-02', '2026-08-30')).toBe(-3)
  })

  it('formats month-day', () => {
    expect(formatYmdMonthDay('2026-09-08')).toBe('Sep 8')
    expect(formatYmdMonthDay('2026-01-31')).toBe('Jan 31')
  })
})

describe('billedExpectedPayModel', () => {
  const row = { billedAtIso: '2026-08-04T15:22:00Z', estBillYmd: null, customerId: 'knight' }

  it('upcoming: bill date + customer median', () => {
    const m = billedExpectedPayModel(row, data, '2026-08-20')
    expect(m).not.toBeNull()
    expect(m!.expectedYmd).toBe('2026-09-08')
    expect(m!.state).toBe('upcoming')
    expect(m!.source).toBe('customer')
    expect(m!.daysLate).toBe(0)
    expect(m!.label).toBe('Expect pay ~Sep 8 · pays in ~35d')
  })

  it('an evening bill counts its expected date from its own day', () => {
    const m = billedExpectedPayModel({ billedAtIso: '2026-10-03T00:30:00Z', estBillYmd: null, customerId: 'knight' }, data, '2026-10-03')!
    expect(m.expectedYmd).toBe('2026-11-06') // Oct 2 + 35
    expect(m.title).toContain('Billed Oct 2 +')
  })

  it('the expected date itself is still upcoming; late starts the day after', () => {
    expect(billedExpectedPayModel(row, data, '2026-09-08')!.state).toBe('upcoming')
    const late = billedExpectedPayModel(row, data, '2026-09-09')!
    expect(late.state).toBe('late')
    expect(late.daysLate).toBe(1)
    expect(late.label).toBe('1d past expected · pays in ~35d')
  })

  it('falls back to the company median below the sample threshold', () => {
    const m = billedExpectedPayModel({ ...row, customerId: 'thin' }, data, '2026-08-20')!
    expect(m.source).toBe('company')
    expect(m.medianDays).toBe(27)
    expect(m.label).toBe('Expect pay ~Aug 31 · company avg')
  })

  it('unknown customer uses the company median; no company stat → no chip', () => {
    expect(billedExpectedPayModel({ ...row, customerId: 'stranger' }, data, '2026-08-20')!.source).toBe('company')
    expect(
      billedExpectedPayModel(
        { ...row, customerId: 'stranger' },
        { company: null, customers: {}, segments: { residential: null, commercial: null }, customerTypes: {}, receipts: {}, quality: null },
        '2026-08-20',
      ),
    ).toBeNull()
  })

  it('no data / no reference date → no chip', () => {
    expect(billedExpectedPayModel(row, null, '2026-08-20')).toBeNull()
    expect(billedExpectedPayModel({ billedAtIso: null, estBillYmd: null, customerId: 'knight' }, data, '2026-08-20')).toBeNull()
  })

  it('a promise overrides the estimate — even with no pay-speed data or bill date', () => {
    const promise = { promisedYmd: '2026-09-25', markedByName: 'Malachi' }
    const m = billedExpectedPayModel({ billedAtIso: null, estBillYmd: null, customerId: null }, null, '2026-08-20', promise)!
    expect(m.source).toBe('promised')
    expect(m.state).toBe('upcoming')
    expect(m.expectedYmd).toBe('2026-09-25')
    expect(m.label).toBe('✓ Promised Sep 25 · Malachi')
  })

  it('a blown promise goes late against the promised date', () => {
    const promise = { promisedYmd: '2026-08-15', markedByName: 'Malachi' }
    const m = billedExpectedPayModel(row, data, '2026-08-20', promise)!
    expect(m.source).toBe('promised')
    expect(m.state).toBe('late')
    expect(m.daysLate).toBe(5)
    expect(m.label).toBe('5d past promise · Malachi')
  })
})

describe('parsePromisedPayDatesRpc', () => {
  it('parses the map and drops malformed entries', () => {
    expect(
      parsePromisedPayDatesRpc({
        j1: { promisedYmd: '2026-09-25', markedByName: 'Malachi', markedAt: 'x' },
        j2: { promisedYmd: 'soon', markedByName: 'A' },
        j3: { promisedYmd: '2026-09-01', markedByName: '  ' },
      }),
    ).toEqual({
      j1: { promisedYmd: '2026-09-25', markedByName: 'Malachi' },
      j3: { promisedYmd: '2026-09-01', markedByName: 'office' },
    })
  })

  it('null for gate-refused payloads', () => {
    expect(parsePromisedPayDatesRpc(null)).toBeNull()
  })
})

describe('Money waiting email (moneyWaitingCore)', () => {
  it('an evening bill waits from its own day', () => {
    const mw = buildMoneyWaitingFromPayload({
      generated_at: '2026-10-12T14:00:00Z',
      today: '2026-10-12',
      rows: [{ invoice_id: 'i1', job_id: 'j1', display_number: '1041', job_name: 'Rough-in', job_address: null, customer_id: 'knight', customer_name: 'Knight', billed_at: '2026-10-03T00:30:00+00:00', est_bill_ymd: null, remaining: 500 }],
      pay_speeds: { company: { medianDays: 5, samples: 40 }, customers: { knight: { medianDays: 5, samples: 9 } }, segments: { residential: null, commercial: null }, customerTypes: {} },
    })!
    const bill = mw.rows[0]!.bills[0]!
    expect(bill.billedYmd).toBe('2026-10-02')
    expect(bill.waitDays).toBe(10)
  })
})
