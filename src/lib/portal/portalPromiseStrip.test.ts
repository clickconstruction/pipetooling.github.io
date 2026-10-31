import { describe, expect, it } from 'vitest'
import { BROKEN_PROMISE_GRACE_DAYS } from '../jobs/paymentChaseTouches'
import { promiseCallYmd, promiseChangeChips, promiseStrip } from './portalPromiseStrip'

describe('promiseStrip', () => {
  // A bill of Oct 27, the customer's day Fri Nov 6, read on Mon Nov 2.
  const strip = promiseStrip({ billedOn: '2026-10-27', promisedYmd: '2026-11-06', todayYmd: '2026-11-02' })!

  it('draws billed, today, your day and we call, left to right', () => {
    expect(strip.marks.map((m) => m.kind)).toEqual(['billed', 'today', 'promised', 'call'])
    expect(strip.marks.map((m) => m.word)).toEqual(['billed', 'today', 'your day', 'we call'])
    expect(strip.marks.map((m) => m.day)).toEqual(['Oct 27', '', 'Fri Nov 6', 'Nov 13, if not in'])
    const xs = strip.marks.map((m) => m.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    expect(xs[0]).toBeGreaterThan(0)
    expect(xs[3]).toBeLessThan(100)
    expect(strip.startYmd).toBe('2026-10-27')
    expect(strip.endYmd).toBe('2026-11-13')
    expect(strip.passed).toBe(false)
  })

  it('reads the call day from the office’s rule: the promise plus the chase queue’s grace', () => {
    expect(BROKEN_PROMISE_GRACE_DAYS).toBe(7)
    expect(promiseCallYmd('2026-11-06')).toBe('2026-11-13')
    expect(strip.callYmd).toBe('2026-11-13')
    expect(promiseCallYmd('2026-12-28')).toBe('2027-01-04')
  })

  it('takes the call day the payload sent over the rule here', () => {
    const s = promiseStrip({ billedOn: '2026-10-27', promisedYmd: '2026-11-06', callYmd: '2026-11-09', todayYmd: '2026-11-02' })!
    expect(s.callYmd).toBe('2026-11-09')
    expect(s.marks.find((m) => m.kind === 'call')?.day).toBe('Nov 9, if not in')
  })

  it('says the strip in short sentences', () => {
    expect(strip.words).toBe('Billed Oct 27. Your day is Fri Nov 6. We call Nov 13 if it has not come.')
    for (const sentence of strip.words.split('. ')) expect(sentence.split(' ').length).toBeLessThanOrEqual(20)
  })

  it('draws without the billed mark when the bill has no day', () => {
    const s = promiseStrip({ billedOn: null, promisedYmd: '2026-11-06', todayYmd: '2026-11-02' })!
    expect(s.marks.map((m) => m.kind)).toEqual(['today', 'promised', 'call'])
    expect(s.startYmd).toBe('2026-11-02')
    expect(s.words).toBe('Your day is Fri Nov 6. We call Nov 13 if it has not come.')
  })

  it('marks today after the day once it has gone by', () => {
    const s = promiseStrip({ billedOn: '2026-10-27', promisedYmd: '2026-11-06', todayYmd: '2026-11-10' })!
    expect(s.passed).toBe(true)
    expect(s.marks.map((m) => m.kind)).toEqual(['billed', 'promised', 'today', 'call'])
    expect(s.words).toContain('Your day was Fri Nov 6.')
  })

  it('keeps the strip one day wide at least, and refuses a day that is not one', () => {
    const s = promiseStrip({ billedOn: '2026-11-06', promisedYmd: '2026-11-06', callYmd: '2026-11-06', todayYmd: '2026-11-06' })!
    expect(s.marks).toHaveLength(4)
    expect(promiseStrip({ billedOn: null, promisedYmd: 'soon', todayYmd: '2026-11-02' })).toBeNull()
    expect(promiseStrip({ billedOn: null, promisedYmd: '2026-11-06', todayYmd: '' })).toBeNull()
  })
})

describe('promiseChangeChips', () => {
  it('offers the page’s three Fridays without the day already promised', () => {
    expect(promiseChangeChips('2026-11-02', '2026-11-06').map((c) => c.label)).toEqual(['Fri Nov 13', 'Fri Nov 27'])
    expect(promiseChangeChips('2026-11-02', '2026-11-10').map((c) => c.label)).toEqual(['Fri Nov 6', 'Fri Nov 13', 'Fri Nov 27'])
  })
})
