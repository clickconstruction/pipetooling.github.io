import { describe, expect, it } from 'vitest'
import { normalizePhysicalInvoiceFooterPlainText } from './physicalInvoiceDocument'

describe('normalizePhysicalInvoiceFooterPlainText', () => {
  it('normalizes CRLF and lone CR to LF', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('maps Unicode line/paragraph separators to LF', () => {
    expect(normalizePhysicalInvoiceFooterPlainText(`a\u2028b\u2029c`)).toBe('a\nb\nc')
  })

  it('NFKC folds fullwidth Latin A to ASCII A', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('\uFF21')).toBe('A')
  })

  it('removes zero-width space between letters', () => {
    expect(normalizePhysicalInvoiceFooterPlainText(`a\u200Bb`)).toBe('ab')
  })

  it('strips BOM', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('\uFEFFhello')).toBe('hello')
  })

  it('maps br and closing block tags to newlines and strips other tags', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('<p>one<br/>two</p><span>three</span>')).toBe(
      'one\ntwo\nthree',
    )
  })

  it('maps </div> and </tr> to newlines', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('<div>a</div><tr>b</tr>')).toBe('a\nb')
  })

  it('trims outer whitespace only and preserves internal blank lines', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('  a\n\nb  \n')).toBe('a\n\nb')
  })

  it('returns empty string when nothing remains', () => {
    expect(normalizePhysicalInvoiceFooterPlainText('   \u200B  ')).toBe('')
  })
})
