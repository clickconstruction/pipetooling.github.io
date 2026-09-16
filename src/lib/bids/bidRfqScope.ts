/**
 * The scope a price request carries when it is sent from Edit Bid's Price
 * requests table (PR 2 of the loop, v2.3526): the bid's count rows as the
 * email's item list — the same `{ lines, text }` shape Pricing's Supply house
 * list hands `RfqComposeModal`, built with the same price-free text builder.
 *
 * Reads the bid's BASE rows (`bid_version_id` null); when the Base has nothing
 * counted (21 of 287 bids on prod keep their counts only on a named version)
 * it falls back to the newest version's rows. Pricing, where a version is
 * chosen, still sends that version's counts; the guide says so.
 */
import { supabase } from '../supabase'
import { buildBidFixtureCountsText } from '../buildBidFixtureCountsText'

export type RfqScopeLine = { fixture: string; count: number; unit?: string | null }
export type RfqScope = { lines: RfqScopeLine[]; text: string }

export type RfqScopeCountRow = { fixture: string | null; count: number | string | null; unit?: string | null }

/** Pure: usable rows (a name and a positive count) → the lines and the list text. */
export function rfqScopeFromCountRows(bidLabel: string, rows: ReadonlyArray<RfqScopeCountRow>): RfqScope {
  const lines: RfqScopeLine[] = []
  for (const r of rows) {
    const fixture = (r.fixture ?? '').trim()
    const count = Number(r.count)
    if (!fixture || !Number.isFinite(count) || count <= 0) continue
    lines.push({ fixture, count, unit: r.unit ?? null })
  }
  return { lines, text: buildBidFixtureCountsText({ bidLabel, rows: lines }) }
}

/** The bid's Base count rows, shaped for `send-rfq-email`. Throws on a read error. */
export async function loadBidRfqScope(bidId: string, bidLabel: string): Promise<RfqScope> {
  const base = await supabase.from('bids_count_rows').select('fixture, count, unit').eq('bid_id', bidId).is('bid_version_id', null)
  if (base.error) throw base.error
  const fromBase = rfqScopeFromCountRows(bidLabel, (base.data ?? []) as RfqScopeCountRow[])
  if (fromBase.lines.length > 0) return fromBase
  const version = await supabase.from('bid_versions').select('id').eq('bid_id', bidId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const versionId = (version.data as { id: string } | null)?.id ?? null
  if (!versionId) return fromBase
  const rows = await supabase.from('bids_count_rows').select('fixture, count, unit').eq('bid_id', bidId).eq('bid_version_id', versionId)
  if (rows.error) throw rows.error
  return rfqScopeFromCountRows(bidLabel, (rows.data ?? []) as RfqScopeCountRow[])
}
