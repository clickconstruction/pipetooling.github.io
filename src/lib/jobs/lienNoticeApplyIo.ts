import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { propertyKey } from './ownerConfirm'
import {
  fieldsWithSetAside,
  fieldsWithoutSetAside,
  LIEN_SET_ASIDE_KEY,
  lienApplyPayload,
  lienNoticedMonthsOnJob,
  lienRecordedPapers,
  sameLienProperty,
  type LienApplyFilingRow,
  type LienApplyProperty,
  type LienRecordedPaper,
} from './lienNoticeApply'

/**
 * Applying a notice that already went (v2.7508): the papers on record at this job's property under its original
 * contractor, the one row written on this job, the waiting notice set aside, and the undo. The rules are pure in
 * `lienNoticeApply.ts`. The paper's own row is never written here.
 */

export type LienApplyJob = { id: string; customer_address_id: string | null; job_address: string | null; gc_customer_id: string | null }

export type LienApplyContext = {
  papers: LienRecordedPaper[]
  /** The months this job's own notices already name. */
  noticedMonths: string[]
}

type AddressRow = { id: string; address: string | null; parcel_id: string | null; county: string | null; owner_name: string | null }
type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_address: string | null; customer_address_id: string | null }

const asProperty = (r: AddressRow): LienApplyProperty => ({ addressId: r.id, parcelId: r.parcel_id ?? '', county: r.county ?? '', ownerName: r.owner_name ?? '', address: r.address ?? '' })
const ADDRESS_COLUMNS = 'id, address, parcel_id, county, owner_name'

/** Every saved record that is this job's property: its own, and any other with the same parcel or the same street and owner. */
async function propertyRecordIds(addressId: string): Promise<string[]> {
  const own = await withSupabaseRetry<AddressRow | null>(() => supabase.from('customer_addresses').select(ADDRESS_COLUMNS).eq('id', addressId).maybeSingle(), 'lien notice: this property')
  if (!own) return [addressId]
  const found = new Map<string, AddressRow>()
  const parcel = (own.parcel_id ?? '').trim()
  if (parcel) {
    const rows = await withSupabaseRetry<AddressRow[]>(() => supabase.from('customer_addresses').select(ADDRESS_COLUMNS).eq('parcel_id', parcel), 'lien notice: the parcel’s records').catch(() => [])
    for (const r of rows ?? []) found.set(r.id, r)
  }
  const streetNumber = (own.address ?? '').trim().split(/\s+/)[0] ?? ''
  if (/^\d/.test(streetNumber)) {
    const rows = await withSupabaseRetry<AddressRow[]>(() => supabase.from('customer_addresses').select(ADDRESS_COLUMNS).ilike('address', `${streetNumber} %`), 'lien notice: the street’s records').catch(() => [])
    for (const r of rows ?? []) found.set(r.id, r)
  }
  const mine = asProperty(own)
  return [...new Set([own.id, ...[...found.values()].filter((r) => sameLienProperty(mine, asProperty(r))).map((r) => r.id)])]
}

/**
 * The notices on record at this job's property under its original contractor, this job's own among them. A job
 * contracted with the owner has none to apply. A job with no saved property record is matched by its street alone,
 * as the by-hand record matches it.
 */
