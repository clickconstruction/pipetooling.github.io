/**
 * Reads and writes for one filed price (punch list #308, PR 3): the RPCs `price_row_file` and
 * `price_row_take_back`, the price a part holds at a house, and the houses a bid asked for prices.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { PricingUnit } from './pastedRow'
import type { OnFilePrice, PriceSource } from './rowCard'

// The RPCs and the new columns are not in the generated types until the types PR that follows their push.
type Db = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type CameBy = 'sheet' | 'pasted' | 'phone' | 'counter' | 'mail' | 'website'

export type FilePriceInput = {
  supplyHouseId: string
  partId: string
  /** The price as printed. Null only for a row of a sheet with no price of its own: it says which part it is. */
  unitPrice: number | null
  pricingUnit?: PricingUnit
  /** How many book units the printed price covers, when a person answered the unit question. */
  unitFactor?: number
  datedOn?: string
  houseCode?: string
  mfrNumber?: string
  description?: string
  cameBy: CameBy
  bidId?: string | null
  number?: string
  matchedHow?: 'crosswalk' | 'mfr_number' | 'description' | 'person'
  /** A row of a sheet already read, in place of a one-off paper. */
  lineId?: string
  /** A person looked at a move past a quarter and said file it. */
  allowBigMove?: boolean
  /** A person said file an older paper over a newer price. */
  allowOlder?: boolean
}

export type FilePriceResult =
  | { ok: true; filed: true; lineId: string; paperId: string; /** Null when the row carried no price. */ price: number | null; datedOn: string; was: OnFilePrice | null }
  | { ok: true; filed: false; why: 'moved' | 'newer_on_file'; price: number; onFile: OnFilePrice }
  | { ok: false; error: string; notLive: boolean }

const isMissingFunction = (e: { code?: string | null; message?: string | null } | null): boolean =>
  e != null && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|function .* does not exist/i.test(e.message ?? ''))

const onFileOf = (j: unknown): OnFilePrice | null => {
  const o = j as { price?: number | string; effective_date?: string | null } | null
  return o && o.price != null ? { price: Number(o.price), effectiveDate: o.effective_date ?? null } : null
}

/** File one price. The database refuses a big move or an older paper unless the flags say a person looked. */
export async function filePriceRow(supabase: Db, input: FilePriceInput): Promise<FilePriceResult> {
  const { data, error } = await supabase.rpc('price_row_file', {
    p: {
      supply_house_id: input.supplyHouseId,
      part_id: input.partId,
      unit_price: input.unitPrice,
      pricing_unit: input.pricingUnit ?? 'each',
      unit_factor: input.unitFactor ?? null,
      dated_on: input.datedOn ?? null,
      house_code: input.houseCode ?? '',
      mfr_number: input.mfrNumber ?? '',
      description: input.description ?? '',
      came_by: input.cameBy,
      bid_id: input.bidId ?? null,
      number: input.number ?? '',
      matched_how: input.matchedHow ?? null,
      line_id: input.lineId ?? null,
      allow_big_move: input.allowBigMove === true,
      allow_older: input.allowOlder === true,
    },
  })
  if (error) {
    const notLive = isMissingFunction(error)
    return { ok: false, notLive, error: notLive ? 'Filing a price is not switched on yet. It arrives with the next database update.' : formatErrorMessage(error, 'The price could not be filed') }
  }
  const j = (data ?? {}) as Record<string, unknown>
  if (j.filed === true) {
    return { ok: true, filed: true, lineId: String(j.line_id), paperId: String(j.paper_id), price: j.price == null ? null : Number(j.price), datedOn: String(j.dated_on), was: onFileOf(j.was) }
  }
  return { ok: true, filed: false, why: j.why === 'newer_on_file' ? 'newer_on_file' : 'moved', price: Number(j.price), onFile: onFileOf(j.on_file) ?? { price: 0, effectiveDate: null } }
}

export type TakeBackResult = { ok: true; restored: boolean; why: 'changed_since' | 'not_filed' | null } | { ok: false; error: string }

/** Take one filed price back: the book returns to what it held, unless someone changed the price since. */
export async function takeBackPriceRow(supabase: Db, lineId: string): Promise<TakeBackResult> {
  const { data, error } = await supabase.rpc('price_row_take_back', { p_line_id: lineId })
  if (error) return { ok: false, error: formatErrorMessage(error, 'The price could not be taken back') }
  const j = (data ?? {}) as { restored?: boolean; why?: string }
  return { ok: true, restored: j.restored === true, why: j.restored === true ? null : j.why === 'not_filed' ? 'not_filed' : 'changed_since' }
}

/** What the book holds for these parts at one house, by part id. */
export async function loadOnFilePrices(supabase: Db, supplyHouseId: string, partIds: string[]): Promise<Map<string, OnFilePrice>> {
  const out = new Map<string, OnFilePrice>()
  const ids = [...new Set(partIds)]
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('part_id,price,effective_date')
      .eq('supply_house_id', supplyHouseId)
      .in('part_id', ids.slice(i, i + 150))
    if (error) throw new Error(formatErrorMessage(error, 'The prices on file could not be read'))
    for (const r of (data ?? []) as { part_id: string; price: number | string; effective_date: string | null }[]) {
      out.set(r.part_id, { price: Number(r.price), effectiveDate: r.effective_date })
    }
  }
  return out
}

/** The supply houses a bid asked for prices, the most recent first, each once. */
export async function loadBidAskedHouseIds(supabase: Db, bidId: string): Promise<string[]> {
  const { data, error } = await supabase.from('bid_rfqs').select('supply_house_id,created_at').eq('bid_id', bidId).order('created_at', { ascending: false })
  if (error) return []
  const out: string[] = []
  for (const r of (data ?? []) as { supply_house_id: string | null }[]) if (r.supply_house_id && !out.includes(r.supply_house_id)) out.push(r.supply_house_id)
  return out
}

/** Where each of a part's prices came from, by price row id. Empty until the columns are live. */
export async function loadPriceSources(supabase: Db, partId: string): Promise<Map<string, PriceSource>> {
  const out = new Map<string, PriceSource>()
  const { data, error } = await supabase
    .from('material_part_prices')
    .select('id, source:supply_paper_lines!source_line_id(filed_price, replaced_price, paper:supply_papers(came_by, kind, number, valid_until))')
    .eq('part_id', partId)
    .not('source_line_id', 'is', null)
  if (error) return out
  type Row = { id: string; source: { filed_price: number | string | null; replaced_price: number | string | null; paper: { came_by: string; kind: string; number: string; valid_until: string | null } | null } | null }
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.source?.paper) continue
    out.set(r.id, {
      cameBy: r.source.paper.came_by,
      kind: r.source.paper.kind,
      number: r.source.paper.number,
      validUntil: r.source.paper.valid_until,
      filedPrice: r.source.filed_price != null ? Number(r.source.filed_price) : null,
      replacedPrice: r.source.replaced_price != null ? Number(r.source.replaced_price) : null,
    })
  }
  return out
}
