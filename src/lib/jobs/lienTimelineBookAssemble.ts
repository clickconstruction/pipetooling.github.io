import type { LienDeskItemRow, LienNoticeMonthRow, LienNoticePolicy } from './lienDesk'
import { parseLienNoticePolicy } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import type { JobDemandLetterRow } from './demandLetterTracking'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from './lienProperty'
import { lienPublicStanding, type LienPublicRecord } from './lienPublicProperty'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { LienBookJob, LienTimelineBookInput } from './lienTimelineBook'
import { parseLienOwnerFactsByJob, type LienOwnerFacts } from '../../../supabase/functions/_shared/lienOwnerFacts'

/**
 * The book's raw rows → the kernel's input (punch list #41, PR 2). The
 * Timeline tab's hook (`useLienTimelineBook`) and the firm's portal
 * (`legal-portal` hands the same rows over, the page assembles) both go
 * through here, so the office's book and counsel's grid are one fold of one
 * read. Pure.
 */

export type LienBookRawJob = {
  id: string
  hcp_number: string
  click_number: string | null
  job_name: string | null
  job_address: string | null
  gc_customer_id: string | null
  customer_address_id: string | null
  revenue: number | null
  payments_made: number | null
  last_work_date: string | null
  lien_payment_bond?: string | null
  lien_contract_ended_on?: string | null
  /** The ZZ test-job rule reads it (punch list #61, PR 3); optional so the portal's rows and older fixtures stand. */
  customer_name?: string | null
  /** The open in-kind deal that pays the job; set, the job is off the book (v2.7253, `lienInKind.ts`). Optional so the portal's rows stand. */
  in_kind_arrangement_id?: string | null
  /** The job's own answer; `'off_path'`, a person took it off the lien path and it is off the book (v2.7521, `lienJobPath.ts`). Optional so the portal's rows stand. */
  lien_path_answer?: string | null
}

export type LienBookRawGc = { id: string; name: string | null; lien_notice_policy: string | null }

export type LienBookRaw = {
  rows: LienNoticeMonthRow[]
  affidavitRows: LienAffidavitRow[]
  items: LienDeskItemRow[]
  /** Affidavits and releases (the tail). The months' notices come through the RPC rows; since v2.7485 the hook also hands the recorded notices, for the day each went (`noticeSentOn`). */
  filings: JobLienFilingRow[]
  /** The jobs' live demand letters (v2.3880); absent from a payload that does not carry them. */
  demandLetters?: JobDemandLetterRow[]
  jobs: LienBookRawJob[]
  gcs: LienBookRawGc[]
  addresses: CustomerAddressRow[]
  owners: Array<NonNullable<JobPropertyOwnerLike> & { job_id: string }>
  /**
   * The owner's answers as facts, by job (`lienOwnerFacts.ts`): the firm's portal carries them, since its items
   * travel without `fields`. Absent from the office's own read, whose items carry the calls.
   */
  ownerFacts?: Record<string, LienOwnerFacts>
}

/** The select the book needs from jobs_ledger — the hook and the function read the same columns. */
export const LIEN_BOOK_JOB_COLUMNS = 'id, hcp_number, click_number, job_name, job_address, gc_customer_id, customer_address_id, revenue, payments_made, last_work_date, lien_payment_bond, lien_contract_ended_on, customer_name, in_kind_arrangement_id, lien_path_answer'

