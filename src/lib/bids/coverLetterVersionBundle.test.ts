import { describe, expect, it } from 'vitest'
import {
  bundleSummary,
  letterTotal,
  planLetterSections,
  sectionLabel,
  starredPricingIdForVersion,
  type BundlePricing,
  type BundleVersion, planUnsplitLetterSections } from './coverLetterVersionBundle'

const v = (over: Partial<BundleVersion> & { id: string }): BundleVersion => ({
  name: over.id,
  sort_order: 0,
  include_in_submission: true,
  is_alternate: false,
  starred_price_book_version_id: null,
  customer_id: null,
  ...over,
})
const p = (id: string, bid_version_id: string | null, sort_order = 0, created_at = '2026-01-01'): BundlePricing => ({ id, bid_version_id, sort_order, created_at })

describe('starredPricingIdForVersion', () => {
  it('uses the saved ★ when it belongs to the version', () => {
    const tp = v({ id: 'tp', starred_price_book_version_id: 'wendi' })
    expect(starredPricingIdForVersion(tp, [p('default', 'tp', 0), p('wendi', 'tp', 1)])).toBe('wendi')
  })
  it('ignores a saved ★ that belongs to another version and falls back to the first scenario', () => {
    const tp = v({ id: 'tp', starred_price_book_version_id: 've-price' })
    expect(starredPricingIdForVersion(tp, [p('wendi', 'tp', 1), p('default', 'tp', 0), p('ve-price', 've', 0)])).toBe('default')
  })
  it('breaks sort ties by created_at and returns null for a version with no scenarios', () => {
    const tp = v({ id: 'tp' })
    expect(starredPricingIdForVersion(tp, [p('b', 'tp', 0, '2026-02-01'), p('a', 'tp', 0, '2026-01-01')])).toBe('a')
    expect(starredPricingIdForVersion(tp, [p('x', 've', 0)])).toBeNull()
  })
})

describe('planLetterSections', () => {
  const pricings = [p('wendi', 'tp', 0), p('ve-price', 've', 0), p('shell-p', 'shell', 0)]
  it('keeps only included versions, base first then alternates, each at its ★', () => {
    const sections = planLetterSections(
      [
        v({ id: 've', name: 'Value Engineered', sort_order: 1, is_alternate: true, starred_price_book_version_id: 've-price' }),
        v({ id: 'tp', name: 'To Plans', sort_order: 0, starred_price_book_version_id: 'wendi' }),
        v({ id: 'shell', name: 'Shell', sort_order: 2, include_in_submission: false }),
      ],
      pricings,
    )
    expect(sections.map((s) => [s.name, s.isAlternate, s.pricingId])).toEqual([
      ['To Plans', false, 'wendi'],
      ['Value Engineered', true, 've-price'],
    ])
  })
  it('adds each OFFERED non-★ scenario as an alternate section priced on its version', () => {
    const sections = planLetterSections(
      [v({ id: 'burd', name: 'BURD', sort_order: 0, starred_price_book_version_id: 'b-base' })],
      [p('b-base', 'burd', 0), { ...p('b-sharp', 'burd', 1), include_in_submission: true, name: 'Sharpened' }, { ...p('b-off', 'burd', 2), include_in_submission: false, name: 'Default' }],
    )
    expect(sections.map((s) => [s.name, s.isAlternate, s.pricingId, s.offeredPricingId ?? null])).toEqual([
      ['BURD', false, 'b-base', null],
      ['BURD · Sharpened', true, 'b-sharp', 'b-sharp'],
    ])
  })
  it('lists an included version with no prices yet (pricingId null) rather than dropping it', () => {
    const sections = planLetterSections([v({ id: 'meet', name: 'Meet Shop' })], pricings)
    expect(sections).toEqual([{ versionId: 'meet', name: 'Meet Shop', isAlternate: false, pricingId: null, customerId: null }])
  })
})

describe('letterTotal / sectionLabel / bundleSummary', () => {
  it('sums base sections only', () => {
    expect(letterTotal([
      { isAlternate: false, revenueSum: 274248.79 },
      { isAlternate: false, revenueSum: 62094.12 },
      { isAlternate: true, revenueSum: 224100.72 },
    ])).toBeCloseTo(336342.91, 2)
    expect(letterTotal([])).toBe(0)
  })
  it('labels base and alternate sections', () => {
    expect(sectionLabel({ name: 'To Plans', isAlternate: false }, ['To Plans'])).toBe('Bid: To Plans')
    expect(sectionLabel({ name: 'Value Engineered', isAlternate: true }, ['To Plans'])).toBe('Alternate: Value Engineered — in lieu of To Plans')
    expect(sectionLabel({ name: 'Shell VE', isAlternate: true }, ['Burgers', 'Shell'])).toBe('Alternate: Shell VE — in lieu of Burgers + Shell')
    expect(sectionLabel({ name: 'Only', isAlternate: true }, [])).toBe('Alternate: Only')
  })
  it('summarizes the bundle', () => {
    expect(bundleSummary([])).toBe('nothing in the letter yet')
    expect(bundleSummary([{ isAlternate: false }])).toBe('1 base bid')
    expect(bundleSummary([{ isAlternate: false }, { isAlternate: false }, { isAlternate: true }])).toBe('2 base bids · 1 alternate')
  })
})

describe('planUnsplitLetterSections (v2.2392)', () => {
  const pr = (id: string, name: string, sort: number, offered = false, versionId: string | null = null) => ({
    id,
    name,
    sort_order: sort,
    bid_version_id: versionId,
    include_in_submission: offered,
  })

  it('★ base first, offered non-★ pricings as alternates', () => {
    const plan = planUnsplitLetterSections([pr('wendi', 'WENDI', 1), pr('def', 'Default', 0, true)], 'wendi')
    expect(plan).toEqual([
      { name: 'WENDI', pricingId: 'wendi', isAlternate: false },
      { name: 'Default', pricingId: 'def', isAlternate: true, offeredPricingId: 'def' },
    ])
  })

  it('empty when nothing is offered — the plain single letter needs no bundle', () => {
    expect(planUnsplitLetterSections([pr('wendi', 'WENDI', 1), pr('def', 'Default', 0)], 'wendi')).toEqual([])
  })

  it('falls back to the first unsplit pricing when the saved ★ is missing or version-owned', () => {
    const plan = planUnsplitLetterSections([pr('def', 'Default', 0), pr('wendi', 'WENDI', 1, true)], 'gone')
    expect(plan[0]).toEqual({ name: 'Default', pricingId: 'def', isAlternate: false })
    expect(plan[1]!.offeredPricingId).toBe('wendi')
  })

  it('ignores version-owned pricings entirely', () => {
    expect(planUnsplitLetterSections([pr('v1', 'Split', 0, true, 'ver-1')], null)).toEqual([])
  })

  it('a ★ that is itself offered never lists twice', () => {
    const plan = planUnsplitLetterSections([pr('wendi', 'WENDI', 1, true), pr('def', 'Default', 0, true)], 'wendi')
    expect(plan.map((s) => s.pricingId)).toEqual(['wendi', 'def'])
  })
})
