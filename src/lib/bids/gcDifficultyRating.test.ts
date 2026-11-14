import { describe, expect, it } from 'vitest'
import { DIFFICULTY_CRITERIA_V1 } from './difficultyCriteria'
import {
  GC_DIFFICULTY_WORDS,
  gcDifficultyCarryLine,
  gcDifficultyChipTitle,
  gcDifficultyChipWords,
  gcDifficultyDraftProblems,
  gcDifficultyHistoryLine,
  gcDifficultyOpeningPicks,
  gcDifficultyPicksChanged,
  gcDifficultyPicksToSave,
  gcDifficultyRatedByWords,
  gcDifficultyStanding,
  gcDifficultyStandings,
  gcDifficultyTotalWords,
  newestRatingByCustomer,
  type DifficultyVersionLite,
  type GcDifficultyRating,
} from './gcDifficultyRating'

const V1: DifficultyVersionLite = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
const field = DIFFICULTY_CRITERIA_V1.scales[1]!
const V2: DifficultyVersionLite = {
  id: 'v2',
  version: 2,
  body: {
    scales: [
      DIFFICULTY_CRITERIA_V1.scales[0]!,
      // Version 2 drops the 3 point rung of the field scale.
      { ...field, max: 2, rungs: field.rungs.slice(0, 3) },
      DIFFICULTY_CRITERIA_V1.scales[2]!,
      { key: 'site', name: 'The site', scope: 'bid', source: 'picked', max: 1, rungs: [{ points: 0, sentence: 'Open.' }, { points: 1, sentence: 'Tight.' }] },
    ],
  },
}

const rating = (p: Partial<GcDifficultyRating> = {}): GcDifficultyRating => ({
  id: 'r1',
  customerId: 'c1',
  criteriaVersionId: 'v1',
  picks: { field: 3, office: 1 },
  note: 'Moved us from building C to A after the rough was staged.',
  ratedByName: 'Robert',
  ratedAt: '2026-11-14T20:00:00Z',
  ...p,
})

describe('gcDifficultyRating', () => {
  it('the newest rating per customer stands', () => {
    const rows = [rating({ id: 'a', ratedAt: '2026-10-01T00:00:00Z' }), rating({ id: 'b', ratedAt: '2026-11-01T00:00:00Z' }), rating({ id: 'c', customerId: 'c2' })]
    const newest = newestRatingByCustomer(rows)
    expect(newest.get('c1')?.id).toBe('b')
    expect(newest.get('c2')?.id).toBe('c')
    expect(gcDifficultyStandings(rows, [V1], V1).get('c1')?.points).toBe(4)
  })

  it('counts the points under the rating’s own version and lists the sentences', () => {
    const s = gcDifficultyStanding(rating(), [V1], V1)
    expect(s.points).toBe(4)
    expect(s.sentences.map((x) => `${x.key} ${x.points}`)).toEqual(['field 3', 'office 1'])
    expect(s.carry).toBeNull()
    expect(gcDifficultyChipWords(s)).toBe('Rated 4 points')
    expect(gcDifficultyChipTitle(s)).toBe(
      'Field and superintendent 3: We remobilize more than once, the super fights every change order, or our crew waits on them every week.\nTheir office 1: Pay apps come back for paperwork, lien waivers are asked for twice, a question waits a week.\nRated by Robert on 2026-11-14 under criteria version 1.',
    )
    expect(gcDifficultyRatedByWords(s)).toBe('Rated by Robert on 2026-11-14 under criteria version 1.')
    expect(gcDifficultyTotalWords(4)).toBe('4 points on every new bid to them.')
    expect(gcDifficultyCarryLine(s)).toBeNull()
    expect(gcDifficultyOpeningPicks(s)).toEqual({ field: 3, office: 1 })
  })

  it('a rating under version 1 stays 4 points when version 2 is published; the card carries what it can and says what is unrated', () => {
    const s = gcDifficultyStanding(rating(), [V1, V2], V2)
    expect(s.points).toBe(4)
    expect(s.carry?.picks).toEqual({ office: 1 })
    expect(s.carry?.unrated).toEqual(['paying', 'field', 'site'])
    expect(gcDifficultyCarryLine(s)).toBe('Rated under version 1; version 2 is published. Paying, Field and superintendent, The site are unrated under this version. A pick from an older version did not carry: its rung is gone.')
    expect(gcDifficultyOpeningPicks(s)).toEqual({ office: 1 })
  })

  it('a rating whose version cannot be read says so', () => {
    const s = gcDifficultyStanding(rating({ criteriaVersionId: 'gone' }), [V1], V1)
    expect(s.points).toBe(0)
    expect(gcDifficultyChipWords(s)).toBe('Rated · rated under a version that cannot be read')
    expect(gcDifficultyRatedByWords(s)).toBe('Rated by Robert on 2026-11-14.')
  })

  it('the draft rules: a pick and a note, under a published version', () => {
    expect(gcDifficultyDraftProblems({}, '', null)).toEqual([GC_DIFFICULTY_WORDS.noVersion])
    expect(gcDifficultyDraftProblems({}, '', V1.body)).toEqual([GC_DIFFICULTY_WORDS.noPick, GC_DIFFICULTY_WORDS.noNote])
    expect(gcDifficultyDraftProblems({ paying: 1 }, 'x', V1.body)).toEqual([GC_DIFFICULTY_WORDS.noPick])
    expect(gcDifficultyDraftProblems({ field: 2 }, 'The super moved us.', V1.body)).toEqual([])
    expect(gcDifficultyPicksToSave({ field: 2, paying: 1, office: 9, gone: 1 }, V1.body)).toEqual({ field: 2 })
  })

  it('the press wakes only when the picks differ from the rating that stands', () => {
    const s = gcDifficultyStanding(rating(), [V1], V1)
    expect(gcDifficultyPicksChanged({ field: 3, office: 1 }, s)).toBe(false)
    expect(gcDifficultyPicksChanged({ field: 2, office: 1 }, s)).toBe(true)
    expect(gcDifficultyPicksChanged({ field: 3 }, s)).toBe(true)
    expect(gcDifficultyPicksChanged({}, null)).toBe(false)
    expect(gcDifficultyPicksChanged({ field: 0 }, null)).toBe(true)
  })

  it('an earlier rating’s line', () => {
    expect(gcDifficultyHistoryLine(rating(), [V1])).toBe('2026-11-14 · Robert · 4 points · Moved us from building C to A after the rough was staged.')
    expect(gcDifficultyHistoryLine(rating({ criteriaVersionId: 'gone', ratedByName: '', note: ' ' }), [V1])).toBe('2026-11-14 · rated under a version that cannot be read')
  })
})
