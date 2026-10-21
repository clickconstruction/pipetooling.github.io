import { describe, expect, it } from 'vitest'
import { acceptTokensIn, sha256Hex, textsCarryingLink } from './acceptLinkTie'

// SHA-256("abc"), the published test vector.
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

describe('acceptLinkTie (v2.5697, punch list #139)', () => {
  it('reads every accept link’s token out of a body, decoded, in order', () => {
    expect(acceptTokensIn('Dana, open it here: https://clicktooling.com/estimate/accept?t=abc and done.')).toEqual(['abc'])
    expect(acceptTokensIn('two: https://x.test/estimate/accept?t=one%2Btwo then https://x.test/estimate/accept?t=three')).toEqual(['one+two', 'three'])
    expect(acceptTokensIn('no link here')).toEqual([])
  })
  it('hashes a token as the edge does', async () => {
    expect(await sha256Hex('abc')).toBe(ABC)
  })
  it('keeps only the texts whose link hashes to the estimate’s, and none without a hash', async () => {
    const texts = [
      { id: 'mine', body: 'Your estimate: https://clicktooling.com/estimate/accept?t=abc' },
      { id: 'later', body: 'Your estimate: https://clicktooling.com/estimate/accept?t=xyz' },
      { id: 'none', body: 'No link at all' },
    ]
    expect((await textsCarryingLink(texts, ABC)).map((t) => t.id)).toEqual(['mine'])
    expect((await textsCarryingLink(texts, ABC.toUpperCase())).map((t) => t.id)).toEqual(['mine'])
    expect(await textsCarryingLink(texts, null)).toEqual([])
  })
})
