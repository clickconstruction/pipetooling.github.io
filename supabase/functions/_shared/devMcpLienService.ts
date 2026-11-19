// The copies of a filed lien affidavit recorded as mailed, and what is left on the filed liens, from the dev seat
// (punch list #366's seat door, the PR after plan_lien_filing).
//
// plan_lien_service → apply_lien_service is Record service… on the job's Lien window and the Lien desk's Mail the
// copies window (src/components/jobs/LienFilingTabs.tsx → recordService; src/lib/jobs/lienServeNumbersIo.ts →
// recordLienServices): one update of the filed affidavit's row, the day on served_at and, through the form's own
// kernel (lienServiceProof.ts → serviceSends), a send for each copy that has a certified mail number or a receipt
// photo. § 53.055 gives five days from filing to mail a copy to the owner, and to the original contractor on a job
// under one. The form opens on what the filing already holds, so a number or a photo saved earlier is kept unless the
// call replaces it. A receipt photo is a staged upload, the route plan_lien_filing's scan takes, and lands in the
// job's Drive folder under Team only › Sent by us by the photo press's own name (lienReceiptPhotoName).
//
// read_lien_filings lists the filed affidavits with what each still lacks: its saved copy, its recording number, its
// copies served, the proof of each copy. A read: it writes nothing.
//
// A plan takes one service or several, each with its own verdict and its own hash; an apply takes one.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpLienService.test.ts).

import { lienReceiptPhotoName, serviceCopyDraft, serviceProofLines, serviceProofMissing, serviceSavedWords, serviceSends, type ServiceCopy, type ServiceCopyDraft } from './gcKernels/lib/jobs/lienServiceProof.ts'
import { normalizeDocumentUrl } from './gcKernels/lib/jobs/lienFilingDocumentLink.ts'
import { effectiveJobLedgerNumber } from './gcKernels/lib/ledgerDisplayPrefixes.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'
import { LIEN_SCAN_LANDING_WORDS, scanMime, type LienFilingScan } from './devMcpLienFiling.ts'

export const LIEN_SERVICE_VERBS = ['plan_lien_service', 'apply_lien_service'] as const
export type LienServiceVerb = (typeof LIEN_SERVICE_VERBS)[number]
export function isLienServiceVerb(name: string): name is LienServiceVerb {
  return (LIEN_SERVICE_VERBS as readonly string[]).includes(name)
}

/** The most services one plan takes, as plan_lien_filing takes filings. */
export const LIEN_SERVICE_PLAN_MAX = 20
/** The most a receipt photo may be: the job folder's own cap. */
export const LIEN_RECEIPT_MAX_BYTES = 10 * 1024 * 1024

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const SHA_RE = /^[0-9a-f]{64}$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** One copy as the caller gives it: a number, a receipt photo as a file, a link to one already saved. Each is optional. */
export type LienServiceCopy = { tracking: string | null; receipt: LienFilingScan | null; receipt_link: string | null }

export type LienServicePayload = {
  action: 'lien_service'
  job_id: string
  served_on: string
  owner: LienServiceCopy | null
  contractor: LienServiceCopy | null
}

const SHAPE =
  'a service is { job_id (a jobs_ledger.id — find_job), served_on (YYYY-MM-DD, the day the copies were mailed), owner?: { tracking? (the certified mail number), receipt?: { name, size_bytes, sha256 } (a photo or scan of the receipt, a file on your machine) | receipt_link? }, contractor?: { the same } (the original contractor’s copy, on a job under a GC) }'

