import { describe, expect, it } from 'vitest'
import type { BundlePricing, BundleVersion } from './coverLetterVersionBundle'
import { afterOpenPriceDeleted, letterPriceCountByVersion, resolvedStarPricingId, starWriteAllowed } from './versionStar'

// BP385 Galloway Park as it stands on prod (2026-10-01): both versions star Value Engineered's price.
const ve: BundleVersion = { id: 'v-ve', name: 'Value Engineered', sort_order: 0, include_in_submission: true, is_alternate: true, starred_price_book_version_id: 'p-ve' }
const wtp: BundleVersion = { id: 'v-wtp', name: 'Written to Plan', sort_order: 1, include_in_submission: true, is_alternate: false, starred_price_book_version_id: 'p-ve' }
const bp385Pricings: BundlePricing[] = [
  { id: 'p-ve', name: 'Value Engineered', bid_version_id: 'v-ve', sort_order: 0, include_in_submission: true, created_at: '2026-08-25T19:18:51Z' },
  { id: 'p-wtp', name: 'Written to Plan', bid_version_id: 'v-wtp', sort_order: 1, include_in_submission: true, created_at: '2026-09-21T19:11:07Z' },
]

describe('resolvedStarPricingId', () => {
  it("passes over a ★ that belongs to another version and reads the version's own price (BP385)", () => {
    expect(resolvedStarPricingId({ activeVersionId: 'v-wtp', bidVersions: [ve, wtp], bidPricings: bp385Pricings, bidSavedPricingId: 'p-ve' })).toBe('p-wtp')
  })

  it("keeps a version's own ★, whatever the bid-level column says", () => {
    expect(resolvedStarPricingId({ activeVersionId: 'v-ve', bidVersions: [ve, wtp], bidPricings: bp385Pricings, bidSavedPricingId: 'p-wtp' })).toBe('p-ve')
  })

  it('without a ★ of its own, the version reads its first price by sort order, then the oldest', () => {
    const pricings: BundlePricing[] = [
      { id: 'p-late', bid_version_id: 'v-a', sort_order: 1, created_at: '2026-09-01' },
      { id: 'p-new', bid_version_id: 'v-a', sort_order: 0, created_at: '2026-09-03' },
      { id: 'p-old', bid_version_id: 'v-a', sort_order: 0, created_at: '2026-09-02' },
    ]
    const v = { id: 'v-a', starred_price_book_version_id: null }
    expect(resolvedStarPricingId({ activeVersionId: 'v-a', bidVersions: [v], bidPricings: pricings, bidSavedPricingId: null })).toBe('p-old')
  })

  it('a version with no prices has no ★, even when it saved one', () => {
    expect(resolvedStarPricingId({ activeVersionId: 'v-empty', bidVersions: [{ id: 'v-empty', starred_price_book_version_id: 'p-ve' }], bidPricings: bp385Pricings, bidSavedPricingId: 'p-ve' })).toBeNull()
  })

  it('a version missing from the list (still loading) reads its first own price', () => {
    expect(resolvedStarPricingId({ activeVersionId: 'v-wtp', bidVersions: [], bidPricings: bp385Pricings, bidSavedPricingId: 'p-ve' })).toBe('p-wtp')
  })

  it("unsplit bid: the saved ★ when it is the bid's own copy, else the first copy, else the saved shared book", () => {
    const copies: BundlePricing[] = [
      { id: 'p-1', bid_version_id: null, sort_order: 0 },
      { id: 'p-2', bid_version_id: null, sort_order: 1 },
    ]
    expect(resolvedStarPricingId({ activeVersionId: null, bidVersions: [], bidPricings: copies, bidSavedPricingId: 'p-2' })).toBe('p-2')
    expect(resolvedStarPricingId({ activeVersionId: null, bidVersions: [], bidPricings: copies, bidSavedPricingId: null })).toBe('p-1')
    expect(resolvedStarPricingId({ activeVersionId: null, bidVersions: [], bidPricings: [], bidSavedPricingId: 'tmpl-default' })).toBe('tmpl-default')
    expect(resolvedStarPricingId({ activeVersionId: null, bidVersions: [], bidPricings: [], bidSavedPricingId: null })).toBeNull()
  })
})

