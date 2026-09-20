/**
 * Filing a signed contract (Contract Desk PR 3 / v2.2744 → shared in Contract
 * sweep PR 4): a signed `job_contracts` row with signer_mode 'paper' — no
 * token, no email — from a Google Doc link and/or an uploaded scan. One write
 * path for the Contract modal's sheet, the sweep's pane, and a file dropped on
 * a row: a live draft converts in place — and so does a row handed over on paper
 * (v2.3629: it is the same document coming back signed) — otherwise a fresh signed
 * row is inserted; the file lands in the private bucket at <contract_id>/paper.<ext>.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { JobContractDraftPayload } from './jobContractDraftWrite'
import { isHttpUrl } from './jobContractDocument'
import { isHandedAwaitingPaper } from './jobContractHandoff'
import type { JobContractRow } from './jobContractLifecycle'

export const JOB_CONTRACT_BUCKET = 'job-contract-documents'

/** `<rowId>/paper.<ext>` — the extension lower-cased and stripped to [a-z0-9]; anything odd becomes pdf. */
export function paperUploadPath(rowId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
  return `${rowId}/paper.${ext}`
}

/** What the filing needs before it can write: a link or a file, and a name. */
export function fileSignedContractReady(input: { link: string; file: File | null; signerName: string }): boolean {
  return Boolean(input.signerName.trim()) && (isHttpUrl(input.link) || input.file != null)
}

export async function fileSignedJobContract(input: {
  jobId: string
  /** The job's live draft — or its handed-over row (v2.3629) — if any; it converts in place. A row sent as a signing link never converts here. */
  existingDraft: JobContractRow | null
  /** The document fields + terms + recipient the record keeps (the modal's payload, or the sweep's). Null = the job id alone. */
  basePayload: JobContractDraftPayload | null
  signerName: string
  /** YYYY-MM-DD in the company zone; blank = now. */
  signedOn: string
  link: string
  file: File | null
  authUserId: string | null
}): Promise<{ row: JobContractRow | null; uploadError: string | null }> {
  const nowIso = new Date().toISOString()
  const link = input.link.trim()
  const base = {
    ...(input.basePayload ?? { job_id: input.jobId }),
    status: 'signed',
    signed_at: input.signedOn ? `${input.signedOn}T12:00:00Z` : nowIso,
    signer_printed_name: input.signerName.trim(),
    signer_mode: 'paper',
    signer_consented_at: null,
    paper_signed_on: input.signedOn || null,
    signed_document_url: isHttpUrl(link) ? link : null,
    recorded_by: input.authUserId,
    public_token: null,
    next_reminder_at: null,
  }
  let row: JobContractRow | null
  if (input.existingDraft && input.existingDraft.status === 'draft') {
    row = await withSupabaseRetry<JobContractRow>(
      () => supabase.from('job_contracts').update(base).eq('id', input.existingDraft!.id).eq('status', 'draft').select('*').single(),
      'record paper contract (draft)',
    )
  } else if (isHandedAwaitingPaper(input.existingDraft)) {
    // The record keeps what was handed over: the sent row's own fields, terms and recipient stay.
    const { status, signed_at, signer_printed_name, signer_mode, signer_consented_at, paper_signed_on, signed_document_url, recorded_by, public_token, next_reminder_at } = base
    row = await withSupabaseRetry<JobContractRow>(
      () =>
        supabase
          .from('job_contracts')
          .update({ status, signed_at, signer_printed_name, signer_mode, signer_consented_at, paper_signed_on, signed_document_url, recorded_by, public_token, next_reminder_at })
          .eq('id', input.existingDraft!.id)
          .eq('status', 'sent')
          .select('*')
          .single(),
      'record paper contract (handed)',
    )
  } else {
    row = await withSupabaseRetry<JobContractRow>(
      () => supabase.from('job_contracts').insert({ ...base, created_by: input.authUserId }).select('*').single(),
      'record paper contract',
    )
  }
  let uploadError: string | null = null
  if (row && input.file) {
    const path = paperUploadPath(row.id, input.file.name)
    const { error: upErr } = await supabase.storage.from(JOB_CONTRACT_BUCKET).upload(path, input.file, { contentType: input.file.type || undefined, upsert: true })
    if (upErr) uploadError = upErr.message || 'upload failed'
    else await withSupabaseRetry(() => supabase.from('job_contracts').update({ paper_upload_path: path }).eq('id', row!.id), 'attach paper upload')
  }
  if (row) {
    await supabase.from('job_contract_events').insert({ contract_id: row.id, event_type: 'recorded', metadata: { paper_signed_on: input.signedOn || null, file: !!input.file }, actor_user_id: input.authUserId })
  }
  return { row, uploadError }
}
