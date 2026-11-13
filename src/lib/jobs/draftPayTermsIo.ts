/**
 * The read behind a job's offered pay terms (punch list #323): the terms an estimator's job draft
 * carried, found on the Dispatch request of the bid the job came from. The office reads a request
 * that carries a bid (`dispatch_requests_select`), open or closed, so the terms outlive the to-do
 * that New Job closes. `draftPayTerms.ts` is the kernel.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { jobDraftFromPayload } from '../bids/jobDraft'
import { OPEN_JOB_FROM_BID_ACTION } from '../bids/wonDispatchHandoff'
import { draftPayTermsFromPayload, type DraftPayTerms } from './draftPayTerms'
import { payCalendarJobOf, type PayCalendarJob } from './payCalendarJob'
import { theirPaperPayer } from './theirPaperPayer'

type Db = SupabaseClient<Database>

/** A Dispatch request that carries pay terms on their own, sent from a won bid whose job is already open. */
export const PAY_TERMS_FROM_BID_ACTION = 'pay_terms_from_bid'

export type DraftPayTermsOffer = {
  terms: DraftPayTerms
  /** Who read them, for the words; null when the reader cannot see the sender's name. */
  from: string | null
}

type RequestRow = { pending_action: string | null; pending_payload: unknown; sender: { name: string | null } | null }

/** The terms a request carries: inside its job draft, or on their own. */
export function payTermsOnRequest(row: Pick<RequestRow, 'pending_action' | 'pending_payload'>): DraftPayTerms | null {
  if (row.pending_action === OPEN_JOB_FROM_BID_ACTION) return jobDraftFromPayload(row.pending_payload)?.payTerms ?? null
  if (row.pending_action === PAY_TERMS_FROM_BID_ACTION) return draftPayTermsFromPayload(row.pending_payload)
  return null
}

/**
 * The newest pay terms an estimator sent for a bid, or null. Null too when the read fails or the
 * reader may not see the bid's requests: the row then offers nothing, never an error.
 */
export async function loadDraftPayTermsForBid(db: Db, bidId: string): Promise<DraftPayTermsOffer | null> {
  try {
    const { data, error } = await db
      .from('dispatch_requests')
      .select('pending_action, pending_payload, sender:users!dispatch_requests_from_user_id_fkey(name)')
      .eq('bid_id', bidId)
      .in('pending_action', [OPEN_JOB_FROM_BID_ACTION, PAY_TERMS_FROM_BID_ACTION])
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) return null
    for (const row of (data ?? []) as unknown as RequestRow[]) {
      const terms = payTermsOnRequest(row)
      if (terms) return { terms, from: row.sender?.name?.trim() || null }
    }
    return null
  } catch {
    return null
  }
}

/** The job a bid opened, as the Pay calendar window needs it, and who pays its bills. Null when the bid has no job the reader can see, or the job names nobody to bill. */
export async function loadJobAndPayerForBid(db: Db, bidId: string): Promise<{ job: PayCalendarJob; payer: { id: string; name: string } } | null> {
  try {
    const { data, error } = await db
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name, development_id, customer_id, gc_customer_id, bill_to_party, customer_name, created_at')
      .eq('bid_id', bidId)
      .order('created_at', { ascending: false })
      .limit(1)
    const row = error ? null : ((data ?? [])[0] ?? null)
    if (!row) return null
    const ids = [row.customer_id, row.gc_customer_id].filter((id): id is string => !!id)
    const names = new Map<string, string>()
    if (ids.length) {
      const { data: people } = await db.from('customers').select('id, name').in('id', ids)
      for (const c of (people ?? []) as Array<{ id: string; name: string | null }>) if (c.name?.trim()) names.set(c.id, c.name.trim())
    }
    const payer = theirPaperPayer({
      ...row,
      customer_name: (row.customer_id ? names.get(row.customer_id) : null) ?? row.customer_name,
      gcCustomer: { name: row.gc_customer_id ? (names.get(row.gc_customer_id) ?? null) : null },
    })
    return payer ? { job: payCalendarJobOf(row), payer } : null
  } catch {
    return null
  }
}

/** The estimator's own newest request that carries pay terms for a bid, with the day it went: what their Job block says back. */
export async function loadMySentPayTerms(db: Db, bidId: string, userId: string): Promise<{ terms: DraftPayTerms; sentAt: string | null } | null> {
  try {
    const { data, error } = await db
      .from('dispatch_requests')
      .select('pending_action, pending_payload, created_at')
      .eq('bid_id', bidId)
      .eq('from_user_id', userId)
      .in('pending_action', [OPEN_JOB_FROM_BID_ACTION, PAY_TERMS_FROM_BID_ACTION])
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) return null
    for (const row of (data ?? []) as unknown as Array<Pick<RequestRow, 'pending_action' | 'pending_payload'> & { created_at: string | null }>) {
      const terms = payTermsOnRequest(row)
      if (terms) return { terms, sentAt: row.created_at }
    }
    return null
  } catch {
    return null
  }
}
