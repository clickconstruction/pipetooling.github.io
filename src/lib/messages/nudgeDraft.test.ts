import { describe, expect, it } from 'vitest'
import { SEED_FLOWS } from '../flows/seed'
import { stepById } from '../flows/state'
import type { QuickReply } from '../quickReplies/kernel'
import { plainWordsFailures } from '../plainWords'
import { nudgeDraftFor, nudgeFallback, nudgeKindOf } from './nudgeDraft'

const ask = stepById(SEED_FLOWS.trade, 'ask')!
const approved = stepById(SEED_FLOWS.residential, 'approved')!

describe('the nudge’s draft (punch list #140 PR 4)', () => {
  it('writes the step’s own reminder line for a person on a step, as the morning run would', () => {
    expect(nudgeDraftFor({ first: 'Greg', kind: 'trade', step: ask })).toEqual({ kind: 'text', words: 'Greg, checking on the number. Still good for the day you gave us?' })
    expect(nudgeDraftFor({ first: 'Dana', kind: 'customer', step: approved }).words).toBe('Dana, any word on the estimate? Happy to answer any questions.')
  })

  it('takes the team’s quick reply for the step first, by the person’s kind', () => {
    const team: QuickReply = {
      id: 'q1',
      text: '{first}, the pond quote is due Friday. Still good?',
      for: 'trade',
      stepId: 'ask',
      scope: 'team',
      addedBy: 'rosa',
      addedAt: Date.parse('2026-10-01T15:00:00Z'),
      removed: false,
      uses: {},
      lastUsed: null,
    }
    expect(nudgeDraftFor({ first: 'Greg', kind: 'trade', step: ask }, [team]).words).toBe('{first}, the pond quote is due Friday. Still good?')
    // A customer's line is not a trade partner's.
    expect(nudgeDraftFor({ first: 'Greg', kind: 'trade', step: ask }, [{ ...team, for: 'customer' }]).words).toBe('Greg, checking on the number. Still good for the day you gave us?')
  })

  it('falls back to a plain check-in for a person on no step, and to Hi for a number nobody has named', () => {
    expect(nudgeDraftFor({ first: 'Dana', kind: 'customer', step: null })).toEqual({ kind: 'text', words: 'Dana, checking in. Anything you need from us?' })
    expect(nudgeDraftFor({ first: '', kind: 'unknown', step: null }).words).toBe('Hi, checking in. Anything you need from us?')
  })

  it('opens as an email when asked, with the same words', () => {
    expect(nudgeDraftFor({ first: 'Dana', kind: 'customer', step: null }, [], null, 'email')).toEqual({ kind: 'email', words: 'Dana, checking in. Anything you need from us?' })
  })

  it('reads the URL’s kind, and nothing else', () => {
    expect(nudgeKindOf('text')).toBe('text')
    expect(nudgeKindOf('email')).toBe('email')
    expect(nudgeKindOf('1')).toBeNull()
    expect(nudgeKindOf(null)).toBeNull()
  })

  it('keeps the fallback in plain words', () => {
    expect(plainWordsFailures(nudgeFallback('Dana'))).toEqual([])
  })
})
