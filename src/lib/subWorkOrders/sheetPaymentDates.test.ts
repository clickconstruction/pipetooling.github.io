import { describe, expect, it } from 'vitest'
import { paymentDayWords, sheetPaidInFullWords, sheetPaidLine, sheetPaymentDates } from './sheetPaymentDates'

const TODAY = '2026-11-13'

describe('sheetPaymentDates', () => {
  it('reads each payment by its Date sent, oldest first, and leaves back-charges out', () => {
    const s = sheetPaymentDates([
      { amount: 3000, payment_date: '2026-11-10', created_at: '2026-11-11T15:00:00Z' },
      { amount: -150, payment_date: null, created_at: '2026-11-06T15:00:00Z' },
      { amount: 1500, payment_date: '2026-10-21', created_at: '2026-10-21T15:00:00Z' },
    ])
    expect(s.count).toBe(2)
    expect(s.dates).toEqual([
      { ymd: '2026-10-21', recorded: false },
      { ymd: '2026-11-10', recorded: false },
    ])
    expect(s.last).toEqual({ ymd: '2026-11-10', recorded: false })
  })

  it('a payment with no Date sent takes the day it was recorded, in the app timezone, and says so', () => {
    // 03:30 UTC on the 29th is the evening of the 28th in Central time.
    const s = sheetPaymentDates([{ amount: 1200, payment_date: null, created_at: '2026-10-29T03:30:00Z' }])
    expect(s.dates).toEqual([{ ymd: '2026-10-28', recorded: true }])
    expect(sheetPaidLine(s, TODAY)).toBe('recorded Oct 28')
  })

  it('an amount typed as text still counts, and a zero or empty list gives nothing', () => {
    expect(sheetPaymentDates([{ amount: '850.00', payment_date: '2026-11-05' }]).count).toBe(1)
    expect(sheetPaymentDates([{ amount: 0, payment_date: '2026-11-05' }]).count).toBe(0)
    expect(sheetPaymentDates(null)).toEqual({ count: 0, dates: [], last: null })
    expect(sheetPaidLine(sheetPaymentDates(undefined), TODAY)).toBeNull()
    expect(sheetPaidInFullWords(sheetPaymentDates([]), TODAY)).toBeNull()
  })

  it('a payment with no day at all is counted and not listed', () => {
    const s = sheetPaymentDates([
      { amount: 500, payment_date: '2026-10-14' },
      { amount: 200, payment_date: null, created_at: null },
    ])
    expect(s.count).toBe(2)
    expect(s.dates).toHaveLength(1)
    // Two payments but one day known: the count leads, so the line never reads as one payment.
    expect(sheetPaidLine(s, TODAY)).toBe('2 payments · last Oct 14')
  })
})

describe('the row words', () => {
  it('one or two payments name each day, more name the count and the newest day', () => {
    expect(sheetPaidLine(sheetPaymentDates([{ amount: 2150, payment_date: '2026-11-03' }]), TODAY)).toBe('Nov 3')
    expect(sheetPaidLine(sheetPaymentDates([{ amount: 1500, payment_date: '2026-10-21' }, { amount: 3000, payment_date: '2026-11-10' }]), TODAY)).toBe('Oct 21 · Nov 10')
    expect(
      sheetPaidLine(
        sheetPaymentDates([
          { amount: 1200, payment_date: '2026-10-28' },
          { amount: 1200, payment_date: '2026-11-12' },
          { amount: 1200, payment_date: '2026-11-02' },
        ]),
        TODAY,
      ),
    ).toBe('3 payments · last Nov 12')
  })

  it('a day in another year carries its year', () => {
    expect(paymentDayWords({ ymd: '2025-12-03', recorded: false }, TODAY)).toBe('Dec 3, 2025')
    expect(paymentDayWords({ ymd: '2026-01-09', recorded: false }, TODAY)).toBe('Jan 9')
  })

  it('a settled sheet says the day it was paid in full', () => {
    expect(sheetPaidInFullWords(sheetPaymentDates([{ amount: 1200, payment_date: '2026-10-28' }, { amount: 2400, payment_date: '2026-11-12' }]), TODAY)).toBe('paid in full Nov 12')
    expect(sheetPaidInFullWords(sheetPaymentDates([{ amount: 900, payment_date: null, created_at: '2026-11-08T18:00:00Z' }]), TODAY)).toBe('paid in full · recorded Nov 8')
  })
})