export async function loadLienApplyContext(job: LienApplyJob): Promise<LienApplyContext> {
  if (!job.gc_customer_id) return { papers: [], noticedMonths: [] }
  const gcId = job.gc_customer_id
  let rows: JobRow[] = []
  if (job.customer_address_id) {
    const ids = await propertyRecordIds(job.customer_address_id)
    rows = (await withSupabaseRetry<JobRow[]>(() => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_address, customer_address_id').eq('gc_customer_id', gcId).in('customer_address_id', ids), 'lien notice: jobs at the property')) ?? []
  } else {
    const streetNumber = (job.job_address ?? '').trim().split(/\s+/)[0] ?? ''
    const key = propertyKey(job.job_address ?? '')
    if (/^\d/.test(streetNumber) && key) {
      const near = (await withSupabaseRetry<JobRow[]>(() => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_address, customer_address_id').eq('gc_customer_id', gcId).ilike('job_address', `${streetNumber}%`), 'lien notice: jobs on the street')) ?? []
      rows = near.filter((r) => propertyKey(r.job_address ?? '') === key)
    }
  }
  const jobIds = [...new Set([job.id, ...rows.map((r) => r.id)])]
  const labels = new Map(rows.map((r) => [r.id, effectiveJobLedgerNumber(r.hcp_number, r.click_number)]))
  const filings = (await withSupabaseRetry<LienApplyFilingRow[]>(() => supabase.from('job_lien_filings').select('*').in('job_id', jobIds).eq('kind', 'notice_53_056').is('voided_at', null), 'lien notice: notices on record')) ?? []
  return {
    papers: lienRecordedPapers(filings, { thisJobId: job.id, jobLabel: (id) => labels.get(id) ?? '' }),
    noticedMonths: lienNoticedMonthsOnJob(filings, job.id),
  }
}

export type LienApplyInput = {
  paper: LienRecordedPaper
  job: { id: string; amount: number }
  months: ReadonlyArray<string>
  reason: string
  userId: string | null
  userName: string
  /** The notice waiting on the desk, when it is to be set aside with the record. */
  setAside: { id: string; fields: unknown } | null
}

/**
 * Write the one row on this job, then set the waiting notice aside: `voided_at` with the reason on its fields, so it
 * keeps its approval and signature and undo can put it back. If the notice cannot be set aside the row is voided
 * again, so the desk is never left with a month noticed and its notice still asking to be mailed.
 */
export async function applyLienNoticePaper(input: LienApplyInput): Promise<{ filingId: string; setAside: boolean }> {
  const payload = lienApplyPayload({ paper: input.paper, job: input.job, months: input.months, reason: input.reason, userId: input.userId, userName: input.userName })
  const row = await withSupabaseRetry<{ id: string } | null>(() => supabase.from('job_lien_filings').insert(payload as never).select('id').single(), 'lien notice: apply a paper on record')
  if (!row?.id) throw new Error('The record was not written.')
  if (!input.setAside) return { filingId: row.id, setAside: false }
  const at = new Date().toISOString()
  const fields = fieldsWithSetAside(input.setAside.fields, { filingId: row.id, at, by: input.userId, byName: input.userName.trim(), sentOn: input.paper.sentOn, fromLabel: input.paper.sourceJobLabel })
  const itemId = input.setAside.id
  try {
    await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ voided_at: at, fields } as never).eq('id', itemId).is('voided_at', null), 'lien notice: set the waiting notice aside')
  } catch (e) {
    await supabase.from('job_lien_filings').update({ voided_at: at } as never).eq('id', row.id)
    throw e
  }
  return { filingId: row.id, setAside: true }
}

/**
 * Undo: void the applied row, then put back the notice it set aside, with its approval and signature as they were.
 * `restored` is false when no notice was set aside, or when the job has started another notice since and the old one
 * cannot stand beside it.
 */
export async function undoLienNoticeApply(filing: { id: string; job_id: string }): Promise<{ restored: boolean }> {
  await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ voided_at: new Date().toISOString() } as never).eq('id', filing.id), 'lien notice: undo the applied record')
  const items = (await withSupabaseRetry<Array<{ id: string; fields: unknown }>>(() => supabase.from('job_lien_desk_items').select('id, fields').eq('job_id', filing.job_id).eq('kind', 'notice_53_056').not('voided_at', 'is', null), 'lien notice: the notice set aside').catch(() => [])) ?? []
  const item = items.find((i) => {
    const mark = i.fields && typeof i.fields === 'object' ? (i.fields as Record<string, unknown>)[LIEN_SET_ASIDE_KEY] : null
    return Boolean(mark) && typeof mark === 'object' && (mark as { filingId?: unknown }).filingId === filing.id
  })
  if (!item) return { restored: false }
  try {
    await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ voided_at: null, fields: fieldsWithoutSetAside(item.fields) } as never).eq('id', item.id), 'lien notice: put the notice back')
    return { restored: true }
  } catch {
    return { restored: false }
  }
}