function copyShape(src: unknown, who: string): { ok: true; copy: LienServiceCopy | null } | { ok: false; error: string } {
  if (src === undefined || src === null) return { ok: true, copy: null }
  const c = obj(src)
  if (!c) return { ok: false, error: `${who} is { tracking?, receipt?: { name, size_bytes, sha256 } | receipt_link? }.` }
  const tracking = str(c.tracking).replace(/\s+/g, ' ')
  if (tracking.length > 80) return { ok: false, error: `${who}.tracking is the certified mail number on the receipt, at most 80 characters.` }
  if (c.receipt !== undefined && c.receipt !== null && c.receipt_link !== undefined && c.receipt_link !== null) return { ok: false, error: `${who}: send receipt (a file on your machine) or receipt_link (a link to a photo already saved), not both.` }
  let receipt: LienFilingScan | null = null
  if (c.receipt !== undefined && c.receipt !== null) {
    const r = obj(c.receipt)
    const name = str(r?.name)
    const size = typeof r?.size_bytes === 'number' && Number.isInteger(r.size_bytes) ? r.size_bytes : -1
    const sha = str(r?.sha256).toLowerCase()
    if (!r || !name || name.length > 200 || /[\\/]/.test(name)) return { ok: false, error: `${who}.receipt.name is the file’s own name with its extension, no folders.` }
    if (!scanMime(name)) return { ok: false, error: `${who}.receipt: ${name} is not a photo or a scan. Send a picture or a PDF.` }
    if (size < 1 || size > LIEN_RECEIPT_MAX_BYTES) return { ok: false, error: `${who}.receipt.size_bytes is the file’s size in bytes, from 1 to ${LIEN_RECEIPT_MAX_BYTES / 1024 / 1024} MB.` }
    if (!SHA_RE.test(sha)) return { ok: false, error: `${who}.receipt.sha256 is the file’s sha256, 64 hex characters (shasum -a 256 file).` }
    receipt = { name, size_bytes: size, sha256: sha }
  }
  let link: string | null = null
  if (c.receipt_link !== undefined && c.receipt_link !== null) {
    link = normalizeDocumentUrl(str(c.receipt_link)) || null
    if (!link) return { ok: false, error: `${who}.receipt_link is a link to the receipt’s photo.` }
  }
  return { ok: true, copy: { tracking: tracking || null, receipt, receipt_link: link } }
}

/** One service's shape, checked. Whether the filing takes it is the dry run's to say. */
export function lienServiceShape(src: unknown): { ok: true; p: LienServicePayload } | { ok: false; error: string } {
  const s = obj(src)
  if (!s) return { ok: false, error: SHAPE }
  const jobId = str(s.job_id).toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: `job_id is not a jobs_ledger.id (find_job resolves a number or a name). ${SHAPE}` }
  const servedOn = str(s.served_on)
  if (!YMD_RE.test(servedOn) || Number.isNaN(new Date(`${servedOn}T12:00:00Z`).getTime())) return { ok: false, error: 'served_on is the day the copies were mailed, YYYY-MM-DD.' }
  const owner = copyShape(s.owner, 'owner')
  if (!owner.ok) return owner
  const contractor = copyShape(s.contractor, 'contractor')
  if (!contractor.ok) return contractor
  return { ok: true, p: { action: 'lien_service', job_id: jobId, served_on: servedOn, owner: owner.copy, contractor: contractor.copy } }
}

export type LienServicePlanInput = { ok: true; services: Array<{ ok: true; p: LienServicePayload } | { ok: false; error: string }>; target: string } | { ok: false; error: string }

/** plan_lien_service's input: `service` (one) or `services` (a trip to the post office), each shaped on its own. */
export function lienServicePlanInput(input: Json): LienServicePlanInput {
  const many = Array.isArray(input.services) ? (input.services as unknown[]) : null
  const one = obj(input.service)
  if (many && one) return { ok: false, error: 'plan_lien_service takes service (one) or services (a list), not both.' }
  const list = many ?? (one ? [one] : null)
  if (!list || list.length < 1) return { ok: false, error: `plan_lien_service needs service or services — ${SHAPE}.` }
  if (list.length > LIEN_SERVICE_PLAN_MAX) return { ok: false, error: `plan_lien_service takes at most ${LIEN_SERVICE_PLAN_MAX} services a call; this one carries ${list.length}. Plan the rest in a second call.` }
  const services = list.map((s) => lienServiceShape(s))
  const first = services.find((s): s is { ok: true; p: LienServicePayload } => s.ok)
  return { ok: true, services, target: list.length === 1 && first ? first.p.job_id : `${list.length} services` }
}

export type LienServiceApplyInput = { ok: true; p: LienServicePayload; target: string; planHash: string } | { ok: false; error: string }

/** apply_lien_service's input: one service, as planned, and its own plan hash. */
export function lienServiceApplyInput(input: Json): LienServiceApplyInput {
  if (Array.isArray(input.services)) return { ok: false, error: 'apply_lien_service applies one service a call: send service (the entry as you planned it) with that entry’s own plan_hash.' }
  const shaped = lienServiceShape(input.service)
  if (!shaped.ok) return { ok: false, error: `apply_lien_service needs service — ${shaped.error}` }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!SHA_RE.test(h)) return { ok: false, error: 'apply_lien_service needs plan_hash — the 64-hex value plan_lien_service gave this service.' }
  return { ok: true, p: shaped.p, target: shaped.p.job_id, planHash: h }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type LienServiceReads = { rows(table: string, query: string): Promise<Json[]> }

