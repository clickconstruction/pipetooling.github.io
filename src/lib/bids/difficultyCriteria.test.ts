import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_CRITERIA_V1,
  carryDifficultyPicks,
  difficultyCriteriaProblems,
  difficultyMaxPoints,
  difficultyRangeWords,
  difficultyRungSentence,
  difficultyTotalPoints,
  difficultyUnratedWords,
  difficultyVersionWords,
  parseDifficultyCriteriaBody,
  type DifficultyCriteriaBody,
} from './difficultyCriteria'

const MIGRATION = resolve(__dirname, '../../../supabase/migrations/20261114090000_difficulty_criteria_versions.sql')

function v2(): DifficultyCriteriaBody {
  // Version 2 as PR 6 will publish it: the site scale on the bid, and the field scale with a fourth rung.
  const field = DIFFICULTY_CRITERIA_V1.scales[1]!
  return {
    scales: [
      DIFFICULTY_CRITERIA_V1.scales[0]!,
      { ...field, max: 4, rungs: [...field.rungs, { points: 4, sentence: 'We walked off the job once.' }] },
      DIFFICULTY_CRITERIA_V1.scales[2]!,
      {
        key: 'site',
        name: 'The site',
        scope: 'bid',
        source: 'picked',
        max: 2,
        rungs: [
          { points: 0, sentence: 'Open ground with room to stage.' },
          { points: 1, sentence: 'An occupied building, or no room to stage.' },
          { points: 2, sentence: 'Work in phases, or every trip is a lift.' },
        ],
      },
    ],
  }
}

