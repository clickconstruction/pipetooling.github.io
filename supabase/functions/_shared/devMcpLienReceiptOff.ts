// A wrong mail receipt taken off a filed lien affidavit's copy, from the dev seat (v2.7909).
//
// plan_lien_receipt_off → apply_lien_receipt_off is **Take off** on a copy's receipt, as the job's Lien window and the
// Lien desk's Filed liens: copies to mail window do it (src/components/jobs/LienReceiptPhotoPress.tsx →
// src/lib/jobs/lienReceiptKeepIo.ts → lienSendsWithProof with `receiptUrl: ''`): one update of the filed affidavit's
// `sends`, the receipt's link gone from that copy's send and nothing else moved, and then the file sent to Drive's
// trash through drive-link's own door once no lien record names it. The day served is never read as an input and never
// written: plan_lien_service records the day, and this pair cannot move it.
//
// It exists because a file can land in a receipt slot that is no receipt. On 2026-11-18 the clerk's stamped PDFs went
// into all twenty-two envelopes of eleven filed liens, the same file twice a lien, before anything was mailed. A
// receipt on record reads as proof, so the desk would never ask for the real one. The desk takes each off by hand;
// the seat had no way to.
//
// A plan takes one filing's receipts or several, each with its own verdict and its own hash; an apply takes one.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpLienReceiptOff.test.ts).

import { serviceProofLines, type ServiceCopy } from './gcKernels/lib/jobs/lienServiceProof.ts'
import { LIEN_SEND_RECIPIENT_WORDS, parseLienSends, type LienSendLike } from './gcKernels/lib/jobs/lienSendTracking.ts'
import { driveFileIdFromUrl } from './driveUpload.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'
import { LIEN_SERVICE_FILING_COLS, LIEN_SERVICE_JOB_COLS, lienServiceFilingOf, lienServiceHasContractor, type LienServiceFiling, type LienServiceJob, type LienServiceReads } from './devMcpLienService.ts'

export const LIEN_RECEIPT_OFF_VERBS = ['plan_lien_receipt_off', 'apply_lien_receipt_off'] as const
export type LienReceiptOffVerb = (typeof LIEN_RECEIPT_OFF_VERBS)[number]
export function isLienReceiptOffVerb(name: string): name is LienReceiptOffVerb {
  return (LIEN_RECEIPT_OFF_VERBS as readonly string[]).includes(name)
}

/** The most filings one plan takes, as plan_lien_service takes services. */
export const LIEN_RECEIPT_OFF_PLAN_MAX = 20

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA_RE = /^[0-9a-f]{64}$/
const COPIES: readonly ServiceCopy[] = ['owner', 'original_contractor']

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export type LienReceiptOffPayload = {
  action: 'lien_receipt_off'
  job_id: string
  /** Whose receipts come off, the owner's first. */
  copies: ServiceCopy[]
  /** One line on why the file on record is not this copy's mail receipt, read back in the plan and kept in the call log. */
  because: string
}

const SHAPE =
  'a receipt is { job_id (a jobs_ledger.id — find_job), copies: ["owner", "original_contractor"] (whose receipt comes off: one or both; "contractor" reads as original_contractor), because (one line, 10 to 300 characters: why the file on record is not that copy’s mail receipt) }'

/** One filing's take-off, shaped. Whether the filing holds those receipts is the dry run's to say. */
export function lienReceiptOffShape(src: unknown): { ok: true; p: LienReceiptOffPayload } | { ok: false; error: string } {
  const s = obj(src)
  if (!s) return { ok: false, error: SHAPE }
  const jobId = str(s.job_id).toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: `job_id is not a jobs_ledger.id (find_job resolves a number or a name). ${SHAPE}` }
  if (!Array.isArray(s.copies) || s.copies.length < 1) return { ok: false, error: 'copies names whose receipt comes off: ["owner"], ["original_contractor"] or both. Name each copy: a receipt is never taken off by default.' }
  const named = new Set<ServiceCopy>()
  for (const c of s.copies) {
    const name = str(c).toLowerCase()
    if (name === 'owner') named.add('owner')
    else if (name === 'original_contractor' || name === 'contractor') named.add('original_contractor')
    else return { ok: false, error: `copies holds "${String(c)}", which is no copy of a filed affidavit. A copy is owner or original_contractor.` }
  }
  const because = str(s.because).replace(/\s+/g, ' ')
  if (because.length < 10 || because.length > 300) return { ok: false, error: 'because is one line, 10 to 300 characters, on why the file on record is not that copy’s mail receipt. It is read back in the plan and kept in the call log.' }
  return { ok: true, p: { action: 'lien_receipt_off', job_id: jobId, copies: COPIES.filter((c) => named.has(c)), because } }
}

