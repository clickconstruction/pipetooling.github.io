import { describe, expect, it } from 'vitest'

import { FEATURED_APPS, MORE_APPS } from './toolingFamily'

describe('toolingFamily', () => {
  const all = [...FEATURED_APPS, ...MORE_APPS]

  it('every app has a unique key, a unique https URL with a trailing slash, a name and a blurb', () => {
    expect(new Set(all.map((a) => a.key)).size).toBe(all.length)
    expect(new Set(all.map((a) => a.href)).size).toBe(all.length)
    for (const a of all) {
      expect(a.href).toMatch(/^https:\/\/[a-z0-9.-]+\/$/)
      expect(a.name.trim()).not.toBe('')
      expect(a.blurb.trim()).not.toBe('')
    }
  })

  it('only the featured tiles carry a mark, and this app is never listed', () => {
    for (const a of FEATURED_APPS)
      expect(a.icon).toMatch(/^\/tooling\/.+\.svg$/)
    for (const a of MORE_APPS) expect(a.icon).toBeUndefined()
    expect(
      all.some((a) => /clicktooling|pipetooling/i.test(a.href + a.name)),
    ).toBe(false)
  })
})
