import { describe, expect, it } from 'vitest'
import { customerJourneys } from '../customerJourneys'
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC, SAMPLE_TOKEN_LOW, SAMPLE_TOKEN_OWNER } from '../customerSample'
import { isSamplePage, isSampleToken } from './samplePage'

describe("a customer's sample page", () => {
  it('knows every sample token What customers see hands out, and no other', () => {
    for (const t of [SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC, SAMPLE_TOKEN_OWNER, SAMPLE_TOKEN_LOW]) expect(isSampleToken(t), t).toBe(true)
    expect(isSampleToken('samples')).toBe(false)
    expect(isSampleToken('7f3a9c')).toBe(false)
    expect(isSampleToken('')).toBe(false)
    expect(isSampleToken(null)).toBe(false)
  })

  it('reads the token from the address, in t or as a path segment, and nowhere else', () => {
    expect(isSamplePage('https://app.example.com/estimate/accept?t=sample&v=0')).toBe(true)
    expect(isSamplePage('https://app.example.com/portal?t=sample-owner')).toBe(true)
    expect(isSamplePage('https://app.example.com/pay/sample?v=0')).toBe(true)
    expect(isSamplePage('https://app.example.com/q/sample-done')).toBe(true)
    expect(isSamplePage('https://app.example.com/estimate/accept?t=7f3a9c')).toBe(false)
    expect(isSamplePage('https://app.example.com/dashboard')).toBe(false)
    expect(isSamplePage('https://app.example.com/settings?tab=settings-what-customers-see')).toBe(false)
    expect(isSamplePage('https://app.example.com/customers?q=sample')).toBe(false)
    expect(isSamplePage('not an address')).toBe(false)
  })

  it('holds every page What customers see previews', () => {
    const pages = customerJourneys()
      .flatMap((j) => j.steps)
      .flatMap((s) => (s.render.kind === 'page' && !s.render.absolute ? [{ id: s.id, path: s.render.path }] : []))
    expect(pages.length).toBeGreaterThan(10)
    for (const p of pages) expect(isSamplePage(`https://app.example.com${p.path}`), p.id).toBe(true)
  })
})
