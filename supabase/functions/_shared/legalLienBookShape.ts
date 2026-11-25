/**
 * What of the Lien desk's book may travel to the collections law firm (punch
 * list #85, item 2). The firm's grid shows every billed job with money open
 * and a lien month — the owner's call — but it draws dates, dollars, the
 * property and the owner of record, nothing anyone said. The function names
 * these columns in its selects and shapes the rows again here before they are
 * sent, so a select widened later cannot leak by itself. The client's grid
 * (`assembleLienBookInput`) reads only what is kept.
 *
 * One thing an owner said does travel, as two of the grid's own columns
 * (v2.8315): whether it has paid the GC out and what became of the 10 %
 * (`ownerFacts`, four values a job, `lienOwnerFacts.ts`). The function reads
 * the notice items' `fields` for that and nothing else, and the items
 * themselves still travel without `fields`.
 *
 * Lives in `_shared` so the edge function and the client tests read one list;
 * `src/lib/legal/legalLienBookShape.ts` is the client's door.
 */
import { jobOffLienDesk, withLienOffDeskColumns } from './gcKernels/lib/jobs/lienInKind.ts'
import { LIEN_OWNER_FACT_KEYS, lienOwnerFactsByJob, parseLienOwnerFacts, type LienOwnerFacts } from './lienOwnerFacts.ts'

type Row = Record<string, unknown>

/** `job_lien_desk_items`: which months are noticed, held or sent. Never `fields`, the hold reason, the GC's word or who did what. */
export const LIEN_BOOK_DESK_ITEM_COLUMNS = ['id', 'job_id', 'kind', 'status', 'months', 'sent_at', 'sent_filing_id', 'hold_until', 'created_at', 'voided_at'] as const
/**
 * `job_lien_filings`: the public record — what was filed, when, where, for how much. Never the office's note on the
 * copy or the link. `sends` is read for one thing and cut before it travels (`counselSends`): on a recorded § 53.056
 * notice, who each copy went to, how and on which day. No mail number, no name, no address. On every other kind it
 * travels as null.
 */
export const LIEN_BOOK_FILING_COLUMNS = ['id', 'job_id', 'kind', 'filed_at', 'served_at', 'serve_due', 'months_covered', 'county', 'amount', 'recording_number', 'created_at', 'voided_at', 'sends'] as const
/**
 * The kinds of filing the firm's book reads: the affidavits and the releases (the tail), and the recorded § 53.056
 * notices (punch list #415, the owner's yes of 2026-11-25), so the grid says the day each notice went as the app's
 * own book has since v2.7485. A notice kept by hand has no desk paper, and the months reader drops a noticed month a
 * week after its day, so without the record the firm read no notice where one is on file.
 */
export const LIEN_BOOK_FILING_KINDS = ['affidavit', 'release_of_record', 'notice_53_056'] as const
/** What of one send the firm may hold. */
export const LIEN_BOOK_SEND_KEYS = ['recipient', 'method', 'sent_on'] as const
/** `job_property_owners`: the owner of record and where to serve. Never the owner's email. */
export const LIEN_BOOK_OWNER_COLUMNS = ['job_id', 'owner_mode', 'owner_name', 'company_name', 'mailing_address'] as const
/** `customer_addresses`: the property record, with its justice precinct and the on-the-line note (v2.4771). Never the office's note or the record's bookkeeping. */
export const LIEN_BOOK_ADDRESS_COLUMNS = ['id', 'customer_id', 'address', 'county', 'legal_description', 'property_kind', 'homestead', 'owner_mode', 'owner_name', 'owner_company', 'owner_mailing_address', 'parcel_id', 'is_primary', 'sequence_order', 'jp_precinct', 'jp_precinct_note'] as const
/** `customers` (the GCs): the name and the standing rule for its notices, which decides what the book shows as held. */
export const LIEN_BOOK_GC_COLUMNS = ['id', 'name', 'lien_notice_policy'] as const
/**
 * `jobs_ledger`: what the grid draws of a job, dates and dollars. The same list as the app's `LIEN_BOOK_JOB_COLUMNS`
 * (`src/lib/jobs/lienTimelineBookAssemble.ts`), and the test beside the client's door holds the two equal.
 */