export const LIEN_SERVICE_JOB_COLS = 'id,job_name,job_address,hcp_number,click_number,gc_customer_id'
export const LIEN_SERVICE_FILING_COLS = 'id,job_id,kind,fields,filed_at,recording_number,county,document_url,serve_due,served_at,sends,created_at'

export type LienServiceFiling = { id: string; job_id: string; fields: unknown; filed_at: string; recording_number: string; county: string; document_url: string; serve_due: string | null; served_at: string | null; sends: unknown }
export type LienServiceJob = { id: string; job_name: string | null; job_address: string | null; hcp_number: string | null; click_number: string | null; gc_customer_id: string | null }

export type LienServiceWorld = {
  job: LienServiceJob | null
  /** The job's live filed affidavit, the newest when a job somehow holds two. */
  filing: LienServiceFiling | null
}

/** A `job_lien_filings` row as the service verbs and the read hold it. */
export const lienServiceFilingOf = (r: Json): LienServiceFiling => ({
  id: str(r.id),
  job_id: str(r.job_id),
  fields: r.fields,
  filed_at: str(r.filed_at),
  recording_number: str(r.recording_number),
  county: str(r.county),
  document_url: str(r.document_url),
  serve_due: str(r.serve_due) || null,
  served_at: str(r.served_at) || null,
  sends: r.sends,
})

export async function readLienServiceWorld(reads: LienServiceReads, p: LienServicePayload): Promise<LienServiceWorld> {
  const job = ((await reads.rows('jobs_ledger', `select=${LIEN_SERVICE_JOB_COLS}&id=eq.${p.job_id}`))[0] as LienServiceJob | undefined) ?? null
  if (!job) return { job: null, filing: null }
  const row = (await reads.rows('job_lien_filings', `select=${LIEN_SERVICE_FILING_COLS}&job_id=eq.${job.id}&kind=eq.affidavit&voided_at=is.null&filed_at=not.is.null&order=created_at.desc&limit=1`))[0]
  return { job, filing: row ? lienServiceFilingOf(row) : null }
}

/**
 * Whether an original contractor gets a copy: the filing's own answer when its paper keeps one (the short form's
 * `isSub`), else whether the job sits under a GC. The Mail the copies window's rule (`lienServeHasContractor`).
 */
