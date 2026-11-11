import { describe, expect, it } from 'vitest'
import { BILL_IN_KIND_CHANNEL_NOTE, BILL_IN_KIND_CHOICE, BILL_IN_KIND_CHOICE_MANY, BILL_MONEY_CHOICE, BILL_PICK_FIRST, JOB_ON_DEAL_SAVED, billPickDealWords, billQuestionState, billQuestionWords, inKindChipHref, inKindChipTitle, inKindChipWords, billOnDealWords, inKindStandings, jobInKindPayer, jobIsOffTheDeal, jobIsOnTheDeal, jobOffTheDealWords, moneyApart, scheduledInKindWords } from './inKindChip'
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

describe('whose in kind deals a job’s bill reads (jobInKindPayer, v2.6946)', () => {
  const gc = { id: 'gc1', name: 'Done Right Foundation' }
  it('is the job’s customer when the bill goes to the customer', () => {
    expect(jobInKindPayer({ customer_id: 'c1', customer_name: 'Randy Vargo', bill_to_party: 'customer' })).toEqual({ id: 'c1', name: 'Randy Vargo' })
    // A GC on the job changes nothing while the rule still says the customer pays.
    expect(jobInKindPayer({ customer_id: 'c1', customer_name: 'Randy Vargo', bill_to_party: 'customer', gc_customer_id: 'gc1', gcCustomer: gc })).toEqual({ id: 'c1', name: 'Randy Vargo' })
  })
  it('is the GC when the bill goes to the GC, never the job’s customer', () => {
    expect(jobInKindPayer({ customer_id: 'c1', customer_name: 'Randy Vargo', bill_to_party: 'gc', gc_customer_id: 'gc1', gcCustomer: gc })).toEqual({ id: 'gc1', name: 'Done Right Foundation' })
    // A GC job with no customer row bills its GC whatever the rule says.
    expect(jobInKindPayer({ customer_id: null, customer_name: null, bill_to_party: 'customer', gc_customer_id: 'gc1', gcCustomer: gc })).toEqual({ id: 'gc1', name: 'Done Right Foundation' })
  })
  it('falls back to the customer when the rule says GC and the job has none, and reads nobody for no job', () => {
    expect(jobInKindPayer({ customer_id: 'c1', customer_name: 'Randy Vargo', bill_to_party: 'gc' })).toEqual({ id: 'c1', name: 'Randy Vargo' })
    expect(jobInKindPayer(null)).toEqual({ id: null, name: null })
    expect(jobInKindPayer({})).toEqual({ id: null, name: null })
  })
})

describe('a job of a customer who pays in kind', () => {
  const s = inKindStandings([row({})]).get('c1')!
  it('is off the deal when the customer has one, the job is not on it and is not paid', () => {
    expect(jobIsOffTheDeal({ in_kind_arrangement_id: null, status: 'ready_to_bill' }, s)).toBe(true)
    expect(jobIsOffTheDeal({ in_kind_arrangement_id: 'a1', status: 'billed' }, s)).toBe(false)
    expect(jobIsOffTheDeal({ in_kind_arrangement_id: null, status: 'paid' }, s)).toBe(false)
    expect(jobIsOffTheDeal({ in_kind_arrangement_id: null, status: 'billed' }, undefined)).toBe(false)
    expect(jobIsOffTheDeal(null, s)).toBe(false)
  })
  it('is on the deal when an open deal of the customer pays it and it is not paid off', () => {
    expect(jobIsOnTheDeal({ in_kind_arrangement_id: 'a1', status: 'ready_to_bill' }, s)).toBe(true)
    expect(jobIsOnTheDeal({ in_kind_arrangement_id: 'a1', status: 'paid' }, s)).toBe(false)
    expect(jobIsOnTheDeal({ in_kind_arrangement_id: 'gone', status: 'billed' }, s)).toBe(false)
    expect(jobIsOnTheDeal({ in_kind_arrangement_id: null, status: 'billed' }, s)).toBe(false)
    expect(jobIsOnTheDeal({ in_kind_arrangement_id: 'a1', status: 'billed' }, undefined)).toBe(false)
    const w = billOnDealWords('Calloway Holdings')
    expect(plainWordsFailures(w.lead)).toEqual([])
    expect(plainWordsFailures(w.rest)).toEqual([])
  })
  it('says it all in plain words', () => {
    const w = jobOffTheDealWords('Calloway Holdings')
    const all = [w.lead, w.rest, JOB_ON_DEAL_SAVED, billQuestionWords('Calloway Holdings'), BILL_IN_KIND_CHOICE.why, BILL_MONEY_CHOICE.why, BILL_PICK_FIRST, BILL_IN_KIND_CHANNEL_NOTE]
    for (const t of all) expect(plainWordsFailures(t)).toEqual([])
    expect(jobOffTheDealWords('  ').lead).toBe('This customer pays in kind.')
  })
})

describe('Bill Customer on a job off the deal (billQuestionState)', () => {
  const one = inKindStandings([row({})]).get('c1')!
  const two = inKindStandings([row({}), row({ id: 'a2', whatGiven: 'Gravel' })]).get('c1')!

  it('asks nothing when the job is not off a deal', () => {
    const none = { asked: false, manyDeals: false, holds: false, recordsInKind: false, dealId: null }
    expect(billQuestionState(one, false, null)).toEqual(none)
    expect(billQuestionState(undefined, true, 'in_kind')).toEqual(none)
    expect(billQuestionState({ ...one, arrangementIds: [] }, true, 'in_kind')).toEqual(none)
  })

  it('with one open deal: holds until answered, In kind records on that deal, money bills as usual', () => {
    expect(billQuestionState(one, true, null)).toEqual({ asked: true, manyDeals: false, holds: true, recordsInKind: false, dealId: null })
    expect(billQuestionState(one, true, 'in_kind')).toEqual({ asked: true, manyDeals: false, holds: false, recordsInKind: true, dealId: 'a1' })
    expect(billQuestionState(one, true, 'money')).toEqual({ asked: true, manyDeals: false, holds: false, recordsInKind: false, dealId: null })
  })

  it('with two open deals the question is still asked, and In kind never records or sends here (v2.6934)', () => {
    expect(two.arrangementIds).toEqual(['a1', 'a2'])
    // Before v2.6934 two deals asked nothing, and the window billed for money.
    expect(billQuestionState(two, true, null)).toEqual({ asked: true, manyDeals: true, holds: true, recordsInKind: false, dealId: null })
    // In kind cannot know which deal pays: the window holds, and no deal is picked for the person.
    expect(billQuestionState(two, true, 'in_kind')).toEqual({ asked: true, manyDeals: true, holds: true, recordsInKind: false, dealId: null })
    // Money is an answer the person gave, so the bill goes out as any other.
    expect(billQuestionState(two, true, 'money')).toEqual({ asked: true, manyDeals: true, holds: false, recordsInKind: false, dealId: null })
  })

  it('says the two-deal path in plain words', () => {
    const w = billPickDealWords('Calloway Holdings')
    expect(w.lead).toBe('Calloway Holdings has more than one arrangement.')
    for (const t of [w.lead, w.rest, BILL_IN_KIND_CHOICE_MANY.title, BILL_IN_KIND_CHOICE_MANY.why]) expect(plainWordsFailures(t)).toEqual([])
    expect(billPickDealWords(' ').lead).toBe('This customer has more than one arrangement.')
  })
})
