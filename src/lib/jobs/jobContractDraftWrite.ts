/**
 * One draft write (Contract sweep PR 3): the sweep's in-place edits land on
 * the same `job_contracts` draft row the Contract modal autosaves and the
 * send reuses — never a second live contract. The payload builder is pure;
 * the save is a thin insert-or-update guarded to drafts (a sent row is locked
 * and returned as-is).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import type { JobContractFields } from './jobContractDocument'
import { draftTermsToWrite, jobContractTermsFromTemplate, pickJobContractTerms } from './jobContractDraftTerms'
import type { JobContractRow } from './jobContractLifecycle'
import type { QuickSendTemplate } from './jobContractQuickSend'

export type JobContractDraftPayload = Pick<
  Database['public']['Tables']['job_contracts']['Insert'],
  'job_id' | 'fields' | 'body_html' | 'body_format' | 'template_document_id' | 'template_name' | 'template_version_date' | 'recipient_name' | 'recipient_email' | 'recipient_phone'
>

export function buildJobContractDraftPayload(input: {
  jobId: string
  fields: JobContractFields
  template: QuickSendTemplate
  recipientName: string
  recipientEmail: string
  recipientPhone: string | null
}): JobContractDraftPayload {
  return {
    job_id: input.jobId,
    fields: { ...input.fields } as unknown as Database['public']['Tables']['job_contracts']['Insert']['fields'],
    ...jobContractTermsFromTemplate(input.template),
    recipient_name: input.recipientName.trim() || null,
    recipient_email: input.recipientEmail.trim() || null,
    recipient_phone: (input.recipientPhone ?? '').trim() || null,
  }
}

/**
 * Insert or update the job's draft. A draft row updates in place: scope,
 * amount and recipient always, and its terms when it was written from the
 * same Book document the payload carries — a draft follows that document's
 * current wording until it is sent (`draftTermsToWrite`). A draft written
 * from another document, or from the built-in wording, keeps its terms. A
 * sent row is locked and comes back unchanged; no row inserts a fresh draft.
 */
export async function saveJobContractDraft(input: { existing: JobContractRow | null; payload: JobContractDraftPayload; authUserId: string | null }): Promise<JobContractRow | null> {
  const { existing, payload } = input
  if (existing && existing.status === 'sent') return existing
  if (existing && existing.status === 'draft') {
    const { body_html: _b, body_format: _f, template_document_id: _t, template_name: _n, template_version_date: _v, ...rest } = payload
    const patch = { ...rest, ...(draftTermsToWrite(existing, pickJobContractTerms(payload)) ?? {}) }
    return await withSupabaseRetry<JobContractRow>(
      () => supabase.from('job_contracts').update(patch).eq('id', existing.id).eq('status', 'draft').select('*').single(),
      'sweep: autosave contract draft',
    )
  }
  return await withSupabaseRetry<JobContractRow>(
    () =>
      supabase
        .from('job_contracts')
        .insert({ ...payload, status: 'draft', created_by: input.authUserId })
        .select('*')
        .single(),
    'sweep: create contract draft',
  )
}

/**
 * Before a reused draft goes out — quick send, hand-off — bring it up to its
 * Book document's current wording. Only the terms are written, and only when
 * `draftTermsToWrite` says so; every other row comes back as it is. A failed
 * write throws, so the caller stops rather than send the old wording.
 */
export async function refreshJobContractDraftTerms(input: { existing: JobContractRow; template: QuickSendTemplate }): Promise<JobContractRow> {
  const { existing } = input
  const terms = draftTermsToWrite(existing, jobContractTermsFromTemplate(input.template))
  if (!terms) return existing
  const row = await withSupabaseRetry<JobContractRow | null>(
    () => supabase.from('job_contracts').update(terms).eq('id', existing.id).eq('status', 'draft').select('*').single(),
    'sweep: refresh contract draft terms',
  )
  if (!row) throw new Error('Could not bring the draft up to the current terms.')
  return row
}