export type LienReceiptOffPlanInput = { ok: true; receipts: Array<{ ok: true; p: LienReceiptOffPayload } | { ok: false; error: string }>; target: string } | { ok: false; error: string }

/** plan_lien_receipt_off's input: `receipt` (one filing) or `receipts` (several), each shaped on its own. */
export function lienReceiptOffPlanInput(input: Json): LienReceiptOffPlanInput {
  const many = Array.isArray(input.receipts) ? (input.receipts as unknown[]) : null
  const one = obj(input.receipt)
  if (many && one) return { ok: false, error: 'plan_lien_receipt_off takes receipt (one filing) or receipts (a list), not both.' }
  const list = many ?? (one ? [one] : null)
  if (!list || list.length < 1) return { ok: false, error: `plan_lien_receipt_off needs receipt or receipts — ${SHAPE}.` }
  if (list.length > LIEN_RECEIPT_OFF_PLAN_MAX) return { ok: false, error: `plan_lien_receipt_off takes at most ${LIEN_RECEIPT_OFF_PLAN_MAX} filings a call; this one carries ${list.length}. Plan the rest in a second call.` }
  const receipts = list.map((r) => lienReceiptOffShape(r))
  const first = receipts.find((r): r is { ok: true; p: LienReceiptOffPayload } => r.ok)
  return { ok: true, receipts, target: list.length === 1 && first ? first.p.job_id : `${list.length} filings` }
}

export type LienReceiptOffApplyInput = { ok: true; p: LienReceiptOffPayload; target: string; planHash: string } | { ok: false; error: string }

/** apply_lien_receipt_off's input: one filing's take-off, as planned, and its own plan hash. */
export function lienReceiptOffApplyInput(input: Json): LienReceiptOffApplyInput {
  if (Array.isArray(input.receipts)) return { ok: false, error: 'apply_lien_receipt_off applies one filing a call: send receipt (the entry as you planned it) with that entry’s own plan_hash.' }
  const shaped = lienReceiptOffShape(input.receipt)
  if (!shaped.ok) return { ok: false, error: `apply_lien_receipt_off needs receipt — ${shaped.error}` }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!SHA_RE.test(h)) return { ok: false, error: 'apply_lien_receipt_off needs plan_hash — the 64-hex value plan_lien_receipt_off gave this filing.' }
  return { ok: true, p: shaped.p, target: shaped.p.job_id, planHash: h }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type LienReceiptOffWorld = {
  job: LienServiceJob | null
  /** The job's live filed affidavit, the newest when a job somehow holds two: the one plan_lien_service records on. */
  filing: LienServiceFiling | null
}

export async function readLienReceiptOffWorld(reads: LienServiceReads, p: Pick<LienReceiptOffPayload, 'job_id'>): Promise<LienReceiptOffWorld> {
  const job = ((await reads.rows('jobs_ledger', `select=${LIEN_SERVICE_JOB_COLS}&id=eq.${p.job_id}`))[0] as LienServiceJob | undefined) ?? null
  if (!job) return { job: null, filing: null }
  const row = (await reads.rows('job_lien_filings', `select=${LIEN_SERVICE_FILING_COLS}&job_id=eq.${job.id}&kind=eq.affidavit&voided_at=is.null&filed_at=not.is.null&order=created_at.desc&limit=1`))[0]
  return { job, filing: row ? lienServiceFilingOf(row) : null }
}

// ── the take-off ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The filing's `sends` with one copy's receipt gone: the client's `lienSendsWithProof(sends, copy, { receiptUrl: '' })`
 * (src/lib/jobs/lienReceiptFile.ts), which the seat cannot import because that file is the browser's. The copy's send
 * keeps its method, its number, its day and whatever a mail provider put on it. A send left with no number, no day and
 * no provider's piece is dropped, so a receipt taken off an unserved lien leaves the filing as it was. Every other
 * copy's send is untouched. The test holds the two to the same answer, case by case.
 */
export function lienSendsWithoutReceipt(sends: unknown, copy: ServiceCopy): LienSendLike[] {
  const rows = parseLienSends(sends)
  const at = rows.findIndex((s) => s.recipient === copy)
  if (at < 0) return rows
  const next: LienSendLike = { ...rows[at]! }
  delete next.receipt_url
  const empty = !(next.tracking ?? '').trim() && !(next.sent_on ?? '').trim() && !(next.piece_id ?? '').trim()
  return empty ? rows.filter((_, i) => i !== at) : rows.map((s, i) => (i === at ? next : s))
}

