import { describe, expect, it } from 'vitest'
import { DIFFICULTY_CRITERIA_V1, DIFFICULTY_CRITERIA_V2 } from './difficultyCriteria'
import { bidDifficultyScalesFor, bidPickLineWords, bidPicksStaleWords, bidPicksUnder, bidRatedScales, difficultyBidScales } from './bidDifficultyPicks'

const V2 = DIFFICULTY_CRITERIA_V2
const site = V2.scales[3]!

describe('the bid’s own scales', () => {
  it('are the scales picked on the bid; version 1 has none', () => {
    expect(difficultyBidScales(V2).map((s) => s.key)).toEqual(['site'])
    expect(difficultyBidScales(DIFFICULTY_CRITERIA_V1)).toEqual([])
    expect(difficultyBidScales(null)).toEqual([])
  })
  it('keep only the picks the published version knows: its bid scales, its rungs', () => {
    expect(bidPicksUnder({ site: 1, field: 2, gone: 1 }, V2)).toEqual({ site: 1 })
    expect(bidPicksUnder({ site: 5 }, V2)).toEqual({})
    expect(bidPicksUnder({ site: 1 }, DIFFICULTY_CRITERIA_V1)).toEqual({})
    expect(bidPicksUnder(null, V2)).toEqual({})
  })
  it('read as rated scales with their sentences', () => {
    expect(bidRatedScales({ site: 2 }, V2)).toEqual([{ key: 'site', name: 'The site', points: 2, sentence: 'Work in phases, or every trip is a lift.' }])
    expect(bidRatedScales({}, V2)).toEqual([])
  })
})

describe('bidDifficultyScalesFor', () => {
  const standing = { sentences: [{ key: 'field', name: 'Field and superintendent', points: 2, sentence: 'x' }] }
  it('prices the GC’s scales, then the bid’s own', () => {
    expect(bidDifficultyScalesFor(standing, { site: 1 }, V2).map((s) => `${s.key} ${s.points}`)).toEqual(['field 2', 'site 1'])
  })
  it('a bid to a GC nobody rated still carries its site pick', () => {
    expect(bidDifficultyScalesFor(null, { site: 1 }, V2).map((s) => s.key)).toEqual(['site'])
    expect(bidDifficultyScalesFor(null, {}, V2)).toEqual([])
  })
})

describe('bidPicksStaleWords', () => {
  it('says when the site was picked, changed or cleared since the bid was priced', () => {
    expect(bidPicksStaleWords({ field: 2 }, { site: 1 }, V2)).toBe('The site was picked since this was priced: 1 point now, unrated when priced.')
    expect(bidPicksStaleWords({ field: 2, site: 1 }, { site: 2 }, V2)).toBe('The site was picked since this was priced: 2 points now, 1 when priced.')
    expect(bidPicksStaleWords({ site: 1 }, {}, V2)).toBe('The site was picked since this was priced: unrated now, 1 when priced.')
  })
  it('is quiet when they agree, with no pin, or under a version with no bid scale', () => {
    expect(bidPicksStaleWords({ field: 2, site: 1 }, { site: 1 }, V2)).toBeNull()
    expect(bidPicksStaleWords(null, { site: 1 }, V2)).toBeNull()
    expect(bidPicksStaleWords({ field: 2 }, { site: 1 }, DIFFICULTY_CRITERIA_V1)).toBeNull()
  })
})

describe('bidPickLineWords', () => {
  it('says the pick with its sentence, or that nothing is picked', () => {
    expect(bidPickLineWords(site, { site: 1 }, V2)).toBe('The site: 1 point · An occupied building, or no room to stage.')
    expect(bidPickLineWords(site, {}, V2)).toBe('The site: not picked on this bid')
  })
})
