import { describe, expect, it } from 'vitest'
import { buildJobSearchRail, daysSinceYmd } from './jobSearchRail'

const base = { lineCount: 0, lineRevenue: 0, revenue: null, lastPaidDaysAgo: null, billedDaysAgo: null, collectionsFlagged: false }

describe('buildJobSearchRail — the amount slot', () => {
  it('uses the line-item total when there are line items', () => {
    expect(buildJobSearchRail({ ...base, status: 'waiting', lineCount: 2, lineRevenue: 16000, revenue: 9 }).amount).toEqual({ label: '$16,000', muted: false })
  })
  it('falls back to the job revenue when there are no line items (J548 had no number at all)', () => {
    expect(buildJobSearchRail({ ...base, status: 'paid', revenue: 4100 }).amount).toEqual({ label: '$4,100', muted: false })
  })
  it('mutes a genuine $0 and shows — when there is no total anywhere', () => {
    expect(buildJobSearchRail({ ...base, status: 'paid', lineCount: 1, lineRevenue: 0 }).amount).toEqual({ label: '$0', muted: true })
    expect(buildJobSearchRail({ ...base, status: 'paid', revenue: 0 }).amount).toEqual({ label: '$0', muted: true })
    expect(buildJobSearchRail({ ...base, status: 'paid' }).amount).toEqual({ label: '—', muted: true })
  })
})

describe('buildJobSearchRail — the note slot', () => {
  it('says nothing on Waiting / Working / Ready to Bill — the chip already did', () => {
    for (const status of ['waiting', 'working', 'ready_to_bill', null]) {
      expect(buildJobSearchRail({ ...base, status, lineCount: 1, lineRevenue: 990 }).note).toBeNull()
    }
  })
  it('Paid → just the recency, no second "paid"', () => {
    expect(buildJobSearchRail({ ...base, status: 'paid', lineCount: 1, lineRevenue: 8621, lastPaidDaysAgo: 183 }).note).toEqual({ label: '6 mo ago', tone: 'green' })
  })
  it('a payment on a job not yet Paid keeps the word (partial payment)', () => {
    expect(buildJobSearchRail({ ...base, status: 'billed', lineCount: 1, lineRevenue: 8621, lastPaidDaysAgo: 12 }).note).toEqual({ label: 'paid 12d ago', tone: 'green' })
  })
  it('Billed with no payment → unpaid + age of the debt, red once in collections', () => {
    expect(buildJobSearchRail({ ...base, status: 'billed', lineCount: 1, lineRevenue: 4200, billedDaysAgo: 47 }).note).toEqual({ label: 'unpaid 47d', tone: 'amber' })
    expect(buildJobSearchRail({ ...base, status: 'billed', lineCount: 1, lineRevenue: 4200, billedDaysAgo: 120, collectionsFlagged: true }).note).toEqual({ label: 'unpaid 120d', tone: 'red' })
    expect(buildJobSearchRail({ ...base, status: 'billed', lineCount: 1, lineRevenue: 4200 }).note).toEqual({ label: 'unpaid', tone: 'amber' })
  })
  it('a $0 billed job is not "unpaid"', () => {
    expect(buildJobSearchRail({ ...base, status: 'billed', lineCount: 1, lineRevenue: 0, billedDaysAgo: 3 }).note).toBeNull()
  })
})

describe('daysSinceYmd', () => {
  const now = Date.parse('2026-09-08T20:00:00Z')
  it('counts whole days from a date-only or ISO string', () => {
    expect(daysSinceYmd('2026-07-23', now)).toBe(47)
    expect(daysSinceYmd('2026-09-08', now)).toBe(0)
    expect(daysSinceYmd('2026-09-01T10:00:00Z', now)).toBe(7)
  })
  it('returns null for blanks and garbage', () => {
    expect(daysSinceYmd(null, now)).toBeNull()
    expect(daysSinceYmd('nope', now)).toBeNull()
  })
})
