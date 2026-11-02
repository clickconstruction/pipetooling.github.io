import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { QUEUES_FOLD_WORDS, queuesFolded } from './queuesFold'

describe('QUEUES_FOLD_WORDS (v2.5708, punch list #139)', () => {
  it('the fold’s words are plain, the counts line being the lists’ own shape', () => {
    expect(QUEUES_FOLD_WORDS.line).toBe('New 0 · Needs a reply 0 · We owe them 0')
    for (const words of [QUEUES_FOLD_WORDS.tail, QUEUES_FOLD_WORDS.open]) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('queuesFolded (v2.5708; the kept read, punch list #183 PR 5)', () => {
  it('folds on a phone with nothing waiting and the lists not opened, and nowhere else', () => {
    expect(queuesFolded({ phone: true, count: 0, open: false, kept: false })).toBe(true)
    expect(queuesFolded({ phone: false, count: 0, open: false, kept: false })).toBe(false)
    expect(queuesFolded({ phone: true, count: 2, open: false, kept: false })).toBe(false)
    expect(queuesFolded({ phone: true, count: null, open: false, kept: false })).toBe(false)
    expect(queuesFolded({ phone: true, count: 0, open: true, kept: false })).toBe(false)
  })

  it('never folds a kept read, whose stamp must show', () => {
    expect(queuesFolded({ phone: true, count: 0, open: false, kept: true })).toBe(false)
  })
})
