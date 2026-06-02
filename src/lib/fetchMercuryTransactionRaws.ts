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

export type MercuryUserReviewTxMeta = {
  /** raw.bankDescription (the bank-line text). */
  bankDescription: string | null
  /** Lowercased raw.details.debitCardInfo.id, for nickname lookup. */
  debitCardId: string | null
}

/**
 * Fetch a few small fields out of each transaction's `raw` jsonb, by id — currently the
 * `bankDescription` line and the debit-card id — by PROJECTING those jsonb fields server-side
 * so we don't pull the whole large `raw` blob. Chunked + parallel like the raw fetch.
 * Used by the User Review cell modal (which doesn't hydrate `raw`).
 */
export async function fetchMercuryUserReviewTxMetaByTxIds(
  ids: string[],
  operationName: string,
): Promise<Map<string, MercuryUserReviewTxMeta>> {
  const map = new Map<string, MercuryUserReviewTxMeta>()
  if (ids.length === 0) return map
  const slices: string[][] = []
  for (let i = 0; i < ids.length; i += RAW_FETCH_CHUNK) {
    slices.push(ids.slice(i, i + RAW_FETCH_CHUNK))
  }
  await Promise.all(
    slices.map(async (slice) => {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transactions')
            .select('id, bankDescription:raw->>bankDescription, debitCardId:raw->details->debitCardInfo->>id')
            .in('id', slice),
        operationName,
      )
      for (const row of (data ?? []) as unknown as Array<{
        id: string
        bankDescription: string | null
        debitCardId: string | null
      }>) {
        const bd = row.bankDescription
        const bankDescription = bd != null && String(bd).trim() !== '' ? String(bd).trim() : null
        const cid = row.debitCardId
        const debitCardId =
          cid != null && String(cid).trim() !== '' ? String(cid).trim().toLowerCase() : null
        map.set(row.id, { bankDescription, debitCardId })
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
