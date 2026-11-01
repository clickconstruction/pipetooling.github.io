import { describe, expect, it } from 'vitest'
import { pricingSetupWords, pricingStartChoices } from './pricingStartChoices'

/**
 * The start panel for a version with no prices (punch list #137): the side-by-side rebid
 * (same GC, own counts) leads with the sibling's book and names versions, the original G1
 * cross-GC case keeps its GC words, and anything the Workbench could not render afterward
 * stays on the setup sentence.
 */

const GC_NAMES: Record<string, string> = { v1: 'Caprock', v2: 'Caprock', g2: 'Harbor Point' }
const gcName = (id: string | null) => (id ? (GC_NAMES[id] ?? 'the GC') : 'the GC')

const BASE = {
  templates: [
    { id: 'tpl-haley', name: 'HALEY' },
    { id: 'tpl-default', name: 'Default' },
  ],
  defaultTemplateId: 'tpl-default',
  gcName,
  hasCounts: true,
  hasCostEstimate: true,
}

describe('pricingStartChoices — the side-by-side rebid (same GC)', () => {
  const input = {
    ...BASE,
    selectedBidVersionId: 'v2',
    bidVersions: [
      { id: 'v1', name: 'To Plans', customer_id: null, starred_price_book_version_id: 'p1' },
      { id: 'v2', name: 'Addendum 2 rebid', customer_id: null, starred_price_book_version_id: null },
    ],
    bidPricings: [{ id: 'p1', bid_version_id: 'v1', source_version_id: 'tpl-haley', name: 'HALEY' }],
  }

  it('names the version, not the GC twice', () => {
    const c = pricingStartChoices(input)
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.title).toBe('No prices yet on Addendum 2 rebid.')
  })

  it('offers the sibling version’s book and says whose it is', () => {
    const c = pricingStartChoices(input)
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.bookTemplateId).toBe('tpl-haley')
    expect(c.bookLabel).toBe('Price from HALEY')
    expect(c.bookSubline).toBe("The book To Plans prices from, as a fresh copy at today's book prices.")
  })

  it('the copy door names the sibling version', () => {
    const c = pricingStartChoices(input)
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.donors).toEqual([{ versionId: 'v1', label: 'Copy prices from To Plans', crossGc: false }])
  })
})

describe('pricingStartChoices — another GC’s packet (the original G1 case)', () => {
  const input = {
    ...BASE,
    selectedBidVersionId: 'v1',
    bidVersions: [
      { id: 'v1', name: 'Base', customer_id: null, starred_price_book_version_id: null },
      { id: 'g2', name: 'Base', customer_id: 'c-harbor', starred_price_book_version_id: 'p2' },
    ],
    bidPricings: [{ id: 'p2', bid_version_id: 'g2', source_version_id: 'tpl-haley', name: 'HALEY' }],
  }

  it('keeps the GC words for title and copy', () => {
    const c = pricingStartChoices({ ...input, gcName: (id) => (id === 'g2' ? 'Harbor Point' : 'Caprock') })
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.title).toBe('No prices yet for Caprock.')
    expect(c.donors).toEqual([{ versionId: 'g2', label: "Copy Harbor Point's base price", crossGc: true }])
    expect(c.bookTemplateId).toBe('tpl-haley')
    expect(c.bookSubline).toBe("The book Harbor Point prices from, as a fresh copy at today's book prices.")
  })
})

describe('pricingStartChoices — same-GC sibling beats a cross-GC donor for the book', () => {
  it('a rebid prices from the book its own packet did', () => {
    const c = pricingStartChoices({
      ...BASE,
      selectedBidVersionId: 'v2',
      bidVersions: [
        { id: 'v1', name: 'To Plans', customer_id: null, starred_price_book_version_id: 'p1' },
        { id: 'v2', name: 'Rebid', customer_id: null, starred_price_book_version_id: null },
        { id: 'g2', name: 'Base', customer_id: 'c-harbor', starred_price_book_version_id: 'p2' },
      ],
      bidPricings: [
        { id: 'p1', bid_version_id: 'v1', source_version_id: 'tpl-haley', name: 'HALEY' },
        { id: 'p2', bid_version_id: 'g2', source_version_id: 'tpl-default', name: 'Default' },
      ],
    })
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.bookTemplateId).toBe('tpl-haley')
    expect(c.donors.map((d) => d.versionId)).toEqual(['v1', 'g2'])
  })
})

