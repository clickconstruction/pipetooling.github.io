import { describe, expect, it } from 'vitest'
import { boardIntro, coerceStage, hiringTabPowers, stageAllowed } from './sharedHiringTab'

describe('the shared Hiring tab', () => {
  it('keeps Hire and Review for the board', () => {
    expect(stageAllowed('tryout', true)).toBe(true)
    expect(stageAllowed('hire', true)).toBe(false)
    expect(stageAllowed('review', true)).toBe(false)
    expect(stageAllowed('review', false)).toBe(true)
  })

  it('coerces the ?stage= deep link', () => {
    expect(coerceStage('review', false)).toBe('review')
    expect(coerceStage('review', true)).toBeNull()
    expect(coerceStage('interview', true)).toBe('interview')
    expect(coerceStage('bogus', false)).toBeNull()
    expect(coerceStage(null, true)).toBeNull()
  })

  it('withholds every office power from a share, and none from the board', () => {
    expect(Object.values(hiringTabPowers(true)).every((v) => v === false)).toBe(true)
    expect(Object.values(hiringTabPowers(false)).every((v) => v === true)).toBe(true)
  })

  it('words the intro for the share', () => {
    expect(boardIntro(true, 1)).toMatch(/^One column was shared with you/)
    expect(boardIntro(true, 2)).toMatch(/^Two columns were shared with you/)
    expect(boardIntro(true, 5)).toMatch(/^5 columns were shared with you/)
    expect(boardIntro(false, 3)).toMatch(/^One column per role/)
  })
})
