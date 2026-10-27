/**
 * The review ask's reads and writes for the office (v2.5946, punch list #185 PR 4): a job's asks, the low answers
 * nobody called, the recent answers, the call, and the company's Google review link. `customer_ratings` and its RPCs
 * are not in the generated types until the types PR after the push, so the client reads them untyped, as the rating
 * link's io does. A table or a column not there yet reads as none, so a client ahead of the push draws nothing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { ratingJobWord } from '../../../supabase/functions/_shared/ratingEventLine'
import { LOW_RATING_WINDOW_DAYS, type OfficeRating } from './ratingsOffice'
import { CALL_AT_OR_BELOW } from './rating'

export const GOOGLE_REVIEW_LINK_KEY = 'google_review_link_v1'

const COLUMNS = 'id, contact_id, job_id, customer_name, asked_at, opened_at, answered_at, score, words, google_pressed_at, called_at, call_note'

type Row = {
  id: string
  contact_id: string | null
  job_id: string | null
  customer_name: string | null
  asked_at: string
  opened_at?: string | null
  answered_at: string | null
  score: number | null
  words: string | null
  google_pressed_at?: string | null
  called_at?: string | null
  call_note?: string | null
}

export function officeRatingFrom(r: Row): OfficeRating {
  return {
    id: r.id,
    contactId: r.contact_id,
    jobId: r.job_id,
    customerName: r.customer_name ?? '',
    askedAt: r.asked_at,
    openedAt: r.opened_at ?? null,
    answeredAt: r.answered_at,
    score: r.score,
    words: r.words ?? '',
    googlePressedAt: r.google_pressed_at ?? null,
    calledAt: r.called_at ?? null,
    callNote: r.call_note ?? '',
  }
}

export interface RatingsOfficeIo {
  forJob(jobId: string): Promise<OfficeRating[]>
  lowOwed(): Promise<OfficeRating[]>
  recent(sinceIso: string): Promise<OfficeRating[]>
  jobWord(jobId: string): Promise<string | null>
  recordCall(ratingId: string, note: string): Promise<void>
  googleLink(): Promise<string>
  saveGoogleLink(value: string): Promise<void>
}

export function supabaseRatingsOfficeIo(client: unknown = supabase): RatingsOfficeIo {
  const db = client as SupabaseClient
  const rows = (result: { data: unknown; error: unknown }): OfficeRating[] => (result.error ? [] : ((result.data ?? []) as Row[]).map(officeRatingFrom))
  return {
    async forJob(jobId) {
      return rows(await db.from('customer_ratings').select(COLUMNS).eq('job_id', jobId).order('asked_at', { ascending: false }).limit(20))
    },
    async lowOwed() {
      const since = new Date(Date.now() - LOW_RATING_WINDOW_DAYS * 24 * 3600 * 1000).toISOString()
      return rows(
        await db.from('customer_ratings').select(COLUMNS).not('answered_at', 'is', null).lte('score', CALL_AT_OR_BELOW).is('called_at', null).gte('answered_at', since).order('answered_at', { ascending: true }).limit(100),
      )
    },
    async recent(sinceIso) {
      return rows(await db.from('customer_ratings').select(COLUMNS).gte('asked_at', sinceIso).order('asked_at', { ascending: false }).limit(500))
    },
    async jobWord(jobId) {
      const job = await db.from('jobs_ledger').select('job_name, hcp_number, click_number').eq('id', jobId).maybeSingle()
      return job.error ? null : ratingJobWord(job.data as { job_name: string | null; hcp_number: string | null; click_number: string | null } | null)
    },
    async recordCall(ratingId, note) {
      const result = await db.rpc('customer_rating_called', { p_rating_id: ratingId, p_note: note })
      checkSupabaseError(result, 'record the call')
      const data = (result.data ?? {}) as { ok?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      if (!data.ok) throw new Error('The call was not recorded.')
    },
    async googleLink() {
      const result = await db.from('app_settings').select('value_text').eq('key', GOOGLE_REVIEW_LINK_KEY).maybeSingle()
      if (result.error) return ''
      return ((result.data as { value_text?: string | null } | null)?.value_text ?? '').trim()
    },
    async saveGoogleLink(value) {
      // A plain update the row's own policy allows (the owner or a dev); a refused one updates nothing, so it says so.
      const result = await db.from('app_settings').update({ value_text: value.trim() }).eq('key', GOOGLE_REVIEW_LINK_KEY).select('key')
      checkSupabaseError(result, 'save the Google review link')
      if (!((result.data ?? []) as unknown[]).length) throw new Error('The link was not saved. Only the owner or a dev changes it, and the push that adds it must be on.')
    },
  }
}