export function lienServiceHasContractor(filing: Pick<LienServiceFiling, 'fields'>, job: Pick<LienServiceJob, 'gc_customer_id'>): boolean {
  const kept = obj(filing.fields)?.isSub
  return typeof kept === 'boolean' ? kept : !!(job.gc_customer_id ?? '').trim()
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A receipt photo to file at apply: whose copy it proves, the staged file and its name in Drive. */
export type LienServiceReceipt = { of: ServiceCopy; staged: LienFilingScan; name: string; mime: string }

export type LienServiceWrite = {
  filingId: string
  servedOn: string
  /** Each copy's draft as it will be saved, a staged receipt's link still to come. */
  owner: ServiceCopyDraft
  contractor: ServiceCopyDraft | null
  receipts: LienServiceReceipt[]
}

export type LienServiceDryRun = { ok: true; reply: Json; write: LienServiceWrite } | { ok: false; refused: string }

const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

/** The `sends` the form would write for a write, with each staged receipt's link once it has landed. */
export function lienServiceSends(write: LienServiceWrite, receiptUrls: Partial<Record<ServiceCopy, string>> = {}) {
  const withUrl = (d: ServiceCopyDraft | null, of: ServiceCopy): ServiceCopyDraft | null => (d ? { ...d, receiptUrl: receiptUrls[of] ?? d.receiptUrl } : null)
  return serviceSends({ servedOn: write.servedOn, owner: withUrl(write.owner, 'owner')!, contractor: withUrl(write.contractor, 'original_contractor') })
}

/**
 * What the plan says and what the hash commits to: the job and its filed affidavit, the day and each copy before and
 * after, the receipts to file, and what the form's own toast would say. Refuses a job not visible, a job with no
 * filed affidavit, a day ahead of today or before the filing, a contractor's copy on a job with no original
 * contractor, and a service that would change nothing.
 */
export function lienServiceDryRun(p: LienServicePayload, world: LienServiceWorld, todayYmd: string): LienServiceDryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  const filing = world.filing
  if (!filing) return { ok: false, refused: `${label}: no filed lien affidavit is on record for this job, so there are no copies to serve. Record the filing first (plan_lien_filing).` }
  if (p.served_on > todayYmd) return { ok: false, refused: `${label}: served_on ${p.served_on} is ahead of today (${todayYmd}). Record the copies once they are mailed.` }
  if (p.served_on < filing.filed_at) return { ok: false, refused: `${label}: served_on ${p.served_on} is before the day the affidavit was filed (${filing.filed_at}). A copy of a filed affidavit is mailed on or after that day.` }
  const hasContractor = lienServiceHasContractor(filing, job)
  if (p.contractor && !hasContractor) return { ok: false, refused: `${label}: this job was contracted with the owner, so it mails one copy, the owner’s. Send no contractor.` }

  const jobNumber = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const receipts: LienServiceReceipt[] = []
  // The form opens on what the filing holds; what the call gives is typed over it.
  const draft = (of: ServiceCopy, given: LienServiceCopy | null): ServiceCopyDraft => {
    const kept = serviceCopyDraft(filing.sends, of)
    if (!given) return kept
    if (given.receipt) {
      const ext = /\.([a-z0-9]{1,5})$/i.exec(given.receipt.name)?.[1]?.toLowerCase() ?? 'jpg'
      receipts.push({ of, staged: given.receipt, name: lienReceiptPhotoName(of, jobNumber, p.served_on, ext), mime: scanMime(given.receipt.name) })
    }
    return { tracking: given.tracking ?? kept.tracking, receiptUrl: given.receipt ? kept.receiptUrl : (given.receipt_link ?? kept.receiptUrl) }
  }
  const owner = draft('owner', p.owner)
  const contractor = hasContractor ? draft('original_contractor', p.contractor) : null
  const write: LienServiceWrite = { filingId: filing.id, servedOn: p.served_on, owner, contractor, receipts }
  const sends = lienServiceSends(write)
  const beforeLines = serviceProofLines(filing.sends)
  const sameSends = JSON.stringify(sends) === JSON.stringify(lienServiceSends({ ...write, servedOn: filing.served_at ?? '', owner: serviceCopyDraft(filing.sends, 'owner'), contractor: hasContractor ? serviceCopyDraft(filing.sends, 'original_contractor') : null }))
  if (filing.served_at === p.served_on && receipts.length === 0 && sameSends) return { ok: false, refused: `${label}: the copies are already recorded as mailed on ${p.served_on} with these numbers. Nothing to change.` }

  const late = filing.serve_due ? daysBetween(filing.serve_due, p.served_on) : 0
  // A receipt to come counts as proof for the toast, as a photo taken on the form does.
  const forToast = lienServiceSends(write, Object.fromEntries(receipts.map((r) => [r.of, 'staged'])))
  const copyWords = (of: ServiceCopy, d: ServiceCopyDraft | null) => (d ? { tracking: d.tracking || null, receipt: receipts.some((r) => r.of === of) ? 'a photo, filed at apply' : d.receiptUrl || null } : null)
  return {
    ok: true,
    write,
    reply: {
      action: 'lien_service',
      job: { id: job.id, label, name: (job.job_name ?? '').trim() || null, address: (job.job_address ?? '').trim() || null },
      filing: { id: filing.id, recording_number: filing.recording_number || null, county: filing.county || null, filed_on: filing.filed_at, serve_by: filing.serve_due },
      copies: hasContractor ? 'two: the owner and the original contractor' : 'one: the owner (the job was contracted with the owner)',
      before: { served_on: filing.served_at, proof: beforeLines.map((l) => ({ copy: l.recipient, tracking: l.tracking || null, receipt: l.receiptUrl || null })) },
      after: { served_on: p.served_on, owner: copyWords('owner', owner), ...(hasContractor ? { original_contractor: copyWords('original_contractor', contractor) } : {}) },
      ...(receipts.length > 0 ? { receipts: receipts.map((r) => ({ copy: r.of, lands_in: LIEN_SCAN_LANDING_WORDS, name: r.name, mime: r.mime, size_bytes: r.staged.size_bytes, sha256: r.staged.sha256 })) } : {}),
      writes: { filing: filing.id, served_at: p.served_on, sends },
      ...(filing.served_at && filing.served_at !== p.served_on ? { changes_the_day: `The filing says the copies were mailed on ${filing.served_at}. This changes the day to ${p.served_on}.` } : {}),
      ...(late > 0 ? { late: `The copies were due by ${filing.serve_due} and went ${late} ${late === 1 ? 'day' : 'days'} after. The record keeps the day they went.` } : {}),
      ...(owner.tracking && contractor?.tracking && owner.tracking === contractor.tracking ? { same_number: 'Both copies carry the same certified mail number. Each envelope has its own: check the receipts.' } : {}),
      says: `${label}: ${serviceSavedWords(forToast, hasContractor)}`,
      not_done: 'A record alone: nothing is mailed, printed or sent by this call. The serve-by watch clears on the day.',
    },
  }
}

