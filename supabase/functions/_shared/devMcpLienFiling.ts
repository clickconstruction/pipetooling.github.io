// A filed lien affidavit recorded from the dev seat (punch list #366's seat door — the owner, 2026-11-16, after eleven
// affidavits came back from two county clerks as scans: "long term I would like to not have to use chrome and I would
// like to build the verbs").
//
// plan_lien_filing → apply_lien_filing is the job's Lien window, affidavit tab, Record the filing (after the County
// Clerk stamps it) — src/components/jobs/LienFilingTabs.tsx → recordAffidavitFiling: one job_lien_filings row, kind
// affidavit, with the claim, the county, the recording number, the day filed, the serve-by day, the saved copy and a
// snapshot of the paper's fields; the scan in the job's Drive folder under Team only › Sent by us, by the press's own
// name (LienFiledScanPress → lienFiledScanName); and the desk's affidavit item marked sent with the filing
// (lienDeskIo.ts → syncLienDeskAfterRecord). The fields are the desk's own recipe (buildLienDeskAffidavitFields), the
// one the paper was approved and printed from.
//
// What the seat adds, because nobody is looking at the paper beside the screen: the caller states what the paper
// says (its claim, its months, the day notice went, the property, the owner) and why it matched the paper to this job,
// and the plan reads each back against what the desk holds. A filing whose paper and desk differ is held, each
// difference named with the door that fixes it, until the desk is fixed and planned again or the call says
// accept_differences. A wrong match files a lien on the wrong job, so the plan leads with the job as a person would
// check it: its number, its name, its address, its customer, its GC and its owner.
//
// A plan takes one filing or a whole visit to the clerk. Each filing gets its own verdict and its own plan hash, and
// an apply takes one: a filing that is held or fails never stops the rest.
//
// A paper already on record (v2.7837, the owner, 2026-11-18, with the clerk's stamped stacks in hand: "help me file
// them carefully, testing along the way"): every lien in the stacks was on record already, and the seat answered each
// with a refusal. It now answers `on_record` and reads what the caller read off the paper against the paper the record
// keeps: the claim, the months, the notice day, the property, the owner, the county and the day. Nothing is written.
// And a saved copy that is the wrong file gives way to the right one: `replace_saved_copy: true` with
// `replace_because`, the Filings list's *change the saved copy*, with the old file sent to Drive's trash.
//
// The scan reaches the server as a staged upload (the route plan_file_plans opened): the plan commits to the file's
// name, size and sha256 and the server hands back a signed upload address; apply reads the staged copy back and files
// it only when it is those bytes. The staging and the Drive put are the server's; this file is the pure half.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpLienFiling.test.ts).

import { buildLienAffidavitQueue, withContractorAddress, withHomesteadAnswer, withPublicOwner, type LienAffidavitEntry, type LienAffidavitRow } from './gcKernels/lib/jobs/lienDeskAffidavits.ts'
import { buildLienDeskAffidavitFields } from './gcKernels/lib/jobs/lienDeskAffidavitFields.ts'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends, lienAffidavitSwornMonths, type LienAffidavitNoticeRow } from './gcKernels/lib/jobs/lienAffidavitNotices.ts'
import { parseLienAffidavitMonthsByHand } from './gcKernels/lib/jobs/lienAffidavitMonthsByHand.ts'
import { describeNoticeMonths } from './gcKernels/lib/jobs/lienNoticeMonthWords.ts'
import { lienAffidavitFormForItem } from './gcKernels/lib/jobs/lienAffidavitForm.ts'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from './gcKernels/lib/jobs/lienProperty.ts'
import { lienSignerNameFor } from './gcKernels/lib/jobs/lienSigner.ts'
import { serveDueForFiling } from './gcKernels/lib/jobs/lienDeadlines.ts'
import { sentAtForTypedDay } from './gcKernels/lib/jobs/lienSentAt.ts'
import { filingDocumentPayload, normalizeDocumentUrl } from './gcKernels/lib/jobs/lienFilingDocumentLink.ts'
import { LIEN_CLERK_SCAN_NOTE, lienFiledScanName, lienScanProblem } from './gcKernels/lib/jobs/lienScanFile.ts'
import { effectiveJobLedgerNumber } from './gcKernels/lib/ledgerDisplayPrefixes.ts'
import type { LienAffidavitIssuer } from './gcKernels/lib/jobs/lienAffidavitJobFields.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'
import { ISSUER_SETTINGS_KEY } from './devMcpNoticeByHand.ts'

export const LIEN_FILING_VERBS = ['plan_lien_filing', 'apply_lien_filing'] as const
export type LienFilingVerb = (typeof LIEN_FILING_VERBS)[number]
export function isLienFilingVerb(name: string): name is LienFilingVerb {
  return (LIEN_FILING_VERBS as readonly string[]).includes(name)
}

