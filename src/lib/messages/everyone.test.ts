import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { EVERYONE_WORDS } from './everyone'

describe('EVERYONE_WORDS (v2.5700, punch list #139)', () => {
  it('the section’s words are plain', () => {
    for (const words of Object.values(EVERYONE_WORDS)) expect(plainWordsFailures(words), words).toEqual([])
  })
})
