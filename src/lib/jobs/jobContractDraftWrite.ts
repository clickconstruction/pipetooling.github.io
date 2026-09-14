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
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN, type JobContractFields } from './jobContractDocument'
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
  const { template } = input
  return {
    job_id: input.jobId,
    fields: { ...input.fields } as unknown as Database['public']['Tables']['job_contracts']['Insert']['fields'],
    body_html: template ? (template.book_body_html ?? '') : DEFAULT_JOB_CONTRACT_TERMS_PLAIN,
    body_format: template ? template.book_body_format : 'plain',
    template_document_id: template?.id ?? null,
    template_name: template ? template.document_name : 'Built-in service agreement terms',
    template_version_date: template?.book_version_date ?? null,
    recipient_name: input.recipientName.trim() || null,
    recipient_email: input.recipientEmail.trim() || null,
    recipient_phone: (input.recipientPhone ?? '').trim() || null,
  }
}

/**
 * Insert or update the job's draft. A draft row updates in place (its terms
 * are left as they are — the sweep edits scope, amount and recipient only);
 * a sent row is locked and comes back unchanged; no row inserts a fresh draft.
 */
export async function saveJobContractDraft(input: { existing: JobContractRow | null; payload: JobContractDraftPayload; authUserId: string | null }): Promise<JobContractRow | null> {
  const { existing, payload } = input
  if (existing && existing.status === 'sent') return existing
  if (existing && existing.status === 'draft') {
    const { body_html: _b, body_format: _f, template_document_id: _t, template_name: _n, template_version_date: _v, ...rest } = payload
    return await withSupabaseRetry<JobContractRow>(
      () => supabase.from('job_contracts').update(rest).eq('id', existing.id).eq('status', 'draft').select('*').single(),
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
