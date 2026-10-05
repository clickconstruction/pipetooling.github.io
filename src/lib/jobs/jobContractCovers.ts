/**
 * One signed paper, several named jobs (v2.4301). Grace, 2026-10-01: "a contract should never
 * cover every job with someone, but it could cover multiple jobs that are specific." Coverage
 * stays per job — every covered job keeps its own signed `job_contracts` row — and the rows
 * filed together share `covers_group_id`. This kernel says which jobs a paper covers, which
 * jobs the office may tick, what the sheet's sentence and button read, and which papers on
 * the same customer's other jobs to offer a job that has none. Pure; words follow plainWords.ts.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { signerNamesLine, type SignerFramesRow } from './jobContractSigners'

/** The rows' group: the shared id, or the row's own id when it was filed alone. */
export function coversGroupKey(row: { id: string; covers_group_id?: string | null }): string {
  return (row.covers_group_id ?? '').trim() || row.id
}

/** "251", "251 and 825", "251, 825 and 843". */
export function joinJobNumbers(nums: ReadonlyArray<string>): string {
  const list = nums.filter((n) => n.trim())
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** Job numbers in the order a person reads them: 251 before 825 before 1054. */
export function sortJobNumbers(nums: ReadonlyArray<string>): string[] {
  return nums.filter((n) => n.trim()).sort((a, b) => jobNumberSortKey(a) - jobNumberSortKey(b) || a.localeCompare(b))
}

/** "both" for two, "all 3" for more. */
export function allOfCount(n: number): string {
  return n === 2 ? 'both' : `all ${n}`
}

/** The strip's line under a signed paper that covers more than this job; null for one job. */
export function contractCoversLine(jobNumbers: ReadonlyArray<string>): string | null {
  const list = sortJobNumbers(jobNumbers)
  if (list.length < 2) return null
  return `Covers jobs ${joinJobNumbers(list)}`
}

/** "180 Go Away Rd, Blanco, TX 78606" → "180 Go Away Rd". */
export function streetOf(address: string | null | undefined): string {
  return (address ?? '').split(',')[0]?.trim() ?? ''
}

export type CoverableJobInput = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
}

export type CoverableJob = {
  id: string
  /** The number the app shows ("251", "J922"); falls back to the job name. */
  num: string
  /** The street, else the job name. */
  where: string
  /** Paid and closed jobs sit behind a link. */
  paid: boolean
  statusWord: string
  /** Another signed contract already covers it: shown, not tickable. */
  coveredElsewhere: boolean
}

const STATUS_WORDS: Record<string, string> = {
  working: 'Working',
  ready_to_bill: 'Ready to bill',
  billed: 'Billed',
  paid: 'Paid',
  waiting: 'Waiting',
}

/** "billed" → "Billed", "ready_to_bill" → "Ready to bill". */
export function jobStatusWord(status: string | null | undefined): string {
  const st = (status ?? '').trim()
  return STATUS_WORDS[st] ?? (st ? st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, ' ') : '')
}

/** Sort key: the first number in a job number ("J922" → 922); no number sorts last. */
export function jobNumberSortKey(num: string): number {
  const m = num.match(/\d+/)
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER
}

export function jobNumberLabel(j: Pick<CoverableJobInput, 'hcp_number' | 'click_number' | 'job_name'>): string {
  const n = effectiveJobLedgerNumber(j.hcp_number, j.click_number)
  return n || (j.job_name ?? '').trim() || 'Job'
}

/**
 * The jobs the sheet lists: the same customer's jobs other than the anchor, open ones first
 * (by number), then paid ones. A job another live signed contract covers is flagged so the
 * sheet shows it greyed. `coveredJobIds` holds jobs covered by a paper OTHER than the one
 * being edited.
 */
export function buildCoverableJobs(
  jobs: ReadonlyArray<CoverableJobInput>,
  anchorJobId: string | null,
  coveredJobIds: ReadonlySet<string>,
): CoverableJob[] {
  const out = jobs
    .filter((j) => j.id !== anchorJobId)
    .map((j) => {
      const status = (j.status ?? '').trim()
      return {
        id: j.id,
        num: jobNumberLabel(j),
        where: streetOf(j.job_address) || (j.job_name ?? '').trim(),
        paid: status === 'paid',
        statusWord: jobStatusWord(status),
        coveredElsewhere: coveredJobIds.has(j.id),
      }
    })
  return out.sort((a, b) => Number(a.paid) - Number(b.paid) || jobNumberSortKey(a.num) - jobNumberSortKey(b.num) || a.num.localeCompare(b.num))
}

