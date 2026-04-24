import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchAttributionsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'

type MtSelect = {
  posted_at: string | null
  counterparty_name: string | null
  amount: number
  note: string | null
  external_memo: string | null
  mercury_account_id: string
  raw: Database['public']['Tables']['mercury_transactions']['Row']['raw']
}

/** Same shape as JobSummaryMercuryAllocationRow in Jobs.tsx (for card breakdown + UI). */
export type MercuryJobAllocationWithAttributionRow = {
  id: string
  amount: number
  note: string | null
  /** Needed to open alloc modal or dedupe by transaction. */
  mercury_transaction_id: string
  attributionDisplayName: string | null
  mercury_transactions: MtSelect | null
}

type RawAlloc = {
  id: string
  amount: number
  note: string | null
  mercury_transaction_id: string
  mercury_transactions: MtSelect | null
}

/**
 * Loads Mercury job allocations for one job and resolves `attributionDisplayName`
 * from `mercury_transaction_attributions` + `people` / `users` names.
 * Mirrors Job Summary’s client logic.
 */
export async function fetchMercuryJobAllocationsWithAttributionForJob(
  jobId: string,
  operationLabel: string,
): Promise<MercuryJobAllocationWithAttributionRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('mercury_transaction_job_allocations')
        .select(
          'id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, note, external_memo, mercury_account_id, raw)',
        )
        .eq('job_id', jobId)
        .order('created_at', { ascending: true }),
    `${operationLabel} mercury allocations`,
  )
  const rawRows = (data ?? []) as RawAlloc[]
  const attrByTxId = new Map<string, { person_id: string | null; user_id: string | null }>()
  const personNameById = new Map<string, string>()
  const userNameById = new Map<string, string>()
  try {
    const txIds = [...new Set(rawRows.map((r) => r.mercury_transaction_id))]
    if (txIds.length > 0) {
      const attrRows = await fetchAttributionsByMercuryTxIds(txIds, `${operationLabel} mercury attr`)
      for (const a of attrRows) {
        attrByTxId.set(a.mercury_transaction_id, {
          person_id: a.person_id,
          user_id: a.user_id,
        })
      }
      const personIds = new Set<string>()
      const userIds = new Set<string>()
      for (const a of attrRows) {
        if (a.person_id) personIds.add(a.person_id)
        if (a.user_id) userIds.add(a.user_id)
      }
      if (personIds.size > 0) {
        const peopleData = await withSupabaseRetry(
          async () => supabase.from('people').select('id, name').in('id', [...personIds]),
          `${operationLabel} mercury people`,
        )
        for (const p of peopleData ?? []) {
          const row = p as { id: string; name: string }
          personNameById.set(row.id, row.name)
        }
      }
      if (userIds.size > 0) {
        const usersData = await withSupabaseRetry(
          async () => supabase.from('users').select('id, name').in('id', [...userIds]),
          `${operationLabel} mercury users`,
        )
        for (const u of usersData ?? []) {
          const row = u as { id: string; name: string }
          userNameById.set(row.id, row.name)
        }
      }
    }
  } catch {
    /* show allocations; names may be missing */
  }
  return rawRows.map((r) => {
    const attr = attrByTxId.get(r.mercury_transaction_id)
    let attributionDisplayName: string | null = null
    if (attr) {
      if (attr.person_id) attributionDisplayName = personNameById.get(attr.person_id) ?? null
      else if (attr.user_id) attributionDisplayName = userNameById.get(attr.user_id) ?? null
    }
    return {
      id: r.id,
      amount: r.amount,
      note: r.note,
      mercury_transaction_id: r.mercury_transaction_id,
      mercury_transactions: r.mercury_transactions,
      attributionDisplayName,
    }
  })
}
