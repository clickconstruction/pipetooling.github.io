import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { QUEUES_FOLD_WORDS } from './queuesFold'

describe('QUEUES_FOLD_WORDS (v2.5708, punch list #139)', () => {
  it('the fold’s words are plain, the counts line being the lists’ own shape', () => {
    expect(QUEUES_FOLD_WORDS.line).toBe('New 0 · Needs a reply 0 · We owe them 0')
    for (const words of [QUEUES_FOLD_WORDS.tail, QUEUES_FOLD_WORDS.open]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
