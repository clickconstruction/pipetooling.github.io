import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { EstimateCatalogLineItem } from './estimateLineItemCatalog'

export type EstimateCatalogItemRow = Database['public']['Tables']['estimate_catalog_items']['Row']
export type EstimateCatalogItemEventRow = Database['public']['Tables']['estimate_catalog_item_events']['Row']

export function catalogDbRowsToLineItems(rows: EstimateCatalogItemRow[]): EstimateCatalogLineItem[] {
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount_cents: r.amount_cents,
  }))
}

/** Payload rows for `replace_estimate_catalog_payload` (order = sort_order). */
export function buildReplaceCatalogPayload(
  rows: Array<{ id?: string | null; description: string; amount_cents: number }>,
): { id?: string; description: string; amount_cents: number }[] {
  return rows
    .filter((r) => r.description.trim() !== '' || r.amount_cents > 0)
    .map((r) => {
      const o: { id?: string; description: string; amount_cents: number } = {
        description: r.description.trim(),
        amount_cents: Math.max(0, Math.round(Number(r.amount_cents) || 0)),
      }
      const id = typeof r.id === 'string' ? r.id.trim() : ''
      if (id) o.id = id
      return o
    })
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
  rows: Array<{ id?: string | null; description: string; amount_cents: number }>,
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
