import { describe, expect, it } from 'vitest'
import { claimedToDate, initialGcState, stageReached, stageReachedWords, theirSovGap, theirSovOf } from './gcModel'

const lines = [
  { label: 'Underground and gear', amount: 70_000 },
  { label: 'Rough-in', amount: 98_000 },
  { label: 'Trim', amount: 56_000 },
  { label: 'Site lighting', amount: 24_000 },
]

describe("a trade's own schedule of values (question 4)", () => {
  it('says where the money claimed stands on their lines, each in full before the next', () => {
    expect(stageReachedWords(lines, stageReached(lines, 89_000))).toBe('Claimed $89,000 to date: through Underground and gear, 19% into Rough-in.')
    expect(stageReachedWords(lines, stageReached(lines, 40_000))).toBe('Claimed $40,000 to date: 57% into Underground and gear.')
    expect(stageReachedWords(lines, stageReached(lines, 168_000))).toBe('Claimed $168,000 to date: through Underground and gear, Rough-in.')
    expect(stageReachedWords(lines, stageReached(lines, 248_000))).toBe('Claimed $248,000 to date: every line on their schedule.')
    expect(stageReachedWords(lines, stageReached(lines, 0))).toBe('Nothing claimed yet.')
  })

  it('checks it adds up to their number', () => {
    expect(theirSovGap(lines, 248_000)).toBe(0)
    expect(theirSovGap(lines, 250_000)).toBe(-2_000)
  })

  it("reads Pecan Valley's on Fair Oaks D electrical, beside what the draws claimed", () => {
    const pkg = initialGcState().projects.find((p) => p.id === 'fairoaksd')?.packages.find((k) => k.id === 'felec')
    const theirs = pkg ? theirSovOf(pkg) : null
    expect(theirs?.map((l) => l.label)).toEqual(['Underground and gear', 'Rough-in', 'Trim', 'Site lighting'])
    expect(pkg?.sow ? claimedToDate(pkg.sow) : null).toBe(89_000)
  })
})
