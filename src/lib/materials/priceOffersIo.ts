/**
 * The reads behind the price offers (punch list #342, PR 1): the parts book's names and prices,
 * and the priced part lines of every supply house bill (`supply_purchase_lines`, the view that
 * counts only a paper whose lines add up). Each is read whole and in pages, since a read with no
 * range stops at 1,000 rows and says nothing. Asked once, when a person asks to price a site's rows.
 *
 * The two sources are read apart: a role that cannot read the bills still gets the parts book's
 * offers, and the window says which source did not answer. A ZZ test house's lines are left out.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { isZzTestName } from '../jobs/zzTestJobSweep'
import { formatErrorMessage, type SupabaseClientResult } from '../../utils/errorHandling'
import { bookPriceRow, type BookPriceRow } from './bookPrice'
import type { PricingUnit } from './lines/paperChecks'
import type { OfferLine, OfferPart, OfferSources } from './priceOffers'

// The view is read through the plain client, as What we buy reads it.
const db = supabase as unknown as SupabaseClient

/** What was read, and the reason for each source that did not answer. */
export type OfferSourcesRead = { sources: OfferSources; bookError: string | null; billsError: string | null }

const num = (v: number | string | null): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const unitOf = (v: string | null): PricingUnit => (v === 'per_hundred' || v === 'per_thousand' ? v : 'each')

type PriceDb = { part_id: string; price: number; effective_date: string | null; updated_at: string | null; supply_houses: { name: string } | null }

async function readBook(): Promise<{ parts: OfferPart[]; prices: BookPriceRow[] }> {
  const [parts, prices] = await Promise.all([
    fetchAllRows<OfferPart>((from, to) => db.from('material_parts').select('id, name, manufacturer').order('id').range(from, to), 'read the parts book’s names'),
    // The embed is one house a price row (a to-one join); the untyped client reads it as a list.
    fetchAllRows<PriceDb>(
      (from, to) => db.from('material_part_prices').select('part_id, price, effective_date, updated_at, supply_houses(name)').order('id').range(from, to) as unknown as PromiseLike<SupabaseClientResult<PriceDb[]>>,
      'read the parts book’s prices',
    ),
  ])
  return { parts, prices: prices.map(bookPriceRow) }
}

type LineDb = { id: string; supply_house_id: string | null; dated_on: string | null; house_code: string | null; description: string | null; unit: string | null; pricing_unit: string | null; unit_price: number | string | null; quantity: number | string | null; extended_cents: number | null }

async function readBills(): Promise<OfferLine[]> {
  const [lines, houses] = await Promise.all([
    fetchAllRows<LineDb>(
      (from, to) => db.from('supply_purchase_lines').select('id, supply_house_id, dated_on, house_code, description, unit, pricing_unit, unit_price, quantity, extended_cents').eq('line_kind', 'part').order('id').range(from, to),
      'read the supply house bills’ lines',
    ),
    fetchAllRows<{ id: string; name: string | null }>((from, to) => db.from('supply_houses').select('id, name').order('id').range(from, to), 'read the supply houses'),
  ])
  const houseName = new Map(houses.map((h) => [h.id, (h.name ?? '').trim()] as const))
  const out: OfferLine[] = []
  for (const l of lines) {
    const name = l.supply_house_id ? (houseName.get(l.supply_house_id) ?? '') : ''
    if (name && isZzTestName(name)) continue
    out.push({ id: l.id, houseId: l.supply_house_id, houseName: name, datedOn: (l.dated_on ?? '').slice(0, 10) || null, houseCode: (l.house_code ?? '').trim(), description: (l.description ?? '').trim(), unit: (l.unit ?? '').trim(), pricingUnit: unitOf(l.pricing_unit), unitPrice: num(l.unit_price), quantity: num(l.quantity), extendedCents: l.extended_cents })
  }
  return out
}

/** Both sources, each failing by itself. Never throws: a source that did not answer is empty and named. */
export async function loadOfferSources(): Promise<OfferSourcesRead> {
  const [book, bills] = await Promise.allSettled([readBook(), readBills()])
  return {
    sources: { parts: book.status === 'fulfilled' ? book.value.parts : [], prices: book.status === 'fulfilled' ? book.value.prices : [], lines: bills.status === 'fulfilled' ? bills.value : [] },
    bookError: book.status === 'rejected' ? formatErrorMessage(book.reason, 'The parts book did not load.') : null,
    billsError: bills.status === 'rejected' ? formatErrorMessage(bills.reason, 'The supply house bills did not load.') : null,
  }
}
