import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bidPricedTotal, openPricing, readAllById, type BidForPricing, type PricingBook, type PricingReader, type PricingRow, type PricingVersion } from '../../../supabase/functions/_shared/devMcpBidPricing'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { deriveActivePricingId } from '../bids/pickActiveVersion'
import { scenarioPricingRows } from '../bids/scenarioPricingRows'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const COMPOSITES = readFileSync('supabase/functions/_shared/devMcpComposites.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')

// A made-up bid, made-up books and made-up prices: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const TRADE = 'bbbbbbbb-1111-4111-8111-111111111111'
const OWN = 'pppppppp-own'
const DEFAULT = 'pppppppp-default'
const OTHER = 'pppppppp-other'
const ROBOT = 'pppppppp-robot'
const V1 = 'vvvvvvvv-0001'
const V2 = 'vvvvvvvv-0002'

const bid = (over: Partial<BidForPricing> = {}): BidForPricing => ({ id: BID, service_type_id: TRADE, selected_bid_version_id: null, selected_price_book_version_id: null, bid_date_sent: null, priced_margin_pct: null, priced_revenue_usd: null, priced_at: null, ...over })
const templates: PricingBook[] = [{ id: OTHER, name: 'Commercial', bid_version_id: null, is_robot: false }, { id: DEFAULT, name: 'Default', bid_version_id: null, is_robot: false }, { id: ROBOT, name: '🤖 Robot Default', bid_version_id: null, is_robot: true }]

describe('openPricing — the Pricing tab’s own pick', () => {
  it('matches deriveActivePricingId on every branch, with nobody’s last-used book', () => {
    const cases: Array<{ name: string; bid: BidForPricing; versions: PricingVersion[]; pricings: PricingBook[]; legacyRefs: Array<string | null>; want: string | null; kind: string; viewer: boolean }> = [
      { name: 'a split bid takes its version’s ★', bid: bid({ selected_bid_version_id: V2 }), versions: [{ id: V1, name: 'To Plans', sort_order: 0, starred_price_book_version_id: null }, { id: V2, name: 'Alt', sort_order: 1, starred_price_book_version_id: 'p-v2-b' }], pricings: [{ id: 'p-v2-a', name: 'A', bid_version_id: V2, is_robot: false }, { id: 'p-v2-b', name: 'B', bid_version_id: V2, is_robot: false }], legacyRefs: [], want: 'p-v2-b', kind: 'own', viewer: false },
      { name: 'an unsplit bid takes its own copy', bid: bid(), versions: [], pricings: [{ id: OWN, name: 'Default (this bid)', bid_version_id: null, is_robot: false }], legacyRefs: [], want: OWN, kind: 'own', viewer: false },
      { name: 'an unsplit bid with a saved shared book opens on it', bid: bid({ selected_price_book_version_id: OTHER }), versions: [], pricings: [], legacyRefs: [], want: OTHER, kind: 'shared', viewer: false },
      { name: 'rows on a shared book pick that book', bid: bid(), versions: [], pricings: [], legacyRefs: [OTHER, OTHER, DEFAULT], want: OTHER, kind: 'shared', viewer: false },
      { name: 'nothing else: "Default", which a viewer’s last pick may change', bid: bid(), versions: [], pricings: [], legacyRefs: [], want: DEFAULT, kind: 'shared', viewer: true },
    ]
    for (const c of cases) {
      const got = openPricing({ bid: c.bid, versions: c.versions, pricings: c.pricings, templates, legacyRefs: c.legacyRefs })
      expect(got.pricingId, c.name).toBe(c.want)
      expect(got.target.kind, c.name).toBe(c.kind)
      expect(got.viewerDependent, c.name).toBe(c.viewer)
    }
    // The app's own function answers the same on the split case.
    expect(deriveActivePricingId({ activeVersionId: V2, bidPricings: [{ id: 'p-v2-a', bid_version_id: V2 }, { id: 'p-v2-b', bid_version_id: V2 }], legacyFallbackPricingId: null, versionStarredPricingId: 'p-v2-b' })).toBe('p-v2-b')
    expect(openPricing({ bid: bid(), versions: [], pricings: [], templates: [], legacyRefs: [] }).pricingId).toBeNull()
  })
})

