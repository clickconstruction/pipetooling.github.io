import type { LienNoticeMonthRow } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import type { JobDemandLetterRow } from './demandLetterTracking'
import type { CustomerAddressRow } from './lienProperty'
import type { LienBookRaw, LienBookRawGc, LienBookRawJob } from './lienTimelineBookAssemble'
import { zzTestJobIds } from './zzTestJobVisibility'
import { lienJobIdsOffDesk } from './lienInKind'
import { chunkIds } from '../supabasePaging'

/**
 * The order of the book's reads (v2.7463). By job's hook (`useLienTimelineBook`) hands in one reader per table and
 * this says which run together, so the order has a test with no database under it.
 *
 * Three steps, where there were five in a row until v2.7463. Each read is one trip to the database and the trip is
 * the cost (a tenth to a third of a second each, whatever comes back), so a read waits only on the read whose rows
 * it needs:
 *
 * 1. the two readers of the path, the months and the affidavit windows. They name the jobs.
 * 2. by those jobs, together: the jobs, the owner overrides, the affidavits and releases, the demand letters.
 * 3. by the jobs' own rows, together: their GCs and their property records.
 *
 * The same reads with the same filters as before, and no read added. The jobs off the desk (ZZ test jobs when
 * hidden, jobs an open in-kind deal pays, `lienInKind.ts`) are known only once the jobs are back, so step 2 asks by
 * every job the path named and the rows of a job that leaves are dropped here, after. The rows handed on are the
 * rows the five steps handed on.
 */

/** The owner override rows the book reads: `job_property_owners`, the columns the fold needs. */
export type LienBookOwnerRow = LienBookRaw['owners'][number]

/** One reader per read. Each takes the ids it filters by, already cut to a chunk where the hook chunks. */
export type LienBookReads = {
  /** `list_lien_notice_months` over the book's window. A failure fails the book. */
  months: () => Promise<LienNoticeMonthRow[]>
  /** `list_lien_affidavit_windows` over the book's window. The reader turns a failure into no rows. */
  affidavitWindows: () => Promise<LienAffidavitRow[]>
  /** `jobs_ledger` by id, one chunk. A failure fails the book. */
  jobs: (jobIds: string[]) => Promise<LienBookRawJob[]>
  /** `job_property_owners` by job. The reader turns a failure into no rows. */
  owners: (jobIds: string[]) => Promise<LienBookOwnerRow[]>
  /** `job_lien_filings` by job, one chunk: the affidavits, the releases and (v2.7485) the recorded notices. The reader turns a failure into no rows. */
  filings: (jobIds: string[]) => Promise<JobLienFilingRow[]>
  /** `job_demand_letters` by job, one chunk. The reader turns a failure into no rows. */
  demandLetters: (jobIds: string[]) => Promise<JobDemandLetterRow[]>
  /** `customers` by id. A failure fails the book. */
  gcs: (customerIds: string[]) => Promise<LienBookRawGc[]>
  /** `customer_addresses` by id. A failure fails the book. */
  addresses: (addressIds: string[]) => Promise<CustomerAddressRow[]>
}

/** Everything the book is folded from but the desk's items, which the desk hands the hook. The demand letters are always read here, so they are never absent as they may be from the portal's payload. */
export type LienBookRows = Omit<LienBookRaw, 'items' | 'demandLetters'> & { demandLetters: JobDemandLetterRow[] }

async function readChunks<T>(ids: string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const parts = await Promise.all(chunkIds(ids).filter((c) => c.length > 0).map((c) => read(c)))
  return parts.flat()
}

export async function readLienBookRows(reads: LienBookReads, opts: { hideZzTestJobs: boolean }): Promise<LienBookRows> {
  // 1. The path's two readers. They name the jobs.
  const [rowsRead, affidavitRowsRead] = await Promise.all([reads.months(), reads.affidavitWindows()])
  const jobIdsRead = [...new Set([...rowsRead.map((r) => r.job_id), ...affidavitRowsRead.map((r) => r.job_id)])]

  // 2. Everything read by the job, together.
  const [jobsRead, ownersRead, filingsRead, demandLettersRead] = await Promise.all([
    readChunks(jobIdsRead, reads.jobs),
    jobIdsRead.length ? reads.owners(jobIdsRead) : Promise.resolve([] as LienBookOwnerRow[]),
    readChunks(jobIdsRead, reads.filings),
    readChunks(jobIdsRead, reads.demandLetters),
  ])

  // A job an open in-kind deal pays leaves with the ZZ test jobs (v2.7253, `lienInKind.ts`), and its rows with it.
  const offJobIds = lienJobIdsOffDesk(jobsRead, opts.hideZzTestJobs ? zzTestJobIds(jobsRead) : null)
  const kept = (jobId: string) => !offJobIds?.has(jobId)
  const rows = offJobIds ? rowsRead.filter((r) => kept(r.job_id)) : rowsRead
  const affidavitRows = offJobIds ? affidavitRowsRead.filter((r) => kept(r.job_id)) : affidavitRowsRead
  const jobs = offJobIds ? jobsRead.filter((j) => kept(j.id)) : jobsRead
  const owners = offJobIds ? ownersRead.filter((o) => kept(o.job_id)) : ownersRead
  const filings = offJobIds ? filingsRead.filter((f) => kept(f.job_id)) : filingsRead
  const demandLetters = offJobIds ? demandLettersRead.filter((l) => kept(l.job_id)) : demandLettersRead

  // 3. What the jobs' own rows name: their GCs and their property records.
  const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((v): v is string => Boolean(v)))]
  const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
  const [gcs, addresses] = await Promise.all([
    gcIds.length ? reads.gcs(gcIds) : Promise.resolve([] as LienBookRawGc[]),
    addressIds.length ? reads.addresses(addressIds) : Promise.resolve([] as CustomerAddressRow[]),
  ])

  return { rows, affidavitRows, filings, demandLetters, jobs, gcs, addresses, owners }
}
