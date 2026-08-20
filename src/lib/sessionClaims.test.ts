import { describe, expect, it } from 'vitest'
import {
  branchSlug,
  isClaimStale,
  nextClaimCandidate,
  parseMigrationVersion,
  parseNewestChangelogVersion,
  parseNewestFragmentVersion,
  parseNewestReleaseNotesVersion,
  parseVersionNumber,
  partitionMergedClaims,
  type SessionClaim,
} from './sessionClaims'

const claim = (version: number, claimedAt = '2026-08-03T12:00:00Z'): SessionClaim => ({
  version,
  branch: 'b',
  claimedAt,
})

describe('parseNewestChangelogVersion', () => {
  it('reads the first Latest Updates heading', () => {
    const doc = [
      '# Recent Features',
      'last_updated: 2026-08-03 (v2.1344)',
      '## Latest Updates (v2.1344)',
      'stuff',
      '## Latest Updates (v2.1343)',
    ].join('\n')
    expect(parseNewestChangelogVersion(doc)).toBe(1344)
  })

  it('ignores inline mentions and returns null when absent', () => {
    expect(parseNewestChangelogVersion('mentions v2.999 but no heading')).toBeNull()
  })
})

describe('parseNewestReleaseNotesVersion', () => {
  it('reads the first version literal', () => {
    expect(parseNewestReleaseNotesVersion("x\n    version: 'v2.1344',\n    version: 'v2.1343',")).toBe(1344)
  })
})

describe('parseNewestFragmentVersion', () => {
  it('takes the max across .ts and .md fragment names in an ls-tree listing', () => {
    const listing = 'src/content/releaseNotes/v2.1898.ts\ndocs/recent-features/v2.1900.md\ndocs/recent-features/v2.1899.md\n'
    expect(parseNewestFragmentVersion(listing)).toBe(1900)
  })

  it('ignores non-fragment names and returns null when none match', () => {
    expect(parseNewestFragmentVersion('docs/recent-features/README.md\nsrc/foo.ts')).toBeNull()
    expect(parseNewestFragmentVersion('')).toBeNull()
  })
})

describe('parseVersionNumber', () => {
  it('accepts v2.NNNN and bare numbers', () => {
    expect(parseVersionNumber('v2.1345')).toBe(1345)
    expect(parseVersionNumber(' 1345 ')).toBe(1345)
    expect(parseVersionNumber('v3.1')).toBeNull()
  })
})

describe('nextClaimCandidate', () => {
  it('goes one past main when no claims', () => {
    expect(nextClaimCandidate(1344, [])).toBe(1345)
  })
  it('goes one past the highest outstanding claim', () => {
    expect(nextClaimCandidate(1344, [1345, 1347])).toBe(1348)
  })
  it('ignores claims behind main', () => {
    expect(nextClaimCandidate(1344, [1340])).toBe(1345)
  })
})

describe('partitionMergedClaims', () => {
  it('splits merged (<= main) from outstanding', () => {
    const { merged, outstanding } = partitionMergedClaims([claim(1343), claim(1344), claim(1345)], 1344)
    expect(merged.map((c) => c.version)).toEqual([1343, 1344])
    expect(outstanding.map((c) => c.version)).toEqual([1345])
  })
})

describe('isClaimStale', () => {
  const now = Date.parse('2026-08-04T12:00:00Z')
  it('is fresh within 24h, stale after, stale when unparseable', () => {
    expect(isClaimStale(claim(1, '2026-08-04T00:00:00Z'), now)).toBe(false)
    expect(isClaimStale(claim(1, '2026-08-03T11:00:00Z'), now)).toBe(true)
    expect(isClaimStale(claim(1, 'garbage'), now)).toBe(true)
  })
})

describe('parseMigrationVersion', () => {
  it('extracts the 14-digit stamp, path-tolerant', () => {
    expect(parseMigrationVersion('supabase/migrations/20260803184515_bid_aware_pins.sql')).toBe('20260803184515')
    expect(parseMigrationVersion('20260803184515_bid_aware_pins.sql')).toBe('20260803184515')
    expect(parseMigrationVersion('nope.sql')).toBeNull()
    expect(parseMigrationVersion('2026_short.sql')).toBeNull()
  })
})

describe('branchSlug', () => {
  it('sanitizes to filename-safe', () => {
    expect(branchSlug('claude/app-review-docs-9e8d52')).toBe('claude-app-review-docs-9e8d52')
    expect(branchSlug('///')).toBe('unnamed')
  })
})
