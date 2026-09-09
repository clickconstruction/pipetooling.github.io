import { describe, expect, it } from 'vitest'
import {
  TWIN_QUESTION_MAX_CHARS,
  TWIN_QUESTION_SHAPE_HINT,
  checkEstimatorQuestionShape,
  normalizeTwinQuestionChoices,
} from '../../../supabase/functions/_shared/twinQuestionShape'
import { answerFromChoice, orderedChoices } from './twinQuestionChoices'

describe('checkEstimatorQuestionShape (the door)', () => {
  it('accepts one decision with 2–4 short choices and a recommended pick', () => {
    const r = checkEstimatorQuestionShape({
      question: 'Take 5 Conroe, P2.01: add a footage residual on small TIs?',
      choices: ['Residual', 'Higher per-fixture', 'Neither'],
      recommended: 'residual',
    })
    expect(r).toEqual({ ok: true, choices: ['Residual', 'Higher per-fixture', 'Neither'], recommended: 'Residual' })
  })

  it('refuses the wall: long, many question marks, numbered decisions, no choices', () => {
    const wall =
      'Slate doctrine asks from the backtest slate — full detail in each STG-6 stamp. Three decisions: (1) SMALL-TI RESIDUAL — approve a footage residual or ~30% higher per-fixture all-ins? (2) TAKE 5 PROTO PACKAGE — approve minting a book entry so the next proto scores inside ±5%? Also confirm: CA piping IS plumber scope? (3) HUNTER RD BAND — confirm we bank this as a market-band flag rather than recalibrating the book down.'
    const r = checkEstimatorQuestionShape({ question: wall })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.problems.join(' ')).toMatch(new RegExp(`under ${TWIN_QUESTION_MAX_CHARS}`))
    expect(r.problems.join(' ')).toMatch(/question marks/)
    expect(r.problems.join(' ')).toMatch(/numbered list/)
    expect(r.problems.join(' ')).toMatch(/no choices/)
    expect(r.hint).toBe(TWIN_QUESTION_SHAPE_HINT)
  })

  it('refuses one choice, five choices, a sentence-length choice, and a recommended that is not offered', () => {
    const one = checkEstimatorQuestionShape({ question: 'Bid it?', choices: ['Yes', 'yes '] })
    expect(one.ok).toBe(false)
    if (!one.ok) expect(one.problems[0]).toMatch(/only 1 distinct choice/)
    const five = checkEstimatorQuestionShape({ question: 'Which tier?', choices: ['A', 'B', 'C', 'D', 'E'] })
    expect(five.ok).toBe(false)
    if (!five.ok) expect(five.problems[0]).toMatch(/5 choices/)
    const long = checkEstimatorQuestionShape({ question: 'Bid it?', choices: ['Yes', 'No, because the shell drawings are the 2021 set and not the fit-out'] })
    expect(long.ok).toBe(false)
    if (!long.ok) expect(long.problems[0]).toMatch(/over 40 characters/)
    const rec = checkEstimatorQuestionShape({ question: 'Bid it?', choices: ['Yes', 'No'], recommended: 'Maybe' })
    expect(rec.ok).toBe(false)
    if (!rec.ok) expect(rec.problems[0]).toMatch(/not one of the choices/)
  })

  it('a plans ask fits the shape once it names the choices', () => {
    const r = checkEstimatorQuestionShape({
      question: 'SpaceX Level 1: the file on the bid is the electrical set. Attach the plumbing sheets?',
      choices: ['Attached — rerun', 'Use what is there', 'Skip this bid'],
      recommended: 'Attached — rerun',
    })
    expect(r.ok).toBe(true)
  })
})

describe('normalizeTwinQuestionChoices', () => {
  it('trims, drops blanks, dedupes case-insensitively, keeps order; null when empty', () => {
    expect(normalizeTwinQuestionChoices(['  Yes ', '', 'no', 'NO', 'Later'])).toEqual(['Yes', 'no', 'Later'])
    expect(normalizeTwinQuestionChoices([])).toBeNull()
    expect(normalizeTwinQuestionChoices('Yes')).toBeNull()
    expect(normalizeTwinQuestionChoices(undefined)).toBeNull()
  })
})

describe('orderedChoices (the buttons)', () => {
  it('puts the recommended pick first and marks it', () => {
    expect(orderedChoices({ choices: ['Residual', 'Higher per-fixture', 'Neither'], recommended: 'Neither' })).toEqual([
      { label: 'Neither', recommended: true },
      { label: 'Residual', recommended: false },
      { label: 'Higher per-fixture', recommended: false },
    ])
  })

  it('keeps the robot order when nothing is recommended, and returns null for legacy rows', () => {
    expect(orderedChoices({ choices: ['Yes', 'No'] })).toEqual([
      { label: 'Yes', recommended: false },
      { label: 'No', recommended: false },
    ])
    expect(orderedChoices({})).toBeNull()
    expect(orderedChoices({ choices: null, recommended: 'Yes' })).toBeNull()
  })

  it('a tapped choice saves as its label', () => {
    expect(answerFromChoice({ label: 'Bid it', recommended: true })).toBe('Bid it')
  })
})
