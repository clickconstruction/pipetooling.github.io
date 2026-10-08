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

  it('v2.4868: the short ?g=<slug> and a heading of another guide both reach the page alive', () => {
    const out = helpGuideMarkdownToSafeHtml('See [your subs](?g=review-your-subs) and [the enclosure](/help/give-a-customer-a-lien-release#enclose-one-with-a-lien-notice).')
    expect(out).toContain('href="/help?g=review-your-subs" data-guide="review-your-subs"')
    expect(out).toContain('href="/help?g=give-a-customer-a-lien-release#enclose-one-with-a-lien-notice" data-guide="give-a-customer-a-lien-release" data-guide-anchor="enclose-one-with-a-lien-notice"')
  })

  it('v2.4868: an example email address prints as text, not as a link that does nothing', () => {
    const out = helpGuideMarkdownToSafeHtml('Bills go to ap@knight.com and taunya@clickplumbing.com.')
    expect(out).toContain('ap@knight.com')
    expect(out).not.toContain('<a')
  })

  it('v2.4290: keeps a link to a page of the app as its path plus the data-app hook', () => {
    const out = helpGuideMarkdownToSafeHtml('Go to [GC Review](/jobs?tab=stages&gcReview=1).')
    expect(out).toContain('>GC Review</a>')
    expect(out).toContain('href="/jobs?tab=stages&amp;gcReview=1"')
    expect(out).toContain('data-app="/jobs?tab=stages&amp;gcReview=1"')
  })

  it('still drops a relative link that is not a root path (the sanitizer rule stands)', () => {
    const out = helpGuideMarkdownToSafeHtml('Go to [jobs](jobs/stages) or [x](/jobs/../etc).')
    expect(out).toContain('>jobs</a>')
    expect(out).not.toContain('href="jobs')
    expect(out).not.toContain('href="/jobs/..')
  })

  it('keeps an absolute https link as before', () => {
    const out = helpGuideMarkdownToSafeHtml('[statutes](https://statutes.capitol.texas.gov/)')
    expect(out).toContain('href="https://statutes.capitol.texas.gov/"')
  })
})