/** Two entries of one call for the same job cannot both stand. */
export function lienServiceBatchClashes(services: ReadonlyArray<LienServicePayload | null>): Map<number, string> {
  const out = new Map<number, string>()
  const first = new Map<string, number>()
  services.forEach((p, i) => {
    if (!p) return
    const prior = first.get(p.job_id)
    if (prior === undefined) {
      first.set(p.job_id, i)
      return
    }
    if (!out.has(i)) out.set(i, `This call names the same job twice (entry ${prior + 1}). One filed affidavit a job, served once.`)
    if (!out.has(prior)) out.set(prior, `This call names the same job twice (entry ${i + 1}). One filed affidavit a job, served once.`)
  })
  return out
}

export function lienServiceRefusedEntry(index: number, p: LienServicePayload | null, why: string): Json {
  return { entry: index + 1, status: 'refused', ...(p ? { job_id: p.job_id } : {}), why }
}

/** plan_lien_service's reply: the count of each verdict, what to do next, and the entries in the order sent. */
export function lienServicePlanReply(entries: ReadonlyArray<Json>): Json {
  const ready = entries.filter((e) => e.status === 'ready').length
  const refused = entries.length - ready
  return {
    services: `${entries.length} ${entries.length === 1 ? 'service' : 'services'}: ${ready} ready${refused > 0 ? `, ${refused} refused` : ''}.`,
    next:
      (ready > 0 ? 'For each ready entry, PUT each receipt to its upload_url when it has one, then call apply_lien_service with service (that entry as you sent it) and that entry’s own plan_hash. One apply a service: one that fails never stops the rest. ' : '') +
      (refused > 0 ? 'A refused entry says why. ' : '') +
      'apply runs the dry run again first: if anything changed, the hash no longer matches and nothing is written.',
    entries,
  }
}

/** The staged path a receipt waits at, beside the scans, in the dev's own folder. */
export function lienReceiptStagePath(userId: string, receipt: Pick<LienFilingScan, 'sha256' | 'name'>): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(receipt.name)?.[1]?.toLowerCase() ?? 'jpg'
  return `${userId}/lien-receipts/${receipt.sha256.slice(0, 32)}.${ext}`
}

export type LienServiceOutcome = {
  /** The filing read back after the write, or null when the day did not land. */
  back: { served_at: string | null; sends: unknown } | null
  /** Each receipt: its link once filed, or why it was not. */
  receipts: Array<{ of: ServiceCopy; url: string | null; failed?: string }>
}

/** The apply's reply: the day and the proof as the filing now holds them, and any receipt that did not land. */
export function lienServiceAppliedWords(p: LienServicePayload, label: string, write: LienServiceWrite, out: LienServiceOutcome, hasContractor: boolean): Json {
  if (!out.back || out.back.served_at !== write.servedOn) return { action: p.action, ok: false, why: `${label}: the day did not land on the filing (RLS let no row through, or the filing was voided since the plan). Plan again.` }
  const failed = out.receipts.filter((r) => r.failed)
  return {
    action: p.action,
    ok: true,
    filing_id: write.filingId,
    served_on: out.back.served_at,
    proof: serviceProofLines(out.back.sends).map((l) => ({ copy: l.recipient, tracking: l.tracking || null, receipt: l.receiptUrl || null })),
    still_missing: serviceProofMissing(out.back.sends, hasContractor),
    ...(failed.length > 0 ? { receipts_not_filed: failed.map((r) => ({ copy: r.of, why: r.failed })), receipts_next: 'The day and the numbers are recorded. Plan again with the same day and the receipt alone to add its photo.' } : {}),
    next: `${label}: the copies are recorded as mailed on ${out.back.served_at}. The serve-by watch is cleared.`,
  }
}

// ── read_lien_filings ────────────────────────────────────────────────────────────────────────────────────────────

/** What a filed affidavit can still lack, in the order a person would close them. */
export type LienFilingLeft = 'recording_number' | 'saved_copy' | 'service' | 'proof'

