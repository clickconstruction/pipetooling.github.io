import { describe, expect, it } from 'vitest'
import {
  type BasketPair,
  type PriceEvent,
  changeText,
  computeMaterialPriceIndex,
  describeChange,
  isBigJump,
  monthEndDay,
  monthName,
  monthsBetween,
  parsePriceInput,
  verdictText,
} from './materialPriceIndex'

const pair = (partId: string, over: Partial<BasketPair> = {}): BasketPair => ({
  priceId: `price-${partId}-${over.houseId ?? 'reece'}`,
  partId,
  houseId: 'reece',
  partName: partId.toUpperCase(),
  houseName: 'Reece',
  spend: 100,
  price: 10,
  priceUpdatedDay: '2026-01-10',
  openBidCount: 0,
  ...over,
})

const ev = (partId: string, day: string, oldPrice: number | null, newPrice: number, houseId = 'reece'): PriceEvent => ({
  partId,
  houseId,
  oldPrice,
  newPrice,
  day,
  at: `${day}T15:00:00Z`,
})

describe('calendar helpers', () => {
  it('lists the months between two months, across a year end', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsBetween('2026-02', '2026-02')).toEqual(['2026-02'])
  })

  it("knows each month's last day, leap years included", () => {
    expect(monthEndDay('2026-02')).toBe('2026-02-28')
    expect(monthEndDay('2028-02')).toBe('2028-02-29')
    expect(monthEndDay('2026-09')).toBe('2026-09-30')
  })

  it('names a month', () => {
    expect(monthName('2026-02')).toBe('February')
  })
})

describe('isBigJump', () => {
  it('sets aside a move to 1.5× or more, or to half or less', () => {
    expect(isBigJump(4.38, 438)).toBe(true)
    expect(isBigJump(438, 4.38)).toBe(true)
    expect(isBigJump(100, 150)).toBe(true)
    expect(isBigJump(100, 50)).toBe(true)
    expect(isBigJump(100, 149)).toBe(false)
    expect(isBigJump(151.44, 101.92)).toBe(false)
  })

  it('treats a $0 or a $999,999 stand-in as never a price', () => {
    expect(isBigJump(653.93, 0)).toBe(true)
    expect(isBigJump(0, 999_999)).toBe(true)
    expect(isBigJump(653.93, 999_999)).toBe(true)
  })
})