describe('pricingStartChoices — no donors at all', () => {
  it('still opens the book door, on the viewer’s default', () => {
    const c = pricingStartChoices({
      ...BASE,
      selectedBidVersionId: 'v2',
      bidVersions: [
        { id: 'v1', name: 'To Plans', customer_id: null, starred_price_book_version_id: null },
        { id: 'v2', name: 'Rebid', customer_id: null, starred_price_book_version_id: null },
      ],
      bidPricings: [],
    })
    if (c.kind !== 'start') throw new Error(c.kind)
    expect(c.bookTemplateId).toBe('tpl-default')
    expect(c.bookLabel).toBe('Price from Default')
    expect(c.bookSubline).toBe("A fresh copy of the book at today's prices.")
    expect(c.donors).toEqual([])
  })
})

describe('pricingStartChoices — the setup sentence stays where the panel cannot help', () => {
  const versions = [{ id: 'v1', name: 'Base', customer_id: null, starred_price_book_version_id: null }]

  it('no counts', () => {
    expect(pricingStartChoices({ ...BASE, selectedBidVersionId: 'v1', bidVersions: versions, bidPricings: [], hasCounts: false })).toEqual({ kind: 'needs-setup', missing: 'counts' })
  })

  it('no cost estimate', () => {
    expect(pricingStartChoices({ ...BASE, selectedBidVersionId: 'v1', bidVersions: versions, bidPricings: [], hasCostEstimate: false })).toEqual({ kind: 'needs-setup', missing: 'cost-estimate' })
  })

  it('an unsplit bid (no active version)', () => {
    expect(pricingStartChoices({ ...BASE, selectedBidVersionId: null, bidVersions: [], bidPricings: [] })).toEqual({ kind: 'needs-setup', missing: 'version' })
  })

  it('the version already has a price', () => {
    expect(
      pricingStartChoices({
        ...BASE,
        selectedBidVersionId: 'v1',
        bidVersions: versions,
        bidPricings: [{ id: 'p1', bid_version_id: 'v1', source_version_id: null, name: 'HALEY' }],
      }),
    ).toEqual({ kind: 'needs-setup', missing: 'version' })
  })
})

describe('pricingSetupWords — the empty start names the press, and always offers the adopt (v2.6251)', () => {
  const onAdopt = () => {}
  const doors = { countsTo: '/bids?tab=counts&bidId=b1', laborTo: '/bids?tab=labor&bidId=b1', onAdopt }

  it('no counts: Open Counts leads, the adopt is the other way', () => {
    expect(pricingSetupWords('counts', doors)).toEqual({
      main: 'No counts on this version yet.',
      next: { label: 'Open Counts', to: '/bids?tab=counts&bidId=b1' },
      tail: 'to count the plans',
      orNext: { label: 'Adopt an existing bid', onPress: onAdopt },
    })
  })

  it('no cost estimate: Open Labor leads', () => {
    const w = pricingSetupWords('cost-estimate', doors)
    expect(w.main).toBe('No cost estimate on this bid yet.')
    expect(w.next).toEqual({ label: 'Open Labor', to: '/bids?tab=labor&bidId=b1' })
    expect(w.orNext?.label).toBe('Adopt an existing bid')
  })

  it('no version to price: the adopt is the one press', () => {
    const w = pricingSetupWords('version', doors)
    expect(w.main).toBe('Nothing to price on this version yet.')
    expect(w.next).toEqual({ label: 'Adopt an existing bid', onPress: onAdopt })
    expect(w.orNext).toBeUndefined()
  })
})
