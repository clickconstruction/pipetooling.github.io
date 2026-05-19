import { describe, expect, it } from 'vitest'
import {
  barMatchesSearch,
  filterBarsBySearch,
  normalizeBarSearchQuery,
  type BarSearchInput,
} from './projectsJobHistoryBarSearch'
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'

const PLUMBING_ID = 'st-plumbing'
const PREFIX_MAP: LedgerPrefixMap = {
  [PLUMBING_ID]: { job: 'JP', bid: 'BP' },
}

function bar(overrides: Partial<BarSearchInput> = {}): BarSearchInput {
  return {
    hcpNumber: '740',
    jobName: 'San Marcos Housing Authority',
    jobAddress: '123 Main St, San Marcos, TX',
    serviceTypeId: PLUMBING_ID,
    ...overrides,
  }
}

describe('normalizeBarSearchQuery', () => {
  it('returns empty string for null / undefined / whitespace-only', () => {
    expect(normalizeBarSearchQuery(null)).toBe('')
    expect(normalizeBarSearchQuery(undefined)).toBe('')
    expect(normalizeBarSearchQuery('')).toBe('')
    expect(normalizeBarSearchQuery('   ')).toBe('')
    expect(normalizeBarSearchQuery('\t\n')).toBe('')
  })

  it('lowercases, trims, and collapses runs of whitespace', () => {
    expect(normalizeBarSearchQuery('  Hello   World  ')).toBe('hello world')
    expect(normalizeBarSearchQuery('FOO\tBAR')).toBe('foo bar')
  })
})

describe('barMatchesSearch', () => {
  it('returns true for an empty query (no filter)', () => {
    expect(barMatchesSearch(bar(), '', PREFIX_MAP)).toBe(true)
    expect(barMatchesSearch(bar(), '   ', PREFIX_MAP)).toBe(true)
  })

  it('matches against the full display label (prefix + name)', () => {
    expect(barMatchesSearch(bar(), 'JP740', PREFIX_MAP)).toBe(true)
    expect(barMatchesSearch(bar(), 'San Marcos', PREFIX_MAP)).toBe(true)
    expect(barMatchesSearch(bar(), 'jp740 · san marcos', PREFIX_MAP)).toBe(true)
  })

  it('matches against the raw HCP number alone', () => {
    expect(barMatchesSearch(bar(), '740', PREFIX_MAP)).toBe(true)
  })

  it('matches against the prefix alone for a plumbing job', () => {
    expect(barMatchesSearch(bar(), 'jp', PREFIX_MAP)).toBe(true)
  })

  it('matches against the address', () => {
    expect(barMatchesSearch(bar(), 'main st', PREFIX_MAP)).toBe(true)
    expect(barMatchesSearch(bar(), 'TX', PREFIX_MAP)).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(barMatchesSearch(bar(), 'electric', PREFIX_MAP)).toBe(false)
    expect(barMatchesSearch(bar(), 'zzz', PREFIX_MAP)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(barMatchesSearch(bar({ jobName: 'Acme Plumbing' }), 'ACME', PREFIX_MAP)).toBe(true)
    expect(barMatchesSearch(bar({ jobName: 'Acme Plumbing' }), 'plumbing', PREFIX_MAP)).toBe(true)
  })

  it('falls back to legacy J prefix when serviceTypeId has no mapping', () => {
    expect(
      barMatchesSearch(
        bar({ serviceTypeId: 'unknown', jobName: 'Test Job' }),
        'J740',
        PREFIX_MAP,
      ),
    ).toBe(true)
  })

  it('treats null serviceTypeId the same as missing mapping (legacy J prefix)', () => {
    expect(
      barMatchesSearch(
        bar({ serviceTypeId: null, hcpNumber: '900' }),
        'j900',
        PREFIX_MAP,
      ),
    ).toBe(true)
  })

  it('handles blank fields gracefully (no crash)', () => {
    const blanky: BarSearchInput = {
      hcpNumber: '',
      jobName: '',
      jobAddress: '',
      serviceTypeId: null,
    }
    expect(barMatchesSearch(blanky, 'anything', PREFIX_MAP)).toBe(false)
  })
})

describe('filterBarsBySearch', () => {
  const A = bar({ hcpNumber: '740', jobName: 'San Marcos Housing Authority' })
  const B = bar({ hcpNumber: '251', jobName: 'Michael Palmer Residence', jobAddress: '99 Pecan' })
  const C = bar({ hcpNumber: '900', jobName: 'Acme Office', jobAddress: '12921 FM 20 Kingsbury TX' })

  it('returns the same array reference when the query is empty', () => {
    const input = [A, B, C]
    expect(filterBarsBySearch(input, '', PREFIX_MAP)).toBe(input)
    expect(filterBarsBySearch(input, '   ', PREFIX_MAP)).toBe(input)
  })

  it('filters down to matching bars', () => {
    expect(filterBarsBySearch([A, B, C], '251', PREFIX_MAP)).toEqual([B])
    expect(filterBarsBySearch([A, B, C], 'KINGSBURY', PREFIX_MAP)).toEqual([C])
    // 'Marcos' only appears in A's name
    expect(filterBarsBySearch([A, B, C], 'Marcos', PREFIX_MAP)).toEqual([A])
  })

  it('preserves input order in results', () => {
    // All three bars have a 'JP' prefix → query 'jp' matches all → original order preserved.
    expect(filterBarsBySearch([A, B, C], 'jp', PREFIX_MAP)).toEqual([A, B, C])
  })

  it('returns empty array when nothing matches', () => {
    expect(filterBarsBySearch([A, B, C], 'electricwave', PREFIX_MAP)).toEqual([])
  })
})
