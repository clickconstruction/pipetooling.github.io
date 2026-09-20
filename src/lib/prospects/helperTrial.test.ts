import { describe, expect, it } from 'vitest'
import { isHelperColumn, trialSinceLabel, tryOutBlocker } from './helperTrial'

describe('isHelperColumn', () => {
  it('offers Try out on helper-shaped columns only', () => {
    expect(isHelperColumn('Helper')).toBe(true)
    expect(isHelperColumn('Apprentice plumbers')).toBe(true)
    expect(isHelperColumn('Office Manager')).toBe(false)
    expect(isHelperColumn('Plumber')).toBe(false)
    expect(isHelperColumn(null)).toBe(false)
  })
})

describe('tryOutBlocker', () => {
  const ok = { status: 'active', email: 'bryan@example.com' }
  it('lets a Screen or Interview card with an email through', () => {
    expect(tryOutBlocker(ok)).toBeNull()
    expect(tryOutBlocker({ ...ok, status: 'calling' })).toBeNull()
  })
  it('wants an email — the helper signs in with it', () => {
    expect(tryOutBlocker({ ...ok, email: null })).toMatch(/Add an email/)
    expect(tryOutBlocker({ ...ok, email: '  ' })).toMatch(/Add an email/)
    expect(tryOutBlocker({ ...ok, email: 'bryan at example' })).toMatch(/does not look right/)
  })
  it('refuses a card already tried, hired or passed', () => {
    expect(tryOutBlocker({ ...ok, status: 'trial' })).toMatch(/Already/)
    expect(tryOutBlocker({ ...ok, trial_user_id: 'u1' })).toMatch(/Already/)
    expect(tryOutBlocker({ ...ok, status: 'hired' })).toMatch(/Screen or Interview/)
    expect(tryOutBlocker({ ...ok, status: 'passed' })).toMatch(/Screen or Interview/)
  })
})

describe('trialSinceLabel', () => {
  it('dates the trial by the company calendar, not UTC', () => {
    // 01:30 UTC on the 13th is still the evening of the 12th in Texas.
    expect(trialSinceLabel('2026-09-13T01:30:00Z')).toBe('on trial since Sep 12')
  })
  it('says less when there is no stamp', () => {
    expect(trialSinceLabel(null)).toBe('on trial')
    expect(trialSinceLabel('not a date')).toBe('on trial')
  })
})
