import { describe, expect, it } from 'vitest'
import { CONTRACT_LINK_GONE_WORDS, contractLinkErrorWords } from './contractAcceptLink'
import { plainWordsFailures } from './plainWords'

describe('the signing page’s words when its link does not load', () => {
  it('says a dead link plainly, naming no portal, whichever 404 the function sent', () => {
    expect(contractLinkErrorWords(404, 'Not found')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(contractLinkErrorWords(404, 'Not available')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(CONTRACT_LINK_GONE_WORDS).not.toMatch(/portal/i)
    expect(plainWordsFailures(CONTRACT_LINK_GONE_WORDS)).toEqual([])
  })

  it('keeps the function’s own words for anything else', () => {
    expect(contractLinkErrorWords(410, 'Link expired')).toBe('Link expired')
    expect(contractLinkErrorWords(500, undefined)).toBe('Unable to load contract.')
  })
})
