import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { LienWaiverFields } from '../jobsDocuments/lienWaiverRelease'
import { lienReleaseRowSignatureWithInk } from './lienReleaseInk'
import type { JobLienReleaseRow } from './lienReleaseTracking'
import { noticeReleaseFromRow, type NoticeRelease, type NoticeReleaseForm } from './lienNoticeRelease'

/**
 * The writes behind a conditional release enclosed with a notice (v2.4729). The Release of Lien
 * window's rule holds: no paper leaves without its record. The tick makes a `job_lien_releases`
 * draft; unticking voids it; recording the run issues it (`status: 'issued'`, `minted_at`), so
 * the Dashboard's cleared-release queue offers the unconditional the day the money clears.
 */

export type NoticeReleaseDraftInput = {
  jobId: string
  formType: NoticeReleaseForm
  fields: LienWaiverFields
  amount: number
  /** The notice's unpaid bills — what the release covers and what the Dashboard watches for payment. */
  invoiceIds: readonly string[]
  throughDate: string
  /** The master who signs it, when the job has one. */
  signerUserId: string | null
  userId: string | null
}

function payloadOf(input: NoticeReleaseDraftInput) {
  return {
    job_id: input.jobId,
    invoice_ids: [...input.invoiceIds],
    form_type: input.formType,
    amount: Math.max(0, Math.round(input.amount * 100) / 100),
    through_date: input.throughDate || null,
    signed_date: null,
    signer_user_id: input.signerUserId,
    fields: { ...input.fields } as Record<string, string>,
  }
}

/** A new draft release for the notice. Returns the row id. */
export async function createNoticeReleaseDraft(input: NoticeReleaseDraftInput): Promise<string> {
  const row = await withSupabaseRetry<{ id: string }>(
    () =>
      supabase
        .from('job_lien_releases')
        .insert({ ...payloadOf(input), status: 'draft', created_by: input.userId } as never)
        .select('id')
        .single(),
    'lien desk: enclose a conditional release',
  )
  return row.id
}

/** The draft follows the notice: a claim or a month changed on the desk rewrites the draft's boxes. Only a draft is touched. */
export async function refreshNoticeReleaseDraft(id: string, input: NoticeReleaseDraftInput): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_releases').update(payloadOf(input) as never).eq('id', id).eq('status', 'draft'),
    'lien desk: refresh the enclosed release',
  )
}

/** Unticked: the draft is voided, never deleted — the row says a release was drawn and left out. */
export async function voidNoticeReleaseDraft(id: string, userId: string | null): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_releases').update({ voided_at: new Date().toISOString(), voided_by: userId } as never).eq('id', id).eq('status', 'draft'),
    'lien desk: leave the release out',
  )
}

/** The run is recorded: the release is issued as the paper leaves. A release already issued or signed is left as it is. */
export async function issueNoticeRelease(id: string): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_releases').update({ status: 'issued', minted_at: new Date().toISOString() } as never).eq('id', id).eq('status', 'draft'),
    'lien desk run: issue the enclosed release',
  )
}

/** The releases the desk's items point at, with the master's ink when he signed one in the app. */
export async function fetchNoticeReleases(ids: readonly string[]): Promise<Map<string, NoticeRelease>> {
  const out = new Map<string, NoticeRelease>()
  const want = [...new Set(ids.filter(Boolean))]
  if (!want.length) return out
  const { data, error } = await supabase.from('job_lien_releases').select('*').in('id', want).is('voided_at', null)
  if (error) throw error
  for (const row of (data ?? []) as JobLienReleaseRow[]) {
    const signature = await lienReleaseRowSignatureWithInk(row).catch(() => null)
    const r = noticeReleaseFromRow(row, signature)
    if (r) out.set(r.id, r)
  }
  return out
}
