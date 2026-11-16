/**
 * The book's reads in three steps (v2.7463). Two things are held here, over made-up jobs with no database:
 * the rows handed on are the rows the five steps in a row handed on (so the same book comes out), and the
 * reads that do not need each other's rows start together.
 */
import { describe, expect, it } from 'vitest'
import { readLienBookRows, type LienBookOwnerRow, type LienBookReads, type LienBookRows } from './lienTimelineBookRead'
import { assembleLienBookInput, type LienBookRawGc, type LienBookRawJob } from './lienTimelineBookAssemble'
import { buildLienTimelineBook } from './lienTimelineBook'
import type { LienDeskItemRow, LienNoticeMonthRow } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import type { JobDemandLetterRow } from './demandLetterTracking'
import type { CustomerAddressRow } from './lienProperty'
import { zzTestJobIds } from './zzTestJobVisibility'
import { lienJobIdsOffDesk } from './lienInKind'
import { chunkIds } from '../supabasePaging'

const TODAY = '2026-10-09'

const month = (job_id: string, work_month: string, deadline: string, gc = 'gc-1'): LienNoticeMonthRow => ({ job_id, work_month, deadline, approved_hours: 40, noticed: false, open_balance: 5_000, customer_id: 'c1', gc_customer_id: gc, property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null })
const window_ = (job_id: string, deadline: string): LienAffidavitRow => ({ job_id, last_month: '2026-07', deadline, is_sub: true, noticed: true, filed: false, open_balance: 900, customer_id: 'c1', gc_customer_id: 'gc-2', property_kind: 'residential', has_owner: true }) as unknown as LienAffidavitRow
const job = (id: string, name: string, over: Partial<LienBookRawJob> = {}): LienBookRawJob => ({ id, hcp_number: id, click_number: null, job_name: name, job_address: `${id} Main St`, gc_customer_id: 'gc-1', customer_address_id: `addr-${id}`, revenue: 9_000, payments_made: 4_000, last_work_date: '2026-08-20', lien_payment_bond: null, lien_contract_ended_on: null, customer_name: 'Ann Lee', in_kind_arrangement_id: null, ...over })

/** A is plain, B is on the affidavit path only, K is paid in kind, Z is a ZZ test job. */
const MONTHS = [month('A', '2026-08', '2026-10-15'), month('A', '2026-09', '2026-11-15'), month('K', '2026-08', '2026-10-15'), month('Z', '2026-08', '2026-10-15', 'gc-3')]
const WINDOWS = [window_('B', '2026-11-16'), window_('K', '2026-11-16')]
const JOBS = [job('A', '101 Hill Street'), job('B', 'Marrow Lane', { gc_customer_id: 'gc-2', customer_address_id: null }), job('K', 'Tannery Row', { in_kind_arrangement_id: 'deal-1' }), job('Z', 'ZZ TEST lien', { gc_customer_id: 'gc-3' })]
const GCS: LienBookRawGc[] = [
  { id: 'gc-1', name: 'Kestrin Builders', lien_notice_policy: 'ask' },
  { id: 'gc-2', name: 'Lowbeck Contracting', lien_notice_policy: null },
  { id: 'gc-3', name: 'ZZ Test GC', lien_notice_policy: null },
]
const ADDRESSES = JOBS.filter((j) => j.customer_address_id).map((j) => ({ id: j.customer_address_id, county: 'Comal', homestead: false, property_kind: 'non_residential' })) as unknown as CustomerAddressRow[]
const OWNERS = [
  { job_id: 'A', owner_mode: 'company', owner_name: null, company_name: 'Elwick Holdings LLC', mailing_address: '1 Elwick Way', owner_email: null },
  { job_id: 'K', owner_mode: 'person', owner_name: 'Dana Roe', company_name: null, mailing_address: '', owner_email: null },
] as unknown as LienBookOwnerRow[]
const FILINGS = [
  { id: 'f1', job_id: 'B', kind: 'affidavit', filed_on: '2026-10-01', voided_at: null },
  { id: 'f2', job_id: 'Z', kind: 'release_of_record', filed_on: '2026-10-02', voided_at: null },
] as unknown as JobLienFilingRow[]
const LETTERS = [
  { id: 'd1', job_id: 'A', amount: 5_000, created_at: '2026-09-14T16:00:00Z', deadline_date: '2026-09-28', sent_at: '2026-09-14T16:10:00Z', voided_at: null },
  { id: 'd2', job_id: 'K', amount: 900, created_at: '2026-09-15T16:00:00Z', deadline_date: '2026-09-29', sent_at: null, voided_at: null },
] as unknown as JobDemandLetterRow[]
const ITEMS = [{ id: 'iA', job_id: 'A', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null }] as unknown as LienDeskItemRow[]