describe('starWriteAllowed', () => {
  it("allows one of the active version's own prices", () => {
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: 'p-wtp', pricingBidVersionId: 'v-wtp' })).toBe(true)
  })

  it("refuses another version's price (how BP385's Written to Plan came to star Value Engineered)", () => {
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: 'p-ve', pricingBidVersionId: 'v-ve' })).toBe(false)
  })

  it('refuses an unversioned price, a shared book and a price that is gone', () => {
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: 'p-legacy', pricingBidVersionId: null })).toBe(false)
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: 'tmpl-default', pricingBidVersionId: null })).toBe(false)
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: 'p-deleted', pricingBidVersionId: undefined })).toBe(false)
  })

  it('always allows clearing the ★, and anything on an unsplit bid', () => {
    expect(starWriteAllowed({ activeVersionId: 'v-wtp', pricingId: null, pricingBidVersionId: undefined })).toBe(true)
    expect(starWriteAllowed({ activeVersionId: null, pricingId: 'tmpl-default', pricingBidVersionId: null })).toBe(true)
  })
})

describe('letterPriceCountByVersion', () => {
  it('counts what the letter draws: BP385 gets 2 prices, not 3', () => {
    const counts = letterPriceCountByVersion([ve, wtp], bp385Pricings)
    expect(counts).toEqual({ 'v-wtp': 1, 'v-ve': 1 })
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2)
  })

  it("adds each price a version offers as an alternate, never its ★ twice", () => {
    const pricings: BundlePricing[] = [
      { id: 'p-base', bid_version_id: 'v-a', sort_order: 0, include_in_submission: true },
      { id: 'p-alt', bid_version_id: 'v-a', sort_order: 1, include_in_submission: true },
      { id: 'p-mine', bid_version_id: 'v-a', sort_order: 2, include_in_submission: false },
    ]
    const v: BundleVersion = { id: 'v-a', name: 'To Plans', sort_order: 0, include_in_submission: true, starred_price_book_version_id: 'p-base' }
    expect(letterPriceCountByVersion([v], pricings)).toEqual({ 'v-a': 2 })
  })

  it('a version left off the letter, or with no prices yet, puts none on it', () => {
    const off: BundleVersion = { ...ve, include_in_submission: false }
    const empty: BundleVersion = { id: 'v-new', name: 'New GC', sort_order: 2, include_in_submission: true, starred_price_book_version_id: null }
    expect(letterPriceCountByVersion([off, wtp, empty], bp385Pricings)).toEqual({ 'v-wtp': 1 })
  })
})

describe('afterOpenPriceDeleted', () => {
  // BP384's shape: NORTHSTAR open, PlanHub's WENDI is the lowest sort order left on the bid.
  const planHubWendi: BundlePricing = { id: 'p-planhub-wendi', bid_version_id: 'v-planhub', sort_order: 2 }
  const northstarWendi: BundlePricing = { id: 'p-ns-wendi', bid_version_id: 'v-ns', sort_order: 3 }
  const northstarVe: BundlePricing = { id: 'p-ns-ve', bid_version_id: 'v-ns', sort_order: 4 }

  it("a split bid opens its version's ★ and saves nothing — never the bid's lowest price from another version", () => {
    const out = afterOpenPriceDeleted({
      deletedId: 'p-ns-scratch',
      activeVersion: { id: 'v-ns', starred_price_book_version_id: 'p-ns-ve' },
      remaining: [planHubWendi, northstarWendi, northstarVe],
      bidSavedPricingId: 'p-ns-ve',
    })
    expect(out).toEqual({ viewId: 'p-ns-ve' })
    expect('saveStarId' in out).toBe(false)
  })

  it("a split version with no ★ of its own opens its first price; with no prices left, nothing", () => {
    expect(afterOpenPriceDeleted({ deletedId: 'p-x', activeVersion: { id: 'v-ns', starred_price_book_version_id: null }, remaining: [planHubWendi, northstarVe, northstarWendi], bidSavedPricingId: null }))
      .toEqual({ viewId: 'p-ns-wendi' })
    expect(afterOpenPriceDeleted({ deletedId: 'p-x', activeVersion: { id: 'v-ns', starred_price_book_version_id: null }, remaining: [planHubWendi], bidSavedPricingId: 'p-planhub-wendi' }))
      .toEqual({ viewId: null })
  })

  it('an unsplit bid moves its ★ only when the deleted price was the ★', () => {
    const remaining: BundlePricing[] = [
      { id: 'p-1', bid_version_id: null, sort_order: 0 },
      { id: 'p-2', bid_version_id: null, sort_order: 1 },
    ]
    expect(afterOpenPriceDeleted({ deletedId: 'p-star', activeVersion: null, remaining, bidSavedPricingId: 'p-star' })).toEqual({ viewId: 'p-1', saveStarId: 'p-1' })
    expect(afterOpenPriceDeleted({ deletedId: 'p-scratch', activeVersion: null, remaining, bidSavedPricingId: 'p-2' })).toEqual({ viewId: 'p-2' })
    expect(afterOpenPriceDeleted({ deletedId: 'p-star', activeVersion: null, remaining: [], bidSavedPricingId: 'p-star' })).toEqual({ viewId: null, saveStarId: null })
  })
})
