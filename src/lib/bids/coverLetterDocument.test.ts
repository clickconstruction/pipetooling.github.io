import { describe, expect, it } from 'vitest'
import {
  letterDocument,
  letterRowsFor,
  letterSectionPlans,
  letterTotalsWithoutOffered,
  priceLetterSections,
  type LetterCountRow,
  type LetterSection,
} from './coverLetterDocument'
import type { GcPacketCustomer } from './coverLetterGcPackets'
import type { BundlePricing, BundleVersion } from './coverLetterVersionBundle'

const v = (over: Partial<BundleVersion> & { id: string }): BundleVersion => ({
  name: over.id,
  sort_order: 0,
  include_in_submission: true,
  is_alternate: false,
  starred_price_book_version_id: null,
  customer_id: null,
  ...over,
})
const p = (id: string, bid_version_id: string | null, over: Partial<BundlePricing> = {}): BundlePricing => ({ id, bid_version_id, sort_order: 0, created_at: '2026-09-01', ...over })
const row = (id: string, bid_version_id: string | null, fixture: string, count: number, group_tag: string | null = null): LetterCountRow & { bid_version_id: string | null } => ({ id, bid_version_id, fixture, count, group_tag })
const price = (count_row_id: string, price_book_version_id: string, unit_price: number) => ({ count_row_id, price_book_version_id, unit_price })
const section = (over: Partial<LetterSection> & { name: string }): LetterSection => ({ bidVersionId: null, revenueSum: 0, fixtureRows: [], isAlternate: false, ...over })
const bidGc: GcPacketCustomer = { id: 'gc', name: 'Acme Builders', address: '1 Acme Way' }

describe('letterSectionPlans', () => {
  it('plans a split bid from its in-letter versions, base first, each at its own ★', () => {
    const versions = [
      v({ id: 've', name: 'Value Engineered', is_alternate: true, starred_price_book_version_id: 'pb-ve' }),
      // BP385: the base's ★ points at the other version's price, so it takes its own first price.
      v({ id: 'wtp', name: 'Written to Plan', sort_order: 1, starred_price_book_version_id: 'pb-ve' }),
      v({ id: 'shelved', include_in_submission: false }),
    ]
    const pricings = [p('pb-ve', 've'), p('pb-wtp', 'wtp'), p('pb-shelved', 'shelved')]
    expect(letterSectionPlans(versions, pricings, 'pb-ve')).toEqual([
      { name: 'Written to Plan', bidVersionId: 'wtp', pricingId: 'pb-wtp', isAlternate: false, offeredPricingId: undefined },
      { name: 'Value Engineered', bidVersionId: 've', pricingId: 'pb-ve', isAlternate: true, offeredPricingId: undefined },
    ])
  })

  it('plans a version-less bid from its offered prices, and plans nothing when none is offered', () => {
    const pricings = [p('star', null, { name: 'Standard' }), p('premium', null, { name: 'Premium', sort_order: 1, include_in_submission: true })]
    expect(letterSectionPlans([], pricings, 'star')).toEqual([
      { name: 'Standard', bidVersionId: null, pricingId: 'star', isAlternate: false, offeredPricingId: undefined },
      { name: 'Premium', bidVersionId: null, pricingId: 'premium', isAlternate: true, offeredPricingId: 'premium' },
    ])
    expect(letterSectionPlans([], [p('star', null)], 'star')).toEqual([])
  })
})

describe('letterRowsFor', () => {
  const active = [row('a1', 'wtp', 'Lavatory', 1)]
  it('gives a version its own rows', () => {
    const rowsFor = letterRowsFor([row('w1', 'wtp', 'Lavatory', 4), row('e1', 've', 'Lavatory', 3)], active)
    expect(rowsFor('ve').map((r) => r.id)).toEqual(['e1'])
    expect(rowsFor('wtp').map((r) => r.id)).toEqual(['w1'])
  })
  it('gives a version with no rows the unsplit rows, else the active version’s', () => {
    expect(letterRowsFor([row('u1', null, 'Lavatory', 2)], active)('empty').map((r) => r.id)).toEqual(['u1'])
    expect(letterRowsFor([row('w1', 'wtp', 'Lavatory', 4)], active)('empty')).toBe(active)
    expect(letterRowsFor([], active)(null)).toBe(active)
  })
})

describe('letterTotalsWithoutOffered', () => {
  const all = { revenueSum: 1300, fixtureRows: [{ fixture: 'WC', count: 2 }, { fixture: 'Break room sink', count: 1 }, { fixture: 'Hose bib', count: 1 }] }
  const split = {
    base: { revenueSum: 1000, fixtureRows: [{ fixture: 'WC', count: 2 }] },
    alternates: [
      { key: 'group:break room', label: 'Break room', revenueSum: 200, fixtureRows: [{ fixture: 'Break room sink', count: 1 }] },
      { key: 'group:patio', label: 'Patio', revenueSum: 100, fixtureRows: [{ fixture: 'Hose bib', count: 1 }] },
    ],
  }
  it('keeps every row when the bid has no with-and-without alternates', () => {
    expect(letterTotalsWithoutOffered(all, null, {})).toBe(all)
  })
  it('takes an offered alternate out of the amount and keeps one the estimator unticked', () => {
    expect(letterTotalsWithoutOffered(all, split, { groups: { 'group:patio': { offered: false } } })).toEqual({
      revenueSum: 1100,
      fixtureRows: [{ fixture: 'WC', count: 2 }, { fixture: 'Hose bib', count: 1 }],
    })
  })
})

