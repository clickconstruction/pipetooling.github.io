// A bid's priced total from the dev seat (the bid train's PR 5a, to-dos/mcp-servers.md → The bid train).
// get_bid said for months that the priced total on Bids → Pricing lived in a client hook and was not restated. The
// reading of 2026-11-11 found the hook only loads rows: the total is computeBidPricingRows through scenarioPricingRows,
// both pure, now read from the kernel copy. This file reads what the Pricing tab reads (useBidPricingEngine
// loadPricingDataForBid, loadBidPricingAssignments, loadPriceBookEntries), picks the open pricing by the tab's own rule
// (pickActiveVersion, then deriveActivePricingId), and hands the rows to the kernel, so get_bid.totals is the grid's
// revenue total, to the cent.
//
// What the total is and is not:
//   · it is the revenue the Pricing grid totals (pricingRowsForGrid.totalRevenue): count × unit price on each count
//     row of the active version, the unit price an assignment's override, else its book entry's, else a book entry of
//     the row's fixture name, else a custom price. Revenue never reads the labor rate, so the company crew rate the tab
//     falls back to does not touch it.
//   · it is not the Workbench strip's Revenue while someone holds an unsaved solver preview or a price mid-typing in
//     their own browser, and the strip multiplies a fixed-price row by its count where the grid does not.
//   · cost and margin are the tab's to compute (they need the company crew rate when the bid has no labor rate); the
//     reply names the margin the tab last stamped on the bid (bids.priced_*), with its day.
//   · one choice depends on the viewer: an unsplit bid with no pricing of its own, no saved pick and no rows on a
//     shared book opens on that person's last-used book (bid_pricing_user_prefs), else the book named "Default". The
//     seat reads it as nobody's, and says so when that branch picked the pricing.
// Pure but for the reads, which come in through one small interface (src/lib/devMcp/devMcpBidPricing.test.ts).

import { pickLegacyDataTemplateId } from './gcKernels/lib/bids/legacyTemplatePricing.ts'
import { pickDefaultPriceBookTemplateId } from './gcKernels/lib/bids/pickDefaultPriceBookTemplateId.ts'
import { deriveActivePricingId, pickActiveVersion } from './gcKernels/lib/bids/pickActiveVersion.ts'
import { resolvePricingWriteTarget, type PricingWriteTarget } from './gcKernels/lib/bids/pricingWriteTarget.ts'
import { scenarioPricingRows } from './gcKernels/lib/bids/scenarioPricingRows.ts'
import type { RowFilter, RowOrder } from './devMcpDoor.ts'

export type PricingRow = Record<string, unknown>
/** The composites' reader, structurally (this file is imported by devMcpComposites.ts, so it does not import it back). */
export type PricingReader = { rows: (table: string, query: { select?: string; filters?: RowFilter[]; order?: RowOrder[]; limit?: number }) => Promise<PricingRow[]> }

const PAGE = 200
const MAX_PAGES = 25

/** Every row of a read, a page of 200 at a time by id (the door cuts a read at 200). */
export async function readAllById(reader: PricingReader, table: string, select: string, filters: RowFilter[]): Promise<{ rows: PricingRow[]; whole: boolean }> {
  const rows: PricingRow[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const got = await reader.rows(table, { select, filters: after ? [...filters, { column: 'id', op: 'gt', value: after }] : filters, order: [{ column: 'id' }], limit: PAGE })
    rows.push(...got)
    if (got.length < PAGE) return { rows, whole: true }
    after = String(got[got.length - 1]?.id ?? '')
  }
  return { rows, whole: false }
}

export type BidForPricing = {
  id: string
  service_type_id: string | null
  selected_bid_version_id: string | null
  selected_price_book_version_id: string | null
  bid_date_sent?: string | null
  priced_margin_pct?: number | string | null
  priced_revenue_usd?: number | string | null
  priced_at?: string | null
}
export type PricingVersion = { id: string; name: string | null; sort_order: number; starred_price_book_version_id: string | null }
export type PricingBook = { id: string; name: string; bid_version_id: string | null; is_robot: boolean | null }

/** Which pricing the Pricing tab opens on, by its own rule, and how it got there. */
export type OpenPricing = {
  activeVersionId: string | null
  pricingId: string | null
  /** true when the pick came from the viewer-dependent branch (a person's last-used book, else "Default"). */
  viewerDependent: boolean
  target: PricingWriteTarget
  name: string | null
  versionName: string | null
}

