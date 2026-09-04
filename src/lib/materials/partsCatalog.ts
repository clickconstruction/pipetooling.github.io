import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'

/**
 * Paged loaders for the parts catalog (v2.2755).
 *
 * PostgREST caps every un-ranged select at `max_rows` (1,000) with NO error.
 * The Plumbing catalog crossed 1,000 parts in June 2026, so every surface that
 * pulled "all parts for the service type" in one query silently lost the tail
 * of the alphabet: the Takeoffs row search said "No parts match" for parts
 * that existed, and saved rows whose part fell past the cap rendered blank —
 * which read as "Add part isn't saving" and produced duplicate parts when
 * people retried. Every whole-catalog read goes through here now; the
 * `.order('name').order('id')` pair keeps pages stable between requests.
 */

type Client = SupabaseClient<Database>

/** The Takeoffs/Materials default projection: the part plus its type row. */
export const PARTS_CATALOG_SELECT = '*, part_types(*)'

/** Every part for one service type, ordered by name. Throws on any page error. */
export async function loadPartsCatalog<T>(
  supabase: Client,
  serviceTypeId: string,
  select: string = PARTS_CATALOG_SELECT,
): Promise<T[]> {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from('material_parts')
        .select(select)
        .eq('service_type_id', serviceTypeId)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    'load parts catalog',
  )
}

/** Every part across every service type (the Duplicates page). Throws on any page error. */
export async function loadWholePartsCatalog<T>(supabase: Client, select: string = '*'): Promise<T[]> {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from('material_parts')
        .select(select)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    'load whole parts catalog',
  )
}

/** Specific parts by id (chunked `.in()`, paged per chunk). Returns [] for no ids. */
export async function loadPartsByIds<T>(
  supabase: Client,
  ids: string[],
  select: string = PARTS_CATALOG_SELECT,
): Promise<T[]> {
  return fetchAllRowsChunkedIn<T, string>(
    ids,
    (chunk, from, to) =>
      supabase
        .from('material_parts')
        .select(select)
        .in('id', chunk)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    'load parts by id',
  )
}

/**
 * Every catalog price row, paged. `order` must be a stable column pair; the
 * default (price, then id) matches the Duplicates page's "first row wins is
 * the lowest price" convention.
 */
export async function loadWholePartPricesCatalog<T>(
  supabase: Client,
  select: string,
  order: { column: string; ascending?: boolean } = { column: 'price', ascending: true },
): Promise<T[]> {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from('material_part_prices')
        .select(select)
        .order(order.column, { ascending: order.ascending ?? true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    'load part prices catalog',
  )
}

/**
 * Pure: part ids that rows reference but the loaded catalog doesn't hold —
 * the ids a surface must fetch by id so those rows can still render a name.
 * De-duplicated, input order, null/blank ids skipped.
 */
export function missingPartIds(
  rows: ReadonlyArray<{ partId: string | null }>,
  catalog: ReadonlyArray<{ id: string }>,
): string[] {
  const have = new Set(catalog.map((p) => p.id))
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const id = r.partId?.trim()
    if (!id || have.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Pure: merge parts fetched by id into a name-ordered catalog list without
 * duplicating ids. Returns the same array instance when nothing was added so
 * a state setter can bail out.
 */
export function mergeCatalogParts<T extends { id: string; name: string }>(catalog: T[], extra: T[]): T[] {
  const have = new Set(catalog.map((p) => p.id))
  const fresh = extra.filter((p) => !have.has(p.id))
  if (fresh.length === 0) return catalog
  return [...catalog, ...fresh].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
