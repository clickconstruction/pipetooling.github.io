// Node environment on purpose: no `document`, so the sanitizer takes its
// last-resort strip-to-text path. The DOM path is covered under jsdom in
// sanitizeContractSigningHtml.test.ts.
import { describe, expect, it } from 'vitest'
import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'

describe('sanitizeContractSigningHtml without a DOM', () => {
  it('strips every tag to text, dropping script and style bodies whole', () => {
    expect(typeof document).toBe('undefined')
    expect(sanitizeContractSigningHtml('<p>Hello <strong>there</strong></p>')).toBe('Hello there')
    expect(sanitizeContractSigningHtml('a<script>alert(1)</script>b<style>p{}</style>c')).toBe('abc')
    expect(sanitizeContractSigningHtml('<a href="javascript:x">link</a>')).toBe('link')
    expect(sanitizeContractSigningHtml('   ')).toBe('')
  })
})
