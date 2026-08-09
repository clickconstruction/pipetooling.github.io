import { describe, expect, it } from 'vitest'
import {
  filterFinanceItems,
  financeAgingDays,
  financeAgingTone,
  sortFinanceItemsMobile,
} from './dashboardFinanceModalRows'

const TODAY = '2026-08-09'

describe('financeAgingDays', () => {
  it('returns days past the date, null for missing / today / future dates', () => {
    expect(financeAgingDays('2026-07-15', TODAY)).toBe(25)
    expect(financeAgingDays('2026-03-16', TODAY)).toBe(146)
    expect(financeAgingDays(TODAY, TODAY)).toBeNull()
    expect(financeAgingDays('2026-08-20', TODAY)).toBeNull()
    expect(financeAgingDays(null, TODAY)).toBeNull()
    expect(financeAgingDays(undefined, TODAY)).toBeNull()
  })
})

describe('financeAgingTone', () => {
  it('buckets: <15 ok, 15–30 warn, >30 late', () => {
    expect(financeAgingTone(1)).toBe('ok')
    expect(financeAgingTone(14)).toBe('ok')
    expect(financeAgingTone(15)).toBe('warn')
    expect(financeAgingTone(30)).toBe('warn')
    expect(financeAgingTone(31)).toBe('late')
    expect(financeAgingTone(146)).toBe('late')
  })
})

describe('filterFinanceItems', () => {
  const items = [
    { label: '878 · Take 5- Seguin', sublabel: 'Billed invoice' },
    { label: '650 · ATI Schertz', sublabel: null },
    { label: 'Ryan (Garner HVAC)', sublabel: 'Sub labor · #717' },
  ]

  it('matches label and sublabel case-insensitively; empty query returns same array', () => {
    expect(filterFinanceItems(items, '')).toBe(items)
    expect(filterFinanceItems(items, '  ')).toBe(items)
    expect(filterFinanceItems(items, 'take 5').map((i) => i.label)).toEqual(['878 · Take 5- Seguin'])
    expect(filterFinanceItems(items, 'SUB LABOR').map((i) => i.label)).toEqual(['Ryan (Garner HVAC)'])
    expect(filterFinanceItems(items, '#717')).toHaveLength(1)
    expect(filterFinanceItems(items, 'zzz')).toHaveLength(0)
  })
})

describe('sortFinanceItemsMobile', () => {
  const items = [
    { key: 'a', amount: 100, dateYmd: '2026-07-01' },
    { key: 'b', amount: 900, dateYmd: null },
    { key: 'c', amount: 500, dateYmd: '2026-03-16' },
    { key: 'd', amount: 700, dateYmd: '2026-07-01' },
  ]

  it('amount mode: biggest first; does not mutate the input', () => {
    const out = sortFinanceItemsMobile(items, 'amount')
    expect(out.map((i) => i.key)).toEqual(['b', 'd', 'c', 'a'])
    expect(items[0]?.key).toBe('a')
  })

  it('oldest mode: earliest date first, undated last, amount breaks same-day ties', () => {
    const out = sortFinanceItemsMobile(items, 'oldest')
    expect(out.map((i) => i.key)).toEqual(['c', 'd', 'a', 'b'])
  })
})
