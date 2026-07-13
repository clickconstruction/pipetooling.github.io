import { describe, expect, it } from 'vitest'
import {
  encodeHelpCodeTags,
  helpGuideMarkdownToSafeHtml,
  restoreHelpCodeTags,
} from './helpGuideHtml'

describe('encode/restore help code tags', () => {
  it('round-trips code and pre tags, dropping attributes', () => {
    const html = '<pre><code class="language-ts">const x = 1</code></pre>'
    const restored = restoreHelpCodeTags(encodeHelpCodeTags(html))
    expect(restored).toBe('<pre><code>const x = 1</code></pre>')
  })

  it('strips literal marker text from authored content', () => {
    const html = '<p>[[[help-code-open]]]sneaky[[[help-code-close]]]</p>'
    expect(restoreHelpCodeTags(encodeHelpCodeTags(html))).toBe('<p>sneaky</p>')
  })
})

describe('helpGuideMarkdownToSafeHtml', () => {
  // Vitest runs in node (no DOMParser) so the sanitizer uses its strip-all
  // fallback — these tests assert the pipeline's safety floor, and the marker
  // round-trip keeps inline code semantics even through that fallback.
  it('never lets script tags survive', () => {
    const out = helpGuideMarkdownToSafeHtml('hello <script>alert(1)</script> world')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
  })

  it('preserves inline code through the sanitizer', () => {
    const out = helpGuideMarkdownToSafeHtml('Tap the `Clock In` button.')
    expect(out).toContain('<code>Clock In</code>')
  })

  it('renders fenced code blocks as pre/code', () => {
    const out = helpGuideMarkdownToSafeHtml('```\nsome steps\n```')
    expect(out).toContain('<pre><code>some steps')
  })
})