const copyWords = (copy: ServiceCopy): string => (copy === 'owner' ? 'the owner’s copy' : 'the original contractor’s copy')
const listWords = (parts: string[]): string => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

/** What becomes of the file a receipt's link named, said before the write. */
export const LIEN_RECEIPT_OFF_FILE_WORDS = {
  drive: 'A Drive file. Once the filing no longer names it, it goes to Drive’s trash when it sits in this job’s Sent by us folder and no lien record names it. Drive keeps it 30 days.',
  link: 'Not a Drive file link: the link is forgotten and nothing is moved.',
} as const

/** One receipt the write takes off: whose copy, the link the filing holds and the Drive file it names, if it names one. */
export type LienReceiptOffTake = { of: ServiceCopy; url: string; driveFileId: string | null }

export type LienReceiptOffWrite = {
  filingId: string
  /** The day served as the plan read it: the write is held to it, so a day recorded since stops the apply. */
  servedAt: string | null
  sends: LienSendLike[]
  takes: LienReceiptOffTake[]
}

export type LienReceiptOffDryRun = { ok: true; reply: Json; write: LienReceiptOffWrite } | { ok: false; refused: string }

const proofWords = (sends: unknown) => serviceProofLines(sends).map((l) => ({ copy: l.recipient, tracking: l.tracking || null, receipt: l.receiptUrl || null }))

/**
 * What the plan says and what the hash commits to: the job and its filed affidavit, each receipt that comes off with
 * what becomes of its file, the proof before and after, and the `sends` the write sets. Refuses a job not visible, a
 * job with no filed affidavit, and a named copy that carries no receipt.
 */
export function lienReceiptOffDryRun(p: LienReceiptOffPayload, world: LienReceiptOffWorld): LienReceiptOffDryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  const filing = world.filing
  if (!filing) return { ok: false, refused: `${label}: no filed lien affidavit is on record for this job, so no copy carries a receipt. read_lien_filings lists the filed liens.` }
  const held = parseLienSends(filing.sends)
  const takes: LienReceiptOffTake[] = []
  const bare: ServiceCopy[] = []
  for (const copy of p.copies) {
    const url = (held.find((s) => s.recipient === copy)?.receipt_url ?? '').trim()
    if (url) takes.push({ of: copy, url, driveFileId: driveFileIdFromUrl(url) })
    else bare.push(copy)
  }
  if (bare.length > 0) {
    const has = takes.map((t) => t.of)
    return {
      ok: false,
      refused: `${label}: ${listWords(bare.map(copyWords))} ${bare.length === 1 ? 'carries' : 'carry'} no receipt on the filing, so there is nothing to take off. ${has.length > 0 ? `Send copies: ${JSON.stringify(has)} to take off what is there.` : 'Nothing on this filing changes.'}`,
    }
  }
  let sends: LienSendLike[] = held
  for (const t of takes) sends = lienSendsWithoutReceipt(sends, t.of)
  const hasContractor = lienServiceHasContractor(filing, job)
  const copiesLeft = filing.served_at ? takes.map((t) => copyWords(t.of)) : []
  return {
    ok: true,
    write: { filingId: filing.id, servedAt: filing.served_at, sends, takes },
    reply: {
      action: 'lien_receipt_off',
      job: { id: job.id, label, name: (job.job_name ?? '').trim() || null, address: (job.job_address ?? '').trim() || null },
      filing: { id: filing.id, recording_number: filing.recording_number || null, county: filing.county || null, filed_on: filing.filed_at, serve_by: filing.serve_due, served_on: filing.served_at },
      copies: hasContractor ? 'two: the owner and the original contractor' : 'one: the owner (the job was contracted with the owner)',
      because: p.because,
      takes_off: takes.map((t) => ({ copy: t.of, who: LIEN_SEND_RECIPIENT_WORDS[t.of] ?? t.of, receipt: t.url, file: t.driveFileId ? LIEN_RECEIPT_OFF_FILE_WORDS.drive : LIEN_RECEIPT_OFF_FILE_WORDS.link })),
      before: { proof: proofWords(filing.sends) },
      after: { proof: proofWords(sends) },
      keeps: 'The day served, each mail number and every other copy’s send stay as they are. This pair cannot write the day.',
      ...(copiesLeft.length > 0 ? { leaves_no_receipt: `The copies are recorded as mailed on ${filing.served_at}. After this, ${listWords(copiesLeft)} ${copiesLeft.length === 1 ? 'has' : 'have'} no receipt on record, and read_lien_filings lists the filing as proof left until the real one is added (plan_lien_service with the same day and the receipt).` } : {}),
      writes: { filing: filing.id, sends },
      says: `${label}: the receipt comes off ${listWords(takes.map((t) => copyWords(t.of)))}.`,
      not_done: 'A record alone: nothing is mailed, printed or sent by this call, and no real receipt is added. plan_lien_service adds a receipt once the copies are mailed.',
    },
  }
}

