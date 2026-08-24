// @vitest-environment jsdom
// hrDocMarkdownToSafeHtml sanitizes via DOMParser; without a DOM it safely
// strips to text (see sanitizeContractSigningHtml). Assert the rendered form
// under jsdom, which is also how it runs in the app.
import { describe, it, expect } from 'vitest'
import { hrDocMarkdownToSafeHtml, extractHrDocHeadings } from './hrDocMarkdown'

describe('hrDocMarkdownToSafeHtml', () => {
  it('renders headings, bold, and lists', () => {
    const html = hrDocMarkdownToSafeHtml('## Trajectory\n\nHe **quit** on Aug 4.\n\n- one\n- two')
    expect(html).toContain('Trajectory')
    expect(html).toContain('<strong>quit</strong>')
    expect(html).toContain('<li>')
  })

  it('returns empty string for blank input', () => {
    expect(hrDocMarkdownToSafeHtml('')).toBe('')
    expect(hrDocMarkdownToSafeHtml('   \n  ')).toBe('')
  })

  it('strips scripts and event handlers (sanitizer boundary)', () => {
    const html = hrDocMarkdownToSafeHtml('Text <script>alert(1)</script> more')
    expect(html).not.toContain('<script')
    expect(html.toLowerCase()).not.toContain('alert(1)')
  })
})

describe('extractHrDocHeadings', () => {
  it('extracts ATX headings in order with levels', () => {
    const hs = extractHrDocHeadings('# Top\n\ntext\n\n## Sub A\n\n### Deep\n\n## Sub B')
    expect(hs.map((h) => [h.level, h.text])).toEqual([
      [1, 'Top'],
      [2, 'Sub A'],
      [3, 'Deep'],
      [2, 'Sub B'],
    ])
  })

  it('makes duplicate headings unique by slug', () => {
    const hs = extractHrDocHeadings('## Pay\n\n## Pay')
    expect(hs.map((h) => h.slug)).toEqual(['pay', 'pay-1'])
  })

  it('ignores # inside fenced code blocks', () => {
    const hs = extractHrDocHeadings('## Real\n\n```\n# not a heading\n```\n\n## Also real')
    expect(hs.map((h) => h.text)).toEqual(['Real', 'Also real'])
  })

  it('strips backticks and bold from heading text', () => {
    const hs = extractHrDocHeadings('## The `sleeves` **matter**')
    expect(hs[0]!.text).toBe('The sleeves matter')
    expect(hs[0]!.slug).toBe('the-sleeves-matter')
  })

  it('returns [] for heading-free content', () => {
    expect(extractHrDocHeadings('just a paragraph, no headings')).toEqual([])
  })
})
