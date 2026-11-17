// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DO_FIRST_MARK, DO_FIRST_OFF_WORDS, DO_FIRST_WORDS, doFirstId, doFirstStorageKey, readDoFirst, writeDoFirst } from './doFirst'

beforeEach(() => localStorage.clear())

describe('Do first', () => {
  it('is kept on the device, one key per account', () => {
    writeDoFirst('u-theo', 'inst-1')
    expect(localStorage.getItem(doFirstStorageKey('u-theo'))).toBe('inst-1')
    expect(readDoFirst('u-theo')).toBe('inst-1')
    expect(readDoFirst('u-hal')).toBeNull()
    writeDoFirst('u-theo', null)
    expect(readDoFirst('u-theo')).toBeNull()
  })
  it('reads and writes nothing with nobody signed in', () => {
    writeDoFirst(null, 'inst-1')
    expect(localStorage.length).toBe(0)
    expect(readDoFirst(undefined)).toBeNull()
  })
  it('stands only while the task can still be Next', () => {
    const open = [{ id: 'a' }, { id: 'b' }]
    expect(doFirstId('b', open)).toBe('b')
    expect(doFirstId('gone', open)).toBeNull()
    expect(doFirstId(null, open)).toBeNull()
  })
  it('says what it does in plain words', () => {
    for (const s of [DO_FIRST_WORDS, DO_FIRST_OFF_WORDS, DO_FIRST_MARK]) expect(plainWordsFailures(s)).toEqual([])
  })
})
