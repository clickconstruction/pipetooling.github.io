import { describe, expect, it } from 'vitest'
import { sortSubMoneySheets, subSheetPayableWords } from './subMoneySheets'

const sheet = (id: string, balance: number, payableAfter: string | null, createdAt: string) => ({ id, balance, payableAfter, createdAt })

describe('sortSubMoneySheets (punch list #184 sweep B)', () => {
  it('soonest payable first, then open sheets with no date oldest first, then settled sheets newest first', () => {
    const rows = [
      sheet('settled-old', 0, '2026-09-01', '2026-08-01T12:00:00Z'),
      sheet('open-nodate-new', 900, null, '2026-10-20T12:00:00Z'),
      sheet('due-later', 400, '2026-11-02', '2026-10-01T12:00:00Z'),
      sheet('settled-new', -5, null, '2026-10-10T12:00:00Z'),
      sheet('late', 1200, '2026-10-20', '2026-09-15T12:00:00Z'),
      sheet('open-nodate-old', 300, null, '2026-09-01T12:00:00Z'),
      sheet('due-today', 250, '2026-10-26', '2026-10-05T12:00:00Z'),
    ]
    expect(sortSubMoneySheets(rows).map((r) => r.id)).toEqual([
      'late',
      'due-today',
      'due-later',
      'open-nodate-old',
      'open-nodate-new',
      'settled-new',
      'settled-old',
    ])
    expect(rows[0]!.id).toBe('settled-old')
  })

  it('two sheets payable the same day keep the older sheet first', () => {
    const rows = [sheet('b', 10, '2026-10-30', '2026-10-02T00:00:00Z'), sheet('a', 10, '2026-10-30', '2026-10-01T00:00:00Z')]
    expect(sortSubMoneySheets(rows).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('subSheetPayableWords', () => {
  const today = '2026-10-26'
  it('says the payable day in neutral words, before, on and after it, while money is open', () => {
    expect(subSheetPayableWords({ balance: 1200, payableAfter: '2026-10-20' }, today)).toBe('payable since Oct 20')
    expect(subSheetPayableWords({ balance: 250, payableAfter: '2026-10-26' }, today)).toBe('payable today')
    expect(subSheetPayableWords({ balance: 400, payableAfter: '2026-11-02' }, today)).toBe('payable after Nov 2')
  })
  it('a settled sheet or one with no date has no words', () => {
    expect(subSheetPayableWords({ balance: 0, payableAfter: '2026-10-01' }, today)).toBeNull()
    expect(subSheetPayableWords({ balance: 300, payableAfter: null }, today)).toBeNull()
  })
})
