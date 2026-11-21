/**
 * A Document builder link's code and the secrets it is made under (punch list #404). The review of 2026-11-20 found
 * the code was made from the service role key unless a secret of its own was set, so a new key would leave a link
 * whose address the app showed wrong. A new link is made under the link's own secret, and a link that exists is made
 * again under whichever secret its own hash answers to.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  DOCUMENT_BUILDER_LINK_ADDRESS_LOST,
  DOCUMENT_BUILDER_LINK_ALPHABET,
  documentBuilderLinkCodeAgain,
  documentBuilderLinkCodeUnder,
  documentBuilderLinkHash,
  documentBuilderLinkSecrets,
} from './link'

const ID = '00000000-0000-0000-0000-000000404311'
const NONCE = 'a'.repeat(32)
const OWN = 'a made-up secret of the link'
const SERVICE = 'a made-up service key'

/** A link's row as the database keeps it, made under one secret. */
async function rowUnder(secret: string) {
  return { id: ID, nonce: NONCE, code_hash: await documentBuilderLinkHash(await documentBuilderLinkCodeUnder(secret, ID, NONCE)) }
}

describe('the secrets a link’s code is made under', () => {
  it('lead with the link’s own, and keep the service key behind it', () => {
    expect(documentBuilderLinkSecrets(OWN, SERVICE)).toEqual([OWN, SERVICE])
  })

  it('fall back to the service key while the link’s own is not set', () => {
    expect(documentBuilderLinkSecrets(undefined, SERVICE)).toEqual([SERVICE])
    expect(documentBuilderLinkSecrets('   ', SERVICE)).toEqual([SERVICE])
    expect(documentBuilderLinkSecrets(null, ` ${SERVICE} `)).toEqual([SERVICE])
  })

  it('say one secret once, and none when there is none', () => {
    expect(documentBuilderLinkSecrets(SERVICE, SERVICE)).toEqual([SERVICE])
    expect(documentBuilderLinkSecrets('', null)).toEqual([])
  })
})

describe('a link’s code under a secret', () => {
  it('is sixteen letters of the link alphabet, the same each time', async () => {
    const code = await documentBuilderLinkCodeUnder(OWN, ID, NONCE)
    expect(code).toHaveLength(16)
    for (const ch of code) expect(DOCUMENT_BUILDER_LINK_ALPHABET).toContain(ch)
    expect(await documentBuilderLinkCodeUnder(OWN, ID, NONCE)).toBe(code)
  })

  it('is another code under another secret, for another link and for another nonce', async () => {
    const code = await documentBuilderLinkCodeUnder(OWN, ID, NONCE)
    expect(await documentBuilderLinkCodeUnder(SERVICE, ID, NONCE)).not.toBe(code)
    expect(await documentBuilderLinkCodeUnder(OWN, ID.replace(/1$/, '2'), NONCE)).not.toBe(code)
    expect(await documentBuilderLinkCodeUnder(OWN, ID, 'b'.repeat(32))).not.toBe(code)
  })

  it('is kept as a hash of sixty-four hex letters', async () => {
    expect(await documentBuilderLinkHash('abcdefgh23456789')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('the code of a link that exists, made again', () => {
  it('is the same address after the link’s own secret is set, for a link made under the service key', async () => {
    const madeBefore = await rowUnder(SERVICE)
    const was = await documentBuilderLinkCodeAgain(documentBuilderLinkSecrets(undefined, SERVICE), madeBefore)
    const now = await documentBuilderLinkCodeAgain(documentBuilderLinkSecrets(OWN, SERVICE), madeBefore)
    expect(was).toBe(await documentBuilderLinkCodeUnder(SERVICE, ID, NONCE))
    expect(now).toBe(was)
  })

  it('is the same address after the service key changes, for a link made under the link’s own secret', async () => {
    const made = await rowUnder(OWN)
    expect(await documentBuilderLinkCodeAgain(documentBuilderLinkSecrets(OWN, 'a new service key'), made)).toBe(await documentBuilderLinkCodeUnder(OWN, ID, NONCE))
  })

  it('is nothing when no secret this side holds made it, never a wrong address', async () => {
    const madeBefore = await rowUnder(SERVICE)
    expect(await documentBuilderLinkCodeAgain(documentBuilderLinkSecrets(OWN, 'a new service key'), madeBefore)).toBeNull()
    expect(await documentBuilderLinkCodeAgain([], madeBefore)).toBeNull()
  })

  it('says so in plain words on the card', () => {
    expect(plainWordsFailures(DOCUMENT_BUILDER_LINK_ADDRESS_LOST)).toEqual([])
  })
})
