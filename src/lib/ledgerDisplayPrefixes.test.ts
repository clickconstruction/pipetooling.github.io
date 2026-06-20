import { describe, expect, it } from 'vitest'
import {
  buildLedgerPrefixMap,
  DEFAULT_BID_LEDGER_PREFIX,
  DEFAULT_JOB_LEDGER_PREFIX,
  effectiveJobLedgerNumber,
  formatBidLedgerNumberLabel,
  formatJobLedgerShortLine,
  formatJobLedgerSummaryLine,
  formatJobLedgerNumberLabel,
  resolveBidLedgerPrefix,
  resolveJobLedgerPrefix,
} from './ledgerDisplayPrefixes'

describe('ledgerDisplayPrefixes', () => {
  it('defaults job/bid prefix when columns blank', () => {
    const map = buildLedgerPrefixMap([{ id: 'a', ledger_job_prefix: '', ledger_bid_prefix: null }])
    expect(map.a).toEqual({ job: DEFAULT_JOB_LEDGER_PREFIX, bid: DEFAULT_BID_LEDGER_PREFIX })
  })

  it('uses custom prefixes when set', () => {
    const map = buildLedgerPrefixMap([{ id: 'x', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])
    expect(resolveJobLedgerPrefix('x', map)).toBe('JP')
    expect(resolveBidLedgerPrefix('x', map)).toBe('BP')
  })

  it('falls back for unknown service type id', () => {
    const map = buildLedgerPrefixMap([])
    expect(resolveJobLedgerPrefix('missing', map)).toBe(DEFAULT_JOB_LEDGER_PREFIX)
    expect(resolveBidLedgerPrefix(null, map)).toBe(DEFAULT_BID_LEDGER_PREFIX)
  })

  it('formats number labels', () => {
    expect(formatJobLedgerNumberLabel('JP', '501')).toBe('JP501')
    expect(formatBidLedgerNumberLabel('BH', '12')).toBe('BH12')
    expect(formatJobLedgerNumberLabel('', null)).toBe(`${DEFAULT_JOB_LEDGER_PREFIX}—`)
  })

  it('formats summary lines with map', () => {
    const map = buildLedgerPrefixMap([{ id: 'st1', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])
    expect(formatJobLedgerSummaryLine(map, 'st1', '9', 'A', 'Addr')).toBe('JP9 · A - Addr')
    expect(formatJobLedgerSummaryLine(map, null, '9', 'A', 'Addr')).toBe('J9 · A - Addr')
  })

  describe('effectiveJobLedgerNumber (HCP wins, Click falls back)', () => {
    it('uses HCP when present', () => {
      expect(effectiveJobLedgerNumber('861', '123')).toBe('861')
      expect(effectiveJobLedgerNumber('861', null)).toBe('861')
      expect(effectiveJobLedgerNumber('  861 ', '123')).toBe('861')
    })
    it('falls back to Click when HCP empty/blank', () => {
      expect(effectiveJobLedgerNumber('', '123')).toBe('123')
      expect(effectiveJobLedgerNumber('   ', '123')).toBe('123')
      expect(effectiveJobLedgerNumber(null, ' 123 ')).toBe('123')
      expect(effectiveJobLedgerNumber(undefined, '123')).toBe('123')
    })
    it('returns empty when both blank', () => {
      expect(effectiveJobLedgerNumber('', '')).toBe('')
      expect(effectiveJobLedgerNumber(null, null)).toBe('')
      expect(effectiveJobLedgerNumber(undefined, undefined)).toBe('')
    })
  })

  it('formatters use the Click number as a fallback when HCP empty', () => {
    const map = buildLedgerPrefixMap([{ id: 'st1', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])
    // HCP wins
    expect(formatJobLedgerNumberLabel('JP', '861', '123')).toBe('JP861')
    // Click fallback
    expect(formatJobLedgerNumberLabel('JP', '', '123')).toBe('JP123')
    expect(formatJobLedgerShortLine(map, 'st1', '', 'A', '123')).toBe('JP123 · A')
    expect(formatJobLedgerSummaryLine(map, 'st1', '', 'A', 'Addr', '123')).toBe('JP123 · A - Addr')
    // both blank → dash
    expect(formatJobLedgerNumberLabel('JP', '', '')).toBe('JP—')
  })
})
