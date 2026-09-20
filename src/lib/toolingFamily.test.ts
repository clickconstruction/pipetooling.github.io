import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it('every app carries a mark that exists in public/tooling/, and this app is never listed', () => {
    for (const a of all) {
      expect(a.icon).toMatch(/^\/tooling\/[a-z]+\.svg$/)
      expect(existsSync(join(process.cwd(), 'public', a.icon))).toBe(true)
    }
    expect(new Set(all.map((a) => a.icon)).size).toBe(all.length)
    expect(
      all.some((a) => /clicktooling|pipetooling/i.test(a.href + a.name)),
    ).toBe(false)
  })

  it('the ten More-apps marks are house marks: the yellow tile, two colours, no text or images', () => {
    for (const a of MORE_APPS) {
      const svg = readFileSync(join(process.cwd(), 'public', a.icon), 'utf8')
      expect(svg).toContain('<rect width="512" height="512" rx="112" fill="#e8c547"/>')
      expect(svg).not.toMatch(/<text|<image|<filter|opacity|href=/)
      const colours = new Set((svg.match(/#[0-9a-fA-F]{6}/g) ?? []).map((c) => c.toLowerCase()))
      expect([...colours].sort()).toEqual(['#161617', '#e8c547'])
    }
  })
})
