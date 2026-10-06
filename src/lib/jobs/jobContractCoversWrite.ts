/**
 * The reads and writes behind one signed paper covering several named jobs (v2.4301). Every
 * covered job gets its own signed paper row through `fileSignedJobContract` (a live draft or
 * a handed-over copy converts in place, as everywhere else), and the rows share
 * `covers_group_id` (the first row's id). Adding a job copies the paper's record onto a new
 * row in the same group; removing a job voids that job's row; taking the paper off voids
 * every row in the group. A paper signed by two carries both frames to every row (v2.4657).
 * Pure decisions live in `jobContractCovers.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { coSignatureOnFile, fileSignedJobContract, JOB_CONTRACT_BUCKET, paperUploadPath } from './jobContractFileWrite'
import type { JobContractRow } from './jobContractLifecycle'
import { isAwaitingPaperCopy } from './jobContractHandoff'
import { dispatchJobContractChanged } from './jobContractNotNeeded'
import { coversGroupKey, groupPapers, type CoverableJobInput, type CoversPaper, type PaperRowLike } from './jobContractCovers'

export type PartyJob = CoverableJobInput & {
  customer_id: string | null
  gc_customer_id: string | null
  bid_id: string | null
  contract_not_needed_at: string | null
  contract_not_needed_reason: string | null
}

const JOB_COLS = 'id, hcp_number, click_number, job_name, job_address, status, customer_id, gc_customer_id, bid_id, contract_not_needed_at, contract_not_needed_reason'

/** The customer's jobs, as the customer or as the GC. */
export async function loadPartyJobs(partyIds: ReadonlyArray<string>): Promise<PartyJob[]> {
  const ids = [...new Set(partyIds.filter(Boolean))]
  if (ids.length === 0) return []
  const list = ids.join(',')
  const { data, error } = await supabase
    .from('jobs_ledger')
    .select(JOB_COLS)
    .or(`customer_id.in.(${list}),gc_customer_id.in.(${list})`)
    .order('id')
    .limit(1000)
  if (error) throw error
  return (data ?? []) as PartyJob[]
}

/** Every contract row on these jobs (the papers are grouped from the live signed ones). */
export async function loadContractRowsForJobs(jobIds: ReadonlyArray<string>): Promise<JobContractRow[]> {
  if (jobIds.length === 0) return []
  const { data, error } = await supabase.from('job_contracts').select('*').in('job_id', [...jobIds]).order('id').limit(1000)
  if (error) throw error
  return (data ?? []) as JobContractRow[]
}

/** Jobs a live signed contract of any kind covers — except the paper being edited. */
export function coveredJobIds(rows: ReadonlyArray<JobContractRow>, exceptGroupKey: string | null): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (r.status !== 'signed' || r.voided_at != null) continue
    if (exceptGroupKey && coversGroupKey(r) === exceptGroupKey) continue
    out.add(r.job_id)
  }
  return out
}

export function papersFromRows(rows: ReadonlyArray<JobContractRow>): CoversPaper[] {
  return groupPapers(rows as unknown as PaperRowLike[])
}

/**
 * The second signer the anchor job's live draft (or its copy out on paper) names, to start the
 * sheet's Second signer box (v2.4657); '' when it names none, or when that signer already signed
 * through the link.
 */
export function anchorCoSignerName(rows: ReadonlyArray<JobContractRow>, anchorJobId: string | null): string {
  if (!anchorJobId) return ''
  const mine = rows.filter((r) => r.job_id === anchorJobId && r.voided_at == null)
  const live = mine.find((r) => r.status === 'draft') ?? mine.find((r) => isAwaitingPaperCopy(r)) ?? null
  if (!live || coSignatureOnFile(live)) return ''
  return (live.co_signer_name ?? '').trim()
}

async function setGroup(rowIds: ReadonlyArray<string>, groupId: string): Promise<void> {
  if (rowIds.length === 0) return
  await withSupabaseRetry(() => supabase.from('job_contracts').update({ covers_group_id: groupId }).in('id', [...rowIds]), 'link the paper to its jobs')
}

/**
 * File one signed paper for the jobs picked. The first job's row id becomes the group id
 * when more than one job is picked. Returns how many jobs were filed and any upload error.
 */
