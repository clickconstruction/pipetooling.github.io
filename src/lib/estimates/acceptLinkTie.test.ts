import { describe, expect, it } from 'vitest'
import { acceptTokensIn, linkTokensIn, sha256Hex, shortCodesIn, textsCarryingLink } from './acceptLinkTie'

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
    expect(await textsCarryingLink(texts, null, [])).toEqual([])
  })
})

describe('the short link’s code (v2.6725, punch list #281)', () => {
  it('reads the code off a my.clickplumbing.com/e/ link, lower-cased, and leaves a trailing period and a bare /e/ alone', () => {
    expect(shortCodesIn('Open it to approve the option you want: https://my.clickplumbing.com/e/fj4nt3ud5n')).toEqual(['fj4nt3ud5n'])
    expect(shortCodesIn('Here: https://my.clickplumbing.com/e/FJ4NT3UD5N.')).toEqual(['fj4nt3ud5n'])
    expect(shortCodesIn('the app at http://localhost:5173/e/abc2def3gh too')).toEqual(['abc2def3gh'])
    expect(shortCodesIn('see /e/abc2def3gh in the path, or the/e/thing')).toEqual([])
    expect(shortCodesIn('an email link https://clicktooling.com/estimate/accept?t=abc is not a short link')).toEqual([])
  })
  it('reads both shapes in the order the body carries them', () => {
    expect(linkTokensIn('https://clicktooling.com/estimate/accept?t=one%2Btwo then https://my.clickplumbing.com/e/abc2def3gh and https://clicktooling.com/estimate/accept?t=three')).toEqual(['one+two', 'abc2def3gh', 'three'])
    expect(linkTokensIn('no link')).toEqual([])
  })
  it('keeps a text whose short code hashes to one of the estimate’s share links, beside the emailed link’s texts', async () => {
    const code = 'fj4nt3ud5n'
    const codeHash = (await sha256Hex(code)) as string
    const otherHash = (await sha256Hex('pmsk4zrr5u')) as string
    const texts = [
      { id: 'short', body: 'Your estimate is ready, $1.00. Open it to approve the option you want: https://my.clickplumbing.com/e/fj4nt3ud5n' },
      { id: 'short-caps', body: 'https://my.clickplumbing.com/e/FJ4NT3UD5N' },
      { id: 'other-short', body: 'https://my.clickplumbing.com/e/z9z9z9z9z9' },
      { id: 'emailed', body: 'Your estimate: https://clicktooling.com/estimate/accept?t=abc' },
      { id: 'pr1-share', body: 'Your estimate: https://clicktooling.com/estimate/accept?t=pmsk4zrr5u' },
    ]
    expect((await textsCarryingLink(texts, ABC, [codeHash, otherHash])).map((t) => t.id)).toEqual(['short', 'short-caps', 'emailed', 'pr1-share'])
    expect((await textsCarryingLink(texts, null, [codeHash.toUpperCase()])).map((t) => t.id)).toEqual(['short', 'short-caps'])
    expect((await textsCarryingLink(texts, ABC, [])).map((t) => t.id)).toEqual(['emailed'])
  })
})
