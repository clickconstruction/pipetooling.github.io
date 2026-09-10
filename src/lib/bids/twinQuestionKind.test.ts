import { describe, expect, it } from 'vitest'
import {
  PLANS_ASK_DEFAULT_CHOICES,
  answerRequestsRerun,
  classifyTwinQuestionKind,
  effectiveTwinQuestionKind,
} from '../../../supabase/functions/_shared/twinQuestionKind'
import { checkEstimatorQuestionShape } from '../../../supabase/functions/_shared/twinQuestionShape'
import { groupStandingRulings, type TwinQuestionRow } from './standingRulings'

describe('classifyTwinQuestionKind', () => {
  it('reads the two real plans asks from the Standing rulings panel as plans', () => {
    const a = classifyTwinQuestionKind('Can you attach the plumbing sheets for this SpaceX Level 1 fit-out so I can do the plumbing takeoff? The file on the bid right now is the electrical part.')
    expect(a.kind).toBe('plans')
    expect(a.signals).toContain('asks to attach plans')
    const b = classifyTwinQuestionKind('The plan file on this bid is the 2021 shell drawing set for The Offices at Rogers Road, Buildings 1 through 6 (no TSAOG sheets anywhere in the 314 pages). Can you attach the TSAOG interior fit-out drawing set so I price the right package?')
    expect(b.kind).toBe('plans')
  })

  it('leaves judgments alone', () => {
    for (const q of [
      'Do we band travel by distance?',
      'Tye Preston library, P2.01: is the water heater plumber scope or by others?',
      'Take 5 Conroe: add a footage residual on small TIs?',
      '[audit b474 / scope] Is a strip mall shell a no-go?',
    ]) {
      expect(classifyTwinQuestionKind(q).kind, q).toBe('decision')
    }
  })

  it('the stored column wins over the text; a blank column falls back to the text', () => {
    expect(effectiveTwinQuestionKind({ kind: 'decision', question: 'Attach the plumbing sheets?' })).toBe('decision')
    expect(effectiveTwinQuestionKind({ kind: null, question: 'Attach the plumbing sheets?' })).toBe('plans')
    expect(effectiveTwinQuestionKind({ question: 'Which tier?' })).toBe('decision')
  })

  it('the default taps pass the estimator shape gate', () => {
    const r = checkEstimatorQuestionShape({
      question: 'SpaceX Level 1: the file on the bid is the electrical set. Attach the plumbing sheets?',
      choices: [...PLANS_ASK_DEFAULT_CHOICES],
      recommended: 'Attached — rerun',
    })
    expect(r.ok).toBe(true)
  })
})

describe('groupStandingRulings keeps plans asks out of the rulings', () => {
  const base = { twin_user_id: 'tw1', mission: null, answer: null, answered_by: null, answered_at: null, status: 'open' as const }
  const rows: TwinQuestionRow[] = [
    { ...base, id: 'd1', about_bid_id: 'b1', question: 'Do we band travel by distance?', created_at: '2026-09-03T10:00:00Z', topic: 'travel-bands' },
    { ...base, id: 'p1', about_bid_id: 'b2', question: 'Attach the plumbing sheets? The file on the bid is the electrical set.', created_at: '2026-09-04T10:00:00Z', topic: null },
    { ...base, id: 'p2', about_bid_id: 'b3', question: 'Which tier?', created_at: '2026-09-05T10:00:00Z', topic: null, kind: 'plans' },
  ]
  it('separates them by column or by text, and does not count them', () => {
    const v = groupStandingRulings(rows, { audience: 'estimator' })
    expect(v.openCount).toBe(1)
    expect(v.rulings.map((r) => r.topic)).toEqual(['travel-bands'])
    expect(v.singles).toEqual([])
    expect(v.plansAsks.map((q) => q.id)).toEqual(['p2', 'p1'])
  })
})

describe('answerRequestsRerun (v2.3223)', () => {
  it('the default tap and plain rerun words say yes; the other taps and free text say no', () => {
    expect(answerRequestsRerun('Attached — rerun')).toBe(true)
    expect(answerRequestsRerun('  attached — RERUN ')).toBe(true)
    expect(answerRequestsRerun('Plans fixed, please re-run it')).toBe(true)
    expect(answerRequestsRerun('run again')).toBe(true)
    expect(answerRequestsRerun('Use what is on the bid')).toBe(false)
    expect(answerRequestsRerun('Skip this bid')).toBe(false)
    expect(answerRequestsRerun('The runoff drawings are on sheet C-3')).toBe(false)
    expect(answerRequestsRerun('')).toBe(false)
    expect(answerRequestsRerun(null)).toBe(false)
  })
})