/** Two entries of one call for the same job cannot both stand. */
export function lienReceiptOffBatchClashes(receipts: ReadonlyArray<LienReceiptOffPayload | null>): Map<number, string> {
  const out = new Map<number, string>()
  const first = new Map<string, number>()
  receipts.forEach((p, i) => {
    if (!p) return
    const prior = first.get(p.job_id)
    if (prior === undefined) {
      first.set(p.job_id, i)
      return
    }
    if (!out.has(i)) out.set(i, `This call names the same job twice (entry ${prior + 1}). One filed affidavit a job: name both copies in one entry.`)
    if (!out.has(prior)) out.set(prior, `This call names the same job twice (entry ${i + 1}). One filed affidavit a job: name both copies in one entry.`)
  })
  return out
}

export function lienReceiptOffRefusedEntry(index: number, p: LienReceiptOffPayload | null, why: string): Json {
  return { entry: index + 1, status: 'refused', ...(p ? { job_id: p.job_id } : {}), why }
}

/** plan_lien_receipt_off's reply: the count of each verdict, what to do next, and the entries in the order sent. */
export function lienReceiptOffPlanReply(entries: ReadonlyArray<Json>): Json {
  const ready = entries.filter((e) => e.status === 'ready').length
  const refused = entries.length - ready
  return {
    receipts: `${entries.length} ${entries.length === 1 ? 'filing' : 'filings'}: ${ready} ready${refused > 0 ? `, ${refused} refused` : ''}.`,
    next:
      (ready > 0 ? 'Read each ready entry to the person: the job, whose receipt comes off and what the file on record is. Then call apply_lien_receipt_off with receipt (that entry as you sent it) and that entry’s own plan_hash. One apply a filing: one that fails never stops the rest. ' : '') +
      (refused > 0 ? 'A refused entry says why. ' : '') +
      'apply runs the dry run again first: if anything changed, the hash no longer matches and nothing is written.',
    entries,
  }
}

// ── what the files on record are ─────────────────────────────────────────────────────────────────────────────────

/** A Drive file's facts as the read-only door hands them, or why it was not read. */
export type LienReceiptFileRead = { name: string; size_bytes: number | null; sha256: string | null; trashed: boolean } | { unread: string }

/** One Drive answer to a file's `name,size,sha256Checksum,trashed` read, as the reading takes it. */
export function lienReceiptFileReadFrom(status: number, body: Json): LienReceiptFileRead {
  if (status === 404) return { unread: 'Drive holds no such file, or the app’s account cannot see it.' }
  if (status < 200 || status >= 300) return { unread: `Drive answered ${status}, so the file was not read.` }
  const size = typeof body.size === 'string' || typeof body.size === 'number' ? Number(body.size) : NaN
  return { name: str(body.name), size_bytes: Number.isFinite(size) ? size : null, sha256: typeof body.sha256Checksum === 'string' && body.sha256Checksum ? body.sha256Checksum.toLowerCase() : null, trashed: body.trashed === true }
}

/** How near two sizes must be to read as the same pages saved twice: a re-saved scan moves by a few hundred bytes. */
const SAME_PAGES_BYTES = 2000

/**
 * What the files in the receipt slots are, beside the filing's saved copy, read off file facts alone (no file is
 * opened). The two tells of 2026-11-18: both copies carry one file byte for byte, and a receipt is the size of the
 * stamped lien. A doubt is a reading for the person, never a verdict: the plan stands whatever this says, and it is
 * not part of the hash, so a Drive read that fails never moves a plan.
 */