/** A reader over tables that checks every column named against the generated catalog, filters as PostgREST does, and cuts at 200. */
function tableReader(tables: Record<string, PricingRow[]>, fail: string[] = []): PricingReader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rows: async (table, query) => {
      asked.push(table)
      if (fail.includes(table)) throw new Error(`${table}: permission denied`)
      const columns = Object.keys(CATALOG_TABLES[table]?.columns ?? {})
      expect(columns.length, `${table} is in the catalog`).toBeGreaterThan(0)
      for (const c of (query.select ?? '').split(',').map((s) => s.replace(/\(.*$/, '').trim()).filter(Boolean)) {
        if (c === 'fixture_types') continue
        expect(columns, `${table}.${c}`).toContain(c)
      }
      let rows = [...(tables[table] ?? [])]
      for (const f of query.filters ?? []) {
        expect(columns, `${table}.${f.column}`).toContain(f.column)
        if (f.op === 'eq') rows = rows.filter((r) => r[f.column] === f.value)
        else if (f.op === 'is') rows = rows.filter((r) => (r[f.column] ?? null) === f.value)
        else if (f.op === 'gt') rows = rows.filter((r) => String(r[f.column]) > String(f.value))
      }
      for (const o of [...(query.order ?? [])].reverse()) rows.sort((a, b) => (String(a[o.column]) < String(b[o.column]) ? -1 : String(a[o.column]) > String(b[o.column]) ? 1 : 0))
      return rows.slice(0, Math.min(query.limit ?? 50, 200))
    },
  }
}

const entry = (id: string, name: string, total: number) => ({ id, total_price: total, version_id: OWN, fixture_types: { name } })
const PRICED_BID = {
  bids_count_rows: [
    { id: 'c1', bid_id: BID, bid_version_id: null, fixture: 'Water closet', count: 4 },
    { id: 'c2', bid_id: BID, bid_version_id: null, fixture: 'Lavatory', count: 3 },
    { id: 'c3', bid_id: BID, bid_version_id: null, fixture: 'Hose bibb', count: 2 },
    { id: 'c4', bid_id: BID, bid_version_id: null, fixture: 'Floor drain', count: 5 },
    { id: 'c5', bid_id: BID, bid_version_id: null, fixture: 'Mop sink', count: 1 },
  ],
  price_book_versions: [{ id: OWN, name: 'Default (this bid)', bid_id: BID, bid_version_id: null, is_robot: false, sort_order: 0, service_type_id: TRADE }, { id: DEFAULT, name: 'Default', bid_id: null, bid_version_id: null, is_robot: false, sort_order: 0, service_type_id: TRADE }],
  price_book_entries: [entry('e1', 'Water closet', 900), entry('e2', 'Lavatory', 600), entry('e3', 'Floor drain', 300)],
  bid_pricing_assignments: [{ id: 'a1', bid_id: BID, count_row_id: 'c2', price_book_entry_id: 'e2', price_book_version_id: OWN, is_fixed_price: false, unit_price_override: 650 }],
  bid_count_row_custom_prices: [
    { id: 'cp1', bid_id: BID, count_row_id: 'c3', price_book_version_id: OWN, unit_price: 120 },
    // A custom price on a row a book entry names is ignored by the kernel: the entry wins.
    { id: 'cp2', bid_id: BID, count_row_id: 'c4', price_book_version_id: OWN, unit_price: 999 },
  ],
  bid_count_row_submission_hides: [],
  cost_estimates: [{ id: 'est', bid_id: BID }],
  bid_versions: [],
}

