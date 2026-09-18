// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyHeadingAnchors, headingAnchor, helpGuideHref } from './helpGuideAnchors'

describe('helpGuideAnchors (v2.3594)', () => {
  it('turns a heading into a stable anchor, section signs included', () => {
    expect(headingAnchor('The § 53.056 notice')).toBe('the-s-53-056-notice')
    expect(headingAnchor('Interest: Prompt Payment')).toBe('interest-prompt-payment')
    expect(headingAnchor("Attorney's fees need presentment")).toBe('attorney-s-fees-need-presentment')
    expect(headingAnchor('Releases & waivers')).toBe('releases-and-waivers')
    expect(headingAnchor('  ')).toBe('')
  })

  it('builds the guide address with and without an anchor', () => {
    expect(helpGuideHref('texas-lien-rules-the-app-follows', 'The § 53.056 notice')).toBe('/help?g=texas-lien-rules-the-app-follows#the-s-53-056-notice')
    expect(helpGuideHref('texas-lien-rules-the-app-follows')).toBe('/help?g=texas-lien-rules-the-app-follows')
    expect(helpGuideHref('x', '')).toBe('/help?g=x')
  })

  it('stamps ids on h2 and h3, numbering repeats', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2>The month rule</h2><p>a</p><h3>Delivery</h3><h2>Delivery</h2><h2></h2>'
    expect(applyHeadingAnchors(root)).toEqual(['the-month-rule', 'delivery', 'delivery-2'])
    expect(root.querySelector('h3')?.id).toBe('delivery')
    expect(root.querySelectorAll('h2')[1]?.id).toBe('delivery-2')
  })
})
