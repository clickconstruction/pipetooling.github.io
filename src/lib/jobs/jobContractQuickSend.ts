/**
 * One-call send for the backlog sweep (Contract Desk PR 4): mint the draft
 * from the job's own facts (fixtures → scope, revenue → amount, the chosen
 * Contract Book template or the built-in terms) and hand it to
 * send-job-contract. The modal path stays for careful edits; this is nine
 * clicks for nine jobs.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildJobContractPrefill, DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from './jobContractDocument'
import type { JobContractRow } from './jobContractLifecycle'

export type QuickSendTemplate = Pick<
  Database['public']['Tables']['contract_template_documents']['Row'],
  'id' | 'document_name' | 'book_body_html' | 'book_body_format' | 'book_version_date'
> | null

export type QuickSendResult = { ok: true; emailed: boolean; signUrl: string | null } | { ok: false; error: string }

export async function quickSendJobContract(input: {
  job: JobWithDetails
  template: QuickSendTemplate
  recipientEmail: string
  recipientName: string
  authUserId: string | null
  message?: string
}): Promise<QuickSendResult> {
  const { job, template } = input
  const email = input.recipientEmail.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Needs a valid email.' }
  try {
    // Reuse a live draft/sent row when one exists — never mint a second live contract.
    const { data: existing } = await supabase
      .from('job_contracts')
      .select('*')
      .eq('job_id', job.id)
      .in('status', ['draft', 'sent'])
      .is('voided_at', null)
      .limit(1)
      .maybeSingle()
    let row = (existing ?? null) as JobContractRow | null
    if (!row) {
      const fields = buildJobContractPrefill({ job })
      row = await withSupabaseRetry<JobContractRow>(
        () =>
          supabase
            .from('job_contracts')
            .insert({
              job_id: job.id,
              status: 'draft',
              fields: fields as unknown as Database['public']['Tables']['job_contracts']['Insert']['fields'],
              body_html: template ? template.book_body_html ?? '' : DEFAULT_JOB_CONTRACT_TERMS_PLAIN,
              body_format: template ? template.book_body_format : 'plain',
              template_document_id: template?.id ?? null,
              template_name: template ? template.document_name : 'Built-in service agreement terms',
              template_version_date: template?.book_version_date ?? null,
              recipient_name: input.recipientName.trim() || job.customer_name || null,
              recipient_email: email,
              recipient_phone: job.customer_phone ?? null,
              created_by: input.authUserId,
            })
            .select('*')
            .single(),
        'sweep: create contract draft',
      )
    }
    if (!row) return { ok: false, error: 'Could not create the draft.' }
    const { data, error } = await supabase.functions.invoke('send-job-contract', {
      body: {
        contract_id: row.id,
        mode: 'email',
        recipient_email: email,
        recipient_name: input.recipientName.trim(),
        public_origin: window.location.origin,
        message: input.message?.trim() || undefined,
      },
    })
    const res = (data ?? {}) as { ok?: boolean; emailed?: boolean; sign_url?: string; error?: string; email_error?: string }
    if (error || !res.ok) return { ok: false, error: res.error || error?.message || 'Send failed.' }
    return { ok: true, emailed: !!res.emailed, signUrl: res.sign_url ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed.' }
  }
}