/** The tab's pick: the active version, then the active pricing (useBidPricingEngine's resolve effect), with no viewer. */
export function openPricing(input: { bid: BidForPricing; versions: PricingVersion[]; pricings: PricingBook[]; templates: PricingBook[]; legacyRefs: Array<string | null> }): OpenPricing {
  const { bid, versions, pricings, templates } = input
  const activeVersionId = pickActiveVersion({ savedVersionId: bid.selected_bid_version_id, bidVersions: versions })
  // The tab reads the legacy rows only on a bid with no versions and no pricing of its own.
  const legacyDataPricingId = versions.length === 0 && pricings.length === 0
    ? pickLegacyDataTemplateId({ referencedVersionIds: input.legacyRefs, templateIds: templates.map((t) => t.id), bidPricingIds: pricings.map((p) => p.id) })
    : null
  const defaultTemplatePricingId = pickDefaultPriceBookTemplateId({ userLastTemplateId: null, templates })
  const versionStarredPricingId = activeVersionId ? versions.find((v) => v.id === activeVersionId)?.starred_price_book_version_id ?? null : null
  const base = { activeVersionId, bidPricings: pricings.map((p) => ({ id: p.id, bid_version_id: p.bid_version_id })), legacyFallbackPricingId: bid.selected_price_book_version_id, legacyDataPricingId, versionStarredPricingId }
  const pricingId = deriveActivePricingId({ ...base, defaultTemplatePricingId })
  const withoutDefault = deriveActivePricingId({ ...base, defaultTemplatePricingId: null })
  const target = resolvePricingWriteTarget({ selectedPricingVersionId: pricingId, bidPricings: pricings, templates })
  const name = [...pricings, ...templates].find((b) => b.id === pricingId)?.name ?? null
  return { activeVersionId, pricingId, viewerDependent: pricingId != null && withoutDefault == null, target, name, versionName: versions.find((v) => v.id === activeVersionId)?.name ?? null }
}

const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const round2 = (n: number): number => Math.round(n * 100) / 100

export type PricedTotal = {
  /** The grid's revenue total, to the cent; null when the tab would show no grid. */
  priced_revenue_usd: number | null
  words: string
  pricing: { id: string | null; name: string | null; kind: PricingWriteTarget['kind']; version: string | null; viewer_dependent: boolean } | null
  rows: { counted: number; priced: number; unpriced: number } | null
  /** The margin the Pricing tab last stamped on the bid (bids.priced_*), never computed here. */
  last_stamped: { margin_pct: number; revenue_usd: number | null; on: string | null } | null
  held: string[]
}

/**
 * The Pricing grid's revenue total for a bid, read as the tab reads it. A read that fails is named in `held` and the
 * figure is left out rather than guessed; a bid the tab would show no grid for (no pricing, no count rows, no labor
 * estimate) answers in words.
 */