/** The sheet's sentence and button for the jobs picked (anchor first). */
export function coversSheetWords(pickedNums: ReadonlyArray<string>, mode: 'add' | 'edit'): { summary: string; button: string } {
  const list = pickedNums.filter((n) => n.trim())
  const n = list.length
  if (mode === 'edit') {
    if (n === 0) return { summary: 'Pick at least one job. To remove the paper from every job, use Take it off.', button: 'Save' }
    return { summary: n === 1 ? `The paper will cover job ${list[0]}.` : `The paper will cover jobs ${joinJobNumbers(list)}.`, button: 'Save the jobs' }
  }
  if (n === 0) return { summary: 'Pick at least one job the paper names.', button: 'File it' }
  if (n === 1) return { summary: `Job ${list[0]} will read signed and on file.`, button: 'File for this job' }
  return { summary: `Jobs ${joinJobNumbers(list)} will read signed and on file. One paper covers ${allOfCount(n)}.`, button: `File for ${n} jobs` }
}

/** What changes when the office saves new ticks for a paper that already covers some jobs. */
export function coversEditDiff(currentJobIds: ReadonlyArray<string>, pickedJobIds: ReadonlyArray<string>): { add: string[]; remove: string[] } {
  const cur = new Set(currentJobIds)
  const next = new Set(pickedJobIds)
  return { add: [...next].filter((id) => !cur.has(id)), remove: [...cur].filter((id) => !next.has(id)) }
}

export type PaperRowLike = {
  id: string
  job_id: string
  status: string
  voided_at: string | null
  signer_mode: string | null
  signed_at: string | null
  signer_printed_name: string | null
  signed_document_url: string | null
  paper_upload_path: string | null
  covers_group_id?: string | null
  created_at?: string | null
} & SignerFramesRow

export type CoversPaper = {
  key: string
  /** The row to copy when a job is added (the newest in the group). */
  source: PaperRowLike
  jobIds: string[]
  signedAt: string | null
  signerName: string | null
  documentUrl: string | null
  hasUpload: boolean
}

/** A live, signed paper filing (a Drive link or a scan) — the only kind a job can be added to. */
export function isLivePaperFiling(r: PaperRowLike): boolean {
  return r.status === 'signed' && r.voided_at == null && r.signer_mode === 'paper' && Boolean((r.signed_document_url ?? '').trim() || (r.paper_upload_path ?? '').trim())
}

/** Live signed paper filings grouped as papers, newest signature first. */
export function groupPapers(rows: ReadonlyArray<PaperRowLike>): CoversPaper[] {
  const byKey = new Map<string, PaperRowLike[]>()
  for (const r of rows) {
    if (!isLivePaperFiling(r)) continue
    const k = coversGroupKey(r)
    const list = byKey.get(k)
    if (list) list.push(r)
    else byKey.set(k, [r])
  }
  const papers: CoversPaper[] = []
  for (const [key, list] of byKey) {
    const newest = [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]!
    papers.push({
      key,
      source: newest,
      jobIds: [...new Set(list.map((r) => r.job_id))],
      signedAt: newest.signed_at,
      // Who signed, in the kernel's words (v2.4590): a filing's typed name today; both, once a filing records two frames.
      signerName: signerNamesLine(newest) || newest.signer_printed_name,
      documentUrl: (newest.signed_document_url ?? '').trim() || null,
      hasUpload: Boolean((newest.paper_upload_path ?? '').trim()),
    })
  }
  return papers.sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''))
}

/** The papers to offer a job with nothing on file: those on the same customer's other jobs. */
export function siblingPaperOffers(papers: ReadonlyArray<CoversPaper>, jobId: string): CoversPaper[] {
  return papers.filter((p) => !p.jobIds.includes(jobId))
}

/** The offer's sentence: "A signed paper covers jobs 251, 825 and 843. Does it name this job too?" */
export function siblingOfferWords(jobNumbers: ReadonlyArray<string>): string {
  const list = sortJobNumbers(jobNumbers)
  const which = list.length === 1 ? `job ${list[0]}` : `jobs ${joinJobNumbers(list)}`
  return `A signed paper on file covers ${which}. Does it name this job too?`
}
