import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Json } from '../types/database'
import type { DuplicatePair, DuplicateTxLite } from './mercuryDuplicateClusters'

type DuplicateRpcRow = {
  a_id: string
  a_amount: number
  a_counterparty_name: string | null
  a_posted_at: string | null
  a_created_at: string
  a_kind: string
  a_mercury_account_id: string
  a_source: string
  a_raw: Json | null
  b_id: string
  b_amount: number
  b_counterparty_name: string | null
  b_posted_at: string | null
  b_created_at: string
  b_kind: string
  b_mercury_account_id: string
  b_source: string
  b_raw: Json | null
  manual_involved: boolean
  days_apart: number
}

function lite(prefix: 'a' | 'b', row: DuplicateRpcRow): DuplicateTxLite {
  const g = <K extends string>(k: K) => (row as Record<string, unknown>)[`${prefix}_${k}`]
  return {
    id: g('id') as string,
    amount: Number(g('amount')),
    counterpartyName: (g('counterparty_name') as string | null) ?? null,
    postedAt: (g('posted_at') as string | null) ?? null,
    createdAt: g('created_at') as string,
    kind: g('kind') as string,
    mercuryAccountId: g('mercury_account_id') as string,
    source: g('source') as string,
    raw: (g('raw') as Json | null) ?? null,
  }
}

export type FetchDuplicatesOptions = {
  /** Date proximity window in days (default 3). */
  windowDays?: number
  /** Restrict to pairs involving a manual entry (default true — the high-signal set). */
  manualOnly?: boolean
  limit?: number
}

/** Candidate duplicate pairs from the detection RPC, mapped for the clustering kernel. */
export async function fetchMercuryDuplicatePairs(opts: FetchDuplicatesOptions = {}): Promise<DuplicatePair[]> {
  const data = await withSupabaseRetry(
    async () =>
      supabase.rpc('find_possible_duplicate_mercury_transactions', {
        p_window_days: opts.windowDays ?? 3,
        p_manual_only: opts.manualOnly ?? true,
        p_limit: opts.limit ?? 500,
      }),
    'find possible duplicate mercury transactions',
  )
  return ((data ?? []) as DuplicateRpcRow[]).map((row) => ({
    a: lite('a', row),
    b: lite('b', row),
    manualInvolved: row.manual_involved,
    daysApart: Number(row.days_apart),
  }))
}

export type ExcludedDuplicateRow = {
  id: string
  amount: number
  counterpartyName: string | null
  postedAt: string | null
  raw: Json | null
  keeperId: string | null
}

/** Rows currently marked as excluded duplicates (for the undo list). */
export async function fetchExcludedDuplicates(): Promise<ExcludedDuplicateRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      supabase
        .from('mercury_transactions')
        .select('id, amount, counterparty_name, posted_at, raw, duplicate_of_transaction_id')
        .not('duplicate_of_transaction_id', 'is', null)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(500),
    'fetch excluded duplicate mercury transactions',
  )
  return (
    (data ?? []) as {
      id: string
      amount: number
      counterparty_name: string | null
      posted_at: string | null
      raw: Json | null
      duplicate_of_transaction_id: string | null
    }[]
  ).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    counterpartyName: r.counterparty_name,
    postedAt: r.posted_at,
    raw: r.raw,
    keeperId: r.duplicate_of_transaction_id,
  }))
}

export async function markMercuryTransactionDuplicate(duplicateId: string, keeperId: string): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.rpc('set_mercury_transaction_duplicate', {
        p_duplicate_id: duplicateId,
        p_keeper_id: keeperId,
      }),
    'set mercury transaction duplicate',
  )
}

export async function clearMercuryTransactionDuplicate(id: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.rpc('clear_mercury_transaction_duplicate', { p_id: id }),
    'clear mercury transaction duplicate',
  )
}

export async function dismissMercuryDuplicatePair(idA: string, idB: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.rpc('dismiss_mercury_duplicate_pair', { p_id_a: idA, p_id_b: idB }),
    'dismiss mercury duplicate pair',
  )
}
