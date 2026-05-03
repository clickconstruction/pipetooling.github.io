import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

export type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/** PostgREST `select` for Banking list loads — omits `raw` (large JSON) until hydrated. */
export const MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS =
  'amount,counterparty_id,counterparty_name,created_at,currency,dashboard_link,external_memo,id,kind,mercury_account_id,mercury_category,mercury_id,note,posted_at,status,synced_at' as const

const RAW_FETCH_CHUNK = 400

/** Row was loaded without `raw`; expand / Drag Sort / debit-card modals need it. */
export function mercuryRowNeedsRawHydration(r: MercuryTxRow): boolean {
  return !('raw' in r) || r.raw === undefined
}

export function applyMercuryRawPatch(rows: MercuryTxRow[], patch: Map<string, MercuryTxRow['raw'] | null>): MercuryTxRow[] {
  if (patch.size === 0) return rows
  return rows.map((r) => {
    if (!patch.has(r.id)) return r
    return { ...r, raw: patch.get(r.id) ?? null }
  })
}

export async function fetchMercuryTransactionRawsByIds(
  ids: string[],
  operationName: string,
): Promise<Map<string, MercuryTxRow['raw'] | null>> {
  const map = new Map<string, MercuryTxRow['raw'] | null>()
  if (ids.length === 0) return map
  const slices: string[][] = []
  for (let i = 0; i < ids.length; i += RAW_FETCH_CHUNK) {
    slices.push(ids.slice(i, i + RAW_FETCH_CHUNK))
  }
  await Promise.all(
    slices.map(async (slice) => {
      const data = await withSupabaseRetry(async () => {
        return supabase.from('mercury_transactions').select('id, raw').in('id', slice)
      }, operationName)
      for (const row of (data ?? []) as Pick<MercuryTxRow, 'id' | 'raw'>[]) {
        map.set(row.id, row.raw ?? null)
      }
    }),
  )
  return map
}

export async function fetchMercuryTransactionRawById(
  txId: string,
  operationName: string,
): Promise<MercuryTxRow['raw'] | null> {
  const data = await withSupabaseRetry(async () => {
    return supabase.from('mercury_transactions').select('raw').eq('id', txId).maybeSingle()
  }, operationName)
  const row = data as { raw: MercuryTxRow['raw'] | null } | null
  if (row == null) return null
  return row.raw ?? null
}
