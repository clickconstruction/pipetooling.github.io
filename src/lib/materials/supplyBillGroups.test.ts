import { describe, expect, it } from 'vitest'
import { billDateWords, billDayName, dueGroupKey, groupSupplyBills, isBareOfJobAccount, supplyBillSummary, unpaidBillsWords, type SupplyBillForGroup, type SupplyBillForSummary } from './supplyBillGroups'

// Made-up bills.
const bill = (id: string, due_date: string | null, amount: number | null, is_paid = false): SupplyBillForGroup => ({ id, due_date, amount, is_paid })
const today = '2026-03-10'
const dayLabel = (ymd: string): string => `d${ymd.slice(8)}`
const rows = [
  bill('a', '2026-03-15', 100),
  bill('b', '2026-03-01', 40),
  bill('c', '2026-03-15', 250.5),
  bill('d', null, 12),
  bill('e', '2026-02-10', 60),
  bill('f', '2026-03-25', 5),
  bill('g', '2026-03-15', -50),
  bill('h', '2026-02-01', 999, true),
  bill('i', '2026-03-10', 7),
]

describe('groupSupplyBills', () => {
  it('reads past due first, then each due day soonest first, then no due date, then paid', () => {
    const groups = groupSupplyBills(rows, today, dayLabel)
    expect(groups.map((g) => [g.key, g.kind, g.title])).toEqual([
      ['past', 'past', 'Past due'],
      ['2026-03-10', 'due', 'Due today'],
      ['2026-03-15', 'due', 'Due d15'],
      ['2026-03-25', 'due', 'Due d25'],
      ['none', 'none', 'No due date'],
      ['paid', 'paid', 'Paid'],
    ])
  })

  it('counts and totals each group, with a credit taken off', () => {
    const byKey = new Map(groupSupplyBills(rows, today, dayLabel).map((g) => [g.key, g]))
    expect(byKey.get('2026-03-15')).toMatchObject({ count: 3, usd: 300.5, words: '3 bills · $300.50' })
    expect(byKey.get('past')).toMatchObject({ count: 2, usd: 100, words: '2 bills · $100.00' })
    expect(byKey.get('2026-03-25')?.words).toBe('1 bill · $5.00')
  })

  it('keeps the order the bills came in, except past due, which is oldest first', () => {
    const byKey = new Map(groupSupplyBills(rows, today, dayLabel).map((g) => [g.key, g.rows.map((r) => r.id)]))
    expect(byKey.get('2026-03-15')).toEqual(['a', 'c', 'g'])
    expect(byKey.get('past')).toEqual(['e', 'b'])
  })

  it('leaves out a group with nothing in it, and loses no bill', () => {
    const groups = groupSupplyBills([bill('a', '2026-03-15', 100)], today, dayLabel)
    expect(groups.map((g) => g.key)).toEqual(['2026-03-15'])
    expect(groupSupplyBills([], today, dayLabel)).toEqual([])
    expect(groupSupplyBills(rows, today, dayLabel).reduce((n, g) => n + g.count, 0)).toBe(rows.length)
  })

  it('keeps a bill paid on this visit where it was, out of its group’s count and total', () => {
    const paidNow = rows.map((r) => (r.id === 'a' ? { ...r, is_paid: true } : r))
    const groups = groupSupplyBills(paidNow, today, dayLabel, new Set(['a']))
    const due = groups.find((g) => g.key === '2026-03-15')
    expect(due?.rows.map((r) => r.id)).toEqual(['a', 'c', 'g'])
    expect(due).toMatchObject({ count: 2, usd: 200.5, words: '2 bills · $200.50' })
    // The bill paid before this visit is still in the paid group, alone.
    expect(groups.find((g) => g.key === 'paid')?.rows.map((r) => r.id)).toEqual(['h'])
    // A group whose every bill was paid on this visit says so.
    expect(groupSupplyBills([{ ...bill('z', '2026-03-25', 5), is_paid: true }], today, dayLabel, new Set(['z']))[0]).toMatchObject({ key: '2026-03-25', count: 0, words: 'all paid' })
  })

  it('reads a bill with no amount as nothing', () => {
    expect(groupSupplyBills([bill('a', '2026-03-15', null)], today, dayLabel)[0]?.words).toBe('1 bill · $0.00')
  })
})

