/**
 * A locked bid version (v2.6234): who may lock, who may unlock, whom the lock blocks, the words.
 */
import { describe, expect, it } from 'vitest'
import { lockBadgeWords, lockBlocks, lockTitleWords, mayLock, mayOverrideLock, mayUnlock } from './versionLock'

const names = new Map([['u-will', 'William'], ['u-wendi', 'Wendi']])
const nameOf = (id: string) => names.get(id)
const open = { owner_user_id: 'u-will', locked_by: null }
const locked = { owner_user_id: 'u-will', locked_by: 'u-will' }

describe('version lock', () => {
  it('dev and master override; estimators and assistants do not', () => {
    expect(['dev', 'master_technician'].every(mayOverrideLock)).toBe(true)
    expect(['estimator', 'assistant', 'controller', null, undefined].some(mayOverrideLock)).toBe(false)
  })
  it('the owner, a dev or a master may lock an open version; nobody locks a locked one twice', () => {
    expect(mayLock(open, 'u-will', 'estimator')).toBe(true)
    expect(mayLock(open, 'u-wendi', 'estimator')).toBe(false)
    expect(mayLock(open, 'u-wendi', 'master_technician')).toBe(true)
    expect(mayLock(locked, 'u-will', 'estimator')).toBe(false)
  })
  it('the holder, the owner, a dev or a master may unlock', () => {
    expect(mayUnlock(locked, 'u-will', 'estimator')).toBe(true)
    expect(mayUnlock(locked, 'u-wendi', 'estimator')).toBe(false)
    expect(mayUnlock(locked, 'u-wendi', 'dev')).toBe(true)
    expect(mayUnlock(open, 'u-will', 'estimator')).toBe(false)
  })
  it('the lock blocks everyone but the holder, a dev or a master', () => {
    expect(lockBlocks(locked, 'u-wendi', 'estimator')).toBe(true)
    expect(lockBlocks(locked, 'u-will', 'estimator')).toBe(false)
    expect(lockBlocks(locked, 'u-wendi', 'master_technician')).toBe(false)
    expect(lockBlocks(open, 'u-wendi', 'estimator')).toBe(false)
  })
  it('the words name the holder, or you', () => {
    expect(lockBadgeWords(locked, 'u-wendi', nameOf)).toBe('Locked · William')
    expect(lockBadgeWords(locked, 'u-will', nameOf)).toBe('Locked · you')
    expect(lockBadgeWords(open, 'u-will', nameOf)).toBe('')
    expect(lockTitleWords(locked, 'u-wendi', nameOf)).toBe('William locked this version. Only they edit it. Ask them, or a master, to unlock it.')
    expect(lockTitleWords(locked, 'u-will', nameOf)).toBe('Only you edit this version. Press Unlock to let others in.')
  })
})