/** The most filings one plan takes: a visit to the clerk, with room. A longer list is planned in two calls. */
export const LIEN_FILING_PLAN_MAX = 20
/** How far ahead the seat asks the desk's reader to look, as plan_affidavit_draft does. */
export const LIEN_FILING_WINDOW_DAYS = 400
/** The private bucket a scan waits in between its plan and its apply (migration 20261116210000). */
export const LIEN_SCAN_STAGING_BUCKET = 'dev-seat-staging'
/** Where the scan lands in the job's Drive folder: drive-link's `put` landing for Team only › Sent by us. */
export const LIEN_SCAN_LANDING = 'sent'
export const LIEN_SCAN_LANDING_WORDS = 'Team only › Sent by us'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const SHA_RE = /^[0-9a-f]{64}$/
/** A clerk's instrument number as the stamp prints it: digits and letters with the few marks a clerk uses. */
const RECORDING_RE = /^[A-Za-z0-9][A-Za-z0-9 ./#-]{0,59}$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** What the caller read off the paper. The claim is asked of every filing; the rest are checked when given and named when not. */
export type LienPaperStates = {
  claim: number
  months: string[] | null
  notice_sent_on: string[] | null
  property_address: string | null
  legal_description: string | null
  owner: string | null
}

export type LienFilingScan = { name: string; size_bytes: number; sha256: string }

export type LienFilingPayload = {
  action: 'lien_filing'
  job_id: string
  county: string
  recording_number: string
  filed_on: string
  /** The clerk's stamped copy as a file on the caller's machine, staged and then filed in the job's Drive folder. */
  scan: LienFilingScan | null
  /** The form's Saved copy line: a link typed, wherever the paper lives, and a note. */
  saved_copy: { link: string; note: string } | null
  paper_states: LienPaperStates
  /** One line on why this paper is this job's, read back in the plan. */
  matched_because: string
  filed_outside_the_desk: boolean
  accept_differences: boolean
  /** The filing on record carries a saved copy and this scan or link takes its place: the Filings list's *change the saved copy*. */
  replace_saved_copy: boolean
  /** One line on why the copy on record is the wrong file, read back in the plan and kept in the call log. */
  replace_because: string
}

const SHAPE =
  'a filing is { job_id (a jobs_ledger.id — find_job), county (the clerk’s county, as stamped), recording_number (the instrument number), filed_on (YYYY-MM-DD, the day the clerk recorded it), scan?: { name, size_bytes, sha256 } (the stamped copy as a file on your machine; one file, one lien) | saved_copy?: { link, note? } (a link to where the paper already lives), paper_states: { claim (dollars, as the paper swears), months?: [YYYY-MM], notice_sent_on?: [YYYY-MM-DD], property_address?, legal_description?, owner? }, matched_because (one line: why this paper is this job’s), filed_outside_the_desk?, accept_differences?, replace_saved_copy? (true: this scan or link takes the place of the saved copy a filing on record carries), replace_because? (one line: why the copy on record is the wrong file) }'

function ymdList(v: unknown, re: RegExp): string[] | null | 'bad' {
  if (v === undefined || v === null) return null
  const list = Array.isArray(v) ? v : [v]
  const out: string[] = []
  for (const x of list) {
    const s = str(x)
    if (!re.test(s)) return 'bad'
    if (!out.includes(s)) out.push(s)
  }
  return out.sort()
}

/** One filing's shape, checked. Whether the desk would take it is the dry run's to say. */
export function lienFilingShape(src: unknown): { ok: true; p: LienFilingPayload } | { ok: false; error: string } {
  const f = obj(src)
  if (!f) return { ok: false, error: SHAPE }
  const jobId = str(f.job_id).toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: `job_id is not a jobs_ledger.id (find_job resolves a number or a name). ${SHAPE}` }
  // As the window keeps it: the county's name alone ("Marlow"), which the screens follow with the word County.
  const county = str(f.county).replace(/\s+/g, ' ').replace(/\s+county$/i, '')
  if (!county || county.length > 80) return { ok: false, error: 'county is the clerk’s county as the stamp reads, 1 to 80 characters.' }
  const recording = str(f.recording_number).replace(/\s+/g, ' ')
  if (!RECORDING_RE.test(recording)) return { ok: false, error: 'recording_number is the instrument number the clerk stamped: letters, digits, spaces and . / # - only, 1 to 60 characters.' }
  const filedOn = str(f.filed_on)
  if (!YMD_RE.test(filedOn) || Number.isNaN(new Date(`${filedOn}T12:00:00Z`).getTime())) return { ok: false, error: 'filed_on is the day the clerk recorded it, YYYY-MM-DD.' }
  const scanIn = f.scan === undefined || f.scan === null ? null : obj(f.scan)
  const copyIn = f.saved_copy === undefined || f.saved_copy === null ? null : obj(f.saved_copy)
  if ((f.scan !== undefined && f.scan !== null && !scanIn) || (f.saved_copy !== undefined && f.saved_copy !== null && !copyIn)) return { ok: false, error: 'scan is { name, size_bytes, sha256 } and saved_copy is { link, note? }.' }
  if (scanIn && copyIn) return { ok: false, error: 'Send scan (a file on your machine) or saved_copy (a link to where the paper already lives), not both.' }
  let scan: LienFilingScan | null = null
  if (scanIn) {
    const name = str(scanIn.name)
    const size = typeof scanIn.size_bytes === 'number' && Number.isInteger(scanIn.size_bytes) ? scanIn.size_bytes : -1
    const sha = str(scanIn.sha256).toLowerCase()
    if (!name || name.length > 200 || /[\\/]/.test(name)) return { ok: false, error: 'scan.name is the file’s own name with its extension, no folders.' }
    if (size < 0) return { ok: false, error: 'scan.size_bytes is the file’s size in bytes, a whole number (wc -c < file).' }
    if (!SHA_RE.test(sha)) return { ok: false, error: 'scan.sha256 is the file’s sha256, 64 hex characters (shasum -a 256 file).' }
    const problem = lienScanProblem({ name, size, type: scanMime(name) }, 'affidavit')
    if (problem) return { ok: false, error: `${name}: ${problem}` }
    scan = { name, size_bytes: size, sha256: sha }
  }
  let savedCopy: LienFilingPayload['saved_copy'] = null
  if (copyIn) {
    const link = normalizeDocumentUrl(str(copyIn.link))
    if (!link) return { ok: false, error: 'saved_copy.link is a link to where the paper lives (a Drive link); a note alone is not a saved copy.' }
    savedCopy = { link, note: str(copyIn.note).slice(0, 200) }
  }
  const paper = obj(f.paper_states)
  if (!paper) return { ok: false, error: 'paper_states is what the filed paper says, read off the scan: { claim, months?, notice_sent_on?, property_address?, legal_description?, owner? }. Read the scan before you plan.' }
  if (!(typeof paper.claim === 'number' && Number.isFinite(paper.claim) && paper.claim >= 0)) return { ok: false, error: 'paper_states.claim is the amount the paper swears, in dollars, a number.' }
  const months = ymdList(paper.months, MONTH_RE)
  if (months === 'bad') return { ok: false, error: 'paper_states.months lists the months the paper names, each YYYY-MM.' }
  const noticeDays = ymdList(paper.notice_sent_on, YMD_RE)
  if (noticeDays === 'bad') return { ok: false, error: 'paper_states.notice_sent_on lists each day the paper says notice went to the owner, YYYY-MM-DD.' }
  const because = str(f.matched_because)
  if (because.length < 10 || because.length > 400) return { ok: false, error: 'matched_because says in one line why this paper is this job’s (the address on the paper, the owner, the claim), 10 to 400 characters.' }
  const text = (v: unknown): string | null => (str(v) ? str(v).slice(0, 600) : null)
  const replace = f.replace_saved_copy === true
  const replaceBecause = str(f.replace_because)
  if (replace && !scan && !savedCopy) return { ok: false, error: 'replace_saved_copy puts a file in place of the saved copy on record: send scan (the right file on your machine) or saved_copy (a link to it) with it.' }
  if (replace && (replaceBecause.length < 10 || replaceBecause.length > 300)) return { ok: false, error: 'replace_saved_copy needs replace_because: one line on why the copy on record is the wrong file (it holds another job’s pages, it is the unsigned draft), 10 to 300 characters.' }
  if (!replace && replaceBecause) return { ok: false, error: 'replace_because goes with replace_saved_copy: true. Leave both out to check a paper against its record.' }
  return {
    ok: true,
    p: {
      action: 'lien_filing',
      job_id: jobId,
      county,
      recording_number: recording,
      filed_on: filedOn,
      scan,
      saved_copy: savedCopy,
      paper_states: { claim: cents(paper.claim), months, notice_sent_on: noticeDays, property_address: text(paper.property_address), legal_description: text(paper.legal_description), owner: text(paper.owner) },
      matched_because: because,
      filed_outside_the_desk: f.filed_outside_the_desk === true,
      accept_differences: f.accept_differences === true,
      replace_saved_copy: replace,
      replace_because: replaceBecause,
    },
  }
}

/** A scan's mime by its name: the press's own kinds, a PDF or a picture. */
export function scanMime(name: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'webp') return 'image/webp'
  return ''
}

export type LienFilingPlanInput = { ok: true; filings: Array<{ ok: true; p: LienFilingPayload } | { ok: false; error: string }>; target: string } | { ok: false; error: string }

/** plan_lien_filing's input: `filing` (one) or `filings` (a visit's worth), each shaped on its own so one bad entry is named and the rest are planned. */
export function lienFilingPlanInput(input: Json): LienFilingPlanInput {
  const many = Array.isArray(input.filings) ? (input.filings as unknown[]) : null
  const one = obj(input.filing)
  if (many && one) return { ok: false, error: 'plan_lien_filing takes filing (one) or filings (a list), not both.' }
  const list = many ?? (one ? [one] : null)
  if (!list || list.length < 1) return { ok: false, error: `plan_lien_filing needs filing or filings — ${SHAPE}.` }
  if (list.length > LIEN_FILING_PLAN_MAX) return { ok: false, error: `plan_lien_filing takes at most ${LIEN_FILING_PLAN_MAX} filings a call; this one carries ${list.length}. Plan the rest in a second call.` }
  const filings = list.map((f) => lienFilingShape(f))
  const first = filings.find((f): f is { ok: true; p: LienFilingPayload } => f.ok)
  return { ok: true, filings, target: list.length === 1 && first ? first.p.job_id : `${list.length} filings` }
}

export type LienFilingApplyInput = { ok: true; p: LienFilingPayload; target: string; planHash: string } | { ok: false; error: string }

/** apply_lien_filing's input: one filing, as planned, and its own plan hash. */
export function lienFilingApplyInput(input: Json): LienFilingApplyInput {
  if (Array.isArray(input.filings)) return { ok: false, error: 'apply_lien_filing applies one filing a call: send filing (the entry as you planned it) with that entry’s own plan_hash. A filing that fails then never stops the rest.' }
  const shaped = lienFilingShape(input.filing)
  if (!shaped.ok) return { ok: false, error: `apply_lien_filing needs filing — ${shaped.error}` }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!SHA_RE.test(h)) return { ok: false, error: 'apply_lien_filing needs plan_hash — the 64-hex value plan_lien_filing gave this filing.' }
  return { ok: true, p: shaped.p, target: shaped.p.job_id, planHash: h }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type LienFilingReads = {
  rows(table: string, query: string): Promise<Json[]>
  /** `list_lien_affidavit_windows` over GET, the desk's own reader, looking this many days ahead. The server reads it once a call. */
  windows(days: number): Promise<Json[]>
}

