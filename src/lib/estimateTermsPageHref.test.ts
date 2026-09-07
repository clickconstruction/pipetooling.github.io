import { afterEach, describe, expect, it } from 'vitest'
import { estimateTermsPageHref } from './estimateTermsPageHref'

const g = globalThis as unknown as { window?: unknown }
afterEach(() => {
  delete g.window
})

describe('estimateTermsPageHref', () => {
  it('is a relative path with no window, and absolute on the current origin in a browser', () => {
    expect(estimateTermsPageHref()).toBe('/estimate/terms')
    g.window = { location: { origin: 'https://clicktooling.com' } }
    expect(estimateTermsPageHref()).toBe('https://clicktooling.com/estimate/terms')
    g.window = { location: {} }
    expect(estimateTermsPageHref()).toBe('/estimate/terms')
  })
})