/** Readers over the made-up tables, each filtering as its query does, and a log of when each starts and ends. */
function fakeReads(log: string[] = []): LienBookReads {
  const logged = <A extends unknown[], T>(name: string, fn: (...a: A) => T) => async (...a: A): Promise<T> => {
    log.push(`start ${name}`)
    // A trip to the database: the answer is never there in the same breath.
    await new Promise((r) => setTimeout(r, 0))
    log.push(`end ${name}`)
    return fn(...a)
  }
  return {
    months: logged('months', () => MONTHS),
    affidavitWindows: logged('affidavitWindows', () => WINDOWS),
    jobs: logged('jobs', (ids: string[]) => JOBS.filter((j) => ids.includes(j.id))),
    owners: logged('owners', (ids: string[]) => OWNERS.filter((o) => ids.includes(o.job_id))),
    filings: logged('filings', (ids: string[]) => FILINGS.filter((f) => ids.includes(f.job_id))),
    demandLetters: logged('demandLetters', (ids: string[]) => LETTERS.filter((l) => ids.includes(l.job_id))),
    gcs: logged('gcs', (ids: string[]) => GCS.filter((g) => ids.includes(g.id))),
    addresses: logged('addresses', (ids: string[]) => ADDRESSES.filter((a) => ids.includes(a.id))),
  }
}

/** The read as it stood through v2.7462, one step after another: the reference the three steps must match. */
async function readInARow(reads: LienBookReads, hideZzTestJobs: boolean): Promise<LienBookRows> {
  const [rowsRead, affidavitRowsRead] = await Promise.all([reads.months(), reads.affidavitWindows()])
  const jobIdsRead = [...new Set([...rowsRead.map((r) => r.job_id), ...affidavitRowsRead.map((r) => r.job_id)])]
  const jobsRead: LienBookRawJob[] = []
  for (const chunk of chunkIds(jobIdsRead)) {
    if (chunk.length === 0) continue
    jobsRead.push(...(await reads.jobs(chunk)))
  }
  const offJobIds = lienJobIdsOffDesk(jobsRead, hideZzTestJobs ? zzTestJobIds(jobsRead) : null)
  const kept = (jobId: string) => !offJobIds?.has(jobId)
  const rows = offJobIds ? rowsRead.filter((r) => kept(r.job_id)) : rowsRead
  const affidavitRows = offJobIds ? affidavitRowsRead.filter((r) => kept(r.job_id)) : affidavitRowsRead
  const jobs = offJobIds ? jobsRead.filter((j) => kept(j.id)) : jobsRead
  const jobIds = offJobIds ? jobIdsRead.filter(kept) : jobIdsRead
  const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((v): v is string => Boolean(v)))]
  const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
  const [gcs, addresses, owners] = await Promise.all([
    gcIds.length ? reads.gcs(gcIds) : Promise.resolve([]),
    addressIds.length ? reads.addresses(addressIds) : Promise.resolve([]),
    jobIds.length ? reads.owners(jobIds) : Promise.resolve([]),
  ])
  const filings: JobLienFilingRow[] = []
  for (const chunk of chunkIds(jobIds)) {
    if (chunk.length === 0) continue
    filings.push(...(await reads.filings(chunk)))
  }
  const demandLetters: JobDemandLetterRow[] = []
  for (const chunk of chunkIds(jobIds)) {
    if (chunk.length === 0) continue
    demandLetters.push(...(await reads.demandLetters(chunk)))
  }
  return { rows, affidavitRows, filings, demandLetters, jobs, gcs, addresses, owners }
}