describe('computeMaterialPriceIndex', () => {
  it('is null with nothing bid from the book', () => {
    expect(computeMaterialPriceIndex({ events: [], basket: [], today: '2026-10-01' })).toBeNull()
    expect(computeMaterialPriceIndex({ events: [], basket: [pair('a', { spend: 0 })], today: '2026-10-01' })).toBeNull()
  })

  it('reads 100 every month when no price moved, from February through today', () => {
    const out = computeMaterialPriceIndex({ events: [], basket: [pair('a'), pair('b')], today: '2026-10-02' })!
    expect(out.months.map((m) => m.month)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(out.months.every((m) => m.index === 100 && m.coverage === 1 && !m.faint)).toBe(true)
    expect(out.sinceBase).toBe(0)
    expect(out.last3).toBe(0)
  })

  it('carries a rise from the month it lands', () => {
    const out = computeMaterialPriceIndex({ events: [ev('a', '2026-05-12', 10, 11)], basket: [pair('a')], today: '2026-07-15' })!
    expect(out.months.map((m) => Number(m.index.toFixed(2)))).toEqual([100, 100, 100, 110, 110, 110])
    expect(out.sinceBase).toBeCloseTo(0.1, 10)
    expect(verdictText(out)).toBe('Up 10.0% since February')
  })

  it('weights each part by what you spend on it', () => {
    // 90% of the spend rises 10%, 10% stays flat: 100 × 1.1^0.9.
    const out = computeMaterialPriceIndex({
      events: [ev('big', '2026-03-03', 10, 11)],
      basket: [pair('big', { spend: 900 }), pair('small', { spend: 100 })],
      today: '2026-03-31',
    })!
    expect(out.latest).toBeCloseTo(100 * Math.pow(1.1, 0.9), 8)
  })

  it('sets a big jump aside: a fixed typo, a pack size and a $999,999 stand-in move nothing', () => {
    const out = computeMaterialPriceIndex({
      events: [
        ev('elbow', '2026-02-02', 438, 4.38),
        ev('clamp', '2026-03-02', 0.56, 28.06),
        ev('sink', '2026-07-17', 653.93, 0),
        ev('sink', '2026-07-17', 0, 999_999),
        ev('tee', '2026-08-04', 10, 10.5),
      ],
      basket: [pair('elbow', { price: 4.38 }), pair('clamp', { price: 28.06 }), pair('sink', { price: 999_999 }), pair('tee', { price: 10.5 })],
      today: '2026-09-30',
    })!
    // Only the tee's 5% counts, on its quarter of the spend.
    expect(out.latest).toBeCloseTo(100 * Math.pow(1.05, 0.25), 8)
  })

  it('a part priced late joins the basket when it gets its price, and thin months read faint', () => {
    const out = computeMaterialPriceIndex({
      events: [ev('late', '2026-07-10', null, 20), ev('late', '2026-08-20', 20, 22)],
      basket: [pair('early', { spend: 100 }), pair('late', { spend: 900, price: 22 })],
      today: '2026-08-31',
    })!
    const byMonth = Object.fromEntries(out.months.map((m) => [m.month, m]))
    expect(byMonth['2026-06']!.coverage).toBeCloseTo(0.1, 10)
    expect(byMonth['2026-06']!.faint).toBe(true)
    expect(byMonth['2026-07']!.coverage).toBe(1)
    expect(byMonth['2026-07']!.faint).toBe(false)
    // July: the late part had no June price, so July does not move. August: +10% on 90%.
    expect(byMonth['2026-07']!.index).toBe(100)
    expect(byMonth['2026-08']!.index).toBeCloseTo(100 * Math.pow(1.1, 0.9), 8)
  })

  it('a price older than the history stands at its old price until its first change', () => {
    const out = computeMaterialPriceIndex({ events: [ev('a', '2026-04-02', 50, 55)], basket: [pair('a', { price: 55 })], today: '2026-04-30' })!
    expect(out.months[0]!.coverage).toBe(1)
    expect(out.latest).toBeCloseTo(110, 8)
  })

  it('a confirmed price (the same price again) moves nothing', () => {
    const out = computeMaterialPriceIndex({ events: [ev('a', '2026-01-20', null, 10), ev('a', '2026-06-01', 10, 10)], basket: [pair('a')], today: '2026-06-30' })!
    expect(out.latest).toBe(100)
  })

  it('this month runs to today', () => {
    const out = computeMaterialPriceIndex({ events: [ev('a', '2026-10-01', 10, 10.3)], basket: [pair('a', { price: 10.3 })], today: '2026-10-02' })!
    expect(out.months[out.months.length - 1]!.month).toBe('2026-10')
    expect(out.sinceBase).toBeCloseTo(0.03, 10)
    expect(out.last3).toBeCloseTo(0.03, 10)
  })

  it('has no three-month change before three months of history', () => {
    const out = computeMaterialPriceIndex({ events: [], basket: [pair('a')], today: '2026-04-15' })!
    expect(out.months).toHaveLength(3)
    expect(out.last3).toBeNull()
  })

  it('freshness shares spend by when each price was last entered, changed or confirmed', () => {
    const out = computeMaterialPriceIndex({
      events: [ev('fresh', '2026-09-20', 10, 10), ev('mid', '2026-07-15', null, 10)],
      basket: [
        pair('fresh', { spend: 100 }),
        pair('mid', { spend: 300 }),
        pair('old', { spend: 600, priceUpdatedDay: '2026-03-01' }),
      ],
      today: '2026-10-01',
    })!
    expect(out.freshness.within30).toBeCloseTo(0.1, 10)
    expect(out.freshness.within90).toBeCloseTo(0.3, 10)
    expect(out.freshness.older).toBeCloseTo(0.6, 10)
    expect(out.showNumber).toBe(false)
  })

  it('shows the number once half the spend was checked within 90 days, and a price with no date counts as old', () => {
    const basket = [pair('a', { spend: 500, priceUpdatedDay: '2026-09-01' }), pair('b', { spend: 500, priceUpdatedDay: null })]
    const out = computeMaterialPriceIndex({ events: [], basket, today: '2026-10-01' })!
    expect(out.freshness.within90 + out.freshness.within30).toBeCloseTo(0.5, 10)
    expect(out.showNumber).toBe(true)
  })

  it('moved lately: each price’s newest ordinary move in 30 days, newest first, three at most', () => {
    const out = computeMaterialPriceIndex({
      events: [
        ev('pvc', '2026-09-21', 19.52, 17.56),
        ev('copper', '2026-09-21', 60.76, 48.59),
        ev('peak', '2026-09-29', 704.31, 770.59),
        ev('peak', '2026-09-10', 690, 704.31),
        ev('tee', '2026-09-28', 5.18, 7.92),
        ev('same', '2026-09-30', 4, 4),
        ev('old', '2026-08-01', 10, 11),
        ev('cleanout', '2026-09-27', 230.23, 212.52),
      ],
      basket: ['pvc', 'copper', 'peak', 'tee', 'same', 'old', 'cleanout'].map((id) => pair(id, { openBidCount: id === 'pvc' ? 6 : 1 })),
      today: '2026-10-01',
    })!
    expect(out.moved.map((m) => m.partId)).toEqual(['peak', 'cleanout', 'pvc'])
    expect(out.moved[0]!.change).toBeCloseTo(770.59 / 704.31 - 1, 10)
    expect(out.moved[2]).toMatchObject({ partId: 'pvc', oldPrice: 19.52, newPrice: 17.56, openBidCount: 6, day: '2026-09-21' })
  })

  it('ignores history for parts nobody bids with', () => {
    const out = computeMaterialPriceIndex({ events: [ev('ghost', '2026-05-01', 10, 13)], basket: [pair('a')], today: '2026-06-30' })!
    expect(out.latest).toBe(100)
    expect(out.moved).toEqual([])
  })

  it('keeps a part at two houses apart', () => {
    const out = computeMaterialPriceIndex({
      events: [ev('a', '2026-03-05', 10, 12, 'moore')],
      basket: [pair('a', { houseId: 'reece', spend: 500 }), pair('a', { houseId: 'moore', spend: 500, price: 12 })],
      today: '2026-03-31',
    })!
    expect(out.latest).toBeCloseTo(100 * Math.pow(1.2, 0.5), 8)
  })
})

describe('words', () => {
  it('reads inside ±1% as about the same', () => {
    expect(describeChange(-0.003)).toEqual({ kind: 'same', pct: '0%' })
    expect(describeChange(0.0099)).toEqual({ kind: 'same', pct: '0%' })
    expect(describeChange(0.024)).toEqual({ kind: 'up', pct: '2.4%' })
    expect(describeChange(-0.012)).toEqual({ kind: 'down', pct: '1.2%' })
  })

  it('writes the headline and the three-month line', () => {
    expect(verdictText({ sinceBase: -0.003, baseMonth: '2026-02' })).toBe('About the same as February')
    expect(verdictText({ sinceBase: -0.025, baseMonth: '2026-02' })).toBe('Down 2.5% since February')
    expect(changeText(0.031)).toBe('up 3.1%')
    expect(changeText(0)).toBe('about the same')
  })
})

describe('Check 20 prices', () => {
  it('lists the 20 parts you spend most on, oldest check first, with their share of spend', () => {
    const basket = Array.from({ length: 25 }, (_, i) => pair(`p${i}`, { spend: 100 + i, priceUpdatedDay: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}` }))
    const out = computeMaterialPriceIndex({ events: [], basket, today: '2026-10-02' })!
    expect(out.checks.items).toHaveLength(20)
    // The five cheapest (p0–p4) are left off.
    expect(out.checks.items.some((i) => ['p0', 'p1', 'p2', 'p3', 'p4'].includes(i.partId))).toBe(false)
    const days = out.checks.items.map((i) => i.lastCheckedDay)
    expect(days).toEqual([...days].sort())
    const total = basket.reduce((s, p) => s + p.spend, 0)
    expect(out.checks.spendShare).toBeCloseTo(basket.slice(5).reduce((s, p) => s + p.spend, 0) / total, 10)
    expect(out.checks.items[0]!.priceId).toMatch(/^price-p/)
  })

  it('reminds you once the oldest of them is more than 30 days old', () => {
    const fresh = computeMaterialPriceIndex({ events: [], basket: [pair('a', { priceUpdatedDay: '2026-09-02' })], today: '2026-10-02' })!
    expect(fresh.checks).toMatchObject({ due: false, oldestDay: '2026-09-02' })
    const due = computeMaterialPriceIndex({ events: [], basket: [pair('a', { priceUpdatedDay: '2026-09-01' })], today: '2026-10-02' })!
    expect(due.checks.due).toBe(true)
  })

  it('a check today makes the part fresh, and a price with no date sorts first and is due', () => {
    const out = computeMaterialPriceIndex({
      events: [ev('a', '2026-10-02', 10, 10)],
      basket: [pair('a', { priceUpdatedDay: '2026-04-14' }), pair('b', { priceUpdatedDay: null })],
      today: '2026-10-02',
    })!
    expect(out.checks.items.map((i) => [i.partId, i.lastCheckedDay])).toEqual([['b', null], ['a', '2026-10-02']])
    expect(out.checks.due).toBe(true)
  })
})

describe('parsePriceInput', () => {
  it('reads a typed price with or without a dollar sign and commas', () => {
    expect(parsePriceInput('12.5')).toBe(12.5)
    expect(parsePriceInput(' $1,234.567 ')).toBe(1234.57)
    expect(parsePriceInput('.75')).toBe(0.75)
  })

  it('refuses nothing, zero, words and the stand-in', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('0')).toBeNull()
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('1.2.3')).toBeNull()
    expect(parsePriceInput('-5')).toBeNull()
    expect(parsePriceInput('999999')).toBeNull()
  })
})
