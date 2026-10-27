import { describe, expect, it } from 'vitest'
import {
  branchSlug,
  claimRefName,
  decodeClaimMessage,
  encodeClaimMessage,
  findVersionCollisions,
  isClaimStale,
  nextClaimCandidate,
  parseClaimRefs,
  parseMigrationVersion,
  parseNewestChangelogVersion,
  parseNewestFragmentVersion,
  parseNewestReleaseNotesVersion,
  parsePrTodoNumbers,
  parsePrVersions,
  parseTodoNumbersOnMain,
  parseVersionNumber,
  partitionMergedClaims,
  type SessionClaim,
  type TodoClaim,
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

describe('GitHub as the ledger (v2.4844)', () => {
  it('names the refs', () => {
    expect(claimRefName('version', 4844)).toBe('refs/claims/v2.4844')
    expect(claimRefName('migration', '20261008030000')).toBe('refs/claims/migration-20261008030000')
  })

  it('parses ls-remote and for-each-ref listings, ignoring other refs', () => {
    const sha = 'ecc8294ba5300e564a743037f6886d6df95f6b1d'
    const listing = [
      `${sha}\trefs/claims/v2.4844`,
      `${sha} refs/claims/migration-20261008030000`,
      `${sha}\trefs/claims/probe`,
      `${sha}\trefs/heads/main`,
      '',
    ].join('\n')
    expect(parseClaimRefs(listing)).toEqual([
      { ref: 'refs/claims/v2.4844', sha, version: 4844 },
      { ref: 'refs/claims/migration-20261008030000', sha, migration: '20261008030000' },
    ])
  })

  it('round-trips a claim through the commit message', () => {
    const c: SessionClaim = { version: 4844, branch: 'claude/x', claimedAt: '2026-10-07T20:00:00Z', description: 'd' }
    expect(decodeClaimMessage(encodeClaimMessage(c))).toEqual(c)
    expect(decodeClaimMessage('not json')).toBeNull()
  })

  it('reads versions off open PR titles', () => {
    expect(
      parsePrVersions([
        { number: 1, title: 'v2.4831 GC mode: O1', headRefName: 'claude/o1' },
        { number: 2, title: 'chore(types): regen', headRefName: 'claude/types' },
        { number: 3, title: ' v2.4833 Bill tab', headRefName: 'claude/bill' },
      ]),
    ).toEqual([
      { version: 4831, number: 1, branch: 'claude/o1', title: 'v2.4831 GC mode: O1' },
      { version: 4833, number: 3, branch: 'claude/bill', title: ' v2.4833 Bill tab' },
    ])
  })

  it('finds the three kinds of collision, sorted by version', () => {
    const prs = parsePrVersions([
      { number: 4853, title: 'v2.4833 B1', headRefName: 'claude/b1' },
      { number: 4856, title: 'v2.4833 Bill tab', headRefName: 'claude/bill' },
      { number: 4851, title: 'v2.4831 O1', headRefName: 'claude/o1' },
      { number: 4845, title: 'v2.4824 Map', headRefName: 'claude/map' },
      { number: 4848, title: 'v2.4827 U1', headRefName: 'claude/u1' },
    ])
    const claims = [
      { version: 4831, branch: 'claude/p0' },
      { version: 4833, branch: 'claude/bill' },
      { version: 4827, branch: 'claude/u1' },
    ]
    expect(findVersionCollisions(prs, claims)).toEqual([
      { version: 4824, kind: 'unclaimed', detail: '#4845 (claude/map)' },
      { version: 4831, kind: 'claimed-by-another-branch', detail: '#4851 (claude/o1) but claimed by claude/p0' },
      { version: 4833, kind: 'two-prs', detail: '#4853 (claude/b1) and #4856 (claude/bill)' },
    ])
  })

  it('nextClaimCandidate clears PR titles too when they are fed in', () => {
    expect(nextClaimCandidate(4823, [4836, 4833, 4844])).toBe(4845)
  })
})

describe('punch-list numbers in the ledger (v2.5998)', () => {
  it('names the ref and reads it back off a listing', () => {
    expect(claimRefName('todo', 208)).toBe('refs/claims/todo-208')
    const listing = [
      `${'c'.repeat(40)}\trefs/claims/todo-208`,
      `${'d'.repeat(40)}\trefs/claims/todo-x`,
      `${'e'.repeat(40)}\trefs/claims/v2.5992`,
    ].join('\n')
    expect(parseClaimRefs(listing)).toEqual([
      { ref: 'refs/claims/todo-208', sha: 'c'.repeat(40), todo: 208 },
      { ref: 'refs/claims/v2.5992', sha: 'e'.repeat(40), version: 5992 },
    ])
  })

  it('round-trips a to-do claim through the commit message', () => {
    const claim: TodoClaim = { todo: 208, branch: 'claude/x', claimedAt: '2026-10-27T20:00:00.000Z', description: 'the claim card' }
    expect(decodeClaimMessage(encodeClaimMessage(claim))).toEqual(claim)
  })

  it('reads the numbers a to-do PR title carries, ranges expanded, and only the to-do phrasings elsewhere', () => {
    // The open PRs of 2026-10-27, the day three cards collided.
    const prs = [
      { number: 6331, title: 'docs(to-dos): #206 a sent estimate: extend its date, download it, see every option', headRefName: 'a' },
      { number: 6118, title: 'docs(to-dos): #161 to #165, the top five gaps from the trade ERP comparison', headRefName: 'b' },
      { number: 6214, title: 'docs(to-dos): retire the six Legal desk rows after their live passes (#166–#175)', headRefName: 'c' },
      { number: 5413, title: 'to-dos: the Bridge weakest-link follow-ups (#107)', headRefName: 'd' },
      { number: 6341, title: 'v2.5995 GC mode: the schedule builder (punch list #204, PR 1)', headRefName: 'e' },
      { number: 6334, title: 'v2.5988 Estimates: a sent estimate shows every option it offered (#204 PR 2)', headRefName: 'f' },
      { number: 6335, title: 'v2.5991 Test the model key from its card (#6335)', headRefName: 'g' },
      { number: 6342, title: "docs(to-dos): #182 the phone's door to the Legal desk is live (v2.5990)", headRefName: 'h' },
    ]
    const range = (pr: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => [pr, from + i])
    expect(parsePrTodoNumbers(prs).map((p) => [p.number, p.todo])).toEqual([
      [6331, 206],
      ...range(6118, 161, 165),
      ...range(6214, 166, 175),
      [5413, 107],
      [6341, 204],
      [6342, 182],
    ])
    expect(parsePrTodoNumbers(prs).find((p) => p.number === 6331)?.branch).toBe('a')
  })

  it('reads every card number off main\'s front matter, nothing else', () => {
    const listing = ['number: 204', 'number: 205   # the handle', 'numbers: 9', ' number: 3', 'number: 3448'].join('\n')
    expect(parseTodoNumbersOnMain(listing)).toEqual([204, 205])
  })
})
