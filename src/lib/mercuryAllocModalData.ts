import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchAttributionsByMercuryTxIds, fetchJobAllocationsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'
import type { MercuryJobSplit } from '../components/MercuryTransactionAllocationsModal'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

async function fetchMercuryNicknameMaps(operationLabel: string): Promise<{
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
}> {
  const empty: {
    nicknameByAccount: Record<string, string>
    nicknameByDebitCard: Record<string, string>
  } = { nicknameByAccount: {}, nicknameByDebitCard: {} }
  try {
    const [accRaw, debRaw] = await Promise.all([
      withSupabaseRetry(
        async () => supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname'),
        `${operationLabel} mercury_account_nicknames`,
      ),
      withSupabaseRetry(
        async () => supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname'),
        `${operationLabel} mercury_debit_card_nicknames`,
      ),
    ])
    const nicknameByAccount: Record<string, string> = {}
    const nicknameByDebitCard: Record<string, string> = {}
    const accList =
      (accRaw ?? []) as Pick<
        Database['public']['Tables']['mercury_account_nicknames']['Row'],
        'mercury_account_id' | 'nickname'
      >[]
    for (const row of accList) nicknameByAccount[row.mercury_account_id] = row.nickname
    const debList =
      (debRaw ?? []) as Pick<
        Database['public']['Tables']['mercury_debit_card_nicknames']['Row'],
        'mercury_debit_card_id' | 'nickname'
      >[]
    for (const row of debList) {
      nicknameByDebitCard[String(row.mercury_debit_card_id).toLowerCase()] = row.nickname
    }
    return { nicknameByAccount, nicknameByDebitCard }
  } catch {
    return empty
  }
}

export type MercuryAllocModalData = {
  fullTx: MercuryTxRow
  initialAllocations: MercuryJobSplit[]
  initialPersonId: string | null
  initialUserId: string | null
  jobLabelById: Record<string, string>
  legacyPersonDisplayName: string | null
  nicknameByDebitCard: Record<string, string>
  nicknameByAccount: Record<string, string>
}

/**
 * Loads everything needed to open MercuryTransactionAllocationsModal for one transaction
 * (matches Banking’s loadMercuryAllocations shape for a single row).
 */
export async function loadMercuryAllocModalDataForTransaction(
  mercuryTransactionId: string,
  operationLabel: string,
): Promise<MercuryAllocModalData> {
  const [fullTxRow, allocRows, attrRows, nickMaps] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase.from('mercury_transactions').select('*').eq('id', mercuryTransactionId).maybeSingle(),
      `${operationLabel} mercury_transactions full row`,
    ),
    fetchJobAllocationsByMercuryTxIds([mercuryTransactionId], `${operationLabel} job allocs`),
    fetchAttributionsByMercuryTxIds([mercuryTransactionId], `${operationLabel} attrs`),
    fetchMercuryNicknameMaps(operationLabel),
  ])

  const fullTx = fullTxRow as MercuryTxRow | null
  if (!fullTx) {
    throw new Error('Mercury transaction not found or no access.')
  }

  const initialAllocations: MercuryJobSplit[] = []
  for (const row of allocRows) {
    if (row.mercury_transaction_id !== mercuryTransactionId) continue
    const split: MercuryJobSplit = { job_id: row.job_id, amount: Number(row.amount) }
    if (row.note != null && row.note !== '') split.note = row.note
    initialAllocations.push(split)
  }

  let initialPersonId: string | null = null
  let initialUserId: string | null = null
  for (const row of attrRows) {
    if (row.mercury_transaction_id === mercuryTransactionId) {
      initialPersonId = row.person_id
      initialUserId = row.user_id
      break
    }
  }

  const jobIds = [...new Set(allocRows.map((r) => r.job_id))]
  const jobLabelById: Record<string, string> = {}
  if (jobIds.length > 0) {
    const jobRowsData = await withSupabaseRetry(
      async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
      `${operationLabel} jobs_ledger labels`,
    )
    for (const j of jobRowsData ?? []) {
      const row = j as { id: string; hcp_number?: string | null; job_name?: string | null }
      const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
      jobLabelById[row.id] = label || row.id
    }
  }

  let legacyPersonDisplayName: string | null = null
  if (initialPersonId && !initialUserId) {
    const p = await withSupabaseRetry(
      async () => supabase.from('people').select('id, name').eq('id', initialPersonId).maybeSingle(),
      `${operationLabel} legacy person name`,
    )
    const pr = p as { id: string; name: string } | null
    legacyPersonDisplayName = pr?.name ?? null
  }

  return {
    fullTx,
    initialAllocations,
    initialPersonId,
    initialUserId,
    jobLabelById,
    legacyPersonDisplayName,
    nicknameByDebitCard: nickMaps.nicknameByDebitCard,
    nicknameByAccount: nickMaps.nicknameByAccount,
  }
}
