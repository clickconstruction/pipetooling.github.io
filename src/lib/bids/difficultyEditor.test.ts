import { describe, expect, it } from 'vitest'
import { DIFFICULTY_CRITERIA_V1, difficultyCriteriaProblems } from './difficultyCriteria'
import {
  addDifficultyRung,
  addDifficultyScale,
  diffDifficultyCriteria,
  difficultyChangeCountWords,
  difficultyKeyIsLocked,
  difficultyPreviewPicks,
  freeDifficultyKey,
  moveDifficultyScale,
  removeDifficultyRung,
  removeDifficultyScale,
  setDifficultyRungPoints,
  setDifficultyRungSentence,
  setDifficultyScaleKey,
  setDifficultyScaleMax,
  setDifficultyScaleName,
  setDifficultyScaleScope,
  setDifficultyScaleSource,
  startDifficultyDraft,
} from './difficultyEditor'

describe('difficultyEditor', () => {
  it('a draft is a copy; edits never touch the published body', () => {
    const draft = startDifficultyDraft(DIFFICULTY_CRITERIA_V1)
    expect(draft).toEqual(DIFFICULTY_CRITERIA_V1)
    expect(draft).not.toBe(DIFFICULTY_CRITERIA_V1)
    const next = setDifficultyRungSentence(draft, 'field', 0, 'changed')
    expect(DIFFICULTY_CRITERIA_V1.scales[1]!.rungs[0]!.sentence).toMatch(/^The super sets/)
    expect(draft.scales[1]!.rungs[0]!.sentence).toMatch(/^The super sets/)
    expect(next.scales[1]!.rungs[0]!.sentence).toBe('changed')
    expect(startDifficultyDraft(null)).toEqual({ scales: [] })
  })

  it('adds a scale with a free key and two rungs, and the site scale as PR 6 will', () => {
    let body = addDifficultyScale(DIFFICULTY_CRITERIA_V1)
    expect(body.scales[3]).toEqual({ key: 'scale_1', name: '', scope: 'gc', source: 'picked', max: 1, rungs: [{ points: 0, sentence: '' }, { points: 1, sentence: '' }] })
    expect(freeDifficultyKey(body)).toBe('scale_2')
    body = setDifficultyScaleKey(body, 'scale_1', 'The Site!')
    expect(body.scales[3]!.key).toBe('the_site_')
    body = setDifficultyScaleKey(body, 'the_site_', 'site')
    body = setDifficultyScaleName(body, 'site', 'The site')
    body = setDifficultyScaleScope(body, 'site', 'bid')
    body = setDifficultyRungSentence(body, 'site', 0, 'Open ground with room to stage.')
    body = setDifficultyRungSentence(body, 'site', 1, 'An occupied building, or no room to stage.')
    body = addDifficultyRung(body, 'site')
    expect(body.scales[3]!.rungs[2]).toEqual({ points: 2, sentence: '' })
    expect(body.scales[3]!.max).toBe(2)
    body = setDifficultyRungSentence(body, 'site', 2, 'Work in phases, or every trip is a lift.')
    expect(difficultyCriteriaProblems(body)).toEqual([])
    expect(diffDifficultyCriteria(DIFFICULTY_CRITERIA_V1, body)).toEqual([{ key: 'site', line: 'The site added, on the bid.' }])
  })

  it('the maximum follows the last rung; a bills scale with no rungs keeps its own', () => {
    let body = removeDifficultyRung(DIFFICULTY_CRITERIA_V1, 'field', 3)
    expect(body.scales[1]!.max).toBe(2)
    body = setDifficultyRungPoints(body, 'field', 2, 5)
    expect(body.scales[1]!.max).toBe(5)
    body = setDifficultyScaleMax(body, 'field', 9)
    expect(body.scales[1]!.max).toBe(5)
    let bills = removeDifficultyRung(removeDifficultyRung(DIFFICULTY_CRITERIA_V1, 'paying', 1), 'paying', 0)
    expect(bills.scales[0]!.rungs).toEqual([])
    bills = setDifficultyScaleMax(bills, 'paying', 2)
    expect(bills.scales[0]!.max).toBe(2)
    expect(setDifficultyScaleSource(bills, 'paying', 'picked').scales[0]!.source).toBe('picked')
  })

  it('moves and removes scales', () => {
    const moved = moveDifficultyScale(DIFFICULTY_CRITERIA_V1, 'office', -1)
    expect(moved.scales.map((s) => s.key)).toEqual(['paying', 'office', 'field'])
    expect(moveDifficultyScale(DIFFICULTY_CRITERIA_V1, 'paying', -1).scales.map((s) => s.key)).toEqual(['paying', 'field', 'office'])
    expect(removeDifficultyScale(DIFFICULTY_CRITERIA_V1, 'office').scales.map((s) => s.key)).toEqual(['paying', 'field'])
  })

  it('a key the published version has is locked', () => {
    expect(difficultyKeyIsLocked(DIFFICULTY_CRITERIA_V1, 'field')).toBe(true)
    expect(difficultyKeyIsLocked(DIFFICULTY_CRITERIA_V1, 'site')).toBe(false)
    expect(difficultyKeyIsLocked(null, 'field')).toBe(false)
  })

  it('diffs a draft against the published version, line by line', () => {
    let draft = setDifficultyScaleName(DIFFICULTY_CRITERIA_V1, 'office', 'The office')
    draft = setDifficultyRungSentence(draft, 'field', 1, 'Small surprises.')
    draft = addDifficultyRung(draft, 'field')
    draft = setDifficultyRungSentence(draft, 'field', 4, 'We walked off the job once.')
    draft = removeDifficultyRung(draft, 'office', 2)
    draft = removeDifficultyScale(draft, 'paying')
    expect(diffDifficultyCriteria(DIFFICULTY_CRITERIA_V1, draft).map((c) => c.line)).toEqual([
      'Field and superintendent: the maximum is 4, was 3.',
      'Field and superintendent: the 1 point rung reworded.',
      'Field and superintendent: a rung at 4 points added.',
      'Their office renamed to The office.',
      'The office: the maximum is 1, was 2.',
      'The office: the 2 points rung removed. A GC on it becomes unrated here.',
      'Paying removed. Every GC becomes unrated on it.',
    ])
    expect(diffDifficultyCriteria(DIFFICULTY_CRITERIA_V1, DIFFICULTY_CRITERIA_V1)).toEqual([])
    expect(diffDifficultyCriteria(null, DIFFICULTY_CRITERIA_V1).map((c) => c.line)).toEqual(['Paying added, read from bills.', 'Field and superintendent added.', 'Their office added.'])
    expect(difficultyChangeCountWords(0)).toBe('no changes yet')
    expect(difficultyChangeCountWords(1)).toBe('1 change')
    expect(difficultyChangeCountWords(2)).toBe('2 changes')
  })

  it('the preview picks every scale at its second rung', () => {
    expect(difficultyPreviewPicks(DIFFICULTY_CRITERIA_V1)).toEqual({ paying: 1, field: 1, office: 1 })
    expect(difficultyPreviewPicks({ scales: [{ key: 'x', name: 'X', scope: 'gc', source: 'bills', max: 1, rungs: [] }] })).toEqual({})
  })
})
