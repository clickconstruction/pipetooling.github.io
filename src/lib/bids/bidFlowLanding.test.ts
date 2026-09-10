// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BID_FLOW_LANDING_CLASS, BID_FLOW_LANDING_MS, findLandingElement, landOnBidFlowTarget, landOnElement, parseLandingParam } from './bidFlowLanding'
import { BID_FLOW_STEP_DEFS } from './bidFlow'

describe('bid flow landing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('every step but Review names at least one landing target, and no two steps share a first target', () => {
    const firsts = new Set<string>()
    for (const def of BID_FLOW_STEP_DEFS) {
      if (def.key === 'review') {
        expect(def.target).toEqual([])
        continue
      }
      expect(def.target.length, def.key).toBeGreaterThan(0)
      expect(firsts.has(def.target[0]!), `${def.key} reuses ${def.target[0]}`).toBe(false)
      firsts.add(def.target[0]!)
    }
  })

  it('waits for the destination to render, then scrolls, focuses, and rings the field for a while', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const done = vi.fn()
    landOnBidFlowTarget(['bid-form-plans-link'], { onDone: done, reducedMotion: true })
    vi.advanceTimersByTime(500) // still polling — nothing rendered yet
    expect(done).not.toHaveBeenCalled()
    const input = document.createElement('input')
    input.id = 'bid-form-plans-link'
    document.body.appendChild(input)
    vi.advanceTimersByTime(200)
    expect(done).toHaveBeenCalledWith(true)
    expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
    expect(document.activeElement).toBe(input)
    expect(input.classList.contains(BID_FLOW_LANDING_CLASS)).toBe(true)
    vi.advanceTimersByTime(BID_FLOW_LANDING_MS + 10)
    expect(input.classList.contains(BID_FLOW_LANDING_CLASS)).toBe(false)
  })

  it('takes the first target that exists, in order', () => {
    const fallback = document.createElement('h2')
    fallback.id = 'pricing-breakdown-title'
    document.body.appendChild(fallback)
    expect(findLandingElement(['pricing-price-requests', 'pricing-breakdown-title'])).toBe(fallback)
    const chip = document.createElement('button')
    chip.id = 'pricing-price-requests'
    document.body.appendChild(chip)
    expect(findLandingElement(['pricing-price-requests', 'pricing-breakdown-title'])).toBe(chip)
  })

  it('holds out for the first target for a grace period before accepting a fallback', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const button = document.createElement('button')
    button.id = 'counts-import-tooling'
    document.body.appendChild(button)
    const done = vi.fn()
    landOnBidFlowTarget(['counts-import-text', 'counts-import-tooling'], { onDone: done, preferFirstMs: 1000, pollMs: 100, reducedMotion: true })
    vi.advanceTimersByTime(500) // the button exists, but the grace period is still holding out for the textarea
    expect(done).not.toHaveBeenCalled()
    const ta = document.createElement('textarea')
    ta.id = 'counts-import-text'
    document.body.appendChild(ta)
    vi.advanceTimersByTime(200)
    expect(done).toHaveBeenCalledWith(true)
    expect(document.activeElement).toBe(ta)
    expect(button.classList.contains(BID_FLOW_LANDING_CLASS)).toBe(false)
  })

  it('falls back to a later target once the grace period passes', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const button = document.createElement('button')
    button.id = 'counts-import-tooling'
    document.body.appendChild(button)
    const done = vi.fn()
    landOnBidFlowTarget(['counts-import-text', 'counts-import-tooling'], { onDone: done, preferFirstMs: 300, pollMs: 100, reducedMotion: true })
    vi.advanceTimersByTime(600)
    expect(done).toHaveBeenCalledWith(true)
    expect(button.classList.contains(BID_FLOW_LANDING_CLASS)).toBe(true)
  })

  it('gives up quietly when nothing appears, and does nothing for an empty target list', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const done = vi.fn()
    landOnBidFlowTarget(['never-there'], { onDone: done, timeoutMs: 1000, pollMs: 100 })
    vi.advanceTimersByTime(1300)
    expect(done).toHaveBeenCalledWith(false)
    const none = vi.fn()
    landOnBidFlowTarget([], { onDone: none })
    expect(none).toHaveBeenCalledWith(false)
  })

  it('a cancelled landing never fires', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const done = vi.fn()
    const cancel = landOnBidFlowTarget(['late'], { onDone: done })
    cancel()
    const el = document.createElement('div')
    el.id = 'late'
    document.body.appendChild(el)
    vi.advanceTimersByTime(2000)
    expect(done).not.toHaveBeenCalled()
  })

  it('a non-focusable element is ringed but not focused', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const h2 = document.createElement('h2')
    h2.id = 'x'
    document.body.appendChild(h2)
    landOnElement(h2, { reducedMotion: true })
    expect(document.activeElement).not.toBe(h2)
    expect(h2.classList.contains(BID_FLOW_LANDING_CLASS)).toBe(true)
  })

  it('parses the focus URL parameter defensively', () => {
    expect(parseLandingParam('bid-form-plans-link')).toEqual(['bid-form-plans-link'])
    expect(parseLandingParam(' a-1 , b_2 ,, <script> ')).toEqual(['a-1', 'b_2'])
    expect(parseLandingParam(null)).toEqual([])
  })
})