const bookOf = (rows: LienBookRows) => buildLienTimelineBook(assembleLienBookInput({ ...rows, items: ITEMS }, TODAY))

describe('readLienBookRows', () => {
  it.each([true, false])('hands on the rows the five steps in a row handed on, and the same book (ZZ test jobs hidden: %s)', async (hideZzTestJobs) => {
    const before = await readInARow(fakeReads(), hideZzTestJobs)
    const after = await readLienBookRows(fakeReads(), { hideZzTestJobs })
    expect(after).toEqual(before)
    expect(bookOf(after)).toEqual(bookOf(before))
    // The fixture is not an empty one: the plain job and the affidavit-only job are both in the book.
    expect(bookOf(after).rows.map((r) => r.jobId).sort()).toEqual(hideZzTestJobs ? ['A', 'B'] : ['A', 'B', 'Z'])
  })

  it('drops every row of a job that leaves the desk, though step 2 asked by it', async () => {
    const got = await readLienBookRows(fakeReads(), { hideZzTestJobs: true })
    const jobIdsIn = (list: ReadonlyArray<{ job_id: string }>) => [...new Set(list.map((r) => r.job_id))].sort()
    expect(got.jobs.map((j) => j.id)).toEqual(['A', 'B'])
    expect(jobIdsIn(got.rows)).toEqual(['A'])
    expect(jobIdsIn(got.affidavitRows)).toEqual(['B'])
    // K is paid in kind and Z is a ZZ test job: the owner, the filing and the letter read for them are not handed on.
    expect(jobIdsIn(got.owners)).toEqual(['A'])
    expect(jobIdsIn(got.filings)).toEqual(['B'])
    expect(jobIdsIn(got.demandLetters)).toEqual(['A'])
    // The ZZ job's GC is asked for by nobody once the job is gone.
    expect(got.gcs.map((g) => g.id)).toEqual(['gc-1', 'gc-2'])
  })

  it('reads in three steps: the path, then everything by the job together, then what the jobs name', async () => {
    const log: string[] = []
    await readLienBookRows(fakeReads(log), { hideZzTestJobs: true })
    expect(log).toEqual([
      'start months',
      'start affidavitWindows',
      'end months',
      'end affidavitWindows',
      'start jobs',
      'start owners',
      'start filings',
      'start demandLetters',
      'end jobs',
      'end owners',
      'end filings',
      'end demandLetters',
      'start gcs',
      'start addresses',
      'end gcs',
      'end addresses',
    ])
  })

  it('makes each read once: no trip is added to the five steps’ eight', async () => {
    const before: string[] = []
    const after: string[] = []
    await readInARow(fakeReads(before), true)
    await readLienBookRows(fakeReads(after), { hideZzTestJobs: true })
    const starts = (log: string[]) => log.filter((l) => l.startsWith('start ')).sort()
    expect(starts(after)).toEqual(starts(before))
    expect(starts(after)).toHaveLength(8)
  })

  it('an empty path asks for nothing more', async () => {
    const log: string[] = []
    const reads = { ...fakeReads(log), months: async () => [], affidavitWindows: async () => [] }
    expect(await readLienBookRows(reads, { hideZzTestJobs: false })).toEqual({ rows: [], affidavitRows: [], filings: [], demandLetters: [], jobs: [], gcs: [], addresses: [], owners: [] })
    expect(log).toEqual([])
  })

  it('fails when a read the book cannot do without fails', async () => {
    const reads = { ...fakeReads(), jobs: async () => Promise.reject(new Error('jobs read refused')) }
    await expect(readLienBookRows(reads, { hideZzTestJobs: false })).rejects.toThrow('jobs read refused')
  })
})