export function assembleLienBookInput(raw: LienBookRaw, todayYmd: string): LienTimelineBookInput {
  const rows = raw.rows.map((r) => ({ ...r, approved_hours: Number(r.approved_hours) || 0, open_balance: Number(r.open_balance) || 0 }))
  const affidavitRows = raw.affidavitRows.map((r) => ({ ...r, open_balance: Number(r.open_balance) || 0 }))
  const gcName: Record<string, string> = {}
  const policyByCustomer: Record<string, LienNoticePolicy> = {}
  for (const c of raw.gcs) {
    gcName[c.id] = (c.name ?? '').trim()
    policyByCustomer[c.id] = parseLienNoticePolicy(c.lien_notice_policy)
  }
  const addressById: Record<string, CustomerAddressRow> = {}
  for (const a of raw.addresses) addressById[a.id] = a
  const ownerByJob: Record<string, JobPropertyOwnerLike> = {}
  for (const o of raw.owners) ownerByJob[o.job_id] = o
  const kindByJob: Record<string, string> = {}
  for (const r of rows) kindByJob[r.job_id] = r.property_kind
  for (const r of affidavitRows) kindByJob[r.job_id] ??= r.property_kind
  const isSubByJob: Record<string, boolean> = {}
  for (const r of affidavitRows) isSubByJob[r.job_id] = r.is_sub
  const filingsByJob: Record<string, JobLienFilingRow[]> = {}
  for (const f of raw.filings) (filingsByJob[f.job_id] ??= []).push(f)
  const demandLettersByJob: Record<string, JobDemandLetterRow[]> = {}
  for (const l of raw.demandLetters ?? []) (demandLettersByJob[l.job_id] ??= []).push(l)

  // What each job's sent bills still owe, as the desk's own rows carry it (`lien_billed_open()`, v2.4969). Until v2.7530 the
  // book counted the job's whole price less payments here, so a job billed one stage of three read as owing the stages
  // never billed, on the office's Timeline and on counsel's grid, where the desk beside it read the bills.
  const billedOpenByJob: Record<string, number> = {}
  for (const r of affidavitRows) billedOpenByJob[r.job_id] = r.open_balance
  for (const r of rows) billedOpenByJob[r.job_id] = r.open_balance

  const jobs: Record<string, LienBookJob> = {}
  for (const j of raw.jobs) {
    const address = j.customer_address_id ? addressById[j.customer_address_id] ?? null : null
    const property = resolveLienProperty(address, ownerByJob[j.id] ?? null)
    const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
    const name = (j.job_name ?? '').trim()
    jobs[j.id] = {
      id: j.id,
      label: name ? `${number} · ${name}` : number,
      address: (j.job_address ?? '').trim(),
      gcId: j.gc_customer_id,
      gcName: j.gc_customer_id ? gcName[j.gc_customer_id] ?? '' : '',
      propertyKind: kindByJob[j.id] ?? property.propertyKind ?? '',
      homestead: Boolean(address?.homestead),
      county: property.county ?? '',
      precinct: ((address as { jp_precinct?: string | null } | null)?.jp_precinct ?? '').trim(),
      precinctNote: ((address as { jp_precinct_note?: string | null } | null)?.jp_precinct_note ?? '').trim(),
      ownerName: lienPropertyOwnerDisplayName(property.owner),
      // A job on no row of either queue (its paper already filed or released) has no bills read here, and keeps the job's balance.
      openBalance: billedOpenByJob[j.id] ?? Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
      lastWorkDate: j.last_work_date,
      isSub: isSubByJob[j.id] ?? Boolean(j.gc_customer_id),
      paymentBond: j.lien_payment_bond ?? null,
      contractEndedOn: j.lien_contract_ended_on ?? null,
      addressId: address ? address.id : null,
      propertyAddress: (address?.address ?? '').trim(),
      ownerMailingAddress: property.owner.mailingAddress,
      ...(address ? { publicStanding: lienPublicStanding(address as LienPublicRecord) } : {}),
    }
  }
  return { rows, affidavitRows, items: raw.items, filingsByJob, demandLettersByJob, jobs, policyByCustomer, ...(raw.ownerFacts ? { ownerFactsByJob: raw.ownerFacts } : {}), todayYmd }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** The portal payload's `lienBook` — the raw rows as the function sends them; null when absent or not the shape. */
export function parseLienBookRaw(v: unknown): LienBookRaw | null {
  if (!isRecord(v)) return null
  return {
    rows: arr<LienNoticeMonthRow>(v.rows),
    affidavitRows: arr<LienAffidavitRow>(v.affidavitRows),
    items: arr<LienDeskItemRow>(v.items),
    filings: arr<JobLienFilingRow>(v.filings),
    demandLetters: arr<JobDemandLetterRow>(v.demandLetters),
    jobs: arr<LienBookRawJob>(v.jobs),
    gcs: arr<LienBookRawGc>(v.gcs),
    addresses: arr<CustomerAddressRow>(v.addresses),
    owners: arr<NonNullable<JobPropertyOwnerLike> & { job_id: string }>(v.owners),
    // Only a function that sends the facts has the key; an older one leaves the book to read its items.
    ...(isRecord(v.ownerFacts) ? { ownerFacts: parseLienOwnerFactsByJob(v.ownerFacts) } : {}),
  }
}
