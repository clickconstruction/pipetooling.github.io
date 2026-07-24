import { describe, expect, it } from 'vitest'
import { formatOpenAgeShort } from './formatOpenAgeShort'

const NOW = new Date('2026-07-24T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString()

describe('formatOpenAgeShort', () => {
  it('blank / invalid → —', () => {
    expect(formatOpenAgeShort(null, NOW)).toBe('—')
    expect(formatOpenAgeShort(undefined, NOW)).toBe('—')
    expect(formatOpenAgeShort('', NOW)).toBe('—')
    expect(formatOpenAgeShort('nope', NOW)).toBe('—')
  })

  it('sub-day age → today (fixes the old "0 months")', () => {
    expect(formatOpenAgeShort(NOW.toISOString(), NOW)).toBe('today')
    expect(formatOpenAgeShort(daysAgo(0.5), NOW)).toBe('today')
    // any future instant clamps to today
    expect(formatOpenAgeShort(new Date(NOW.getTime() + 3600000).toISOString(), NOW)).toBe('today')
  })

  it('the reported case: 2 months 3 weeks → 2m 3w', () => {
    // 2*30 + 3*7 = 81 days
    expect(formatOpenAgeShort(daysAgo(81), NOW)).toBe('2m 3w')
  })

  it('months + weeks', () => {
    expect(formatOpenAgeShort(daysAgo(60), NOW)).toBe('2m') // 2m 0w → drops the zero
    expect(formatOpenAgeShort(daysAgo(37), NOW)).toBe('1m 1w') // 30 + 7
  })

  it('the old "0 months" band (28-30 days) now reads in weeks', () => {
    expect(formatOpenAgeShort(daysAgo(28), NOW)).toBe('4w')
    expect(formatOpenAgeShort(daysAgo(29), NOW)).toBe('4w 1d')
  })

  it('weeks + days, and days only', () => {
    expect(formatOpenAgeShort(daysAgo(23), NOW)).toBe('3w 2d')
    expect(formatOpenAgeShort(daysAgo(21), NOW)).toBe('3w') // 3w 0d
    expect(formatOpenAgeShort(daysAgo(5), NOW)).toBe('5d')
    expect(formatOpenAgeShort(daysAgo(1), NOW)).toBe('1d')
  })

  it('years lead, then months', () => {
    expect(formatOpenAgeShort(daysAgo(365), NOW)).toBe('1y') // 1y 0m
    expect(formatOpenAgeShort(daysAgo(365 + 60), NOW)).toBe('1y 2m')
  })
})
