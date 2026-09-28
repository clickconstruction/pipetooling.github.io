/**
 * The reads and the two writes behind history and reviews on Settings → Contracts & terms
 * (`contractTextHistory.ts` decides what the rows mean). The history is written by database
 * triggers; the only writes here are the office's own review and taking one back.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { ContractTextReview, ContractTextVersion } from './contractTextHistory'

export type ContractHistoryData = {
  versions: ContractTextVersion[]
  reviews: ContractTextReview[]
  /** `users.id` → name, for everyone a version or a review names. */
  names: Map<string, string>
}

export const EMPTY_CONTRACT_HISTORY: ContractHistoryData = { versions: [], reviews: [], names: new Map() }

const ROW_LIMIT = 1000
export const REVIEW_NOTE_MAX = 2000

export async function fetchContractHistory(): Promise<ContractHistoryData> {
  const [versions, reviews] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('contract_text_versions').select('id, source_kind, source_key, name, body, body_format, version_date, change_kind, changed_at, changed_by').order('changed_at', { ascending: false }).limit(ROW_LIMIT),
      'contracts tab: wording history',
    ),
    withSupabaseRetry(
      () => supabase.from('contract_text_reviews').select('id, entry_id, reviewed_on, note, reviewed_by, created_at').order('reviewed_on', { ascending: false }).limit(ROW_LIMIT),
      'contracts tab: reviews',
    ),
  ])
  const v = (versions ?? []) as ContractTextVersion[]
  const r = (reviews ?? []) as ContractTextReview[]
  const ids = [...new Set([...v.map((x) => x.changed_by), ...r.map((x) => x.reviewed_by)].filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    try {
      const people = await withSupabaseRetry(() => supabase.from('users').select('id, name').in('id', ids), 'contracts tab: who changed it')
      for (const p of (people ?? []) as Array<{ id: string; name: string | null }>) if ((p.name ?? '').trim()) names.set(p.id, (p.name ?? '').trim())
    } catch {
      /* the dates stand without the names */
    }
  }
  return { versions: v, reviews: r, names }
}

/** The office read this entry today. Returns the row as saved. */
export async function markContractReviewed(input: { entryId: string; userId: string; note: string }): Promise<ContractTextReview> {
  const note = input.note.trim().slice(0, REVIEW_NOTE_MAX)
  const row = await withSupabaseRetry(
    () =>
      supabase
        .from('contract_text_reviews')
        .insert({ entry_id: input.entryId, reviewed_on: todayYmdInAppTz(), reviewed_by: input.userId, note: note || null })
        .select('id, entry_id, reviewed_on, note, reviewed_by, created_at')
        .single(),
    'contracts tab: mark reviewed',
  )
  return row as ContractTextReview
}

/** Take back a review marked by mistake (the person who marked it, or a dev). */
export async function removeContractReview(id: string): Promise<void> {
  await withSupabaseRetry(() => supabase.from('contract_text_reviews').delete().eq('id', id).select('id'), 'contracts tab: take back a review')
}
