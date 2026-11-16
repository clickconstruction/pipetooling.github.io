import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { chunkIds } from '../supabasePaging'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { lienBilledOpen } from './lienBilledOpen'
import { parsePaymentBond } from './lienDeskRetainage'
import { lienAttentionLine } from './lienProperty'
import { lienPublicAnswerOf, type LienPaymentBondAnswer, type LienPublicAnswer, type LienPublicPaper, type LienPublicPressLine, type LienPublicPropertyJob } from './lienPublicProperty'

/**
 * The reads and the one write behind *Is this public property?* (v2.7443). The rules and the words are
 * `lienPublicProperty.ts`; the write is `set_property_lien_public_answer` (migration 20261116221500), which stores the
 * answer and, for a public property, writes the bond and puts the ticked jobs on the attorney's list in one
 * transaction.
 */

/** A job at the property, with what the window and the bin print beside it. */
export type LienPublicPropertyJobRead = LienPublicPropertyJob & {
  gcName: string
  bond: LienPaymentBondAnswer
  attorneySince: string | null
}

export type LienPublicPropertyRead = {
  addressId: string
  address: string
  /** The owner of record as the window names it: the first name on the record that is not an attention line. */
  ownerName: string
  answer: LienPublicAnswer | null
  answeredAt: string | null
  reason: string
  jobs: LienPublicPropertyJobRead[]
}

type AddressRow = { id: string; address?: string | null; owner_name?: string | null; owner_company?: string | null; lien_public_answer?: unknown; lien_public_answered_at?: unknown; lien_public_reason?: unknown }
type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; status: string | null; revenue: number | null; payments_made: number | null; gc_customer_id: string | null; lien_payment_bond: string | null; collections_at: string | null }
type InvoiceRow = { id: string; job_id: string; status: string | null; amount: number | null; sequence_order: number | null; billed_at: string | null }
type PaymentRow = { job_id: string; invoice_id: string | null; amount: number | null }
type ItemRow = LienPublicPaper & { job_id: string }

const JOB_COLUMNS = 'id, hcp_number, click_number, job_name, status, revenue, payments_made, gc_customer_id, lien_payment_bond, collections_at'

/** The owner the window names: the person or the body, never an *ATTN* line. */
export function lienPublicOwnerName(row: Pick<AddressRow, 'owner_name' | 'owner_company'> | null | undefined): string {
  const names = [row?.owner_name, row?.owner_company].map((n) => (n ?? '').trim()).filter((n) => n && !lienAttentionLine(n))
  return names[0] ?? ''
}

/** The property record and every job at it, with each job's money by the desk's own rule, its bond, its GC and its papers. */
export async function readLienPublicProperty(addressId: string): Promise<LienPublicPropertyRead> {
  const [addressData, jobsData] = await Promise.all([
    withSupabaseRetry(() => supabase.from('customer_addresses').select('*').eq('id', addressId).maybeSingle(), 'public property: the record'),
    withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).eq('customer_address_id', addressId), 'public property: the jobs'),
  ])
  const record = (addressData ?? null) as AddressRow | null
  if (!record) throw new Error('The property record could not be read.')
  const jobs = (jobsData ?? []) as unknown as JobRow[]
  const ids = jobs.map((j) => j.id)
  const invoices: InvoiceRow[] = []
  const payments: PaymentRow[] = []
  const items: ItemRow[] = []
  for (const chunk of chunkIds(ids)) {
    if (chunk.length === 0) continue
    const [inv, pay, its] = await Promise.all([
      withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at').in('job_id', chunk), 'public property: the bills'),
      withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount').in('job_id', chunk), 'public property: the payments'),
      withSupabaseRetry(() => supabase.from('job_lien_desk_items').select('job_id, kind, status, months, sent_at, approved_at, voided_at').in('job_id', chunk).is('voided_at', null), 'public property: the lien papers'),
    ])
    invoices.push(...((inv ?? []) as InvoiceRow[]))
    payments.push(...((pay ?? []) as PaymentRow[]))
    items.push(...((its ?? []) as unknown as ItemRow[]))
  }
  const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((v): v is string => Boolean(v)))]
  const gcRows = gcIds.length ? ((await withSupabaseRetry(() => supabase.from('customers').select('id, name').in('id', gcIds), 'public property: the GCs')) ?? []) : []
  const gcName = new Map((gcRows as Array<{ id: string; name: string | null }>).map((g) => [g.id, (g.name ?? '').trim()]))
  return {
    addressId,
    address: (record.address ?? '').trim(),
    ownerName: lienPublicOwnerName(record),
    answer: lienPublicAnswerOf(record),
    answeredAt: typeof record.lien_public_answered_at === 'string' ? record.lien_public_answered_at : null,
    reason: typeof record.lien_public_reason === 'string' ? record.lien_public_reason : '',
    jobs: jobs.map((j) => ({
      jobId: j.id,
      number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
      name: (j.job_name ?? '').trim(),
      status: j.status,
      unpaid: lienBilledOpen(
        { id: j.id, status: j.status ?? null, revenue: Number(j.revenue ?? 0), payments_made: Number(j.payments_made ?? 0) },
        invoices.filter((i) => i.job_id === j.id).map((i) => ({ ...i, amount: Number(i.amount ?? 0) })),
        payments.filter((p) => p.job_id === j.id).map((p) => ({ ...p, amount: Number(p.amount ?? 0) })),
      ),
      papers: items.filter((i) => i.job_id === j.id).map(({ kind, status, months, sent_at, approved_at, voided_at }) => ({ kind, status, months, sent_at, approved_at, voided_at })),
      gcName: j.gc_customer_id ? (gcName.get(j.gc_customer_id) ?? '') : '',
      bond: parsePaymentBond(j.lien_payment_bond),
      attorneySince: j.collections_at,
    })),
  }
}

export type LienPublicAnswerInput = {
  addressId: string
  answer: LienPublicAnswer | 'unanswered'
  reason?: string | null
  /** For *public*: the ticked jobs, each with the note that goes on the attorney's list with it. */
  jobs?: ReadonlyArray<{ job_id: string; note: string }>
  /** For *public*: the payment bond written to each ticked job; null leaves the jobs' own. */
  bond?: LienPaymentBondAnswer | null
}

/** The press: the answer stored, and for *public* each ticked job's line. Throws the function's own words when it refuses. */
export async function setLienPublicAnswer(input: LienPublicAnswerInput): Promise<{ answer: LienPublicAnswer | null; jobs: LienPublicPressLine[] }> {
  const data = await withSupabaseRetry(
    () =>
      supabase.rpc('set_property_lien_public_answer' as never, {
        p_address_id: input.addressId,
        p_answer: input.answer,
        p_reason: input.reason?.trim() || null,
        p_jobs: input.jobs ?? [],
        p_payment_bond: input.bond ?? null,
      } as never),
    'public property: the answer',
  )
  const r = (data ?? {}) as { ok?: boolean; error?: string; answer?: unknown; jobs?: unknown }
  if (r.error) throw new Error(r.error)
  if (!r.ok) throw new Error('The answer was not saved.')
  return { answer: r.answer === 'public' || r.answer === 'private' ? r.answer : null, jobs: Array.isArray(r.jobs) ? (r.jobs as LienPublicPressLine[]) : [] }
}