describe('difficultyCriteria', () => {
  it('version 1 in the kernel is the JSON the migration seeds', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const m = /\$json\$(\{.*?\})\$json\$/s.exec(sql)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1]!)).toEqual(DIFFICULTY_CRITERIA_V1)
    expect(difficultyCriteriaProblems(DIFFICULTY_CRITERIA_V1)).toEqual([])
  })

  it('parses a row body leniently and refuses what is not a body', () => {
    expect(parseDifficultyCriteriaBody(null)).toBeNull()
    expect(parseDifficultyCriteriaBody({})).toBeNull()
    expect(parseDifficultyCriteriaBody('{"scales":[]}')).toEqual({ scales: [] })
    const parsed = parseDifficultyCriteriaBody({ scales: [{ key: 'x', name: 'X', rungs: [{ points: '0', sentence: 'a' }, { points: 2 }] }, 'junk'] })
    expect(parsed).toEqual({ scales: [{ key: 'x', name: 'X', scope: 'gc', source: 'picked', max: 2, rungs: [{ points: 0, sentence: 'a' }, { points: 2, sentence: '' }] }] })
  })

  it('names each rule a draft breaks', () => {
    const problems = difficultyCriteriaProblems({
      scales: [
        { key: 'Bad Key', name: '', scope: 'gc', source: 'picked', max: 0, rungs: [{ points: 1, sentence: '' }] },
        { key: 'field', name: 'Field', scope: 'gc', source: 'picked', max: 2, rungs: [{ points: 0, sentence: 'a' }, { points: 0, sentence: 'b' }, { points: 3, sentence: 'c' }] },
        { key: 'field', name: 'Field again', scope: 'gc', source: 'picked', max: 1, rungs: [{ points: 0, sentence: 'a' }, { points: 1, sentence: 'b' }] },
      ],
    })
    expect(problems).toEqual([
      'scale 1: the key is lower-case letters, digits and underscores, starting with a letter.',
      'Scale 1 (Bad Key): give it a name.',
      'scale 1: the maximum is a whole number from 1 to 10.',
      'scale 1: a picked scale needs at least two rungs.',
      'scale 1: the first rung is 0 points.',
      'scale 1: the last rung is the maximum, 0.',
      'scale 1: rung 1 (1 point) has no sentence.',
      'Field: the last rung is the maximum, 2.',
      'Field: rung 2 must have more points than the rung before it.',
      'Field again: the key field is already on another scale.',
    ])
    expect(difficultyCriteriaProblems({ scales: [] })).toEqual(['A version needs at least one scale.'])
  })

  it('a bills scale may carry no rungs', () => {
    expect(difficultyCriteriaProblems({ scales: [{ key: 'paying', name: 'Paying', scope: 'gc', source: 'bills', max: 1, rungs: [] }] })).toEqual([])
  })

  it('adds up the points a GC carries and names what is unrated or stale', () => {
    expect(difficultyMaxPoints(DIFFICULTY_CRITERIA_V1)).toBe(6)
    expect(difficultyMaxPoints(v2(), 'bid')).toBe(2)
    expect(difficultyTotalPoints({ paying: 1, field: 2, office: 1 }, DIFFICULTY_CRITERIA_V1)).toEqual({ points: 4, rated: ['paying', 'field', 'office'], unrated: [], stale: [] })
    expect(difficultyTotalPoints({ field: 2, site: 1, gone: 3 }, DIFFICULTY_CRITERIA_V1)).toEqual({ points: 2, rated: ['field'], unrated: ['paying', 'office'], stale: ['site', 'gone'] })
    // A rung the version does not have counts for nothing.
    expect(difficultyTotalPoints({ field: 4 }, DIFFICULTY_CRITERIA_V1).points).toBe(0)
    expect(difficultyTotalPoints({ field: 4 }, v2()).points).toBe(4)
    expect(difficultyRungSentence(DIFFICULTY_CRITERIA_V1, 'office', 1)).toMatch(/^Pay apps come back/)
    expect(difficultyRungSentence(DIFFICULTY_CRITERIA_V1, 'office', 9)).toBeNull()
    expect(difficultyRangeWords(DIFFICULTY_CRITERIA_V1.scales[1]!)).toBe('0 to 3')
  })

  describe('the carry-over rule', () => {
    it('a pick carries when its key and its points still exist; a new scale starts unrated', () => {
      const carry = carryDifficultyPicks({ paying: 1, field: 2, office: 1 }, v2())
      expect(carry.picks).toEqual({ paying: 1, field: 2, office: 1 })
      expect(carry.kept).toEqual(['paying', 'field', 'office'])
      expect(carry.dropped).toEqual([])
      expect(carry.unrated).toEqual(['site'])
      expect(difficultyUnratedWords(carry, v2())).toBe('The site is unrated under this version.')
    })

    it('a removed rung or scale leaves that scale unrated and says so; nothing is recomputed', () => {
      const trimmed: DifficultyCriteriaBody = {
        scales: [
          { ...DIFFICULTY_CRITERIA_V1.scales[1]!, max: 2, rungs: DIFFICULTY_CRITERIA_V1.scales[1]!.rungs.slice(0, 3) },
          DIFFICULTY_CRITERIA_V1.scales[2]!,
        ],
      }
      const carry = carryDifficultyPicks({ paying: 1, field: 3, office: 2 }, trimmed)
      expect(carry.picks).toEqual({ office: 2 })
      expect(carry.dropped).toEqual([
        { key: 'paying', points: 1, reason: 'scale gone' },
        { key: 'field', points: 3, reason: 'rung gone' },
      ])
      expect(carry.unrated).toEqual(['field'])
      expect(difficultyUnratedWords(carry, trimmed)).toBe('Field and superintendent is unrated under this version. A pick from an older version did not carry: its rung is gone.')
    })

    it('says nothing when everything carries', () => {
      const carry = carryDifficultyPicks({ field: 1, office: 0, paying: 0 }, DIFFICULTY_CRITERIA_V1)
      expect(difficultyUnratedWords(carry, DIFFICULTY_CRITERIA_V1)).toBeNull()
    })
  })

  it('words', () => {
    expect(difficultyVersionWords({ version: 2, publishedAt: '2026-11-20T15:00:00Z', publishedByName: 'Micah' })).toBe('Version 2 · 2026-11-20 by Micah')
    expect(difficultyVersionWords({ version: 1, publishedAt: null, publishedByName: '' })).toBe('Version 1')
  })
})
