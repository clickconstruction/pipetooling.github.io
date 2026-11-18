import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'

/**
 * The fixture lines under each bid on Documents → Bids (and the Search tab's Bids section, whose search reads them).
 *
 * The page lists up to 200 bids and used to read their count rows in ONE un-ranged `.in('bid_id', …)`. PostgREST
 * answers an un-ranged read with at most `max_rows` (1,000) rows and a 200, so once those bids carried more than
 * 1,000 count rows between them the rest were simply missing: a bid further down the list showed too few fixture
 * lines or none, and a search for one of its fixtures did not find it. The `[row-cap] bids_count_rows` tripwire fired
 * on the page on 2026-11-17. Both reads here go through `fetchAllRowsChunkedIn`: chunked `.in()`, each chunk paged
 * under an order that ends on `id`, so pages do not shuffle between requests.
 */

type Client = SupabaseClient<Database>

export type DocumentsBidCountRow = { bid_id: string; bid_version_id: string | null; fixture: string | null; count: number | string | null }
export type DocumentsBidVersionRow = { id: string; bid_id: string; sort_order?: number | null }
export type DocumentsBidCountLine = { fixture: string; count: number }

/**
 * Every count row and every version of `bidIds`, read whole. A bid's rows all come from one chunk, in
 * `sequence_order` then `id`, and a bid's versions in `sort_order` then `id`, so each bid's own order is the
 * display order. Throws DatabaseError on any page error: a failure is never "no count rows".
 */
export async function loadDocumentsBidCountRows(
  supabase: Client,
  bidIds: ReadonlyArray<string>,
): Promise<{ countRows: DocumentsBidCountRow[]; versions: DocumentsBidVersionRow[] }> {
  const ids = [...bidIds]
  const [countRows, versions] = await Promise.all([
    fetchAllRowsChunkedIn<DocumentsBidCountRow, string>(
      ids,
      (chunk, from, to) =>
        supabase
          .from('bids_count_rows')
          .select('bid_id, bid_version_id, fixture, count')
          .in('bid_id', chunk)
          .order('sequence_order', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'load documents bid count rows',
    ),
    fetchAllRowsChunkedIn<DocumentsBidVersionRow, string>(
      ids,
      (chunk, from, to) =>
        supabase
          .from('bid_versions')
          .select('id, bid_id, sort_order')
          .in('bid_id', chunk)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'load documents bid versions',
    ),
  ])
  return { countRows, versions }
}

/**
 * Counts are per version (v2.2132): each bid shows the rows of its ACTIVE version, which is its saved choice, else
 * its first version, else the unsplit rows (no version). Pure. A bid with no row of that version is absent.
 */
export function documentsBidCountLinesByBid(
  bids: ReadonlyArray<{ id: string; selected_bid_version_id: string | null }>,
  versions: ReadonlyArray<DocumentsBidVersionRow>,
  countRows: ReadonlyArray<DocumentsBidCountRow>,
): Map<string, DocumentsBidCountLine[]> {
  const firstVersionByBid = new Map<string, string>()
  for (const v of versions) if (!firstVersionByBid.has(v.bid_id)) firstVersionByBid.set(v.bid_id, v.id)
  const wantedVersionByBid = new Map<string, string | null>()
  for (const b of bids) wantedVersionByBid.set(b.id, b.selected_bid_version_id ?? firstVersionByBid.get(b.id) ?? null)
  const byBid = new Map<string, DocumentsBidCountLine[]>()
  for (const row of countRows) {
    if ((row.bid_version_id ?? null) !== (wantedVersionByBid.get(row.bid_id) ?? null)) continue
    const lines = byBid.get(row.bid_id) ?? []
    lines.push({ fixture: row.fixture ?? '', count: Number(row.count) })
    byBid.set(row.bid_id, lines)
  }
  return byBid
}
