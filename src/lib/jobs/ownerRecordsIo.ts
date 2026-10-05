/**
 * Records for an owner (v2.4544) — the reads and the writes behind the window. The rules are
 * `ownerRecords.ts`; this file only moves rows.
 *
 * `lien_owner_record_requests` is applied after the client ships (docs/migrations). Until
 * then a read answers "no request yet" and `available: false`, and the window says saving
 * is not ready; nothing throws at open.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { EMPTY_OWNER_RECORDS, parseOwnerRecords, type OwnerPacketJobInput, type OwnerRecordsFile } from './ownerRecords'

export type OwnerRecordsSeed = { id: string; customer_id: string | null; customer_address_id: string | null }

type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_id: string | null; gc_customer_id: string | null; customer_address_id: string | null; revenue: number | null }
type BillRow = { id: string; job_id: string; amount: number | null; status: string | null; billed_at: string | null; sequence_order: number | null }
type PayRow = { id: string; job_id: string; invoice_id: string | null; amount: number | null; paid_on: string | null; created_at: string | null; payment_type: string | null; reference_number: string | null }

/**
 * Every job at the property with the same owner, with its bills and its payments. A job with
 * no saved property reads alone: an address typed by hand is not proof of the same property.
 */
export async function loadOwnerPacketJobs(seed: OwnerRecordsSeed): Promise<{ jobs: OwnerPacketJobInput[]; gcIds: string[] }> {
  const addr = (seed.customer_address_id ?? '').trim()
  const cols = 'id, hcp_number, click_number, job_name, job_address, customer_id, gc_customer_id, customer_address_id, revenue'
  const jobs = ((await withSupabaseRetry(
    () => {
      const q = supabase.from('jobs_ledger').select(cols)
      return addr && seed.customer_id ? q.eq('customer_address_id', addr).eq('customer_id', seed.customer_id) : q.eq('id', seed.id)
    },
    'owner records: jobs',
  )) ?? []) as unknown as JobRow[]
  const ids = jobs.map((j) => j.id)
  if (ids.length === 0) return { jobs: [], gcIds: [] }
  const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((x): x is string => !!x))]
  const [bills, pays, gcs] = await Promise.all([
    withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, billed_at, sequence_order').in('job_id', ids), 'owner records: bills'),
    withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('id, job_id, invoice_id, amount, paid_on, created_at, payment_type, reference_number').in('job_id', ids), 'owner records: payments'),
    gcIds.length ? withSupabaseRetry(() => supabase.from('customers').select('id, name').in('id', gcIds), 'owner records: GCs') : Promise.resolve([]),
  ])
  const gcName = new Map(((gcs ?? []) as unknown as Array<{ id: string; name: string | null }>).map((g) => [g.id, g.name ?? '']))
  const billRows = (bills ?? []) as unknown as BillRow[]
  const payRows = (pays ?? []) as unknown as PayRow[]
  return {
    gcIds,
    jobs: jobs.map((j) => ({
      id: j.id,
      number: effectiveJobLedgerNumber(j.hcp_number ?? '', j.click_number) || '—',
      name: (j.job_name ?? '').trim() || 'Job',
      address: (j.job_address ?? '').replace(/\s*\n\s*/g, ', ').trim(),
      gcName: j.gc_customer_id ? gcName.get(j.gc_customer_id) ?? null : null,
      total: Number(j.revenue ?? 0),
      bills: billRows.filter((b) => b.job_id === j.id).map((b) => ({ id: b.id, amount: Number(b.amount ?? 0), status: b.status ?? '', billedAt: b.billed_at, order: Number(b.sequence_order ?? 0) })),
      payments: payRows.filter((p) => p.job_id === j.id).map((p) => ({ id: p.id, billId: p.invoice_id, amount: Number(p.amount ?? 0), paidOn: p.paid_on, recordedAt: p.created_at, type: p.payment_type, reference: p.reference_number })),
    })),
  }
}

export type OwnerRecordRequestRow = { id: string; customer_id: string | null; customer_address_id: string | null; gc_customer_id: string | null; seed_job_id: string | null; job_ids: string[]; file: unknown; sent_at: string | null; created_at: string | null }

