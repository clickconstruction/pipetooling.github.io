import { describe, expect, it } from 'vitest'
import { addInKindApart, inKindApartWords, noInKindApart, rowIsScheduledInKind, splitInKind } from './inKindApart'

type Bill = { id: string; open: number; in_kind_arrangement_id?: string | null }
const onDeal = (b: Bill) => rowIsScheduledInKind(b)
const openOf = (b: Bill) => b.open

describe('splitInKind', () => {
  it('sets a bill a deal pays apart and counts what is open on it', () => {
    const bills: Bill[] = [
      { id: 'a', open: 4200, in_kind_arrangement_id: 'deal-1' },
      { id: 'b', open: 900 },
    ]
    const split = splitInKind(bills, onDeal, openOf)
    expect(split.money.map((b) => b.id)).toEqual(['b'])
    expect(split.scheduled.map((b) => b.id)).toEqual(['a'])
    expect(split.inKind).toEqual({ count: 1, dollars: 4200 })
  })

  it('keeps a payer’s bills off the deal as money, in the order they came', () => {
    const bills: Bill[] = [
      { id: 'money-1', open: 100 },
      { id: 'deal-1', open: 250.25, in_kind_arrangement_id: 'd' },
      { id: 'money-2', open: 300 },
      { id: 'deal-2', open: 250.5, in_kind_arrangement_id: 'd' },
    ]
    const split = splitInKind(bills, onDeal, openOf)
    expect(split.money.map((b) => b.id)).toEqual(['money-1', 'money-2'])
    expect(split.inKind).toEqual({ count: 2, dollars: 500.75 })
  })

  it('leaves an ordinary late bill where it was', () => {
    const bills: Bill[] = [{ id: 'late', open: 1800, in_kind_arrangement_id: null }]
    const split = splitInKind(bills, onDeal, openOf)
    expect(split.money).toEqual(bills)
    expect(split.scheduled).toEqual([])
    expect(split.inKind).toEqual(noInKindApart())
  })

  it('takes a paid-off bill on a deal out of the money pile and counts nothing for it', () => {
    const split = splitInKind([{ id: 'settled', open: 0, in_kind_arrangement_id: 'd' }], onDeal, openOf)
    expect(split.money).toEqual([])
    expect(split.scheduled).toHaveLength(1)
    expect(split.inKind).toEqual({ count: 0, dollars: 0 })
  })
})

describe('rowIsScheduledInKind', () => {
  it('reads the job’s column or a shaped row’s camel-cased one', () => {
    expect(rowIsScheduledInKind({ in_kind_arrangement_id: 'd' })).toBe(true)
    expect(rowIsScheduledInKind({ inKindArrangementId: 'd' })).toBe(true)
    expect(rowIsScheduledInKind({ inKindArrangementId: null })).toBe(false)
    expect(rowIsScheduledInKind({})).toBe(false)
    expect(rowIsScheduledInKind(null)).toBe(false)
  })
})

describe('inKindApartWords', () => {
  it('says the one line, and nothing when no bill is set apart', () => {
    expect(inKindApartWords({ count: 8, dollars: 14643.46 }, 'money owed')).toBe('$14,643 on 8 bills is scheduled in kind, not money owed')
    expect(inKindApartWords({ count: 1, dollars: 500 }, 'money coming')).toBe('$500 on 1 bill is scheduled in kind, not money coming')
    expect(inKindApartWords(noInKindApart(), 'money owed')).toBeNull()
  })
})

describe('addInKindApart', () => {
  it('adds two counts', () => {
    expect(addInKindApart({ count: 1, dollars: 10.1 }, { count: 2, dollars: 20.2 })).toEqual({ count: 3, dollars: 30.3 })
  })
})
