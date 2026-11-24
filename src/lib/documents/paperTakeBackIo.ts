/**
 * Documents → Agreements, **Take back** (punch list #403): the delete. One statement removes the paper, and the
 * statement itself asks for an outside party's paper that is not signed and that no job requires. So a paper signed a
 * moment before the press is not removed, whatever the list on the screen still says. When nothing was removed the
 * paper is read once more, to say why. Browser io, not pure; the rules and the words are `paperTakeBack.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { TAKE_BACK_STATUSES, companyTakeBackOutcome, takeBackOutcome, type TakeBackOutcome } from './paperTakeBack'

// `take_back_company_paper` joins the generated types with the types PR after its push; until then the client is cast once.
const db = supabase as unknown as SupabaseClient

export const PAPERS_TABLE = 'person_contract_documents'

/**
 * Take the paper back. Each table's own row security decides whether the caller may delete it: the office's four
 * roles may, and a training account, a digital twin and an archived account may not. Throws with the reason when the
 * database refuses in words or cannot be reached.
 */
export async function takeBackPartyPaper(documentId: string): Promise<TakeBackOutcome> {
  const removed = await withSupabaseRetry<Array<{ id: string }>>(
    async () =>
      supabase
        .from(PAPERS_TABLE)
        .delete()
        .eq('id', documentId)
        .not('party_contact_id', 'is', null)
        .is('job_id', null)
        .in('status', [...TAKE_BACK_STATUSES])
        .select('id'),
    'take back the paper',
  )
  if ((removed ?? []).length > 0) return takeBackOutcome(removed.length, null)
  const after = await withSupabaseRetry<{ status: string } | null>(async () => supabase.from(PAPERS_TABLE).select('status').eq('id', documentId).maybeSingle(), 'read the paper again')
  return takeBackOutcome(0, after?.status ?? null)
}

/**
 * Take back a trade company's own paper, through `take_back_company_paper` (20261124103000). The function deletes an
 * unsigned paper no job requires, and refuses in words one that GC mode is waiting on. Throws with those words, and
 * when the database cannot be reached. A press whose answer was lost and is sent again reads *gone*: the paper was
 * taken back the first time.
 */
export async function takeBackCompanyPaper(documentId: string): Promise<TakeBackOutcome> {
  const answer = await withSupabaseRetry<unknown>(async () => db.rpc('take_back_company_paper', { p_document_id: documentId }), 'take back the paper')
  const outcome = companyTakeBackOutcome(answer)
  if (!outcome) throw new Error('The app could not tell whether the paper was taken back. Read the list again.')
  return outcome
}