export const LIEN_BOOK_JOB_COLUMNS_SENT = ['id', 'hcp_number', 'click_number', 'job_name', 'job_address', 'gc_customer_id', 'customer_address_id', 'revenue', 'payments_made', 'last_work_date', 'lien_payment_bond', 'lien_contract_ended_on'] as const
/** Read for a rule and cut before the book is sent: `customer_name` for the ZZ test-job rule, the in-kind deal's link for the paid-in-kind rule, the job's own answer for the off-the-lien-path rule. */
const LIEN_BOOK_JOB_RULE_COLUMNS = ['customer_name', 'in_kind_arrangement_id', 'lien_path_answer'] as const

/**
 * The one read that takes `fields`: the § 53.056 notice items, for the owner's call. The rows never leave the
 * function. `shapeLienBookForCounsel` folds them to `ownerFacts` and sends that.
 */
export const LIEN_BOOK_OWNER_CALL_SELECT = 'job_id, kind, voided_at, fields'

export const LIEN_BOOK_COUNSEL_SELECT = {
  /** The sent columns, then `customer_name`, then the deal's link and the job's own answer through the Lien desk's own `withLienOffDeskColumns`. */
  jobs: withLienOffDeskColumns([...LIEN_BOOK_JOB_COLUMNS_SENT, 'customer_name'].join(', ')),
  deskItems: LIEN_BOOK_DESK_ITEM_COLUMNS.join(', '),
  filings: LIEN_BOOK_FILING_COLUMNS.join(', '),
  owners: LIEN_BOOK_OWNER_COLUMNS.join(', '),
  addresses: LIEN_BOOK_ADDRESS_COLUMNS.join(', '),
  gcs: LIEN_BOOK_GC_COLUMNS.join(', '),
} as const

function pick(row: unknown, keys: ReadonlyArray<string>): Row {
  const r = row && typeof row === 'object' ? (row as Row) : {}
  const out: Row = {}
  for (const k of keys) out[k] = k in r ? r[k] : null
  return out
}

/**
 * The ZZ convention (punch list #61; the app's `isZzTestName`, `src/lib/jobs/zzTestJobSweep.ts`): a name that starts
 * with ZZ, in any case and after trimming, is a test record. Counsel never sees one (v2.5124).
 */
function isZzName(name: unknown): boolean {
  return typeof name === 'string' && /^zz/i.test(name.trim())
}

/**
 * A filing's sends as the firm may hold them: on a recorded § 53.056 notice, each send cut to who, how and the day,
 * and a send with no day dropped. Null on every other kind, where `served_at` already says what the grid draws.
 */
function counselSends(row: unknown): Row[] | null {
  const r = row && typeof row === 'object' ? (row as Row) : {}
  if (r.kind !== 'notice_53_056' || !Array.isArray(r.sends)) return null
  return r.sends
    .filter((s): s is Row => !!s && typeof s === 'object' && typeof (s as Row).sent_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((s as Row).sent_on as string))
    .map((s) => ({ recipient: typeof s.recipient === 'string' ? s.recipient : '', method: typeof s.method === 'string' ? s.method : '', sent_on: s.sent_on }))
}

function jobIdOf(row: unknown): unknown {
  return row && typeof row === 'object' ? (row as Row).job_id : undefined
}

export type LienBookForCounsel = {
  rows: unknown[]
  affidavitRows: unknown[]
  items: Row[]
  filings: Row[]
  jobs: unknown[]
  gcs: Row[]
  addresses: Row[]
  owners: Row[]
  /** By job id, the owner's answers behind *Paid out to GC* and *10 % reserved*; a job with no call recorded has no key. */
  ownerFacts: Record<string, LienOwnerFacts>
}

