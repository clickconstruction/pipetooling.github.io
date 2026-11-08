import { describe, expect, it } from 'vitest'
import { lienCodeRefusalWords, lienCodeSignerFrom, lienCodeStatusStale, lienFirstName, lienOtherScreen } from './lienCodeSigner'

/**
 * The master's code on someone else's screen (punch list #150, v2.6733): the one kernel the desk's footers and the
 * run window's card read, so the three lines name him and his code's state the same way.
 */
describe('lienCodeSignerFrom — the sign line’s signer from what the screen read', () => {
  it('names him by his first name and says whether his code can be taken', () => {
    expect(lienCodeSignerFrom('Malachi Whites', null)).toEqual({ firstName: 'Malachi', status: 'loading', lockedUntilClock: null })
    expect(lienCodeSignerFrom('Malachi Whites', 'loading')).toEqual({ firstName: 'Malachi', status: 'loading', lockedUntilClock: null })
    expect(lienCodeSignerFrom('Malachi Whites', 'not_live')).toEqual({ firstName: 'Malachi', status: 'not_live', lockedUntilClock: null })
    expect(lienCodeSignerFrom('Malachi Whites', { set: false, setAtIso: null, lastUsedAtIso: null, lockedUntilIso: null })).toEqual({ firstName: 'Malachi', status: 'none', lockedUntilClock: null })
    expect(lienCodeSignerFrom('Malachi Whites', { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null })).toEqual({ firstName: 'Malachi', status: 'ready', lockedUntilClock: null })
  })

  it('a locked code carries the clock it opens at, in the app’s time', () => {
    const locked = lienCodeSignerFrom('Malachi Whites', { set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: '2026-10-23T19:29:00Z' })
    expect(locked.status).toBe('locked')
    expect(locked.lockedUntilClock).toBe('2:29 PM')
  })

  it('a blank name reads as the leader', () => {
    expect(lienFirstName('  ')).toBe('The leader')
    expect(lienFirstName(null, 'his')).toBe('his')
    expect(lienCodeSignerFrom('', 'not_live').firstName).toBe('The leader')
  })
})

describe('lienOtherScreen — the job has a master and he is not signed in here', () => {
  it('is true for another’s screen, false on his own and false with no master', () => {
    expect(lienOtherScreen('u-malachi', 'u-robert')).toBe(true)
    expect(lienOtherScreen('u-malachi', 'u-malachi')).toBe(false)
    expect(lienOtherScreen(null, 'u-robert')).toBe(false)
    expect(lienOtherScreen('u-malachi', null)).toBe(true)
  })
})

describe('lienCodeRefusalWords and lienCodeStatusStale — what a refused code says, and when to ask again', () => {
  it('a wrong code counts the tries left; every other refusal is the database’s sentence as it came', () => {
    expect(lienCodeRefusalWords({ ok: false, reason: 'wrong', message: 'That is not Malachi’s code.', triesLeft: 3, lockedUntilIso: null })).toBe('That is not Malachi’s code. 3 tries left.')
    expect(lienCodeRefusalWords({ ok: false, reason: 'wrong', message: 'That is not Malachi’s code.', triesLeft: 1, lockedUntilIso: null })).toBe('That is not Malachi’s code. 1 try left.')
    expect(lienCodeRefusalWords({ ok: false, reason: 'locked', message: 'His code is locked until 2:29 PM.', triesLeft: null, lockedUntilIso: '2026-10-23T19:29:00Z' })).toBe('His code is locked until 2:29 PM.')
  })

  it('a lock, a missing code or a database side not live is stale news; a wrong code is not', () => {
    expect(lienCodeStatusStale('locked')).toBe(true)
    expect(lienCodeStatusStale('none')).toBe(true)
    expect(lienCodeStatusStale('not_live')).toBe(true)
    expect(lienCodeStatusStale('wrong')).toBe(false)
    expect(lienCodeStatusStale('format')).toBe(false)
    expect(lienCodeStatusStale('error')).toBe(false)
  })
})
