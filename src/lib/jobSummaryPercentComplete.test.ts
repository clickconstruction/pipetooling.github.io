import { describe, expect, it } from 'vitest'
import {
  formatJobSummaryPercentComplete,
  resolveJobSummaryPercentComplete,
} from './jobSummaryPercentComplete'

describe('resolveJobSummaryPercentComplete', () => {
  it('prefers the report percent when present', () => {
    expect(resolveJobSummaryPercentComplete(60, 20)).toBe(60)
    expect(resolveJobSummaryPercentComplete(0, 50)).toBe(0)
    expect(resolveJobSummaryPercentComplete(100, null)).toBe(100)
  })
  it('falls back to the job pct_complete field when no report percent', () => {
    expect(resolveJobSummaryPercentComplete(null, 45)).toBe(45)
    expect(resolveJobSummaryPercentComplete(undefined, 0)).toBe(0)
  })
  it('returns null when neither source has a valid value', () => {
    expect(resolveJobSummaryPercentComplete(null, null)).toBeNull()
    expect(resolveJobSummaryPercentComplete(undefined, undefined)).toBeNull()
  })
  it('ignores out-of-range or non-finite values from either source', () => {
    expect(resolveJobSummaryPercentComplete(150, 40)).toBe(40)
    expect(resolveJobSummaryPercentComplete(-1, null)).toBeNull()
    expect(resolveJobSummaryPercentComplete(Number.NaN, 30)).toBe(30)
    expect(resolveJobSummaryPercentComplete(null, 101)).toBeNull()
  })
  it('rounds fractional values', () => {
    expect(resolveJobSummaryPercentComplete(66.6, null)).toBe(67)
    expect(resolveJobSummaryPercentComplete(null, 33.3)).toBe(33)
  })
})

describe('formatJobSummaryPercentComplete', () => {
  it('formats percent and em-dash for null', () => {
    expect(formatJobSummaryPercentComplete(62)).toBe('62%')
    expect(formatJobSummaryPercentComplete(0)).toBe('0%')
    expect(formatJobSummaryPercentComplete(null)).toBe('—')
  })
})