export type LienFilingLine = {
  filing_id: string
  job_id: string
  job: string
  job_name: string | null
  county: string | null
  recording_number: string | null
  filed_on: string
  serve_by: string | null
  served_on: string | null
  saved_copy: string | null
  proof: Array<{ copy: string; tracking: string | null; receipt: string | null }>
  left: LienFilingLeft[]
  clock: string | null
}

/** One filed affidavit as the read hands it back, with what it still lacks and where its serve-by day stands. */
export function lienFilingLine(filing: LienServiceFiling, job: LienServiceJob | null, todayYmd: string): LienFilingLine {
  const hasContractor = lienServiceHasContractor(filing, job ?? { gc_customer_id: null })
  const left: LienFilingLeft[] = []
  if (!filing.recording_number) left.push('recording_number')
  if (!normalizeDocumentUrl(filing.document_url)) left.push('saved_copy')
  if (!filing.served_at) left.push('service')
  else if (serviceProofMissing(filing.sends, hasContractor) > 0) left.push('proof')
  let clock: string | null = null
  if (!filing.served_at && filing.serve_due) {
    const days = daysBetween(todayYmd, filing.serve_due)
    clock = days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} left to mail the copies` : days === 0 ? 'the copies are due today' : `the copies are ${-days} ${days === -1 ? 'day' : 'days'} late`
  }
  return {
    filing_id: filing.id,
    job_id: filing.job_id,
    job: job ? jobLabelOf(job) : filing.job_id,
    job_name: job ? (job.job_name ?? '').trim() || null : null,
    county: filing.county || null,
    recording_number: filing.recording_number || null,
    filed_on: filing.filed_at,
    serve_by: filing.serve_due,
    served_on: filing.served_at,
    saved_copy: normalizeDocumentUrl(filing.document_url) || null,
    proof: serviceProofLines(filing.sends).map((l) => ({ copy: l.recipient, tracking: l.tracking || null, receipt: l.receiptUrl || null })),
    left,
    clock,
  }
}

/** read_lien_filings's arguments: `show` (left, the default, or all) and an optional job. */
export function lienFilingsReadArgs(args: Json): { ok: true; show: 'left' | 'all'; jobId: string | null } | { ok: false; error: string } {
  const show = args.show === undefined || args.show === null ? 'left' : args.show === 'left' || args.show === 'all' ? args.show : null
  if (!show) return { ok: false, error: 'read_lien_filings: show is left (the filed liens that still lack something, the default) or all.' }
  const jobId = args.job_id === undefined || args.job_id === null ? null : str(args.job_id).toLowerCase()
  if (jobId !== null && !UUID_RE.test(jobId)) return { ok: false, error: 'read_lien_filings: job_id is a jobs_ledger.id (find_job resolves a number or a name).' }
  return { ok: true, show, jobId }
}

/** The most filed affidavits one read hands back, newest first. */
export const LIEN_FILINGS_READ_MAX = 200

/** The read's reply: a one-line reading, the counts of what is left, and the lines. */
export function lienFilingsReadReply(lines: ReadonlyArray<LienFilingLine>, show: 'left' | 'all', atCap: boolean): Json {
  const shown = show === 'left' ? lines.filter((l) => l.left.length > 0) : [...lines]
  const count = (k: LienFilingLeft) => lines.filter((l) => l.left.includes(k)).length
  const counts = { filed: lines.length, no_recording_number: count('recording_number'), no_saved_copy: count('saved_copy'), copies_not_served: count('service'), served_without_proof: count('proof') }
  const open = lines.filter((l) => l.left.length > 0).length
  return {
    reading: open === 0 ? `${lines.length} filed lien ${lines.length === 1 ? 'affidavit' : 'affidavits'}, and nothing is left on any of them.` : `${lines.length} filed lien ${lines.length === 1 ? 'affidavit' : 'affidavits'}: ${counts.copies_not_served} with copies not served, ${counts.no_saved_copy} with no saved copy, ${counts.no_recording_number} with no recording number, ${counts.served_without_proof} served with a mail receipt still missing.`,
    counts,
    ...(atCap ? { at_cap: `This read hands back the newest ${LIEN_FILINGS_READ_MAX} filed affidavits. Older ones are read with job_id.` } : {}),
    writes: 'plan_lien_filing adds a scan to a filing already on record (the same recording number, with scan), checks a paper against its record (the same number: it answers on_record with each difference) and puts the right file in place of a wrong saved copy (replace_saved_copy). plan_lien_service records the copies. A recording number is typed on the job’s Lien window.',
    filings: shown,
  }
}