export function lienReceiptFilesReading(receipts: ReadonlyArray<{ of: ServiceCopy; file: LienReceiptFileRead }>, savedCopy: LienReceiptFileRead | null): Json {
  const facts = (f: LienReceiptFileRead): Json => ('unread' in f ? { unread: f.unread } : { name: f.name, size_bytes: f.size_bytes, sha256: f.sha256 ? `${f.sha256.slice(0, 12)}…` : null, ...(f.trashed ? { trashed: 'already in Drive’s trash' } : {}) })
  const read = receipts.filter((r): r is { of: ServiceCopy; file: Exclude<LienReceiptFileRead, { unread: string }> } => !('unread' in r.file))
  const reading: string[] = []
  if (read.length === 2 && read[0]!.file.sha256 && read[0]!.file.sha256 === read[1]!.file.sha256) reading.push('Both copies carry the same file, byte for byte. Each envelope has its own mail receipt.')
  if (savedCopy && !('unread' in savedCopy) && typeof savedCopy.size_bytes === 'number') {
    const near = read.filter((r) => typeof r.file.size_bytes === 'number' && Math.abs(r.file.size_bytes - (savedCopy.size_bytes as number)) <= SAME_PAGES_BYTES)
    const same = read.filter((r) => r.file.sha256 && r.file.sha256 === savedCopy.sha256)
    if (same.length > 0) reading.push(`${listWords(same.map((r) => copyWords(r.of)))}: the receipt on record is the filing’s saved copy, byte for byte. It is the lien, not a mail receipt.`)
    else if (near.length > 0) reading.push(`${listWords(near.map((r) => copyWords(r.of)))}: the receipt on record is the size of the filing’s saved copy (${near.map((r) => r.file.size_bytes).join(' and ')} bytes against ${savedCopy.size_bytes}). It may be the lien, not a mail receipt.`)
  }
  if (reading.length === 0 && read.length > 0) reading.push('Nothing in the file facts says these are not mail receipts. Open each before it is taken off.')
  return {
    files: receipts.map((r) => ({ copy: r.of, ...facts(r.file) })),
    ...(savedCopy ? { saved_copy: facts(savedCopy) } : {}),
    reading,
    read_from: 'File facts alone, through the read-only Drive door. No file was opened.',
  }
}

// ── the apply ────────────────────────────────────────────────────────────────────────────────────────────────────

/** What became of one receipt's file once its link was off the filing. */
export type LienReceiptOffFile = { of: ServiceCopy; url: string; result: 'trashed' | 'link' | { left: string } }

export type LienReceiptOffOutcome = {
  /** The filing read back after the write, or null when the write let no row through. */
  back: { served_at: string | null; sends: unknown } | null
  files: LienReceiptOffFile[]
}

/** Whether the write landed: the row read back, and no named copy still carrying a receipt. Only then is a file moved. */
export function lienReceiptOffLanded(back: LienReceiptOffOutcome['back'], write: Pick<LienReceiptOffWrite, 'takes'>): boolean {
  if (!back) return false
  return !parseLienSends(back.sends).some((s) => write.takes.some((t) => t.of === s.recipient) && (s.receipt_url ?? '').trim())
}

/** The apply's reply: each receipt gone from the filing with what became of its file, and the proof as it stands. */
export function lienReceiptOffAppliedWords(p: LienReceiptOffPayload, label: string, write: LienReceiptOffWrite, out: LienReceiptOffOutcome): Json {
  if (!out.back) return { action: p.action, ok: false, why: `${label}: the receipt did not come off (RLS let no row through, the filing was voided, or its day served changed since the plan). Nothing was written and no file was moved. Plan again.` }
  const still = parseLienSends(out.back.sends).filter((s) => write.takes.some((t) => t.of === s.recipient) && (s.receipt_url ?? '').trim())
  if (still.length > 0) return { action: p.action, ok: false, why: `${label}: the filing still names a receipt on ${listWords(still.map((s) => copyWords(s.recipient as ServiceCopy)))} after the write. No file was moved. Plan again.` }
  const left = out.files.filter((f) => typeof f.result === 'object')
  return {
    action: p.action,
    ok: true,
    filing_id: write.filingId,
    took_off: out.files.map((f) => ({
      copy: f.of,
      receipt_was: f.url,
      file: f.result === 'trashed' ? 'in Drive’s trash, where Drive keeps it 30 days' : f.result === 'link' ? 'not a Drive file: the link is forgotten' : `left where it is: ${f.result.left}`,
    })),
    served_on: out.back.served_at,
    proof: proofWords(out.back.sends),
    ...(left.length > 0 ? { files_left: 'A file left where it is no longer shows on the filing. It can be trashed in Drive by hand, or put back with plan_lien_service and receipt_link.' } : {}),
    next: `${label}: ${listWords(write.takes.map((t) => copyWords(t.of)))} ${write.takes.length === 1 ? 'carries' : 'carry'} no receipt now. The day served and the mail numbers are as they were.`,
  }
}
