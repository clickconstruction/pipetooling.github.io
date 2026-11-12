import { describe, expect, it } from 'vitest'
import { homesteadAnswer, homesteadAnsweredOnRow, homesteadQuestionOpen } from './homesteadAnswer'

describe('the homestead question on a property record (punch list #305)', () => {
  it('reads the answer softly: a row without the column says nothing, NULL is unanswered, a time is answered', () => {
    expect(homesteadAnsweredOnRow(null)).toBeNull()
    expect(homesteadAnsweredOnRow({ homestead: false })).toBeNull()
    expect(homesteadAnsweredOnRow({ homestead: false, homestead_answered_at: null })).toBe(false)
    expect(homesteadAnsweredOnRow({ homestead: false, homestead_answered_at: '' })).toBe(false)
    expect(homesteadAnsweredOnRow({ homestead: false, homestead_answered_at: '2026-11-17T15:00:00Z' })).toBe(true)
  })

  it('nobody asked is not a no: the flag is yes when set, no only once answered or when nothing is known', () => {
    expect(homesteadAnswer(true, false)).toBe('yes')
    expect(homesteadAnswer(true, null)).toBe('yes')
    expect(homesteadAnswer(false, true)).toBe('no')
    expect(homesteadAnswer(false, false)).toBe('unanswered')
    // A row read before the migration: the flag alone, as the app read it until now.
    expect(homesteadAnswer(false, null)).toBe('no')
    expect(homesteadAnswer(false, undefined)).toBe('no')
  })

  it('the hold is a residential property, not marked homestead, with no answer on record', () => {
    expect(homesteadQuestionOpen({ propertyKind: 'residential', homestead: false, answered: false })).toBe(true)
    expect(homesteadQuestionOpen({ propertyKind: 'residential', homestead: false, answered: true })).toBe(false)
    // Marked homestead is the other hold, the attorney's.
    expect(homesteadQuestionOpen({ propertyKind: 'residential', homestead: true, answered: false })).toBe(false)
    // A commercial property is never asked; an unknown kind is asked its kind first.
    expect(homesteadQuestionOpen({ propertyKind: 'non_residential', homestead: false, answered: false })).toBe(false)
    expect(homesteadQuestionOpen({ propertyKind: '', homestead: false, answered: false })).toBe(false)
    // A row that does not carry the column holds nothing: the client can land before the migration.
    expect(homesteadQuestionOpen({ propertyKind: 'residential', homestead: false, answered: null })).toBe(false)
    expect(homesteadQuestionOpen({ propertyKind: 'residential', homestead: false, answered: undefined })).toBe(false)
  })
})
