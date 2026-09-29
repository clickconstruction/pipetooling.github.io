import { describe, expect, it } from 'vitest'
import { escapeHtmlText, renderContractBodyToSafeHtml } from './renderContractBodyToSafeHtml'

describe('escapeHtmlText', () => {
  it('escapes &, <, >, and "', () => {
    expect(escapeHtmlText('A <b>& "C"')).toBe('A &lt;b&gt;&amp; &quot;C&quot;')
  })
  it('treats null/undefined as empty', () => {
    expect(escapeHtmlText(null)).toBe('')
    expect(escapeHtmlText(undefined)).toBe('')
  })
})

describe('renderContractBodyToSafeHtml', () => {
  it('returns empty string for empty/whitespace/null bodies', () => {
    expect(renderContractBodyToSafeHtml('', 'plain')).toBe('')
    expect(renderContractBodyToSafeHtml('   ', 'plain')).toBe('')
    expect(renderContractBodyToSafeHtml(null, 'html')).toBe('')
    expect(renderContractBodyToSafeHtml(undefined, 'markdown')).toBe('')
  })

  it('plain: escapes HTML and preserves whitespace via pre-wrap', () => {
    const out = renderContractBodyToSafeHtml('a < b\n  c', 'plain')
    expect(out).toContain('white-space:pre-wrap')
    expect(out).toContain('a &lt; b')
    // newline + leading spaces are kept verbatim inside the pre-wrap wrapper
    expect(out).toContain('a &lt; b\n  c')
    expect(out).not.toContain('<b>')
  })

  it('plain: a **sentence** prints as a statutory span at 10 pt with the asterisks gone; a lone ** stays; the text inside is still escaped (v2.4150)', () => {
    const out = renderContractBodyToSafeHtml('11. General terms. Waivers are conditional. **Customer waives the list under § 53.256.** Texas law governs.', 'plain')
    expect(out).toContain('Waivers are conditional. <span class="statutory" style="font-size:max(10pt, 1em)">Customer waives the list under § 53.256.</span> Texas law governs.')
    expect(out).not.toContain('**')
    expect(renderContractBodyToSafeHtml('a ** b', 'plain')).toContain('a ** b')
    expect(renderContractBodyToSafeHtml('**<b>x</b>**', 'plain')).toContain('<span class="statutory" style="font-size:max(10pt, 1em)">&lt;b&gt;x&lt;/b&gt;</span>')
  })

  it('markdown: the source text survives rendering', () => {
    // In the node test env the sanitizer strips tags (no DOMParser); we assert the
    // text content survives. Rich markup is verified live in the browser preview.
    const out = renderContractBodyToSafeHtml('**bold** and _em_', 'markdown')
    expect(out).toContain('bold')
    expect(out).toContain('em')
    expect(out).not.toContain('**')
  })

  it('html: defaults unknown formats to html handling', () => {
    const out = renderContractBodyToSafeHtml('<p>Hi there</p>', 'something-else')
    expect(out).toContain('Hi there')
  })
})
