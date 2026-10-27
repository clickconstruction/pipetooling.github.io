import { describe, expect, it } from 'vitest'
import { CONTRACT_LINK_EXPIRED_WORDS, CONTRACT_LINK_GONE_WORDS, contractLinkErrorWords } from './contractAcceptLink'
import { plainWordsFailures } from './plainWords'

describe('the signing page’s words when its link does not load', () => {
  it('says a dead link plainly, naming no portal, whichever 404 the function sent', () => {
    expect(contractLinkErrorWords(404, 'Not found')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(contractLinkErrorWords(404, 'Not available')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(CONTRACT_LINK_GONE_WORDS).not.toMatch(/portal/i)
    expect(plainWordsFailures(CONTRACT_LINK_GONE_WORDS)).toEqual([])
  })

  it('words an expired link by its code, and leaves anything else to the failure’s class, never the function’s words (v2.5965)', () => {
    expect(contractLinkErrorWords(410, 'expired')).toBe(CONTRACT_LINK_EXPIRED_WORDS)
    expect(plainWordsFailures(CONTRACT_LINK_EXPIRED_WORDS)).toEqual([])
    expect(contractLinkErrorWords(500)).toBeNull()
    expect(contractLinkErrorWords(410, null)).toBeNull()
  })
})
