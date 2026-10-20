/**
 * What of the Lien desk's book may travel to the collections law firm (punch
 * list #85, item 2). The firm's grid shows every billed job with money open
 * and a lien month — the owner's call — but it draws dates, dollars, the
 * property and the owner of record, nothing anyone said. The function names
 * these columns in its selects and shapes the rows again here before they are
 * sent, so a select widened later cannot leak by itself. The client's grid
 * (`assembleLienBookInput`) reads only what is kept.
 *
 * Lives in `_shared` so the edge function and the client tests read one list;
 * `src/lib/legal/legalLienBookShape.ts` is the client's door.
 */

type Row = Record<string, unknown>

/** `job_lien_desk_items`: which months are noticed, held or sent. Never `fields`, the hold reason, the GC's word or who did what. */
export const LIEN_BOOK_DESK_ITEM_COLUMNS = ['id', 'job_id', 'kind', 'status', 'months', 'sent_at', 'sent_filing_id', 'hold_until', 'created_at', 'voided_at'] as const
/** `job_lien_filings`: the public record — what was filed, when, where, for how much. Never the office's note on the copy, the sends or the link. */
export const LIEN_BOOK_FILING_COLUMNS = ['id', 'job_id', 'kind', 'filed_at', 'served_at', 'serve_due', 'months_covered', 'county', 'amount', 'recording_number', 'created_at', 'voided_at'] as const
/** `job_property_owners`: the owner of record and where to serve. Never the owner's email. */
export const LIEN_BOOK_OWNER_COLUMNS = ['job_id', 'owner_mode', 'owner_name', 'company_name', 'mailing_address'] as const
/** `customer_addresses`: the property record, with its justice precinct and the on-the-line note (v2.4771). Never the office's note or the record's bookkeeping. */
export const LIEN_BOOK_ADDRESS_COLUMNS = ['id', 'customer_id', 'address', 'county', 'legal_description', 'property_kind', 'homestead', 'owner_mode', 'owner_name', 'owner_company', 'owner_mailing_address', 'parcel_id', 'is_primary', 'sequence_order', 'jp_precinct', 'jp_precinct_note'] as const
/** `customers` (the GCs): the name and the standing rule for its notices, which decides what the book shows as held. */
export const LIEN_BOOK_GC_COLUMNS = ['id', 'name', 'lien_notice_policy'] as const

export const LIEN_BOOK_COUNSEL_SELECT = {
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
}

/**
 * The book as the firm may hold it: every row cut to its list. The RPC rows and the jobs already carry only dates and
 * dollars; the jobs lose `customer_name`, which is read only for the test-job rule.
 *
 * ZZ test jobs (punch list #61, v2.5124) leave every list: a job whose own name or customer's name is a ZZ name, or
 * whose GC's is, with its months, affidavit windows, desk items, filings and owners. A ZZ GC leaves too, and so do a
 * GC or a property only those jobs pointed at.
 */
export function shapeLienBookForCounsel(raw: { rows?: unknown[]; affidavitRows?: unknown[]; items?: unknown[]; filings?: unknown[]; jobs?: unknown[]; gcs?: unknown[]; addresses?: unknown[]; owners?: unknown[] }): LienBookForCounsel {
  const gcsRead = (raw.gcs ?? []) as Row[]
  const jobsRead = (raw.jobs ?? []) as Row[]
  const zzGcIds = new Set(gcsRead.filter((g) => isZzName(g.name)).map((g) => g.id))
  const isZzJob = (j: Row) => isZzName(j.job_name) || isZzName(j.customer_name) || zzGcIds.has(j.gc_customer_id)
  const zzJobIds = new Set(jobsRead.filter(isZzJob).map((j) => j.id))
  const jobs = jobsRead.filter((j) => !zzJobIds.has(j.id))
  const keptGcIds = new Set(jobs.map((j) => j.gc_customer_id))
  const keptAddressIds = new Set(jobs.map((j) => j.customer_address_id))
  const droppedGcIds = new Set(jobsRead.filter((j) => zzJobIds.has(j.id) && !keptGcIds.has(j.gc_customer_id)).map((j) => j.gc_customer_id))
  const droppedAddressIds = new Set(jobsRead.filter((j) => zzJobIds.has(j.id) && !keptAddressIds.has(j.customer_address_id)).map((j) => j.customer_address_id))
  const kept = <T,>(list: T[] | undefined): T[] => (list ?? []).filter((r) => !zzJobIds.has(jobIdOf(r)))
  return {
    rows: kept(raw.rows),
    affidavitRows: kept(raw.affidavitRows),
    items: kept(raw.items).map((r) => pick(r, LIEN_BOOK_DESK_ITEM_COLUMNS)),
    filings: kept(raw.filings).map((r) => pick(r, LIEN_BOOK_FILING_COLUMNS)),
    jobs: jobs.map(({ customer_name: _customerName, ...job }) => job),
    gcs: gcsRead.filter((g) => !zzGcIds.has(g.id) && !droppedGcIds.has(g.id)).map((r) => pick(r, LIEN_BOOK_GC_COLUMNS)),
    addresses: ((raw.addresses ?? []) as Row[]).filter((a) => !droppedAddressIds.has(a.id)).map((r) => pick(r, LIEN_BOOK_ADDRESS_COLUMNS)),
    owners: kept(raw.owners).map((r) => pick(r, LIEN_BOOK_OWNER_COLUMNS)),
  }
}
