import type { LienDeskItemRow, LienNoticeMonthRow, LienNoticePolicy } from './lienDesk'
import { parseLienNoticePolicy } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from './lienProperty'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { LienBookJob, LienTimelineBookInput } from './lienTimelineBook'

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
}

export type LienBookRawGc = { id: string; name: string | null; lien_notice_policy: string | null }

export type LienBookRaw = {
  rows: LienNoticeMonthRow[]
  affidavitRows: LienAffidavitRow[]
  items: LienDeskItemRow[]
  /** Affidavits and releases (the tail); notices come through the RPC rows. */
  filings: JobLienFilingRow[]
  jobs: LienBookRawJob[]
  gcs: LienBookRawGc[]
  addresses: CustomerAddressRow[]
  owners: Array<NonNullable<JobPropertyOwnerLike> & { job_id: string }>
}

/** The select the book needs from jobs_ledger — the hook and the function read the same columns. */
export const LIEN_BOOK_JOB_COLUMNS = 'id, hcp_number, click_number, job_name, job_address, gc_customer_id, customer_address_id, revenue, payments_made, last_work_date, lien_payment_bond, lien_contract_ended_on'

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
      ownerName: lienPropertyOwnerDisplayName(property.owner),
      openBalance: Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
      lastWorkDate: j.last_work_date,
      isSub: isSubByJob[j.id] ?? Boolean(j.gc_customer_id),
      paymentBond: j.lien_payment_bond ?? null,
      contractEndedOn: j.lien_contract_ended_on ?? null,
    }
  }
  return { rows, affidavitRows, items: raw.items, filingsByJob, jobs, policyByCustomer, todayYmd }
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
    jobs: arr<LienBookRawJob>(v.jobs),
    gcs: arr<LienBookRawGc>(v.gcs),
    addresses: arr<CustomerAddressRow>(v.addresses),
    owners: arr<NonNullable<JobPropertyOwnerLike> & { job_id: string }>(v.owners),
  }
}
