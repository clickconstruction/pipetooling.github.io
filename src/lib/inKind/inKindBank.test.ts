import { describe, expect, it } from 'vitest'
import { bankLinesOfMonth, bankPaidByMonth, bankPaidLines, isPayeeLine, monthsWithBank, type BankLine } from './inKindBank'

const row = (o: Partial<BankLine> & { id: string }): BankLine => ({ amount: -1500, posted_at: '2026-11-03T16:00:00Z', created_at: '2026-11-03T15:00:00Z', status: 'sent', counterparty_name: 'Calloway Holdings LLC', duplicate_of_transaction_id: null, ...o })

describe('isPayeeLine', () => {
  it('finds the payee inside the bank’s name, whatever the case or spacing', () => {
    expect(isPayeeLine('CALLOWAY  HOLDINGS LLC', 'calloway holdings')).toBe(true)
    expect(isPayeeLine('Calloway Holdings LLC', ' Calloway ')).toBe(true)
    expect(isPayeeLine('Pecan Creek Gravel', 'Calloway')).toBe(false)
  })
  it('matches nothing with no payee', () => {
    expect(isPayeeLine('Calloway Holdings', '')).toBe(false)
    expect(isPayeeLine(null, 'Calloway')).toBe(false)
  })
})

describe('bankPaidLines', () => {
  it('keeps money out to the payee, as positive dollars on its day', () => {
    expect(bankPaidLines([row({ id: 't1' })], 'Calloway')).toEqual([{ id: 't1', day: '2026-11-03', amount: 1500, name: 'Calloway Holdings LLC' }])
  })
  it('leaves out money in, a failed line, a duplicate and another payee', () => {
    const rows = [row({ id: 'in', amount: 1500 }), row({ id: 'failed', status: 'failed' }), row({ id: 'dup', duplicate_of_transaction_id: 't1' }), row({ id: 'other', counterparty_name: 'Ridgeway Supply' }), row({ id: 'zero', amount: 0 })]
    expect(bankPaidLines(rows, 'Calloway')).toEqual([])
  })
  it('reads a pending line by the day it was made', () => {
    expect(bankPaidLines([row({ id: 'p', posted_at: null, created_at: '2026-11-05T15:00:00Z', status: 'pending' })], 'Calloway')[0]?.day).toBe('2026-11-05')
  })
  it('reads the day in the company’s calendar, not the UTC one', () => {
    // 03:30 UTC on Dec 1 is still Nov 30 in the company's zone.
    expect(bankPaidLines([row({ id: 'late', posted_at: '2026-12-01T03:30:00Z' })], 'Calloway')[0]?.day).toBe('2026-11-30')
  })
  it('sorts oldest first', () => {
    expect(bankPaidLines([row({ id: 'b', posted_at: '2026-11-20T16:00:00Z' }), row({ id: 'a', posted_at: '2026-11-03T16:00:00Z' })], 'Calloway').map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('bankPaidByMonth', () => {
  const lines = bankPaidLines(
    [row({ id: 'nov' }), row({ id: 'nov2', amount: -500, posted_at: '2026-11-20T16:00:00Z' }), row({ id: 'sep', posted_at: '2026-09-02T16:00:00Z' }), row({ id: 'old', posted_at: '2026-03-02T16:00:00Z' })],
    'Calloway',
  )
  it('sums each month asked for and gives zero to a month with nothing', () => {
    expect([...bankPaidByMonth(lines, ['2026-09-01', '2026-10-01', '2026-11-01'])]).toEqual([
      ['2026-09-01', 1500],
      ['2026-10-01', 0],
      ['2026-11-01', 2000],
    ])
  })
  it('gives the lines of one month', () => {
    expect(bankLinesOfMonth(lines, '2026-11-01').map((l) => l.id)).toEqual(['nov', 'nov2'])
  })
})

describe('monthsWithBank', () => {
  const rent = { monthly_amount: 1500, starts_on: '2026-10-01', ended_at: null }
  it('makes this month due once the rent has left the bank, and reads last month by the calendar', () => {
    const bank = bankPaidLines([row({ id: 'nov' })], 'Calloway')
    expect(monthsWithBank(rent, [], bank, '2026-11-10').map((m) => `${m.month} ${m.state} ${m.bankPaid}`)).toEqual(['2026-11-01 due 1500', '2026-10-01 due 0'])
  })
  it('waits on this month when the bank was not read', () => {
    expect(monthsWithBank(rent, [], null, '2026-11-10').map((m) => `${m.month} ${m.state} ${m.bankPaid}`)).toEqual(['2026-11-01 waiting null', '2026-10-01 due null'])
  })
  it('is empty for a deal with no schedule', () => {
    expect(monthsWithBank({ monthly_amount: null, starts_on: null, ended_at: null }, [], [], '2026-11-10')).toEqual([])
  })
})
