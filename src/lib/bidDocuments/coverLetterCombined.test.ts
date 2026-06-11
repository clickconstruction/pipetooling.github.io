import { describe, expect, it } from 'vitest'
import { buildCombinedCoverLetterDocument, buildCombinedCoverLetterText } from './coverLetter'

describe('buildCombinedCoverLetterDocument', () => {
  it('returns the single letter unchanged when there is one section (parity with un-bundled)', () => {
    const html = '<p>Only letter</p>'
    expect(buildCombinedCoverLetterDocument([{ label: 'Pricing: Plans', html }])).toBe(html)
  })

  it('returns empty string for no sections', () => {
    expect(buildCombinedCoverLetterDocument([])).toBe('')
  })

  it('labels each section and preserves order', () => {
    const out = buildCombinedCoverLetterDocument([
      { label: 'Pricing: Plans', html: '<p>A</p>' },
      { label: 'Pricing: Value Engineered', html: '<p>B</p>' },
    ])
    expect(out.indexOf('Pricing: Plans')).toBeLessThan(out.indexOf('Pricing: Value Engineered'))
    expect(out).toContain('<p>A</p>')
    expect(out).toContain('<p>B</p>')
  })

  it('adds a page break between sections but not after the last', () => {
    const out = buildCombinedCoverLetterDocument([
      { label: 'One', html: '<p>A</p>' },
      { label: 'Two', html: '<p>B</p>' },
    ])
    expect(out.match(/page-break-after: always/g) ?? []).toHaveLength(1)
  })

  it('escapes the label to avoid HTML injection', () => {
    const out = buildCombinedCoverLetterDocument([
      { label: '<script>x</script>', html: '<p>A</p>' },
      { label: 'Two', html: '<p>B</p>' },
    ])
    expect(out).not.toContain('<script>x</script>')
    expect(out).toContain('&lt;script&gt;')
  })
})

describe('buildCombinedCoverLetterText', () => {
  it('returns the single text unchanged for one section', () => {
    expect(buildCombinedCoverLetterText([{ label: 'Plans', text: 'hello' }])).toBe('hello')
  })

  it('joins multiple sections with labeled separators in order', () => {
    const out = buildCombinedCoverLetterText([
      { label: 'Plans', text: 'A' },
      { label: 'Value Engineered', text: 'B' },
    ])
    expect(out.indexOf('Plans')).toBeLessThan(out.indexOf('Value Engineered'))
    expect(out).toContain('A')
    expect(out).toContain('B')
  })
})