export async function fileContractForJobs(input: {
  jobIds: ReadonlyArray<string>
  signerName: string
  /** The second person who signed the paper; blank = one signer. */
  coSignerName?: string
  signedOn: string
  link: string
  file: File | null
  authUserId: string | null
}): Promise<{ filed: number; uploadError: string | null }> {
  const jobIds = [...new Set(input.jobIds)]
  if (jobIds.length === 0) throw new Error('Pick at least one job the paper names.')
  const existing = await loadContractRowsForJobs(jobIds)
  const rowIds: string[] = []
  let uploadError: string | null = null
  for (const jobId of jobIds) {
    const mine = existing.filter((r) => r.job_id === jobId && r.voided_at == null)
    const draft = mine.find((r) => r.status === 'draft') ?? mine.find((r) => isAwaitingPaperCopy(r)) ?? null
    const { row, uploadError: upErr } = await fileSignedJobContract({
      jobId,
      existingDraft: draft,
      basePayload: null,
      signerName: input.signerName,
      coSignerName: input.coSignerName,
      signedOn: input.signedOn,
      link: input.link,
      file: input.file,
      authUserId: input.authUserId,
    })
    if (!row) throw new Error(`The contract was not recorded for every job. ${rowIds.length} of ${jobIds.length} were filed.`)
    rowIds.push(row.id)
    uploadError = uploadError ?? upErr
  }
  if (rowIds.length > 1) await setGroup(rowIds, rowIds[0]!)
  dispatchJobContractChanged()
  return { filed: rowIds.length, uploadError }
}

/** Put one more job under a paper already on file. */
export async function addJobToPaper(paper: CoversPaper, jobId: string, authUserId: string | null): Promise<void> {
  const src = paper.source as unknown as JobContractRow
  const groupId = (src.covers_group_id ?? '').trim() || src.id
  const existing = (await loadContractRowsForJobs([jobId])).filter((r) => r.voided_at == null)
  const draft = existing.find((r) => r.status === 'draft') ?? existing.find((r) => isAwaitingPaperCopy(r)) ?? null
  // The paper's second signature comes along (v2.4657); a second frame signed through a link stays with its own job.
  const coSignerName = src.co_signer_mode === 'paper' && src.co_signed_at ? (src.co_signer_printed_name ?? '').trim() : ''
  const { row } = await fileSignedJobContract({
    jobId,
    existingDraft: draft,
    basePayload: null,
    signerName: src.signer_printed_name ?? '',
    coSignerName,
    signedOn: src.paper_signed_on ?? '',
    link: src.signed_document_url ?? '',
    file: null,
    authUserId,
  })
  if (!row) throw new Error('The job was not added to the paper.')
  let uploadPath: string | null = null
  if (src.paper_upload_path) {
    // Each row keeps its scan under its own folder, as a lone filing does; reuse the path if the copy is refused.
    const target = paperUploadPath(row.id, src.paper_upload_path)
    const { error } = await supabase.storage.from(JOB_CONTRACT_BUCKET).copy(src.paper_upload_path, target)
    uploadPath = error ? src.paper_upload_path : target
  }
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_contracts')
        .update({
          covers_group_id: groupId,
          signed_at: src.signed_at,
          ...(coSignerName && row.co_signer_mode === 'paper' ? { co_signed_at: src.co_signed_at } : {}),
          ...(uploadPath ? { paper_upload_path: uploadPath } : {}),
        })
        .eq('id', row.id),
    'add the job to the paper',
  )
  // A lone filing has one row, and its id becomes the group's.
  if (!src.covers_group_id) await setGroup([src.id], groupId)
  dispatchJobContractChanged()
}

/** Void the given rows: the jobs read No contract again (or whatever else covers them). */
export async function voidPaperRows(rowIds: ReadonlyArray<string>, authUserId: string | null, reason: string): Promise<void> {
  if (rowIds.length === 0) return
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_contracts')
        .update({ status: 'voided', voided_at: new Date().toISOString(), voided_by: authUserId, void_reason: reason })
        .in('id', [...rowIds])
        .eq('status', 'signed'),
    'take the paper off',
  )
  dispatchJobContractChanged()
}

/** The live rows of one paper, by job. */
export function paperRowsByJob(rows: ReadonlyArray<JobContractRow>, groupKey: string): Map<string, JobContractRow> {
  const out = new Map<string, JobContractRow>()
  for (const r of rows) {
    if (r.status !== 'signed' || r.voided_at != null || r.signer_mode !== 'paper') continue
    if (coversGroupKey(r) !== groupKey) continue
    out.set(r.job_id, r)
  }
  return out
}

/** Change which jobs a paper covers: add rows for new ticks, void rows for cleared ones. */
export async function saveCoveredJobs(input: {
  paper: CoversPaper
  rows: ReadonlyArray<JobContractRow>
  add: ReadonlyArray<string>
  remove: ReadonlyArray<string>
  authUserId: string | null
}): Promise<void> {
  const byJob = paperRowsByJob(input.rows, input.paper.key)
  for (const jobId of input.add) await addJobToPaper(input.paper, jobId, input.authUserId)
  const voidIds = input.remove.map((j) => byJob.get(j)?.id).filter((x): x is string => Boolean(x))
  await voidPaperRows(voidIds, input.authUserId, 'Taken off the jobs this paper covers')
  dispatchJobContractChanged()
}
