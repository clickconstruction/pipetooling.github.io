/**
 * Filing a signed contract (Contract Desk PR 3 / v2.2744 → shared in Contract
 * sweep PR 4): a signed `job_contracts` row with signer_mode 'paper' — no
 * token, no email — from a Google Doc link and/or an uploaded scan. One write
 * path for the Contract modal's sheet, the sweep's pane, and a file dropped on
 * a row: a live draft converts in place — and so does a row that went out on paper,
 * handed over (v2.3629) or emailed as a PDF (v2.3631): it is the same document coming back signed — otherwise a fresh signed
 * row is inserted; the file lands in the private bucket at <contract_id>/paper.<ext>.
 * A paper signed by two fills both frames (v2.4657): the second name typed is the second frame,
 * marked paper.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isUnfinishedDate } from '../autosaveDateHold'
import { unfinishedDateStopsMessage } from '../dateBoxEntry'
import type { JobContractDraftPayload } from './jobContractDraftWrite'
import { isHttpUrl } from './jobContractDocument'
import { isAwaitingPaperCopy } from './jobContractHandoff'
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

/** Why the filing cannot be recorded yet, or null: the Signed-on date becomes the record's signed date, and a half-typed year would be locked into it. */
export function fileSignedContractDateBlocks(signedOn: string, thisYear: number): string | null {
  return isUnfinishedDate(signedOn) ? unfinishedDateStopsMessage('Signed on', 'this is filed', thisYear) : null
}

/** The second frame already signed through the link (a PDF emailed to sign by hand keeps its link), or null. */
export function coSignatureOnFile(row: Pick<JobContractRow, 'co_signed_at' | 'co_signer_printed_name'> | null | undefined): { name: string; signedAt: string } | null {
  const name = (row?.co_signer_printed_name ?? '').trim()
  return row?.co_signed_at && name ? { name, signedAt: row.co_signed_at } : null
}

/**
 * The name the second frame expects: the caller's payload when it carries the key (the Contract
 * window's; a null there is the second signer taken off and not yet saved), else the row's own.
 */
export function expectedCoSignerName(
  basePayload: { co_signer_name?: string | null } | null,
  existing: Pick<JobContractRow, 'co_signer_name'> | null,
): string | null {
  if (basePayload && 'co_signer_name' in basePayload) return basePayload.co_signer_name ?? null
  return existing?.co_signer_name ?? null
}

export type PaperCoSignerFields = {
  co_signer_name: string
  co_signer_printed_name: string
  co_signed_at: string
  co_signer_mode: 'paper'
  co_signer_consented_at: null
}

/**
 * The second frame a paper signed by two fills (v2.4657): the second name typed, marked paper,
 * stamped with the record's signed time. The frame keeps the name the draft expected when it
 * named one, as an e-signed frame does. Null when no second name is typed, or when that frame
 * already signed through the link: the paper never replaces a signature on file.
 */
export function paperCoSignerFields(input: {
  coSignerName: string | null | undefined
  signedAt: string
  expectedName: string | null | undefined
  existing: Pick<JobContractRow, 'co_signed_at' | 'co_signer_printed_name'> | null
}): PaperCoSignerFields | null {
  const typed = (input.coSignerName ?? '').trim()
  if (!typed || coSignatureOnFile(input.existing)) return null
  return {
    co_signer_name: (input.expectedName ?? '').trim() || typed,
    co_signer_printed_name: typed,
    co_signed_at: input.signedAt,
    co_signer_mode: 'paper',
    co_signer_consented_at: null,
  }
}

export async function fileSignedJobContract(input: {
  jobId: string
  /** The job's live draft — or its row out on paper (handed v2.3629, PDF-emailed v2.3631) — if any; it converts in place. A row sent as a signing link never converts here. */
  existingDraft: JobContractRow | null
  /** The document fields + terms + recipient the record keeps (the modal's payload, or the sweep's). Null = the job id alone. */
  basePayload: (JobContractDraftPayload & { co_signer_name?: string | null }) | null
  signerName: string
  /** The second person who signed the paper; blank = one signer (v2.4657). */
  coSignerName?: string
  /** YYYY-MM-DD in the company zone; blank = now. */
  signedOn: string
  link: string
  file: File | null
  authUserId: string | null
}): Promise<{ row: JobContractRow | null; uploadError: string | null }> {
  const nowIso = new Date().toISOString()
  const link = input.link.trim()
  const signedAt = input.signedOn ? `${input.signedOn}T12:00:00Z` : nowIso
  const co = paperCoSignerFields({
    coSignerName: input.coSignerName,
    signedAt,
    expectedName: expectedCoSignerName(input.basePayload, input.existingDraft),
    existing: input.existingDraft,
  })
  const base = {
    ...(input.basePayload ?? { job_id: input.jobId }),
    status: 'signed',
    signed_at: signedAt,
    signer_printed_name: input.signerName.trim(),
    signer_mode: 'paper',
    signer_consented_at: null,
    paper_signed_on: input.signedOn || null,
    signed_document_url: isHttpUrl(link) ? link : null,
    recorded_by: input.authUserId,
    public_token: null,
    next_reminder_at: null,
    ...co,
  }
  let row: JobContractRow | null
  if (input.existingDraft && input.existingDraft.status === 'draft') {
    row = await withSupabaseRetry<JobContractRow>(
      () => supabase.from('job_contracts').update(base).eq('id', input.existingDraft!.id).eq('status', 'draft').select('*').single(),
      'record paper contract (draft)',
    )
  } else if (isAwaitingPaperCopy(input.existingDraft)) {
    // The record keeps what was handed over: the sent row's own fields, terms and recipient stay.
    const { status, signed_at, signer_printed_name, signer_mode, signer_consented_at, paper_signed_on, signed_document_url, recorded_by, public_token, next_reminder_at } = base
    row = await withSupabaseRetry<JobContractRow>(
      () =>
        supabase
          .from('job_contracts')
          .update({ status, signed_at, signer_printed_name, signer_mode, signer_consented_at, paper_signed_on, signed_document_url, recorded_by, public_token, next_reminder_at, ...co })
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