describe('priceLetterSections', () => {
  const rows = [row('w1', 'wtp', 'Lavatory', 10), row('w2', 'wtp', 'Water Closet', 8), row('e1', 've', 'Lavatory', 10), row('e2', 've', 'Water Closet', 8)]
  const inputs = {
    rowsFor: letterRowsFor(rows, rows.slice(0, 2)),
    entries: [],
    assignments: [],
    customPrices: [price('w1', 'pb-wtp', 1000), price('w2', 'pb-wtp', 1500), price('e1', 'pb-ve', 900), price('e2', 'pb-ve', 1250)],
    hides: [],
    alternateGroupTags: [],
    altTexts: {},
  }

  it('prices each section with its own scenario on its own version’s rows', () => {
    const sections = priceLetterSections({
      ...inputs,
      plans: [
        { name: 'Written to Plan', bidVersionId: 'wtp', pricingId: 'pb-wtp', isAlternate: false },
        { name: 'Value Engineered', bidVersionId: 've', pricingId: 'pb-ve', isAlternate: true },
        { name: 'No prices yet', bidVersionId: 'new', pricingId: null, isAlternate: true },
      ],
    })
    expect(sections.map((s) => [s.name, s.revenueSum])).toEqual([['Written to Plan', 22000], ['Value Engineered', 19000], ['No prices yet', 0]])
    expect(sections[0]!.fixtureRows).toEqual([{ fixture: 'Lavatory', count: 10 }, { fixture: 'Water Closet', count: 8 }])
  })

  it('leaves an offered with-and-without alternate out of a section’s amount', () => {
    const tagged = [row('w1', 'wtp', 'Lavatory', 10), row('w2', 'wtp', 'Water Closet', 8, 'Break room')]
    const [base] = priceLetterSections({
      ...inputs,
      rowsFor: letterRowsFor(tagged, tagged),
      alternateGroupTags: ['Break room'],
      plans: [{ name: 'Written to Plan', bidVersionId: 'wtp', pricingId: 'pb-wtp', isAlternate: false }],
    })
    expect(base).toMatchObject({ revenueSum: 10000, fixtureRows: [{ fixture: 'Lavatory', count: 10 }] })
  })
})

describe('letterDocument', () => {
  const wtp = section({ name: 'Written to Plan', bidVersionId: 'wtp', revenueSum: 22000 })
  const ve = section({ name: 'Value Engineered', bidVersionId: 've', revenueSum: 19000, isAlternate: true })
  const unpriced = section({ name: 'Shell', bidVersionId: 'shell', isAlternate: true })

  it('leaves a $0 section off and plans one same-page letter: the base is the amount, the alternate a line', () => {
    const doc = letterDocument({ sections: [wtp, ve, unpriced], versionGcById: {}, bidGc, activeBidVersionId: 'wtp', layout: 'same-page' })
    expect(doc.priced).toEqual([wtp, ve])
    expect(doc.packet).toMatchObject({ customer: bidGc, sections: [wtp, ve] })
    expect(doc.samePage).toMatchObject({ headlineRevenue: 22000, alternates: [ve], alternateLeads: false })
  })

  it('keeps a letter per section on separate pages', () => {
    const doc = letterDocument({ sections: [wtp, ve], versionGcById: {}, bidGc, activeBidVersionId: 'wtp', layout: 'separate' })
    expect(doc.packet?.sections).toEqual([wtp, ve])
    expect(doc.samePage).toBeNull()
  })

  it('shows the active version’s GC packet unless another is picked', () => {
    const other: GcPacketCustomer = { id: 'gc2', name: 'Other GC', address: '2 Other St' }
    const input = { sections: [wtp, ve], versionGcById: { ve: other }, bidGc, layout: 'same-page' as const }
    expect(letterDocument({ ...input, activeBidVersionId: 've' }).packet).toMatchObject({ key: 'gc2', sections: [ve] })
    expect(letterDocument({ ...input, activeBidVersionId: 've', pickedPacketKey: 'gc' }).packet).toMatchObject({ key: 'gc', sections: [wtp] })
  })

  it('has no packet when nothing is priced: the single letter', () => {
    expect(letterDocument({ sections: [unpriced], versionGcById: {}, bidGc, activeBidVersionId: null, layout: 'same-page' })).toEqual({ priced: [], packets: [], packet: null, samePage: null })
  })
})
