import { describe, expect, it } from 'vitest'
import { boardValueForRule, firstSentOn, formatSendBadge, latestSendByVersion, latestSentOn, parseBoardValueRule } from './versionSends'

describe('firstSentOn', () => {
  it('returns the earliest send date (the day the bid left the building)', () => {
    expect(
      firstSentOn([
        { bid_version_id: 'a', sent_on: '2026-08-27', value: null },
        { bid_version_id: 'b', sent_on: '2026-08-20', value: null },
        { bid_version_id: 'a', sent_on: '2026-08-29', value: null },
      ]),
    ).toBe('2026-08-20')
  })
  it('null when there are no sends', () => {
    expect(firstSentOn([])).toBeNull()
  })
})

describe('latestSendByVersion / latestSentOn', () => {
  it('keeps the newest send per version (date, then created_at) and coerces values', () => {
    const rows = [
      { bid_version_id: 'tp', sent_on: '2026-05-18', value: '260840.08', created_at: '2026-05-18T10:00:00Z' },
      { bid_version_id: 'tp', sent_on: '2026-07-17', value: 274248.79, created_at: '2026-07-17T09:00:00Z' },
      { bid_version_id: 'tp', sent_on: '2026-07-17', value: 274300, created_at: '2026-07-17T11:00:00Z' },
      { bid_version_id: 've', sent_on: '2026-07-17', value: null, is_alternate: true },
    ]
    const latest = latestSendByVersion(rows)
    expect(latest.tp).toEqual({ sentOn: '2026-07-17', value: 274300, isAlternate: false })
    expect(latest.ve).toEqual({ sentOn: '2026-07-17', value: null, isAlternate: true })
    expect(latestSentOn(rows)).toBe('2026-07-17')
    expect(latestSentOn([])).toBeNull()
  })
})

describe('boardValueForRule', () => {
  const sections = [
    { isAlternate: false, revenueSum: 274248.79 },
    { isAlternate: false, revenueSum: 62094.12 },
    { isAlternate: true, revenueSum: 224100.72 },
  ]
  it('base_sum adds base sections only; null when the letter is empty', () => {
    expect(boardValueForRule('base_sum', sections, 999)).toBeCloseTo(336342.91, 2)
    expect(boardValueForRule('base_sum', [], 999)).toBeNull()
  })
  it("active_star uses the active bid's ★ and falls back to the base sum", () => {
    expect(boardValueForRule('active_star', sections, 279578.8)).toBe(279578.8)
    expect(boardValueForRule('active_star', sections, null)).toBeCloseTo(336342.91, 2)
    expect(boardValueForRule('active_star', [], null)).toBeNull()
  })
  it('parses the stored rule with a safe default', () => {
    expect(parseBoardValueRule('active_star')).toBe('active_star')
    expect(parseBoardValueRule('range')).toBe('base_sum')
    expect(parseBoardValueRule(null)).toBe('base_sum')
  })
})

describe('formatSendBadge', () => {
  it('formats date + value, date only, or nothing', () => {
    expect(formatSendBadge({ sentOn: '2026-07-07', value: 279578.8, isAlternate: false })).toBe('sent 7/7 · $279,579')
    expect(formatSendBadge({ sentOn: '2026-07-07', value: null, isAlternate: true })).toBe('sent 7/7')
    expect(formatSendBadge(undefined)).toBeNull()
  })
})
