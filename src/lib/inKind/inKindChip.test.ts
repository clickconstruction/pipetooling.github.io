import { describe, expect, it } from 'vitest'
import { inKindChipHref, inKindChipTitle, inKindChipWords, inKindStandings, moneyApart, scheduledInKindWords } from './inKindChip'
import type { InKindListRow } from './inKindList'
import { plainWordsFailures } from '../plainWords'

const row = (o: Partial<InKindListRow>): InKindListRow => ({
  id: 'a1',
  customerId: 'c1',
  partner: 'Calloway Holdings',
  whatGiven: 'Rent credit',
  kind: 'Every month',
  ended: false,
  work: 19875.4,
  paidInKind: 10500,
  left: 9375.4,
  ahead: 0,
  lineCount: 6,
  dueMonth: null,
  dueCount: 0,
  next: '',
  ...o,
})

describe('inKindStandings', () => {
  it('gives one standing a customer, over the open deals only', () => {
    const m = inKindStandings([row({}), row({ id: 'a2', left: 100, paidInKind: 50 }), row({ id: 'a3', ended: true, left: 999 }), row({ id: 'a4', customerId: 'c2', left: 0, ahead: 1400, paidInKind: 0 })])
    expect(m.get('c1')).toEqual({ customerId: 'c1', arrangementIds: ['a1', 'a2'], left: 9475.4, ahead: 0, paidInKind: 10550, dueMonth: null, dueCount: 0 })
    expect(m.get('c2')?.ahead).toBe(1400)
    expect(m.size).toBe(2)
  })
  it('puts the deal with a month due first, and keeps the oldest due month', () => {
    const m = inKindStandings([row({}), row({ id: 'a2', dueMonth: '2026-11-01', dueCount: 1 }), row({ id: 'a3', dueMonth: '2026-10-01', dueCount: 2 })])
    const s = m.get('c1')!
    expect(s.arrangementIds).toEqual(['a3', 'a2', 'a1'])
    expect(s.dueMonth).toBe('2026-10-01')
    expect(s.dueCount).toBe(3)
    expect(inKindChipHref(s)).toBe('/customers/c1?inKind=a3')
  })
  it('skips a deal with no customer and an ended one', () => {
    expect(inKindStandings([row({ customerId: null }), row({ ended: true })]).size).toBe(0)
  })
})

describe('inKindChipWords', () => {
  const s = (o: Partial<InKindListRow>) => inKindStandings([row(o)]).get('c1')!
  it('says what is still to come when the deal is on schedule', () => {
    expect(inKindChipWords(s({}))).toEqual({ text: 'In kind · $9,375.40 to come', tone: 'quiet' })
  })
  it('says the month that is due, in amber, ahead of the amount', () => {
    expect(inKindChipWords(s({ dueMonth: '2026-11-01', dueCount: 1 }))).toEqual({ text: 'In kind · November due', tone: 'due' })
    expect(inKindChipWords(s({ dueMonth: '2026-10-01', dueCount: 2 }))).toEqual({ text: 'In kind · 2 months due', tone: 'due' })
  })
  it('says the work we owe when they gave first', () => {
    expect(inKindChipWords(s({ left: 0, ahead: 1400 }))).toEqual({ text: 'In kind · we owe $1,400.00 of work', tone: 'quiet' })
  })
  it('says only In kind when nothing is open, and in the short form', () => {
    expect(inKindChipWords(s({ left: 0 })).text).toBe('In kind')
    expect(inKindChipWords(s({}), 'short')).toEqual({ text: 'In kind', tone: 'quiet' })
    expect(inKindChipWords(s({ dueMonth: '2026-11-01', dueCount: 1 }), 'short')).toEqual({ text: 'In kind', tone: 'due' })
  })
  it('reads out the whole standing in plain words', () => {
    const title = inKindChipTitle(s({ dueMonth: '2026-11-01', dueCount: 1 }))
    expect(title).toBe('Pays in kind. November’s credit is not entered. $9,375.40 is still to come on its bills. Opens the ledger.')
    expect(plainWordsFailures(title)).toEqual([])
  })
})

describe('moneyApart', () => {
  const s = inKindStandings([row({})]).get('c1')!
  it('leaves the whole balance as money for a customer with no deal', () => {
    expect(moneyApart(4210, undefined)).toEqual({ money: 4210, inKind: 0 })
  })
  it('takes the part the deal pays out of the money', () => {
    expect(moneyApart(9375.4, s)).toEqual({ money: 0, inKind: 9375.4 })
    expect(moneyApart(9590.4, s)).toEqual({ money: 215, inKind: 9375.4 })
  })
  it('never takes more than the balance', () => {
    expect(moneyApart(5000, s)).toEqual({ money: 0, inKind: 5000 })
    expect(moneyApart(-3, s)).toEqual({ money: 0, inKind: 0 })
  })
  it('names the in kind part under a total, or says nothing', () => {
    expect(scheduledInKindWords(9375.4)).toBe('$9,375.40 more is scheduled in kind')
    expect(scheduledInKindWords(0)).toBeNull()
  })
})
