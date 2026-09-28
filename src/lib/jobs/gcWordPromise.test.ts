import { describe, expect, it } from 'vitest'
import {
  gcWordBills,
  payDateShortcuts,
  planWordPromise,
  promiseChannelForWord,
  standingPromiseYmd,
  wordPromiseHeadline,
  wordPromiseNote,
  wordPromiseSavedMessage,
  wordPromiseSummary,
  type GcWordBill,
} from './gcWordPromise'

/** A Sunday. */
const TODAY = '2026-09-27'

const row = (jobId: string, remaining: number, over: Partial<{ hcp: string; jobName: string; jobAddress: string }> = {}) => ({
  jobId,
  hcp: over.hcp ?? '4412',
  jobName: over.jobName ?? 'Barton Lofts',
  jobAddress: over.jobAddress ?? '1200 Barton Springs',
  remaining,
})

const bill = (jobId: string, amount: number, promisedYmd: string | null = null): GcWordBill => ({ jobId, label: jobId, amount, promisedYmd })

describe('gcWordBills', () => {
  it('folds a job’s invoice rows into one bill, largest first', () => {
    const bills = gcWordBills([row('a', 1000), row('b', 5000, { hcp: '4431', jobAddress: '88 Rainey St' }), row('a', 250.5)], null)
    expect(bills).toEqual([
      { jobId: 'b', label: '4431 · 88 Rainey St', amount: 5000, promisedYmd: null },
      { jobId: 'a', label: '4412 · 1200 Barton Springs', amount: 1250.5, promisedYmd: null },
    ])
  })

  it('carries the date each job was promised', () => {
    const bills = gcWordBills([row('a', 100), row('b', 50)], { a: { promisedYmd: '2026-10-09' }, b: { promisedYmd: 'soon' } })
    expect(bills.map((b) => b.promisedYmd)).toEqual(['2026-10-09', null])
  })

  it('names a job by what it has: the name when there is no address, no number when there is none', () => {
    expect(gcWordBills([row('a', 1, { hcp: '—', jobAddress: '' })], null)[0]!.label).toBe('Barton Lofts')
    expect(gcWordBills([row('a', 1, { hcp: '—', jobAddress: '', jobName: '' })], null)[0]!.label).toBe('Job')
  })
})

describe('standingPromiseYmd', () => {
  it('is the latest date still ahead; today counts, a passed date does not', () => {
    expect(standingPromiseYmd([bill('a', 1, '2026-10-02'), bill('b', 1, '2026-10-09'), bill('c', 1, '2026-09-20')], TODAY)).toBe('2026-10-09')
    expect(standingPromiseYmd([bill('a', 1, TODAY)], TODAY)).toBe(TODAY)
    expect(standingPromiseYmd([bill('a', 1, '2026-09-26'), bill('b', 1)], TODAY)).toBeNull()
  })
})

describe('wordPromiseHeadline', () => {
  it('leads with the oldest date that passed with money open', () => {
    const bills = [bill('a', 100, '2026-09-25'), bill('b', 100, '2026-09-20'), bill('c', 100, '2026-10-09'), bill('d', 100)]
    expect(wordPromiseHeadline(bills, TODAY)).toEqual({ tone: 'late', text: 'They said Sep 20 · 7 days late · 2 of 4 bills' })
  })

  it('a paid bill kept its word', () => {
    expect(wordPromiseHeadline([bill('a', 0, '2026-09-20')], TODAY)).toBeNull()
  })

  it('else the date still ahead; one bill needs no count', () => {
    expect(wordPromiseHeadline([bill('a', 100, '2026-10-09'), bill('b', 100)], TODAY)).toEqual({ tone: 'standing', text: 'They said Oct 9 · 1 of 2 bills' })
    expect(wordPromiseHeadline([bill('a', 100, '2026-09-26')], TODAY)).toEqual({ tone: 'late', text: 'They said Sep 26 · 1 day late' })
  })

  it('no date, no line', () => {
    expect(wordPromiseHeadline([bill('a', 100)], TODAY)).toBeNull()
  })
})

describe('payDateShortcuts', () => {
  it('from a Sunday: the coming Friday, the one after, and the month after a month end three days out', () => {
    expect(payDateShortcuts(TODAY)).toEqual([
      { key: 'this_friday', label: 'This Fri · Oct 2', ymd: '2026-10-02' },
      { key: 'next_friday', label: 'Next Fri · Oct 9', ymd: '2026-10-09' },
      { key: 'month_end', label: 'End of Oct', ymd: '2026-10-31' },
    ])
  })

  it('on a Friday, this Friday is today', () => {
    expect(payDateShortcuts('2026-10-02').slice(0, 2).map((s) => s.ymd)).toEqual(['2026-10-02', '2026-10-09'])
  })

  it('keeps this month’s end while it is a week or more away, leap years included', () => {
    expect(payDateShortcuts('2026-09-10').find((s) => s.key === 'month_end')).toEqual({ key: 'month_end', label: 'End of Sep', ymd: '2026-09-30' })
    expect(payDateShortcuts('2028-02-03').find((s) => s.key === 'month_end')?.ymd).toBe('2028-02-29')
    expect(payDateShortcuts('2026-12-28').find((s) => s.key === 'month_end')?.ymd).toBe('2027-01-31')
  })

  it('puts the date they already gave first, once', () => {
    expect(payDateShortcuts(TODAY, '2026-10-15')[0]).toEqual({ key: 'standing', label: 'Still Oct 15', ymd: '2026-10-15' })
    expect(payDateShortcuts(TODAY, '2026-10-09').map((s) => s.key)).toEqual(['standing', 'this_friday', 'month_end'])
    expect(payDateShortcuts(TODAY, '2026-09-20').map((s) => s.key)).toEqual(['this_friday', 'next_friday', 'month_end'])
  })

  it('offers nothing without a day to count from', () => {
    expect(payDateShortcuts('')).toEqual([])
  })
})