/**
 * The book as the firm may hold it: every row cut to its list. The RPC rows and the jobs already carry only dates and
 * dollars; the jobs lose `customer_name`, `in_kind_arrangement_id` and `lien_path_answer`, which are read only for the rules below.
 *
 * ZZ test jobs (punch list #61, v2.5124) leave every list: a job whose own name or customer's name is a ZZ name, or
 * whose GC's is, with its months, affidavit windows, desk items, filings and owners. A ZZ GC leaves too, and so do a
 * GC or a property only those jobs pointed at.
 *
 * A job paid in kind leaves the same way (the owner's rule of 2026-11-14; the Lien desk's `lienInKind.ts`, read from
 * the generated copy): a job on an open in-kind deal is treated as paid, so it is on the firm's grid no more than on
 * the office's By job book. Its GC stays unless no other job points at it. Ending the deal clears the link, and the
 * job is back on the next read.
 *
 * A job a person took off the lien path leaves the same way (v2.7521, `lienJobPath.ts`): the office said no lien
 * stands behind it, so it is on the firm's lien grid no more than on the office's. Put back, it is on the next read.
 */
export function shapeLienBookForCounsel(raw: { rows?: unknown[]; affidavitRows?: unknown[]; items?: unknown[]; filings?: unknown[]; jobs?: unknown[]; gcs?: unknown[]; addresses?: unknown[]; owners?: unknown[]; ownerCallItems?: unknown[] }): LienBookForCounsel {
  const gcsRead = (raw.gcs ?? []) as Row[]
  const jobsRead = (raw.jobs ?? []) as Row[]
  const zzGcIds = new Set(gcsRead.filter((g) => isZzName(g.name)).map((g) => g.id))
  const isZzJob = (j: Row) => isZzName(j.job_name) || isZzName(j.customer_name) || zzGcIds.has(j.gc_customer_id)
  const offJobIds = new Set(jobsRead.filter((j) => isZzJob(j) || jobOffLienDesk(j as { in_kind_arrangement_id?: string | null; lien_path_answer?: string | null })).map((j) => j.id))
  const jobs = jobsRead.filter((j) => !offJobIds.has(j.id))
  const keptGcIds = new Set(jobs.map((j) => j.gc_customer_id))
  const keptAddressIds = new Set(jobs.map((j) => j.customer_address_id))
  const droppedGcIds = new Set(jobsRead.filter((j) => offJobIds.has(j.id) && !keptGcIds.has(j.gc_customer_id)).map((j) => j.gc_customer_id))
  const droppedAddressIds = new Set(jobsRead.filter((j) => offJobIds.has(j.id) && !keptAddressIds.has(j.customer_address_id)).map((j) => j.customer_address_id))
  const kept = <T,>(list: T[] | undefined): T[] => (list ?? []).filter((r) => !offJobIds.has(jobIdOf(r)))
  return {
    rows: kept(raw.rows),
    affidavitRows: kept(raw.affidavitRows),
    items: kept(raw.items).map((r) => pick(r, LIEN_BOOK_DESK_ITEM_COLUMNS)),
    filings: kept(raw.filings).map((r) => ({ ...pick(r, LIEN_BOOK_FILING_COLUMNS), sends: counselSends(r) })),
    jobs: jobs.map((j) => { const job = { ...j }; for (const k of LIEN_BOOK_JOB_RULE_COLUMNS) delete job[k]; return job }),
    gcs: gcsRead.filter((g) => !zzGcIds.has(g.id) && !droppedGcIds.has(g.id)).map((r) => pick(r, LIEN_BOOK_GC_COLUMNS)),
    addresses: ((raw.addresses ?? []) as Row[]).filter((a) => !droppedAddressIds.has(a.id)).map((r) => pick(r, LIEN_BOOK_ADDRESS_COLUMNS)),
    owners: kept(raw.owners).map((r) => pick(r, LIEN_BOOK_OWNER_COLUMNS)),
    // The calls of the jobs that stay, folded to facts and cut to their keys: no note, no name, no time, no `fields`.
    ownerFacts: Object.fromEntries(
      Object.entries(lienOwnerFactsByJob(kept(raw.ownerCallItems) as Row[])).map(([jobId, facts]) => [jobId, pick(parseLienOwnerFacts(facts), LIEN_OWNER_FACT_KEYS) as LienOwnerFacts]),
    ),
  }
}
