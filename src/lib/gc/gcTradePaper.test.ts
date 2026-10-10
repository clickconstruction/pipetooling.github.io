/**
 * A company's paper opened to sign from its portal (P5b-1): the token `submit-gc-trade-portal` mints for
 * `gc_trade_paper_open`, its hash as `get-contract-for-signer` reads it, its expiry, and the path the page goes to.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mintPaperToken, PAPER_LINK_DAYS, paperSignPath, paperTokenHash, paperTokenRaw } from '../../../supabase/functions/_shared/gcTradePaper'
import { tradeSignPath } from './tradePortalSubmit'

describe('a paper’s signing token', () => {
  it('is 64 hex characters, new each time', () => {
    const a = paperTokenRaw()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(paperTokenRaw()).not.toBe(a)
  })

  it('is kept as its SHA-256 in hex, the hash the signing page looks it up by', async () => {
    const raw = 'ab'.repeat(32)
    expect(await paperTokenHash(raw)).toBe(createHash('sha256').update(raw).digest('hex'))
  })

  it('works for 14 days, and its path is the signing page with the raw token', async () => {
    const now = new Date('2026-10-10T15:00:00Z')
    const t = await mintPaperToken(now)
    expect(PAPER_LINK_DAYS).toBe(14)
    expect(t.expiresAt).toBe('2026-10-24T15:00:00.000Z')
    expect(t.hash).toBe(createHash('sha256').update(t.raw).digest('hex'))
    expect(paperSignPath(t.raw)).toBe(`/contract/accept?t=${t.raw}`)
  })
})

describe('where the page goes', () => {
  it('goes only to the signing page with a minted token', () => {
    const raw = 'cd'.repeat(32)
    expect(tradeSignPath({ signPath: paperSignPath(raw) })).toBe(`/contract/accept?t=${raw}`)
  })

  it('goes nowhere an answer names otherwise, nor on the sample’s answer with none', () => {
    for (const value of [undefined, null, 'x', {}, { signPath: 'https://evil.example/contract/accept?t=' + 'a'.repeat(64) }, { signPath: '/contract/accept?t=short' }, { signPath: '//evil.example' }]) {
      expect(tradeSignPath(value)).toBeNull()
    }
  })
})
