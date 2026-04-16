import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { computeEstimateLineExtendedCents } from './estimateLineItemNormalize'
import type { EstimateCatalogLineItem } from './estimateLineItemCatalog'

export type EstimateCatalogItemRow = Database['public']['Tables']['estimate_catalog_items']['Row']
export type EstimateCatalogItemEventRow = Database['public']['Tables']['estimate_catalog_item_events']['Row']

export function catalogDbRowsToLineItems(rows: EstimateCatalogItemRow[]): EstimateCatalogLineItem[] {
  return rows.map((r) => {
    const quantity = Number(r.quantity)
    const unit_price_cents = r.unit_price_cents
    const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
    const amount_cents = computeEstimateLineExtendedCents(q, unit_price_cents)
    return {
      id: r.id,
      line_item: r.line_item ?? '',
      description: r.description,
      quantity: q,
      unit_price_cents,
      amount_cents,
    }
  })
}

export type EstimateCatalogReplaceRow = {
  id?: string | null
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
}

/** Payload rows for `replace_estimate_catalog_payload` (order = sort_order). */
export function buildReplaceCatalogPayload(rows: EstimateCatalogReplaceRow[]): EstimateCatalogReplaceRow[] {
  const out: EstimateCatalogReplaceRow[] = []
  for (const r of rows) {
    const line_item = r.line_item.trim()
    const description = r.description.trim()
    let quantity = Number(r.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
    const unit_price_cents = Math.max(0, Math.round(Number(r.unit_price_cents) || 0))
    const amount_cents = computeEstimateLineExtendedCents(quantity, unit_price_cents)
    if (line_item === '' && description === '' && amount_cents === 0) continue
    const o: EstimateCatalogReplaceRow = { line_item, description, quantity, unit_price_cents }
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (id) o.id = id
    out.push(o)
  }
  return out
}

export async function fetchEstimateCatalogLive(
  client: SupabaseClient<Database>,
): Promise<EstimateCatalogItemRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await client.from('estimate_catalog_items').select('*').is('deleted_at', null).order('sort_order', { ascending: true }),
    'load estimate catalog',
  )
  return (data ?? []) as EstimateCatalogItemRow[]
}

export async function fetchEstimateCatalogEvents(
  client: SupabaseClient<Database>,
  itemId: string,
): Promise<EstimateCatalogItemEventRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await client
        .from('estimate_catalog_item_events')
        .select('*')
        .eq('item_id', itemId)
        .order('edited_at', { ascending: false }),
    'load estimate catalog events',
  )
  return (data ?? []) as EstimateCatalogItemEventRow[]
}

export async function replaceEstimateCatalogFromPayload(
  client: SupabaseClient<Database>,
  rows: EstimateCatalogReplaceRow[],
): Promise<void> {
  const payload = buildReplaceCatalogPayload(rows) as unknown as Json
  await withSupabaseRetry(
    async () => await client.rpc('replace_estimate_catalog_payload', { p_payload: payload }),
    'replace estimate catalog',
  )
}

export async function loadEditorDisplayByUserId(
  client: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds)].filter(Boolean)
  const out = new Map<string, string>()
  if (uniq.length === 0) return out
  const data = await withSupabaseRetry(
    async () => await client.from('users').select('id, name, email').in('id', uniq),
    'load users for catalog history',
  )
  for (const u of (data ?? []) as { id: string; name: string | null; email: string | null }[]) {
    out.set(u.id, u.name?.trim() || u.email?.trim() || u.id)
  }
  return out
}