describe('planWordPromise', () => {
  const bills = [bill('a', 11250, '2026-09-25'), bill('b', 8900, '2026-10-09'), bill('c', 4349.49), bill('d', 3000)]

  it('files the picked bills that do not carry the date yet', () => {
    const plan = planWordPromise({ bills, picked: new Set(['a', 'b', 'c', 'd']), ymd: '2026-10-09' })
    expect(plan.file.map((b) => b.jobId)).toEqual(['a', 'c', 'd'])
    expect(plan).toMatchObject({ pickedCount: 4, same: 1, moves: 1 })
    expect(plan.total).toBeCloseTo(27499.49, 2)
  })

  it('leaves an unpicked bill alone', () => {
    const plan = planWordPromise({ bills, picked: new Set(['c']), ymd: '2026-10-09' })
    expect(plan.file.map((b) => b.jobId)).toEqual(['c'])
    expect(plan).toMatchObject({ pickedCount: 1, same: 0, moves: 0, total: 4349.49 })
  })

  it('files nothing without a date', () => {
    expect(planWordPromise({ bills, picked: new Set(['a']), ymd: '' })).toEqual({ file: [], pickedCount: 0, same: 0, moves: 0, total: 0 })
    expect(planWordPromise({ bills, picked: new Set(['a']), ymd: null }).file).toEqual([])
  })
})

describe('wordPromiseSummary', () => {
  const bills = [bill('a', 11250, '2026-09-25'), bill('b', 8900, '2026-10-09'), bill('c', 4349.49), bill('d', 3000)]
  const summary = (picked: string[], list = bills) => wordPromiseSummary(planWordPromise({ bills: list, picked: new Set(picked), ymd: '2026-10-09' }), list, '2026-10-09')

  it('says which bills, what they add up to, and what changes', () => {
    expect(summary(['a', 'b', 'c', 'd'])).toEqual({
      line: 'Goes on all 4 bills · $27,499.49',
      notes: ['1 bill had a different date — that promise goes on record as broken', '1 already says Oct 9'],
    })
    expect(summary(['c', 'd'])).toEqual({ line: 'Goes on 2 of 4 bills · $7,349.49', notes: [] })
  })

  it('names the bill when the GC has one', () => {
    expect(summary(['x'], [{ jobId: 'x', label: '4412 · 1200 Barton Springs', amount: 103386.4, promisedYmd: null }]).line).toBe('Goes on 4412 · 1200 Barton Springs · $103,386.40')
  })

  it('with nothing picked the date stays with the word', () => {
    expect(summary([])).toEqual({ line: 'No bills picked — the date stays with the word only', notes: [] })
  })
})

describe('promiseChannelForWord', () => {
  it('speaks the promise record’s channels', () => {
    expect(promiseChannelForWord('call')).toBe('phone')
    expect(promiseChannelForWord('text')).toBe('text')
    expect(promiseChannelForWord('email')).toBe('email')
    expect(promiseChannelForWord('in_person')).toBe('in_person')
    expect(promiseChannelForWord('other')).toBeNull()
    expect(promiseChannelForWord(null)).toBeNull()
  })
})

describe('wordPromiseNote', () => {
  it('keeps the word, and whose it was when someone else typed it', () => {
    expect(wordPromiseNote({ note: ' Hot — the check run is the 9th. ', wordFromName: 'Malachi', enteredByName: 'Taunya' })).toBe('GC Review — Malachi’s word, entered by Taunya: Hot — the check run is the 9th.')
    expect(wordPromiseNote({ note: 'Hot — the check run is the 9th.', wordFromName: 'Taunya', enteredByName: 'Taunya' })).toBe('GC Review: Hot — the check run is the 9th.')
    expect(wordPromiseNote({ note: '' })).toBe('GC Review')
  })

  it('stops at the record’s length', () => {
    const out = wordPromiseNote({ note: 'x'.repeat(600) })
    expect(out).toHaveLength(500)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('wordPromiseSavedMessage', () => {
  it('says where the date now shows', () => {
    expect(wordPromiseSavedMessage({ ymd: '2026-10-09', saved: 3, failed: 0 })).toEqual({ text: 'Oct 9 is on 3 bills — the Stages board and the forecast read it.', tone: 'success' })
  })

  it('says what did not save, and where to set it', () => {
    expect(wordPromiseSavedMessage({ ymd: '2026-10-09', saved: 2, failed: 1 })).toEqual({ text: 'The word is in. Oct 9 did not reach 1 bill (2 saved) — set it from the Stages board.', tone: 'warning' })
    expect(wordPromiseSavedMessage({ ymd: '2026-10-09', saved: 0, failed: 2 }).text).toBe('The word is in. Oct 9 did not reach 2 bills — set them from the Stages board.')
  })
})