export type LienFilingJob = {
  id: string
  job_name: string | null
  job_address: string | null
  hcp_number: string | null
  click_number: string | null
  customer_name: string | null
  customer_address_id: string | null
  gc_customer_id: string | null
  master_user_id: string | null
  service_type_id: string | null
  revenue: number | null
  payments_made: number | null
  first_work_date?: string | null
  last_work_date?: string | null
  lien_last_work_on?: string | null
}
export const LIEN_FILING_JOB_COLS = 'id,job_name,job_address,hcp_number,click_number,customer_name,customer_address_id,gc_customer_id,master_user_id,service_type_id,revenue,payments_made,first_work_date,last_work_date,lien_last_work_on'
export const LIEN_FILING_FILING_COLS = 'id,job_id,kind,months_covered,sends,filed_at,recording_number,county,document_url,document_note,served_at,serve_due,created_at,amount,fields'

/** A live filing as the plan reads it. */
export type LienFilingOnRecord = { id: string; job_id: string; kind: string; months_covered: string[]; sends: unknown; filed_at: string | null; recording_number: string; county: string; document_url: string; serve_due: string | null; served_at: string | null; amount: number; fields: Json | null }

export type LienFilingWorld = {
  job: LienFilingJob | null
  /** The job's row from the desk's reader; null when the desk lists no window for it. */
  row: LienAffidavitRow | null
  /** The job's live affidavit items on the desk, newest first. */
  items: Json[]
  address: Json | null
  ownerOverride: Json | null
  gc: { id: string; name: string; address: string } | null
  correctionOff: number | null
  monthsByHand: string[] | null
  /** The job's live filings, oldest first: the notices the paper names, and any affidavit already on file. */
  filings: LienFilingOnRecord[]
  /** Live affidavit filings on other jobs that carry this recording number. */
  sameNumber: Array<{ id: string; job_id: string; county: string; filed_at: string | null; job_label: string }>
  /** Other jobs at the same street line, with the property record each sits on. */
  siblings: Array<{ id: string; label: string; customer_address_id: string | null }>
  signer: { id: string; name: string | null; notes: string | null } | null
  issuer: LienAffidavitIssuer | null
  serviceTypeName: string
}

function parseIssuer(valueText: unknown): LienAffidavitIssuer | null {
  if (typeof valueText !== 'string' || !valueText.trim()) return null
  try {
    const o = obj(JSON.parse(valueText))
    if (!o) return null
    const s = (v: unknown) => (typeof v === 'string' ? v : '')
    return { companyName: s(o.companyName), addressText: s(o.addressText), physicalAddressText: s(o.physicalAddressText), signingCounty: s(o.signingCounty) }
  } catch {
    return null
  }
}

/** The street line of an address as typed: everything before the first comma, one space between words. */
export function streetLine(address: string | null | undefined): string {
  return (address ?? '').split(',')[0]!.replace(/\s+/g, ' ').trim()
}

const filingOnRecord = (r: Json): LienFilingOnRecord => ({
  id: str(r.id),
  job_id: str(r.job_id),
  kind: str(r.kind),
  months_covered: Array.isArray(r.months_covered) ? (r.months_covered as unknown[]).filter((m): m is string => typeof m === 'string') : [],
  sends: r.sends,
  filed_at: str(r.filed_at) || null,
  recording_number: str(r.recording_number),
  county: str(r.county),
  document_url: str(r.document_url),
  serve_due: str(r.serve_due) || null,
  served_at: str(r.served_at) || null,
  amount: num(r.amount),
  fields: obj(r.fields),
})