describe('dueGroupKey', () => {
  it('is the day while it is to come, and the past-due group once it has gone', () => {
    expect(dueGroupKey('2026-03-15', today)).toBe('2026-03-15')
    expect(dueGroupKey('2026-03-10', today)).toBe('2026-03-10')
    expect(dueGroupKey('2026-03-09', today)).toBe('past')
  })
})

describe('billDateWords', () => {
  it('writes the month and day, and the year in two digits only when it is not this year', () => {
    expect(billDateWords('2026-10-31', today)).toBe('10/31')
    expect(billDateWords('2026-03-05', today)).toBe('3/5')
    expect(billDateWords('2025-12-05', today)).toBe('12/5/25')
    expect(billDateWords('2027-01-15', today)).toBe('1/15/27')
  })

  it('hands back what it cannot read, and nothing for no day', () => {
    expect(billDateWords('soon', today)).toBe('soon')
    expect(billDateWords(null, today)).toBe('')
  })

  it('names a group’s due day by the same rule', () => {
    expect(billDayName('2026-03-15', today)).toBe('Mar 15')
    expect(billDayName('2027-01-15', today)).toBe('Jan 15 ’27')
  })
})

describe('supplyBillSummary', () => {
  const dayName = (ymd: string): string => `d${ymd.slice(8)}`
  const sum = (id: string, due_date: string | null, amount: number, more: Partial<SupplyBillForSummary> = {}): SupplyBillForSummary => ({ id, due_date, amount, is_paid: false, hasJob: true, on_job_account: true, ...more })
  const list = [
    sum('a', '2026-03-15', 100),
    sum('b', '2026-03-15', 250.6, { on_job_account: false }),
    sum('c', '2026-03-01', 40),
    sum('d', '2026-03-25', 5, { on_job_account: null, hasJob: false }),
    sum('e', '2026-02-01', 999, { is_paid: true }),
    sum('f', null, 12, { on_job_account: false }),
  ]

  it('opens on what is open, past due, due next and not on a job account', () => {
    expect(supplyBillSummary(list, today, dayName, { jobAccountsInUse: true })).toEqual([
      { key: 'open', label: 'Open', value: '$408', sub: '5 bills', tone: 'plain' },
      { key: 'past', label: 'Past due', value: '$40', sub: '1 bill', tone: 'red' },
      { key: 'next', label: 'Due d15', value: '$351', sub: '2 bills', tone: 'plain' },
      { key: 'bare', label: 'Not on a job account', value: '$263', sub: '2 bills, ours to carry', tone: 'amber' },
    ])
  })

  it('says nothing of job accounts at a house that does not use them', () => {
    expect(supplyBillSummary(list, today, dayName, { jobAccountsInUse: false }).map((s) => s.key)).toEqual(['open', 'past', 'next'])
  })

  it('leaves out what is not there', () => {
    expect(supplyBillSummary([sum('e', '2026-02-01', 999, { is_paid: true })], today, dayName, { jobAccountsInUse: true })).toEqual([{ key: 'open', label: 'Open', value: '$0', sub: 'nothing unpaid', tone: 'plain' }])
    expect(supplyBillSummary([sum('a', today, 10)], today, dayName, { jobAccountsInUse: true })[1]).toMatchObject({ key: 'next', label: 'Due today' })
  })

  it('counts a bill as bare only when it is unpaid, for a job, and not on an account', () => {
    expect(isBareOfJobAccount(sum('a', null, 10, { on_job_account: false }))).toBe(true)
    expect(isBareOfJobAccount(sum('a', null, 10, { on_job_account: null }))).toBe(true)
    expect(isBareOfJobAccount(sum('a', null, 10))).toBe(false)
    expect(isBareOfJobAccount(sum('a', null, 10, { on_job_account: false, hasJob: false }))).toBe(false)
    expect(isBareOfJobAccount(sum('a', null, 10, { on_job_account: false, is_paid: true }))).toBe(false)
    // A credit is not something to carry.
    expect(isBareOfJobAccount(sum('a', null, -10, { on_job_account: false }))).toBe(false)
  })
})

describe('unpaidBillsWords', () => {
  it('counts and totals what is unpaid', () => {
    expect(unpaidBillsWords(rows)).toBe('8 unpaid · $424.50')
    expect(unpaidBillsWords([bill('h', '2026-02-01', 999, true)])).toBe('')
  })
})
