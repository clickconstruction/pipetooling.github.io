/**
 * A site's own prices (punch list #342, PR 2): the reads and the two writes of `on_site_prices`
 * (migration 20261113160000). The table's own rules decide who: the roles that read the desk with
 * its money read and write it, and an answer is undone by deleting its row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import type { TieScope } from './partTiesIo'
import type { SitePrice } from './sitePrices'

// The table is younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

type Row = { id: string; development_id: string | null; job_id: string | null; row_key: string; row_name: string; kind: 'price' | 'left_out'; unit_price: number | string | null; source: 'typed' | 'bill' | 'book'; source_line_id: string | null; source_words: string; priced_on: string; by_name: string; at: string }
const COLS = 'id, development_id, job_id, row_key, row_name, kind, unit_price, source, source_line_id, source_words, priced_on, by_name, at'
const priceOf = (r: Row): SitePrice => ({ id: r.id, rowKey: r.row_key, rowName: r.row_name, kind: r.kind, unitPrice: r.unit_price == null ? null : Number(r.unit_price), source: r.source, sourceLineId: r.source_line_id, sourceWords: r.source_words, pricedOn: (r.priced_on ?? '').slice(0, 10), byName: r.by_name, at: r.at })

/** The scope a row belongs to, as the store keys it: `d:<development id>` or `j:<job id>`. */
export function scopeKeyOf(scope: TieScope): string {
  return 'developmentId' in scope ? `d:${scope.developmentId}` : `j:${scope.jobId}`
}

/** Every answer the reader may see, by scope. The table is small: a site's answers are its rows. */
export async function fetchAllSitePrices(): Promise<Map<string, SitePrice[]>> {
  // Paged, as every on-site read is since v2.7160: an un-ranged answer is cut at 1,000 rows without a word.
  const data = await fetchAllRows<Row>((from, to) => db.from('on_site_prices').select(COLS).order('at').order('id').range(from, to), 'read the prices set on site')
  const out = new Map<string, SitePrice[]>()
  for (const r of data) {
    const key = r.development_id ? `d:${r.development_id}` : `j:${r.job_id}`
    const list = out.get(key)
    if (list) list.push(priceOf(r))
    else out.set(key, [priceOf(r)])
  }
  return out
}

/** What a new answer carries. A row left out has no price and no source. */
export type SitePriceInput = { rowKey: string; rowName: string } & ({ kind: 'price'; unitPrice: number; source: 'typed' | 'bill' | 'book'; sourceLineId?: string | null; sourceWords?: string; pricedOn: string } | { kind: 'left_out'; pricedOn: string })

export async function insertSitePrice(scope: TieScope, input: SitePriceInput, byName: string): Promise<SitePrice> {
  const { data, error } = await db
    .from('on_site_prices')
    .insert({
      ...('developmentId' in scope ? { development_id: scope.developmentId } : { job_id: scope.jobId }),
      row_key: input.rowKey,
      row_name: input.rowName.slice(0, 200),
      kind: input.kind,
      unit_price: input.kind === 'price' ? input.unitPrice : null,
      source: input.kind === 'price' ? input.source : 'typed',
      source_line_id: input.kind === 'price' ? (input.sourceLineId ?? null) : null,
      source_words: input.kind === 'price' ? (input.sourceWords ?? '').slice(0, 300) : '',
      priced_on: input.pricedOn,
      by_name: byName.slice(0, 120),
    })
    .select(COLS)
    .single()
  if (error) throw error
  return priceOf(data as Row)
}

export async function deleteSitePrice(id: string): Promise<void> {
  const { error } = await db.from('on_site_prices').delete().eq('id', id)
  if (error) throw error
}

/** The `same` ties the reader may see, by scope: the store prices a job's lines through its site's ties. */
export async function fetchAllSameTies(): Promise<Map<string, Array<{ id: string; aKey: string; bKey: string; aName: string; bName: string; verdict: 'same'; byName: string; at: string }>>> {
  type TieDb = { id: string; development_id: string | null; job_id: string | null; a_key: string; b_key: string; a_name: string; b_name: string; by_name: string; at: string }
  const data = await fetchAllRows<TieDb>((from, to) => db.from('on_site_part_ties').select('id, development_id, job_id, a_key, b_key, a_name, b_name, by_name, at').eq('verdict', 'same').order('at').order('id').range(from, to), 'read the names joined on site')
  const out = new Map<string, Array<{ id: string; aKey: string; bKey: string; aName: string; bName: string; verdict: 'same'; byName: string; at: string }>>()
  for (const r of data) {
    const key = r.development_id ? `d:${r.development_id}` : `j:${r.job_id}`
    const tie = { id: r.id, aKey: r.a_key, bKey: r.b_key, aName: r.a_name, bName: r.b_name, verdict: 'same' as const, byName: r.by_name, at: r.at }
    const list = out.get(key)
    if (list) list.push(tie)
    else out.set(key, [tie])
  }
  return out
}

/** Each job's site: its development, or itself when it is on none (or the ledger row is not the reader's to see). */
export async function fetchJobScopes(jobIds: ReadonlyArray<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>(jobIds.map((id) => [id, `j:${id}`] as const))
  if (jobIds.length === 0) return out
  const { data, error } = await db.from('jobs_ledger').select('id, development_id').in('id', [...jobIds])
  if (error) throw error
  for (const r of (data ?? []) as Array<{ id: string; development_id: string | null }>) if (r.development_id) out.set(r.id, `d:${r.development_id}`)
  return out
}
