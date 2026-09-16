// @vitest-environment jsdom
/**
 * The node twin (helpGuideHtml.test.ts) runs the sanitizer's strip-all fallback,
 * so it cannot see an <a> survive. This file runs the real DOMParser path and pins
 * the v2.3516 finding: a guide-to-guide link written as /help/<slug> reaches the
 * page with its in-app address and the hook GuideBrowser navigates on.
 */
import { describe, expect, it } from 'vitest'
import { helpGuideMarkdownToSafeHtml } from './helpGuideHtml'

describe('helpGuideMarkdownToSafeHtml (DOM sanitizer)', () => {
  it('keeps a guide-to-guide link as href="/help?g=<slug>" with a data-guide hook', () => {
    const out = helpGuideMarkdownToSafeHtml('See [the rules](/help/texas-lien-rules-the-app-follows).')
    expect(out).toContain('href="/help?g=texas-lien-rules-the-app-follows"')
    expect(out).toContain('data-guide="texas-lien-rules-the-app-follows"')
  })

  it('still drops a relative link that is not a guide (the sanitizer rule stands)', () => {
    const out = helpGuideMarkdownToSafeHtml('Go to [jobs](/jobs?tab=stages).')
    expect(out).toContain('>jobs</a>')
    expect(out).not.toContain('href="/jobs')
  })

  it('keeps an absolute https link as before', () => {
    const out = helpGuideMarkdownToSafeHtml('[statutes](https://statutes.capitol.texas.gov/)')
    expect(out).toContain('href="https://statutes.capitol.texas.gov/"')
  })
})