export async function bidPricedTotal(reader: PricingReader, bid: BidForPricing): Promise<PricedTotal> {
  const held: string[] = []
  const stamp = bid.priced_margin_pct == null || bid.priced_margin_pct === '' ? null : { margin_pct: Number(bid.priced_margin_pct), revenue_usd: bid.priced_revenue_usd == null ? null : Number(bid.priced_revenue_usd), on: bid.priced_at ? String(bid.priced_at).slice(0, 10) : null }
  const answer = (words: string, extra: Partial<PricedTotal> = {}): PricedTotal => ({ priced_revenue_usd: null, words, pricing: null, rows: null, last_stamped: stamp, held, ...extra })
  const eq = (column: string, value: unknown): RowFilter => ({ column, op: 'eq', value })
  let versions: PricingVersion[]
  let pricings: PricingBook[]
  let templates: PricingBook[]
  try {
    const [v, pr, t] = await Promise.all([
      reader.rows('bid_versions', { select: 'id,name,sort_order,starred_price_book_version_id', filters: [eq('bid_id', bid.id)], order: [{ column: 'sort_order' }], limit: 50 }),
      reader.rows('price_book_versions', { select: 'id,name,bid_version_id,is_robot', filters: [eq('bid_id', bid.id)], order: [{ column: 'sort_order' }], limit: PAGE }),
      bid.service_type_id
        ? reader.rows('price_book_versions', { select: 'id,name,bid_version_id,is_robot', filters: [eq('service_type_id', bid.service_type_id), { column: 'bid_id', op: 'is', value: null }], order: [{ column: 'name' }], limit: PAGE })
        : Promise.resolve([]),
    ])
    versions = v.map((r) => ({ id: String(r.id), name: (r.name as string | null) ?? null, sort_order: Number(r.sort_order) || 0, starred_price_book_version_id: (r.starred_price_book_version_id as string | null) ?? null }))
    pricings = pr.map((r) => ({ id: String(r.id), name: String(r.name ?? ''), bid_version_id: (r.bid_version_id as string | null) ?? null, is_robot: (r.is_robot as boolean | null) ?? null }))
    templates = t.map((r) => ({ id: String(r.id), name: String(r.name ?? ''), bid_version_id: null, is_robot: (r.is_robot as boolean | null) ?? null }))
  } catch (e) {
    held.push(`the bid's versions and price books: ${e instanceof Error ? e.message : String(e)}`)
    return answer('Not stated: the price books could not be read, so the pricing the tab opens on is not known.')
  }
  let legacyRefs: Array<string | null> = []
  if (versions.length === 0 && pricings.length === 0) {
    try {
      const [a, c] = await Promise.all([
        readAllById(reader, 'bid_pricing_assignments', 'id,price_book_version_id', [eq('bid_id', bid.id)]),
        readAllById(reader, 'bid_count_row_custom_prices', 'id,price_book_version_id', [eq('bid_id', bid.id)]),
      ])
      legacyRefs = [...a.rows, ...c.rows].map((r) => (r.price_book_version_id as string | null) ?? null)
    } catch (e) {
      held.push(`the bid's rows on shared books: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const open = openPricing({ bid, versions, pricings, templates, legacyRefs })
  const pricing = { id: open.pricingId, name: open.name, kind: open.target.kind, version: open.versionName, viewer_dependent: open.viewerDependent }
  if (!open.pricingId) return answer('No pricing: the bid has no price book of its own and none to fall back on, so the Pricing tab opens on its start panel. Nothing is priced.', { pricing })
  const versionFilter: RowFilter = open.activeVersionId ? eq('bid_version_id', open.activeVersionId) : { column: 'bid_version_id', op: 'is', value: null }
  try {
    const [countRows, estimate, entries, assignments, customPrices, hides] = await Promise.all([
      readAllById(reader, 'bids_count_rows', 'id,fixture,count', [eq('bid_id', bid.id), versionFilter]),
      reader.rows('cost_estimates', { select: 'id', filters: [eq('bid_id', bid.id)], limit: 1 }),
      readAllById(reader, 'price_book_entries', 'id,total_price,version_id,fixture_types(name)', [eq('version_id', open.pricingId)]),
      readAllById(reader, 'bid_pricing_assignments', 'id,count_row_id,price_book_entry_id,price_book_version_id,is_fixed_price,unit_price_override', [eq('bid_id', bid.id), eq('price_book_version_id', open.pricingId)]),
      readAllById(reader, 'bid_count_row_custom_prices', 'id,count_row_id,price_book_version_id,unit_price', [eq('bid_id', bid.id), eq('price_book_version_id', open.pricingId)]),
      reader.rows('bid_count_row_submission_hides', { select: 'bid_id,count_row_id,price_book_version_id,created_at', filters: [eq('bid_id', bid.id), eq('price_book_version_id', open.pricingId)], limit: PAGE }),
    ])
    for (const [what, r] of [['count rows', countRows], ['book entries', entries], ['assignments', assignments], ['custom prices', customPrices]] as const) {
      if (!r.whole) held.push(`the ${what}: more than ${PAGE * MAX_PAGES}, read in part`)
    }
    if (held.length) return answer(`Not stated: ${held.join('; ')}.`, { pricing })
    if (!countRows.rows.length) return answer('No count rows on the version the tab opens on, so the Pricing grid is empty. plan_bid_counts adds them.', { pricing, rows: { counted: 0, priced: 0, unpriced: 0 } })
    const result = scenarioPricingRows({
      scenarioId: open.pricingId,
      countRows: countRows.rows.map((r) => ({ id: String(r.id), fixture: (r.fixture as string | null) ?? null, count: r.count as number | string | null })),
      entries: entries.rows.map((r) => ({ id: String(r.id), total_price: r.total_price as number | string | null, version_id: (r.version_id as string | null) ?? null, fixture_types: (r.fixture_types as { name: string } | null) ?? null })),
      assignments: assignments.rows.map((r) => ({ price_book_version_id: String(r.price_book_version_id), count_row_id: String(r.count_row_id), price_book_entry_id: String(r.price_book_entry_id), is_fixed_price: (r.is_fixed_price as boolean | null) ?? null, unit_price_override: r.unit_price_override == null ? null : Number(r.unit_price_override) })),
      customPrices: customPrices.rows.map((r) => ({ price_book_version_id: String(r.price_book_version_id), count_row_id: String(r.count_row_id), unit_price: r.unit_price as number | string })),
      hides: hides as unknown as Parameters<typeof scenarioPricingRows>[0]['hides'],
    })
    const priced = result.rows.filter((r) => r.priced).length
    const total = round2(result.totalRevenue)
    const where = `${open.name ? `"${open.name}"` : 'the open pricing'}${open.target.kind === 'shared' ? ', a shared price book' : open.target.kind === 'robot' ? ', the robots\' book' : ''}${open.versionName ? ` on the version "${open.versionName}"` : ''}`
    const parts = [
      `${money(total)} — the Pricing grid's revenue total, from ${where}: ${priced} of ${result.rows.length} count rows priced.`,
      open.viewerDependent ? 'The bid has no pricing of its own: the tab opens it on the viewer\'s last-used book, else "Default"; this is "Default"\'s answer.' : '',
      estimate.length ? '' : 'The bid has no labor estimate, so the tab shows its start panel instead of this grid until one is made.',
      stamp ? `The tab last stamped a ${stamp.margin_pct}% margin${stamp.on ? ` on ${stamp.on}` : ''}; cost and margin are the tab's to compute.` : 'Cost and margin are the tab\'s to compute (they read the company crew rate when the bid has no labor rate).',
    ].filter(Boolean)
    return { priced_revenue_usd: total, words: parts.join(' '), pricing, rows: { counted: result.rows.length, priced, unpriced: result.rows.length - priced }, last_stamped: stamp, held }
  } catch (e) {
    held.push(`the pricing rows: ${e instanceof Error ? e.message : String(e)}`)
    return answer(`Not stated: ${held.join('; ')}.`, { pricing })
  }
}