export async function readLienFilingWorld(reads: LienFilingReads, p: LienFilingPayload): Promise<LienFilingWorld> {
  const empty: LienFilingWorld = { job: null, row: null, items: [], address: null, ownerOverride: null, gc: null, correctionOff: null, monthsByHand: null, filings: [], sameNumber: [], siblings: [], signer: null, issuer: null, serviceTypeName: '' }
  const job = ((await reads.rows('jobs_ledger', `select=${LIEN_FILING_JOB_COLS}&id=eq.${p.job_id}`))[0] as LienFilingJob | undefined) ?? null
  if (!job) return empty
  const windowRow = (await reads.windows(LIEN_FILING_WINDOW_DAYS)).find((r) => str(r.job_id).toLowerCase() === job.id.toLowerCase())
  const row = windowRow ? ({ ...windowRow, open_balance: num(windowRow.open_balance) } as unknown as LienAffidavitRow) : null
  const items = await reads.rows('job_lien_desk_items', `select=*&job_id=eq.${job.id}&kind=eq.affidavit&voided_at=is.null&order=created_at.desc`)
  const address = job.customer_address_id ? ((await reads.rows('customer_addresses', `select=*&id=eq.${job.customer_address_id}`))[0] ?? null) : null
  const ownerOverride = (await reads.rows('job_property_owners', `select=*&job_id=eq.${job.id}`))[0] ?? null
  const gcRow = job.gc_customer_id ? (await reads.rows('customers', `select=id,name,address&id=eq.${job.gc_customer_id}`))[0] : undefined
  const correctionRow = (await reads.rows('job_lien_claim_corrections', `select=job_id,amount_off&job_id=eq.${job.id}`))[0]
  const monthsRow = await reads.rows('job_lien_affidavit_months', `select=job_id,months,reason,set_by_name,set_at&job_id=eq.${job.id}`).then((rows) => rows[0], () => undefined)
  const filings = (await reads.rows('job_lien_filings', `select=${LIEN_FILING_FILING_COLS}&job_id=eq.${job.id}&voided_at=is.null&order=created_at.asc`)).map(filingOnRecord)
  // The number as other jobs hold it, however it was typed: "2026-0222921", "2026 0222921" and "20260222921" are one
  // instrument. The read is loose (the letters and digits in order, anything between) and the key decides.
  const numberRows = (await reads.rows('job_lien_filings', `select=id,job_id,county,filed_at,recording_number&kind=eq.affidavit&voided_at=is.null&recording_number=ilike.${recordingLoosePattern(p.recording_number)}&job_id=neq.${job.id}&limit=50`)).filter((r) => recordingKey(str(r.recording_number)) === recordingKey(p.recording_number))
  const otherJobIds = [...new Set(numberRows.map((r) => str(r.job_id)).filter(Boolean))]
  const otherJobs = otherJobIds.length > 0 ? await reads.rows('jobs_ledger', `select=id,job_name,hcp_number,click_number&id=in.(${otherJobIds.join(',')})`) : []
  const labelById = new Map(otherJobs.map((j) => [str(j.id), jobLabelOf(j as never)]))
  const street = streetLine(job.job_address)
  // The street line as a prefix, case-blind: two jobs typed "12 Sample Rd, Marlow" and "12 Sample Rd, Marlow, TX 78000" are one place.
  const siblingRows = street.length >= 4 ? await reads.rows('jobs_ledger', `select=id,job_name,hcp_number,click_number,customer_address_id&job_address=ilike.${encodeURIComponent(`${street.replace(/[*%_\\]/g, ' ')}*`)}&id=neq.${job.id}&limit=30`) : []
  const signerRow = job.master_user_id ? (await reads.rows('users', `select=id,name,notes&id=eq.${job.master_user_id}`))[0] : undefined
  const issuerRow = (await reads.rows('app_settings', `select=value_text&key=eq.${ISSUER_SETTINGS_KEY}`))[0]
  const serviceType = job.service_type_id ? (await reads.rows('service_types', `select=name&id=eq.${job.service_type_id}`))[0] : undefined
  return {
    job,
    row,
    items,
    address,
    ownerOverride,
    gc: gcRow ? { id: str(gcRow.id), name: str(gcRow.name), address: str(gcRow.address) } : null,
    correctionOff: correctionRow ? num(correctionRow.amount_off) : null,
    monthsByHand: parseLienAffidavitMonthsByHand(monthsRow)?.months ?? null,
    filings,
    sameNumber: numberRows.map((r) => ({ id: str(r.id), job_id: str(r.job_id), county: str(r.county), filed_at: str(r.filed_at) || null, job_label: labelById.get(str(r.job_id)) ?? str(r.job_id) })),
    siblings: siblingRows.map((r) => ({ id: str(r.id), label: jobLabelOf(r as never), customer_address_id: str(r.customer_address_id) || null })),
    signer: signerRow ? { id: str(signerRow.id), name: typeof signerRow.name === 'string' ? signerRow.name : null, notes: typeof signerRow.notes === 'string' ? signerRow.notes : null } : null,
    issuer: parseIssuer(issuerRow?.value_text),
    serviceTypeName: str(serviceType?.name),
  }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One thing the paper says that the desk does not, with the door that brings the desk to the paper. */
export type LienFilingDifference = { what: 'claim' | 'months' | 'notice_day' | 'property_address' | 'legal_description' | 'owner' | 'county' | 'property_record'; paper: string; desk: string; door: string }

/** What the apply writes: the filing's row, the desk's item, then the scan into Drive and onto the filing as its saved copy (or the saved copy alone). */
export type LienFilingWrite =
  | { kind: 'record'; row: Json; item: { id: string; from: string; patch: Json } | null; scan: { name: string; mime: string; size_bytes: number; sha256: string } | null }
  /** A filing already on record with this number and no saved copy: the scan alone, as the Filings list's upload does. */
  /** `replaces` is the link the filing carries now, when the call puts this file in its place: the write is held to it. */
  | { kind: 'attach_scan'; filingId: string; scan: { name: string; mime: string; size_bytes: number; sha256: string }; replaces?: string }
  /** The same filing, and a link to a copy that is already in Drive: the Filings list's *link the saved copy*. */
  | { kind: 'attach_link'; filingId: string; link: { url: string; note: string }; replaces?: string }

export type LienFilingDryRun =
  | { ok: true; status: 'ready'; reply: Json; write: LienFilingWrite }
  /** Planned, and held on differences the call has not accepted: it carries no hash, so nothing can apply it. */
  | { ok: true; status: 'held'; reply: Json }
  /** The paper is already on record and the call asks for no change: the record read against the paper, nothing to apply. */
  | { ok: true; status: 'on_record'; reply: Json }
  | { ok: false; refused: string }

const ITEM_STATUS_WORDS: Record<string, string> = {
  drafted: 'a draft, never sent for approval',
  awaiting_approval: 'sent for approval and not yet approved',
  held: 'on hold',
  sent: 'already marked filed',
}
/** The item statuses the Lien window's own sync moves on once a filing is on record (`syncLienDeskAfterRecord`). */
export const LIEN_FILING_SYNC_STATUSES = ['approved', 'drafted', 'awaiting_approval', 'held'] as const

/** Words compared as a person would: case, punctuation and spacing aside. */
export function sameWords(a: string, b: string): boolean {
  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return flat(a) === flat(b)
}
/** The PostgREST `ilike` pattern that finds a recording number however it was punctuated: its letters and digits in order, anything between. */
export const recordingLoosePattern = (s: string): string => [...recordingKey(s)].join('*')
/** A recording number as compared: its letters and digits alone, so "2026 0222921" and "2026-0222921" are one number. */
export const recordingKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const countyKey = (s: string) => s.toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const list = (xs: readonly string[]): string => (xs.length > 0 ? xs.join(', ') : 'none')

/** The differences between what the caller read off the paper and what the desk holds, and what was not checked. */
export function lienFilingDifferences(p: LienFilingPayload, desk: { claim: number; months: string[]; noticeDays: string[]; isSub: boolean; propertyAddress: string; legalDescription: string; owner: string; county: string; propertyRecordId: string | null; siblings: LienFilingWorld['siblings']; approvedClaim: number | null }): { differences: LienFilingDifference[]; notChecked: string[] } {
  const out: LienFilingDifference[] = []
  const notChecked: string[] = []
  const paper = p.paper_states
  if (Math.abs(paper.claim - desk.claim) > 0.005) {
    const approved = desk.approvedClaim !== null && Math.abs(desk.approvedClaim - desk.claim) > 0.005 ? ` The paper approved on the desk claimed ${usd(desk.approvedClaim)}, so the job’s bills or payments changed since.` : ''
    out.push({ what: 'claim', paper: usd(paper.claim), desk: usd(desk.claim), door: `The record would keep ${usd(desk.claim)}, today’s reading of what the sent bills owe.${approved} To make the record swear what the paper swears, set the claim by hand on the Lien desk (Affidavits, the job’s row), then plan again.` })
  }
  if (desk.isSub) {
    if (paper.months === null) notChecked.push('months')
    else if (paper.months.join(',') !== desk.months.join(',')) out.push({ what: 'months', paper: list(paper.months), desk: list(desk.months), door: 'The desk reads the months from the recorded notices inside the job’s work span. Set the months by hand on the Lien desk (Affidavits, the job’s row, the months line) to what the paper names, then plan again.' })
    if (paper.notice_sent_on === null) notChecked.push('notice_sent_on')
    else if (paper.notice_sent_on.join(',') !== desk.noticeDays.join(',')) out.push({ what: 'notice_day', paper: list(paper.notice_sent_on), desk: list(desk.noticeDays), door: desk.noticeDays.length === 0 ? 'The desk holds no notice to the owner with its day. If the notice went, record it with plan_notice_by_hand → apply_notice_by_hand (as the paper went), then plan again.' : 'The days on record are not the paper’s. plan_notice_by_hand records a notice that went and is not on record; a wrong day on a recorded notice is fixed on the job’s Lien window.' })
  }
  if (paper.property_address === null) notChecked.push('property_address')
  else if (!sameWords(paper.property_address, desk.propertyAddress) && !sameWords(streetLine(paper.property_address), streetLine(desk.propertyAddress))) out.push({ what: 'property_address', paper: paper.property_address, desk: desk.propertyAddress || 'no address on the job', door: 'The paper names another address than this job’s. Check that the paper is this job’s before anything else: a wrong match files a lien on the wrong job. plan_job_update changes a job’s address.' })
  if (paper.legal_description === null) notChecked.push('legal_description')
  else if (!sameWords(paper.legal_description, desk.legalDescription)) out.push({ what: 'legal_description', paper: paper.legal_description, desk: desk.legalDescription || 'none on the property record', door: 'plan_property_record → apply_property_record sets the property record’s legal description, then plan again.' })
  if (paper.owner === null) notChecked.push('owner')
  else if (!sameWords(paper.owner, desk.owner)) out.push({ what: 'owner', paper: paper.owner, desk: desk.owner || 'no owner on the property record', door: 'plan_property_record → apply_property_record sets the owner on the property record, then plan again.' })
  if (desk.county && countyKey(p.county) !== countyKey(desk.county)) out.push({ what: 'county', paper: p.county, desk: desk.county, door: 'The clerk’s county is not the property record’s. A lien is filed in the county where the property is: check the stamp, then fix whichever is wrong (plan_property_record sets the record’s county).' })
  const elsewhere = desk.siblings.filter((s) => s.customer_address_id !== desk.propertyRecordId)
  if (elsewhere.length > 0) out.push({ what: 'property_record', paper: 'one property', desk: `${elsewhere.map((s) => s.label).join(', ')} at the same street address ${elsewhere.length === 1 ? 'sits' : 'sit'} on another property record`, door: 'Jobs at one address read their owner, county and legal description from the record each is linked to, so two records can swear two things. Put the jobs on one record (plan_job_update sets a job’s property), then plan again.' })
  return { differences: out, notChecked }
}

/** One thing the paper says that the record on file does not. */
export type LienRecordDifference = { what: 'claim' | 'months' | 'notice_day' | 'property_address' | 'legal_description' | 'owner' | 'county' | 'filed_on'; paper: string; record: string }

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
/** The days a sentence names, as the papers write them ("September 22, 2026 and October 14, 2026"), oldest first. */
export function daysInWords(words: string): string[] {
  const out: string[] = []
  for (const m of words.matchAll(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/g)) {
    const month = MONTH_NAMES.indexOf(m[1]!.toLowerCase())
    if (month < 0) continue
    const ymd = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2]!.padStart(2, '0')}`
    if (!out.includes(ymd)) out.push(ymd)
  }
  return out.sort()
}

/**
 * What the caller read off the paper against the paper the record keeps: the filing's own claim, county and day, and
 * the snapshot of the affidavit it was recorded with (`fields`). The snapshot is what *Print the copies to mail*
 * redraws, so a difference here is a copy that would not match the filed paper. A fact the caller did not send, or the
 * snapshot does not hold (an earlier form names no months), is named and not compared.
 */
export function lienFilingRecordCheck(p: LienFilingPayload, record: LienFilingOnRecord): { differences: LienRecordDifference[]; notChecked: string[]; paperOnRecord: Json } {
  const out: LienRecordDifference[] = []
  const notChecked: string[] = []
  const paper = p.paper_states
  const f = record.fields ?? {}
  const kept = (k: string): string => str(f[k])
  const monthsWords = kept('workMonthsWords')
  const noticeWords = kept('noticesSentWords')
  if (Math.abs(paper.claim - record.amount) > 0.005) out.push({ what: 'claim', paper: usd(paper.claim), record: usd(record.amount) })
  if (paper.months === null) notChecked.push('months')
  else if (!monthsWords) {
    if (paper.months.length > 0) notChecked.push('months (the record’s paper names none)')
  } else if (!sameWords(describeNoticeMonths(paper.months), monthsWords)) out.push({ what: 'months', paper: describeNoticeMonths(paper.months) || 'none', record: monthsWords })
  if (paper.notice_sent_on === null) notChecked.push('notice_sent_on')
  else if (!noticeWords) {
    if (paper.notice_sent_on.length > 0) notChecked.push('notice_sent_on (the record’s paper names no notice)')
  } else if (paper.notice_sent_on.join(',') !== daysInWords(noticeWords).join(',')) out.push({ what: 'notice_day', paper: list(paper.notice_sent_on), record: noticeWords })
  const address = kept('propertyAddress')
  if (paper.property_address === null) notChecked.push('property_address')
  else if (!sameWords(paper.property_address, address) && !sameWords(streetLine(paper.property_address), streetLine(address))) out.push({ what: 'property_address', paper: paper.property_address, record: address || 'none' })
  const legal = kept('legalDescription')
  if (paper.legal_description === null) notChecked.push('legal_description')
  else if (!sameWords(paper.legal_description, legal)) out.push({ what: 'legal_description', paper: paper.legal_description, record: legal || 'none' })
  const owner = kept('ownerName')
  if (paper.owner === null) notChecked.push('owner')
  else if (!sameWords(paper.owner, owner)) out.push({ what: 'owner', paper: paper.owner, record: owner || 'none' })
  if (record.county && countyKey(p.county) !== countyKey(record.county)) out.push({ what: 'county', paper: p.county, record: record.county })
  if (record.filed_at !== p.filed_on) out.push({ what: 'filed_on', paper: p.filed_on, record: record.filed_at ?? 'no day' })
  return {
    differences: out,
    notChecked,
    paperOnRecord: { claim: record.amount, months_words: monthsWords || null, notice_to_the_owner: noticeWords || null, property_address: address || null, legal_description: legal || null, owner: owner || null, county: record.county || null },
  }
}

/** The differences that change the words of the copy *Print the copies to mail* redraws. */
const COPY_WORDS: ReadonlyArray<LienRecordDifference['what']> = ['claim', 'months', 'notice_day', 'property_address', 'legal_description', 'owner']

const NOT_DONE = 'A record alone. No copy is mailed and nobody is told: the copies to the owner and the original contractor are due by the serve-by day, and plan_lien_service records them once they are mailed. No line lands on the job’s Activity: the table’s trigger posts notices, not affidavits.'

/**
 * What the plan says and what the hash commits to: the job as a person would check the match, where its affidavit
 * stands on the desk, the paper as the desk reads it today, every difference from what the caller read off the paper,
 * the row, the desk item's move and the file's landing. Refuses a job not visible, one the desk lists no window for,
 * a second filing, a recording number on another job, a day ahead of today, and a job with no approved affidavit
 * unless the call says the filing was made outside the desk.
 */
export function lienFilingDryRun(p: LienFilingPayload, world: LienFilingWorld, who: { userId: string; name: string | null }, todayYmd: string): LienFilingDryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  if (p.filed_on > todayYmd) return { ok: false, refused: `${label}: filed_on ${p.filed_on} is ahead of today (${todayYmd}). A filing is recorded on or after the day the clerk recorded it.` }

  const jobNumber = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const scan = p.scan ? { name: lienFiledScanName(jobNumber, p.filed_on, { name: p.scan.name, type: scanMime(p.scan.name) }), mime: scanMime(p.scan.name), size_bytes: p.scan.size_bytes, sha256: p.scan.sha256 } : null

  // A second filing: one affidavit on file a job. The one exception is the Filings list's own later upload: the same
  // filing, already on record with no saved copy, takes its scan, or a link to a copy already in Drive.
  const dateless = world.filings.find((f) => f.kind === 'affidavit' && !f.filed_at)
  if (dateless) return { ok: false, refused: `${label}: an affidavit record with no filed day is already on this job (${dateless.recording_number ? `instrument ${dateless.recording_number}` : 'no number'}). Set its day on the job’s Lien window, or void it there if it was made in error, then plan again. The seat records no second affidavit beside it.` }
  const onFile = world.filings.filter((f) => f.kind === 'affidavit' && f.filed_at)
  if (onFile.length > 0) {
    const same = onFile.find((f) => recordingKey(f.recording_number) === recordingKey(p.recording_number))
    const check = same ? lienFilingRecordCheck(p, same) : null
    const checked = check
      ? {
          paper_on_record: check.paperOnRecord,
          paper_as_you_read_it: p.paper_states,
          agrees: check.differences.length === 0,
          differences: check.differences,
          ...(check.notChecked.length > 0 ? { not_checked: `Not compared: ${check.notChecked.join(', ')}.` } : {}),
          ...(check.differences.some((d) => COPY_WORDS.includes(d.what)) ? { copy_to_mail: 'Print the copies to mail redraws the copy from the record, so its copy would not say what the filed paper says: mail a photocopy of the stamped scan. Neither the seat nor the app changes a recorded paper’s words; a record voided and made again on the job’s Lien window reads the desk as it stands that day.' } : {}),
        }
      : {}
    // The copy the filing carries gives way only when the call says so, with its reason: the Filings list's *change the saved copy*.
    const replaces = same && same.document_url && p.replace_saved_copy && (scan || p.saved_copy) ? same.document_url : null
    if (same && (scan || p.saved_copy) && (!same.document_url || replaces)) {
      if (same.filed_at !== p.filed_on || (same.county && countyKey(same.county) !== countyKey(p.county))) return { ok: false, refused: `${label}: instrument ${p.recording_number} is on record for this job as filed ${same.filed_at} in ${same.county || 'no county'}, not ${p.filed_on} in ${p.county}. Check the stamp; the record’s day and county are changed on the job’s Lien window.` }
      if (replaces && p.saved_copy && normalizeDocumentUrl(replaces) === p.saved_copy.link) return { ok: false, refused: `${label}: the filing already carries that link as its saved copy. Nothing to replace.` }
      const onRecord = { id: same.id, recording_number: same.recording_number, county: same.county, filed_on: same.filed_at, serve_by: same.serve_due, served_on: same.served_at, ...(replaces ? { saved_copy: replaces } : {}) }
      const swap = replaces ? { replaces, replace_because: p.replace_because, old_copy: 'Once the filing carries the new copy, the old file goes to Drive’s trash when it sits in this job’s Sent by us folder and no lien record names it. Drive keeps it 30 days. A file anywhere else is left where it is.' } : {}
      const was = replaces ? 'carries a saved copy that this call replaces' : 'is already on record with no saved copy'
      if (scan) {
        return {
          ok: true,
          status: 'ready',
          write: { kind: 'attach_scan', filingId: same.id, scan, ...(replaces ? { replaces } : {}) },
          reply: {
            action: 'lien_filing',
            mode: replaces ? 'replace_scan' : 'attach_scan',
            status: 'ready',
            job: jobFacts(job, world, label),
            matched_because: p.matched_because,
            filing_on_record: onRecord,
            ...checked,
            ...swap,
            file: { lands_in: LIEN_SCAN_LANDING_WORDS, name: scan.name, mime: scan.mime, size_bytes: scan.size_bytes, sha256: scan.sha256 },
            writes: { saved_copy_on_filing: same.id, note: LIEN_CLERK_SCAN_NOTE },
            says: `${label}: instrument ${p.recording_number} ${was}. The scan lands in ${LIEN_SCAN_LANDING_WORDS} as ${scan.name} and becomes the filing’s saved copy. Nothing else on the filing changes.`,
          },
        }
      }
      const link = { url: p.saved_copy!.link, note: p.saved_copy!.note || LIEN_CLERK_SCAN_NOTE }
      return {
        ok: true,
        status: 'ready',
        write: { kind: 'attach_link', filingId: same.id, link, ...(replaces ? { replaces } : {}) },
        reply: {
          action: 'lien_filing',
          mode: replaces ? 'replace_link' : 'attach_link',
          status: 'ready',
          job: jobFacts(job, world, label),
          matched_because: p.matched_because,
          filing_on_record: onRecord,
          ...checked,
          ...swap,
          writes: { saved_copy_on_filing: same.id, link: link.url, note: link.note },
          says: `${label}: instrument ${p.recording_number} ${was}. The link becomes the filing’s saved copy; no file is uploaded. Nothing else on the filing changes.`,
        },
      }
    }
    if (same && check) {
      // The paper is this job's filing on record and the call changes nothing: the record read against the paper.
      const differ = check.differences.map((d) => d.what)
      const stands = `${label}: instrument ${same.recording_number} is on record, filed ${same.filed_at} in ${same.county || 'no county'} County`
      return {
        ok: true,
        status: 'on_record',
        reply: {
          action: 'lien_filing',
          mode: 'check',
          status: 'on_record',
          job: jobFacts(job, world, label),
          matched_because: p.matched_because,
          filing_on_record: { id: same.id, recording_number: same.recording_number, county: same.county, filed_on: same.filed_at, serve_by: same.serve_due, served_on: same.served_at, saved_copy: same.document_url || null },
          ...checked,
          writes: 'nothing: a check alone, with no plan_hash',
          says: differ.length === 0 ? `${stands}, and its record says what the paper says.` : `${stands}. The record and the paper differ on ${differ.join(', ')}.`,
          next: same.document_url
            ? 'One affidavit a job: nothing more is recorded. To put another file in place of the saved copy, plan again with replace_saved_copy: true and replace_because.'
            : 'The filing has no saved copy: plan again with scan (the file) or saved_copy (a link) to add it.',
        },
      }
    }
    const first = onFile[0]!
    return { ok: false, refused: `${label}: an affidavit is already on file for this job (instrument ${first.recording_number || 'no number'}, filed ${first.filed_at}${first.document_url ? ', with its saved copy' : ''}), and it is not instrument ${p.recording_number}. One affidavit a job: a second filing is not recorded here. A record made in error is voided on the job’s Lien window first.` }
  }
  if (p.replace_saved_copy) return { ok: false, refused: `${label}: replace_saved_copy is for a filing already on record, and this job holds none with instrument ${p.recording_number}. Leave it out to record the filing.` }
  if (world.sameNumber.length > 0) {
    const other = world.sameNumber[0]!
    return { ok: false, refused: `${label}: instrument ${p.recording_number} is already on ${other.job_label} (filed ${other.filed_at ?? 'no day'}${other.county ? `, ${other.county}` : ''}). A clerk gives one number to one paper: check which job the paper is for. Nothing is recorded.` }
  }
  if (!world.row) return { ok: false, refused: `${label}: the Lien desk lists no affidavit window for this job in the next ${LIEN_FILING_WINDOW_DAYS} days, so the seat cannot read its paper. Record this one on the job’s Lien window (Already filed — record it…).` }

  const addressIdByJob = { [job.id]: job.customer_address_id }
  const addressesById = world.address && job.customer_address_id ? { [job.customer_address_id]: world.address } : {}
  const gcsById = world.gc ? { [world.gc.id]: { address: world.gc.address } } : {}
  const rows = withHomesteadAnswer(withPublicOwner(withContractorAddress([world.row], gcsById), addressIdByJob, addressesById as never), addressIdByJob, addressesById)
  const entry: LienAffidavitEntry | undefined = buildLienAffidavitQueue(rows as LienAffidavitRow[], world.items as never, todayYmd).entries[0]
  const isSub = entry?.isSub ?? world.row.is_sub
  const lastMonth = entry?.lastMonth ?? world.row.last_month

  // The item the window's own sync would move: the newest live affidavit item still short of sent.
  const syncItem = world.items.find((i) => (LIEN_FILING_SYNC_STATUSES as readonly string[]).includes(str(i.status))) ?? null
  const newest = world.items[0] ?? null
  const approved = syncItem && str(syncItem.status) === 'approved' ? syncItem : null
  if (!approved && !p.filed_outside_the_desk) {
    const where = !newest ? 'the desk holds no affidavit for it' : `its affidavit on the desk is ${ITEM_STATUS_WORDS[str(newest.status)] ?? `in status ${str(newest.status)}`}`
    return { ok: false, refused: `${label}: ${where}, so the desk never approved the paper that was filed. If this lien was filed outside the desk (counsel filed it, or the office by hand), plan again with filed_outside_the_desk: true. Otherwise check that the paper is this job’s.` }
  }

  const property = resolveLienProperty(world.address as never, world.ownerOverride as never)
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const form = lienAffidavitFormForItem((approved ?? syncItem ?? newest) as never)
  const signer = lienSignerNameFor(world.signer ? [world.signer] : [], job.master_user_id ?? null, who.name ?? '')
  const notices: LienAffidavitNoticeRow[] = world.filings.map((f) => ({ kind: f.kind, months_covered: f.months_covered, sends: f.sends, voided_at: null }))
  // The desk's own recipe, fact for fact (LienDesk → buildLienDeskAffidavitFields): the paper the leader approved.
  const fields = buildLienDeskAffidavitFields({
    job: { ...job, service_type: world.serviceTypeName ? { name: world.serviceTypeName } : null },
    entry: entry ?? null,
    gc: world.gc,
    ownerName,
    ownerAddress: property.owner.mailingAddress,
    county: property.county,
    legalDescription: property.legalDescription,
    correction: world.correctionOff === null ? null : { amountOff: world.correctionOff },
    contactPerson: signer,
    issuer: world.issuer,
    todayYmd,
    form,
    filings: notices,
    homestead: property.homestead,
    monthsByHand: world.monthsByHand,
  })
  const claim = cents(Number(fields.unpaidAmount))
  const sworn = lienAffidavitSwornMonths({ isSub, workDays: job, lastMonth, todayYmd, filings: notices, monthsByHand: world.monthsByHand })
  const ownerSends = lienAffidavitOwnerSends(notices)
  const approvedClaimRaw = approved ? obj(obj(approved.fields)?.notice)?.claimAmount : undefined
  const approvedClaim = typeof approvedClaimRaw === 'string' && approvedClaimRaw.trim() !== '' && Number.isFinite(Number(approvedClaimRaw)) ? cents(Number(approvedClaimRaw)) : null
  const { differences, notChecked } = lienFilingDifferences(p, {
    claim,
    months: sworn,
    noticeDays: [...new Set(ownerSends.map((s) => s.sentOn))].sort(),
    isSub,
    propertyAddress: fields.propertyAddress,
    legalDescription: property.legalDescription,
    owner: ownerName,
    county: property.county,
    propertyRecordId: job.customer_address_id,
    siblings: world.siblings,
    approvedClaim,
  })

  const serveBy = serveDueForFiling(p.filed_on)
  const sentAt = sentAtForTypedDay(p.filed_on, todayYmd)
  // The window's own insert, key for key (recordAffidavitFiling → insertFiling). A staged scan's link is known once it lands, so the server sets it on the row afterwards, as the Filings list's own upload does.
  const row: Json = {
    job_id: job.id,
    created_by: who.userId,
    ...(p.saved_copy ? filingDocumentPayload({ url: p.saved_copy.link, note: p.saved_copy.note }) : {}),
    kind: 'affidavit',
    amount: Number(fields.unpaidAmount),
    fields: JSON.parse(JSON.stringify(fields)) as Json,
    county: p.county,
    recording_number: p.recording_number,
    filed_at: p.filed_on,
    serve_due: serveBy || null,
  }
  const item = syncItem ? { id: str(syncItem.id), from: str(syncItem.status), patch: { status: 'sent', sent_filing_id: '(the new filing)', ...(sentAt ? { sent_at: sentAt } : {}) } as Json } : null
  const blanks = (['ownerName', 'propertyAddress', 'unpaidAmount'] as const).filter((k) => !String(fields[k] ?? '').trim())
  const held = differences.length > 0 && !p.accept_differences
  const copies = isSub ? 'the owner and the original contractor' : 'the owner'
  const reply: Json = {
    action: 'lien_filing',
    mode: 'record',
    job: jobFacts(job, world, label),
    matched_because: p.matched_because,
    check_the_match: 'Read the job above against the paper: the address, the owner and the claim. A wrong match files a lien on the wrong job.',
    desk: {
      affidavit: newest ? { id: str(newest.id), status: str(newest.status), ...(approved ? { approved_at: str(approved.approved_at) || null, approved_claim: approvedClaim } : {}) } : null,
      pile: entry?.pile ?? null,
      ...(p.filed_outside_the_desk && !approved ? { filed_outside_the_desk: 'The desk never approved a paper for this job, so the snapshot below is the desk’s reading today and not the paper that was filed.' } : {}),
    },
    the_clerk: { county: p.county, recording_number: p.recording_number, filed_on: p.filed_on },
    serve_by: serveBy,
    paper_as_the_desk_reads_it: {
      form,
      contracted_with_the_owner: !isSub,
      claim,
      months: isSub ? sworn : null,
      months_words: isSub ? describeNoticeMonths(sworn) || null : null,
      notice_to_the_owner: isSub ? lienAffidavitNoticesWords(ownerSends) || null : null,
      property_address: fields.propertyAddress || null,
      legal_description: property.legalDescription || null,
      owner: ownerName || null,
      county: property.county || null,
      original_contractor: isSub ? world.gc?.name || null : null,
      signer: signer || null,
    },
    paper_as_you_read_it: p.paper_states,
    differences,
    ...(notChecked.length > 0 ? { not_checked: `You sent no ${notChecked.join(', ')} from the paper, so ${notChecked.length === 1 ? 'it was' : 'they were'} not compared.` } : {}),
    ...(blanks.length > 0 ? { no_copy_to_print: `The snapshot has no ${blanks.join(', ')}, so Print the copies to mail will not redraw this affidavit: mail a photocopy of the filed paper.` } : {}),
    writes: {
      filing: row,
      desk_item: item ? { id: item.id, from: item.from, to: 'sent', sent_at: sentAt ?? 'the moment of the write' } : 'none: the desk holds no affidavit item short of sent for this job',
      file: scan ? { lands_in: LIEN_SCAN_LANDING_WORDS, name: scan.name, mime: scan.mime, size_bytes: scan.size_bytes, sha256: scan.sha256, becomes: `the filing’s saved copy, noted “${LIEN_CLERK_SCAN_NOTE}”` } : p.saved_copy ? { saved_copy: p.saved_copy.link, note: p.saved_copy.note || null } : 'none: the filing is recorded with no saved copy; read_lien_filings lists it until one is added',
    },
    says: `${label}: affidavit filed ${p.filed_on} in ${p.county} County as instrument ${p.recording_number}, claim ${usd(claim)}. Copies go to ${copies} by ${serveBy}.`,
    not_done: NOT_DONE,
  }
  if (held) {
    return {
      ok: true,
      status: 'held',
      reply: {
        ...reply,
        status: 'held',
        held_because: `The paper and the desk differ on ${differences.map((d) => d.what).join(', ')}. Fix each through its door and plan again, or plan again with accept_differences: true to record the filing as the desk reads it.${differences.some((d) => d.what === 'claim' || d.what === 'months' || d.what === 'notice_day') ? ' Recorded as it stands, the copy Print the copies to mail redraws would not match the filed paper: mail a photocopy of the scan instead.' : ''}`,
      },
    }
  }
  return {
    ok: true,
    status: 'ready',
    write: { kind: 'record', row, item, scan },
    reply: {
      ...reply,
      status: 'ready',
      ...(differences.length > 0 ? { differences_accepted: `Recorded as the desk reads it, with ${differences.length} ${differences.length === 1 ? 'difference' : 'differences'} from the paper accepted by this call. The record’s snapshot is not the filed paper where they differ.` } : {}),
    },
  }
}

function jobFacts(job: LienFilingJob, world: LienFilingWorld, label: string): Json {
  const property = resolveLienProperty(world.address as never, world.ownerOverride as never)
  return {
    id: job.id,
    label,
    name: (job.job_name ?? '').trim() || null,
    address: (job.job_address ?? '').trim() || null,
    customer: (job.customer_name ?? '').trim() || null,
    general_contractor: world.gc?.name || null,
    owner: lienPropertyOwnerDisplayName(property.owner) || null,
    property_record: job.customer_address_id,
  }
}

// ── a plan of many ───────────────────────────────────────────────────────────────────────────────────────────────

/** Why two entries of one call cannot both stand, by the index of each entry it holds. */
export function lienFilingBatchClashes(filings: ReadonlyArray<LienFilingPayload | null>): Map<number, string> {
  const out = new Map<number, string>()
  const seen = (key: (p: LienFilingPayload) => string | null, words: (other: number) => string) => {
    const first = new Map<string, number>()
    filings.forEach((p, i) => {
      const k = p ? key(p) : null
      if (!p || !k) return
      const prior = first.get(k)
      if (prior === undefined) {
        first.set(k, i)
        return
      }
      if (!out.has(i)) out.set(i, words(prior))
      if (!out.has(prior)) out.set(prior, words(i))
    })
  }
  seen((p) => p.job_id, (o) => `This call names the same job twice (entry ${o + 1}). One affidavit a job: check which paper is this job’s.`)
  seen((p) => recordingKey(p.recording_number), (o) => `This call names the same recording number twice (entry ${o + 1}). A clerk gives one number to one paper.`)
  seen((p) => p.scan?.sha256 ?? null, (o) => `This call sends the same file twice (entry ${o + 1}): one file, one lien. Split the packet so each lien has its own pages.`)
  return out
}

/** An entry of a plan that cannot be recorded as sent: its place in the call, what it named, and why. */
export function lienFilingRefusedEntry(index: number, p: LienFilingPayload | null, why: string): Json {
  return { entry: index + 1, status: 'refused', ...(p ? { job_id: p.job_id, recording_number: p.recording_number } : {}), why }
}

/**
 * plan_lien_filing's reply: the count of each verdict, the words that say what to do with each, and the entries in the
 * order they were sent. A plan of several shows each filing's row without its fields snapshot, which the entry already
 * reads back as the paper the desk reads; the hash commits to the whole row either way.
 */
export function lienFilingPlanReply(entries: ReadonlyArray<Json>): Json {
  const count = (status: string) => entries.filter((e) => e.status === status).length
  const ready = count('ready')
  const held = count('held')
  const refused = count('refused')
  const onRecord = count('on_record')
  const differ = entries.filter((e) => e.status === 'on_record' && e.agrees === false).length
  const many = entries.length > 1
  const shown = entries.map((e) => {
    const writes = obj(e.writes)
    const filing = obj(writes?.filing)
    if (!many || !writes || !filing) return e
    const { fields: _fields, ...rest } = filing
    return { ...e, writes: { ...writes, filing: { ...rest, fields: 'the paper as the desk reads it, above (plan this filing alone to read the whole snapshot)' } } }
  })
  const parts = [`${ready} ready`, ...(held > 0 ? [`${held} held on differences`] : []), ...(onRecord > 0 ? [`${onRecord} already on record${differ > 0 ? ` (${differ} whose record and paper differ)` : ''}`] : []), ...(refused > 0 ? [`${refused} refused`] : [])]
  return {
    filings: `${entries.length} ${entries.length === 1 ? 'filing' : 'filings'}: ${parts.join(', ')}.`,
    next:
      `Read each entry against its paper before anything is applied: the job, the address, the owner and the claim. ` +
      (ready > 0 ? `For each ready entry, PUT its file to its upload_url when it has one, then call apply_lien_filing with filing (that entry as you sent it) and that entry’s own plan_hash. One apply a filing: one that fails never stops the rest. ` : '') +
      (held > 0 ? `A held entry carries no plan_hash: show its differences to the person, fix each through its door and plan again, or plan again with accept_differences: true. ` : '') +
      (onRecord > 0 ? `An entry already on record writes nothing and carries no plan_hash: read its differences to the person. ` : '') +
      (refused > 0 ? `A refused entry says why. ` : '') +
      'apply runs the dry run again first: if anything changed, the hash no longer matches and nothing is written.',
    entries: shown,
  }
}

/** The facts of the file a filing's saved copy points at, as the plan shows them beside the scan the caller sent. */
export function savedCopyFileWords(file: { name: string; size_bytes: number | null; sha256: string | null; trashed: boolean; path: string[] }, scan: LienFilingScan | null): Json {
  const same = scan && file.sha256 ? file.sha256.toLowerCase() === scan.sha256 : null
  return {
    name: file.name,
    size_bytes: file.size_bytes,
    in: file.path.slice(-3).join(' › ') || null,
    ...(file.trashed ? { trashed: 'This file is in Drive’s trash.' } : {}),
    ...(same === null
      ? {}
      : same
        ? { against_your_scan: 'the same bytes as the file you sent' }
        : { against_your_scan: `not the bytes you sent: ${file.size_bytes ?? 'an unknown number of'} bytes on record against your ${scan!.size_bytes}. A split of the same pages differs by a few hundred bytes. A file several times the size holds more than this lien’s pages.` }),
  }
}

/** The staged path a scan waits at: the dev's own folder, the file's sha256, its own extension. The bucket's policies hold a dev to their folder. */
export function lienScanStagePath(userId: string, scan: Pick<LienFilingScan, 'sha256' | 'name'>): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(scan.name)?.[1]?.toLowerCase() ?? 'pdf'
  return `${userId}/lien-scans/${scan.sha256.slice(0, 32)}.${ext}`
}

/** The curl line that puts one file at its signed address. */
export function lienScanUploadHow(mime: string, then = 'apply_lien_filing with this filing and its plan_hash'): string {
  return `curl -sS -X PUT "<upload_url>" -H "Content-Type: ${mime}" -H "x-upsert: true" --data-binary @"<the file>" — then ${then}. The staged copy is read back, checked against size_bytes and sha256, filed in the job’s Drive folder and removed.`
}

/** Whether staged bytes are the kind their name says: a PDF by its header, a picture by its own. */
export function stagedScanProblem(bytes: Uint8Array, scan: { name: string; mime: string; size_bytes: number }): string | null {
  if (bytes.length !== scan.size_bytes) return `The staged file is ${bytes.length} bytes; the plan says ${scan.size_bytes}. PUT the file you planned, or plan again with this file’s size and sha256.`
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (scan.mime === 'application/pdf' && !starts(0x25, 0x50, 0x44, 0x46)) return 'The staged file is not a PDF (no %PDF header).'
  if (scan.mime === 'image/png' && !starts(0x89, 0x50, 0x4e, 0x47)) return 'The staged file is not a PNG.'
  if (scan.mime === 'image/jpeg' && !starts(0xff, 0xd8)) return 'The staged file is not a JPEG.'
  return null
}

// ── the apply's words ────────────────────────────────────────────────────────────────────────────────────────────

export type LienFilingOutcome = {
  /** The Drive file the scan became, when the filing carried one and the folder took it. */
  file: { url: string; driveFileId: string } | null
  /** The filing row read back, or null when none came back. */
  filing: { id: string; serve_due: string | null; document_url: string } | null
  item: 'marked sent' | 'none' | { failed: string }
  stagedRemoved: boolean | null
  /** Why the scan is not the filing's saved copy, when the filing was recorded and the scan did not follow. */
  scanFailed?: string | null
  /** Other live filed affidavits found on the job after the write: a second record that landed beside this one. */
  duplicates?: string[]
  /** The file the filing carried before a replace: in Drive's trash, or left where it is with the reason. */
  oldCopy?: 'trashed' | { left: string } | null
}

/** The apply's reply for a recorded filing: what landed, what did not and the press that comes next. */
export function lienFilingAppliedWords(p: LienFilingPayload, label: string, write: LienFilingWrite, out: LienFilingOutcome): Json {
  if (!out.filing) return { action: p.action, ok: false, why: `${label}: no filing row came back (RLS let none through, or the write was refused). Nothing else was written. Plan again.` }
  const itemFailed = typeof out.item === 'object'
  const attach = write.kind !== 'record'
  const replaces = write.kind === 'record' ? null : write.replaces ?? null
  // A file that is in Drive is never uploaded twice: the plan that finishes the job carries its link.
  const finish = replaces
    ? out.file
      ? `The filing still carries the copy it had. Plan again with replace_saved_copy: true and saved_copy: { link: "${out.file.url}" } in place of scan: the file is not uploaded twice.`
      : 'The filing still carries the copy it had. Plan the replace again.'
    : out.file
      ? `Plan this filing again with saved_copy: { link: "${out.file.url}" } in place of scan: a filing on record with no saved copy takes the link alone, and the file is not uploaded twice.`
      : 'Plan this filing again with the same recording number and the scan: a filing on record with no saved copy takes the scan alone.'
  return {
    action: p.action,
    ok: true,
    filing_id: out.filing.id,
    wrote: write.kind === 'attach_scan' ? `the scan, ${replaces ? 'in place of the saved copy the filing carried' : 'as the saved copy of the filing on record'}` : write.kind === 'attach_link' ? `the link, ${replaces ? 'in place of the saved copy the filing carried' : 'as the saved copy of the filing on record'}` : 'the filing',
    serve_by: out.filing.serve_due,
    saved_copy: out.filing.document_url || null,
    ...(out.file ? { file: out.file } : {}),
    ...(replaces && !out.scanFailed ? { old_copy: { was: replaces, now: out.oldCopy === 'trashed' ? 'in Drive’s trash, where Drive keeps it 30 days' : `left where it is: ${out.oldCopy && typeof out.oldCopy === 'object' ? out.oldCopy.left : 'the file was not looked at'}` } } : {}),
    ...(attach ? {} : { desk_item: out.item }),
    ...(out.scanFailed ? { saved_copy_not_added: `${attach ? 'The filing stands as it was' : 'The filing is recorded'}, and its scan is not its saved copy: ${out.scanFailed}. ${finish}` } : {}),
    ...(itemFailed ? { desk_item_not_marked: `The filing is recorded, and the desk’s affidavit item was not marked sent: ${(out.item as { failed: string }).failed}. Opening the job’s Lien window runs the same mark.` } : {}),
    ...(out.duplicates && out.duplicates.length > 0 ? { second_affidavit_on_record: `This job now holds more than one live filed affidavit (${[out.filing.id, ...out.duplicates].join(', ')}): another record landed while this one was being written. Void the extra one on the job’s Lien window.` } : {}),
    ...(out.stagedRemoved === false ? { staged_copy_left: 'The staged copy could not be removed. It is private to you.' } : {}),
    next: attach
      ? out.scanFailed
        ? `${label}: the saved copy was not ${replaces ? 'replaced' : 'added'}. ${finish}`
        : `${label}: the filing has its ${replaces ? 'new ' : ''}saved copy. Nothing else on the filing changed.`
      : `${label}: filed ${p.filed_on}, instrument ${p.recording_number}. Mail the copies by ${out.filing.serve_due ?? 'the serve-by day'} (the Lien desk’s Print the copies to mail prints them), then plan_lien_service records the day and the certified mail numbers.`,
  }
}