export type OwnerRecordsLoaded = {
  /** False when the table is not there yet (or the read failed): the window can draw and print, not save. */
  available: boolean
  /** The open request for this property, or the last one sent; null when there is none. */
  rowId: string | null
  file: OwnerRecordsFile
}

/** Does this request belong to the property? The saved property and owner when both name one; else a job in common. */
function sameProperty(row: OwnerRecordRequestRow, key: { customerId: string | null; addressId: string | null; jobIds: ReadonlyArray<string> }): boolean {
  if (key.addressId && row.customer_address_id) return row.customer_address_id === key.addressId && row.customer_id === key.customerId
  return (row.job_ids ?? []).some((id) => key.jobIds.includes(id))
}

/**
 * The property's request and the GC's contract check. The request is the one still open (not
 * sent), else the newest; the contract check is the newest tick on any request for one of the
 * same GCs, since the contract is read once per GC.
 */
export async function loadOwnerRecords(key: { customerId: string | null; addressId: string | null; jobIds: ReadonlyArray<string>; gcIds: ReadonlyArray<string> }): Promise<OwnerRecordsLoaded> {
  let rows: OwnerRecordRequestRow[] = []
  try {
    const filters = [key.addressId ? `customer_address_id.eq.${key.addressId}` : '', key.gcIds.length ? `gc_customer_id.in.(${key.gcIds.join(',')})` : '', key.jobIds.length ? `seed_job_id.in.(${key.jobIds.join(',')})` : ''].filter(Boolean)
    if (filters.length === 0) return { available: true, rowId: null, file: EMPTY_OWNER_RECORDS }
    const { data, error } = await supabase
      .from('lien_owner_record_requests' as never)
      .select('id, customer_id, customer_address_id, gc_customer_id, seed_job_id, job_ids, file, sent_at, created_at')
      .or(filters.join(','))
      .order('created_at', { ascending: false })
    if (error) return { available: false, rowId: null, file: EMPTY_OWNER_RECORDS }
    rows = (data ?? []) as unknown as OwnerRecordRequestRow[]
  } catch {
    return { available: false, rowId: null, file: EMPTY_OWNER_RECORDS }
  }
  const mine = rows.filter((r) => sameProperty(r, key))
  const current = mine.find((r) => !r.sent_at) ?? mine[0] ?? null
  const own = current ? parseOwnerRecords(current.file) : null
  let contract: OwnerRecordsFile['contractChecked'] = null
  for (const r of rows) {
    if (!r.gc_customer_id || !key.gcIds.includes(r.gc_customer_id)) continue
    const c = parseOwnerRecords(r.file)?.contractChecked ?? null
    if (c && (!contract || c.at > contract.at)) contract = c
  }
  return { available: true, rowId: current?.id ?? null, file: { ...(own ?? EMPTY_OWNER_RECORDS), contractChecked: own?.contractChecked ?? contract } }
}

export type OwnerRecordsSave = {
  rowId: string | null
  customerId: string | null
  addressId: string | null
  gcId: string | null
  seedJobId: string
  jobIds: string[]
  ownerName: string
  propertyAddress: string
  file: OwnerRecordsFile
}

/** Create or update the property's request. Returns the row id. */
export async function saveOwnerRecords(input: OwnerRecordsSave): Promise<string> {
  const payload = {
    customer_id: input.customerId,
    customer_address_id: input.addressId,
    gc_customer_id: input.gcId,
    seed_job_id: input.seedJobId,
    job_ids: input.jobIds,
    owner_name: input.ownerName,
    property_address: input.propertyAddress,
    file: JSON.parse(JSON.stringify(input.file)) as Record<string, unknown>,
    sent_at: input.file.sent?.at ?? null,
  }
  if (input.rowId) {
    await withSupabaseRetry(() => supabase.from('lien_owner_record_requests' as never).update(payload as never).eq('id', input.rowId as string), 'owner records: save')
    return input.rowId
  }
  const row = await withSupabaseRetry<{ id: string }>(() => supabase.from('lien_owner_record_requests' as never).insert(payload as never).select('id').single(), 'owner records: start')
  return row.id
}