describe('bidPricedTotal — the grid’s revenue total', () => {
  it('reads what the tab reads and totals it through the tab’s own kernel', async () => {
    const reader = tableReader(PRICED_BID)
    const t = await bidPricedTotal(reader, bid({ priced_margin_pct: '31.5', priced_revenue_usd: '9000', priced_at: '2026-10-01T15:00:00Z' }))
    const app = scenarioPricingRows({
      scenarioId: OWN,
      countRows: PRICED_BID.bids_count_rows,
      entries: PRICED_BID.price_book_entries,
      assignments: PRICED_BID.bid_pricing_assignments,
      customPrices: PRICED_BID.bid_count_row_custom_prices,
    })
    // 4 × 900 + 3 × 650 + 2 × 120 + 5 × 300 + the mop sink unpriced = 7,290.
    expect(app.totalRevenue).toBe(7290)
    expect(t).toMatchObject({ priced_revenue_usd: 7290, pricing: { id: OWN, name: 'Default (this bid)', kind: 'own', version: null, viewer_dependent: false }, rows: { counted: 5, priced: 4, unpriced: 1 }, last_stamped: { margin_pct: 31.5, revenue_usd: 9000, on: '2026-10-01' }, held: [] })
    expect(t.words).toContain('$7,290.00 — the Pricing grid\'s revenue total, from "Default (this bid)": 4 of 5 count rows priced.')
    expect(t.words).toContain('last stamped a 31.5% margin on 2026-10-01')
    expect(reader.asked).toEqual(expect.arrayContaining(['bid_versions', 'price_book_versions', 'bids_count_rows', 'cost_estimates', 'price_book_entries', 'bid_pricing_assignments', 'bid_count_row_custom_prices', 'bid_count_row_submission_hides']))
  })
  it('names a shared book, a bid with no labor estimate, and the viewer-dependent pick', async () => {
    const shared = { ...PRICED_BID, price_book_versions: PRICED_BID.price_book_versions.filter((v) => v.id === DEFAULT), price_book_entries: PRICED_BID.price_book_entries.map((e) => ({ ...e, version_id: DEFAULT })), bid_pricing_assignments: [], bid_count_row_custom_prices: [], cost_estimates: [] }
    const t = await bidPricedTotal(tableReader(shared), bid())
    expect(t).toMatchObject({ priced_revenue_usd: 6900, pricing: { id: DEFAULT, kind: 'shared', viewer_dependent: true } })
    expect(t.words).toContain('a shared price book')
    expect(t.words).toContain('the viewer\'s last-used book, else "Default"')
    expect(t.words).toContain('shows its start panel instead of this grid')
    expect(t.words).toContain('Cost and margin are the tab\'s to compute')
  })
  it('answers in words where the tab shows no grid, and leaves the figure out when a read fails', async () => {
    expect(await bidPricedTotal(tableReader({}), bid({ service_type_id: null }))).toMatchObject({ priced_revenue_usd: null, words: expect.stringContaining('No pricing') })
    expect(await bidPricedTotal(tableReader({ ...PRICED_BID, bids_count_rows: [] }), bid())).toMatchObject({ priced_revenue_usd: null, rows: { counted: 0 }, words: expect.stringContaining('plan_bid_counts adds them') })
    const failed = await bidPricedTotal(tableReader(PRICED_BID, ['bid_pricing_assignments']), bid())
    expect(failed).toMatchObject({ priced_revenue_usd: null, held: [expect.stringContaining('permission denied')], words: expect.stringContaining('Not stated') })
  })
  it('reads past the door’s 200 rows a page, by id', async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ id: `c${String(i).padStart(4, '0')}`, bid_id: BID }))
    const got = await readAllById(tableReader({ bids_count_rows: many }), 'bids_count_rows', 'id', [{ column: 'bid_id', op: 'eq', value: BID }])
    expect(got).toMatchObject({ whole: true })
    expect(got.rows).toHaveLength(450)
  })
})

describe('the seat says it', () => {
  it('get_bid’s totals come from the kernel, and the docs no longer say the total is not restated', () => {
    expect(COMPOSITES).toContain('part(() => bidPricedTotal(reader, bid as unknown as BidForPricing))')
    expect(COMPOSITES).toContain('    totals: priced,')
    expect(SERVER).toContain("Since v2.6990 `totals` is the Pricing grid's revenue total")
    expect(SERVER).not.toContain('is NOT restated here')
    expect(README).toContain('the Pricing grid\'s revenue total')
    expect(README).not.toContain('so `get_bid.totals` is a sentence, not a figure')
  })
})
