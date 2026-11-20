import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  DOCUMENT_BUILDER_LINK_ALPHABET,
  DOCUMENT_BUILDER_LINK_CODE_LENGTH,
  DOCUMENT_BUILDER_LINK_WORDS,
  documentBuilderHexOf,
  documentBuilderLinkCode,
  documentBuilderLinkCodeFrom,
  documentBuilderLinkOpen,
  documentBuilderLinkSeed,
  documentBuilderLinkUrl,
} from './link'

describe('a link’s code', () => {
  it('is sixteen letters of an alphabet with no look-alike', () => {
    expect(DOCUMENT_BUILDER_LINK_CODE_LENGTH).toBe(16)
    expect(DOCUMENT_BUILDER_LINK_ALPHABET).not.toMatch(/[01ilo]/)
    expect(new Set(DOCUMENT_BUILDER_LINK_ALPHABET).size).toBe(DOCUMENT_BUILDER_LINK_ALPHABET.length)
    const code = documentBuilderLinkCode(new Uint8Array(32).map((_, i) => i * 7))
    expect(code).toHaveLength(16)
    for (const ch of code ?? '') expect(DOCUMENT_BUILDER_LINK_ALPHABET).toContain(ch)
  })

  it('is the same code from the same bytes, and another from others', () => {
    const a = new Uint8Array(32).map((_, i) => i * 5 + 1)
    expect(documentBuilderLinkCode(a)).toBe(documentBuilderLinkCode(a))
    expect(documentBuilderLinkCode(a)).not.toBe(documentBuilderLinkCode(new Uint8Array(32).map((_, i) => i * 5 + 2)))
  })

  it('skips the bytes that would lean toward the first letters, and asks for more when it runs short', () => {
    expect(documentBuilderLinkCode(new Uint8Array(32).fill(255))).toBeNull()
    expect(documentBuilderLinkCode(new Uint8Array(8).fill(3))).toBeNull()
    const mixed = new Uint8Array(40).fill(255)
    for (let i = 0; i < 16; i++) mixed[i * 2] = 31
    expect(documentBuilderLinkCode(mixed)).toBe('2'.repeat(16))
  })

  it('reads a pasted code trimmed and in any case, and nothing that is not one', () => {
    const code = documentBuilderLinkCode(new Uint8Array(32).map((_, i) => i * 7)) as string
    expect(documentBuilderLinkCodeFrom(`  ${code.toUpperCase()} `)).toBe(code)
    for (const bad of [null, 7, '', 'short', `${code}x`, code.replace(/.$/, 'o'), code.replace(/.$/, '-')]) expect(documentBuilderLinkCodeFrom(bad)).toBeNull()
  })

  it('is made from the row, its nonce and a round, so two links never share a seed', () => {
    expect(documentBuilderLinkSeed('id-1', 'aa', 0)).toBe('document-builder-link:id-1:aa:0')
    expect(documentBuilderLinkSeed('id-1', 'aa', 0)).not.toBe(documentBuilderLinkSeed('id-1', 'aa', 1))
    expect(documentBuilderLinkSeed('id-1', 'aa', 0)).not.toBe(documentBuilderLinkSeed('id-2', 'aa', 0))
  })
})

describe('a link', () => {
  it('opens at /d on the app’s own address', () => {
    expect(documentBuilderLinkUrl('https://app.example', 'abcd')).toBe('https://app.example/d/abcd')
    expect(documentBuilderLinkUrl('https://app.example/', 'abcd')).toBe('https://app.example/d/abcd')
  })

  it('opens until it is switched off or replaced', () => {
    expect(documentBuilderLinkOpen({ ended_at: null })).toBe(true)
    expect(documentBuilderLinkOpen({ ended_at: '2026-11-20T15:00:00Z' })).toBe(false)
  })

  it('writes bytes as hex', () => {
    expect(documentBuilderHexOf(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff')
  })

  it('reads in plain words', () => {
    expect(Object.values(DOCUMENT_BUILDER_LINK_WORDS).flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
