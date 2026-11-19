/**
 * Permit news on Followup (punch list #401, PR 2): the read and the write behind an answer on a
 * line. `bid_permit_answers` (migration 20261119130000) is append-only; `bidPermitAnswers.ts`
 * folds what is read here. No kernel logic.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { fetchAllRows } from '../supabasePaging'
import type { PermitAnswer, PermitAnswerRow, PermitRef } from './bidPermitAnswers'

type Page<T> = PromiseLike<SupabaseClientResult<T[]>>

/** PostgREST's "table not found": the window before migration 20261119130000 is pushed. */
function missingTable(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null
  return e != null && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|relation .* does not exist/i.test(e.message ?? ''))
}

const COLUMNS = 'id, bid_id, city, permit_number, permit_type, answer, answered_by, answered_at'

/**
 * Every answer, oldest first, a page at a time with the id settling two saved in one instant, so
 * none past the API's 1,000 is lost: the newest per bid and permit is the one that stands, and it
 * is read last. Before the table is on the database there are no answers.
 */
export async function loadPermitAnswers(): Promise<PermitAnswerRow[]> {
  try {
    return await fetchAllRows<PermitAnswerRow>(
      (from, to) => supabase.from('bid_permit_answers' as never).select(COLUMNS).order('answered_at', { ascending: true }).order('id').range(from, to) as unknown as Page<PermitAnswerRow>,
      'read the answers on permit news',
    )
  } catch (e) {
    if (missingTable(e)) return []
    throw e
  }
}

const listeners = new Set<() => void>()

/** Told after an answer is saved, so every list that reads the answers reads them again. Returns the way to stop listening. */
export function onPermitAnswered(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** One answer, appended as the person signed in. The newest row per bid and permit stands; `taken_back` undoes the one before it. */
export async function recordPermitAnswer(input: { bidId: string; permit: PermitRef; answer: PermitAnswer }): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id
  if (!me) throw new Error('Sign in again to answer.')
  await withSupabaseRetry(
    async () =>
      await supabase.from('bid_permit_answers' as never).insert({
        bid_id: input.bidId,
        city: input.permit.city,
        permit_number: input.permit.permit_number,
        permit_type: input.permit.permit_type,
        answer: input.answer,
        answered_by: me,
      } as never),
    'save the answer',
  )
  for (const fn of listeners) fn()
}
