import { describe, expect, it } from 'vitest'
import {
  encodeHelpCodeTags,
  encodeHelpGuideLinks,
  helpGuideMarkdownToSafeHtml,
  restoreHelpCodeTags,
  restoreHelpGuideLinks,
  isHelpGuidePagePath,
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

describe('encode/restore in-app guide links', () => {
  it('carries /help/<slug> and /help?g=<slug> through as the in-app address plus a data-guide hook', () => {
    const html = '<a href="/help/sub-labor-outstanding">a</a> <a href="/help?g=share-a-sub-their-portal">b</a>'
    const out = restoreHelpGuideLinks(encodeHelpGuideLinks(html))
    expect(out).toBe(
      '<a href="/help?g=sub-labor-outstanding" data-guide="sub-labor-outstanding">a</a> ' +
        '<a href="/help?g=share-a-sub-their-portal" data-guide="share-a-sub-their-portal">b</a>',
    )
  })

  it('encodes to an absolute https placeholder, which is what the sanitizer keeps', () => {
    expect(encodeHelpGuideLinks('<a href="/help/texas-lien-rules-the-app-follows">x</a>')).toBe(
      '<a href="https://guide.help.internal/texas-lien-rules-the-app-follows">x</a>',
    )
  })

  it('leaves other hrefs alone and refuses anything but a bare slug', () => {
    const html = '<a href="https://example.com/help/x">e</a> <a href="/help/../etc">bad</a> <a href="mailto:x@y.z">m</a>'
    expect(restoreHelpGuideLinks(encodeHelpGuideLinks(html))).toBe(html)
  })

  it('v2.4290: a page of the app rides through as its path plus a data-app hook', () => {
    const html = '<a href="/jobs?tab=stages&amp;gcReview=1">g</a> <a href="/settings?tab=settings-jobs&amp;focus=issuer.signerName">s</a> <a href="/dashboard">d</a>'
    const out = restoreHelpGuideLinks(encodeHelpGuideLinks(html))
    expect(out).toBe(
      '<a href="/jobs?tab=stages&amp;gcReview=1" data-app="/jobs?tab=stages&amp;gcReview=1">g</a> ' +
        '<a href="/settings?tab=settings-jobs&amp;focus=issuer.signerName" data-app="/settings?tab=settings-jobs&amp;focus=issuer.signerName">s</a> ' +
        '<a href="/dashboard" data-app="/dashboard">d</a>',
    )
    expect(encodeHelpGuideLinks('<a href="/dashboard">d</a>')).toBe('<a href="https://page.help.internal/%2Fdashboard">d</a>')
  })

  it('v2.4290: refuses a page path with .., a protocol-relative start, or a pre-baked placeholder', () => {
    const html = '<a href="/jobs/../etc">a</a> <a href="//evil.example/x">b</a>'
    expect(restoreHelpGuideLinks(encodeHelpGuideLinks(html))).toBe(html)
    expect(encodeHelpGuideLinks('<a href="https://page.help.internal/%2Fevil">x</a>')).toBe('<a href="%2Fevil">x</a>')
    expect(isHelpGuidePagePath('/jobs?tab=stages')).toBe(true)
    expect(isHelpGuidePagePath('javascript:alert(1)')).toBe(false)
  })

  it('strips a pre-baked placeholder so authored text cannot mint a data-guide hook', () => {
    expect(encodeHelpGuideLinks('<a href="https://guide.help.internal/evil">x</a>')).toBe('<a href="evil">x</a>')
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
