/**
 * The owner sees the bills (v2.3827, punch list #45 PR 1).
 *
 * A job whose bills go to the GC and whose customer is someone else — the owner of the
 * property — shows the owner nothing on their portal: the statement lists what they pay, so it
 * reads $0 and "all paid up" while the GC owes us on their house (Umar Khan, 9703 Lenox Hl,
 * 2026-09-25). Sharing already exists (v2.3375): a bill stamped `shown_to_party = 'customer'`
 * reaches their portal for their records, no Pay button, never in their balance; the job's
 * `show_bills_to_other_party` stamps its NEXT bills. This kernel is the switch over both, for
 * a whole property at once (the owner's call, 2026-09-25): which jobs it applies to, whether
 * it is on, off or partly on, and exactly which rows a flip writes. Pure; the IO writes.
 */
import { effectiveInvoiceParty } from '../../../supabase/functions/_shared/billToParty'
import { PORTAL_OPEN_INVOICE_STATUS } from '../../../supabase/functions/_shared/portalBillMembership'

export type OwnerShareJob = {
  id: string
  customer_id: string | null
  gc_customer_id: string | null
  bill_to_party?: string | null
  customer_address_id?: string | null
  show_bills_to_other_party?: boolean | null
}

export type OwnerShareInvoice = {
  id: string
  job_id: string
  status?: string | null
  bill_to_party?: string | null
  bill_to_email?: string | null
  shown_to_party?: string | null
}

export type OwnerShareState = 'on' | 'off' | 'partly'

/** The switch belongs on a job billed to its GC whose customer is a different party — the owner. */
export function ownerShareApplies(job: OwnerShareJob): boolean {
  const gc = (job.gc_customer_id ?? '').trim()
  const cust = (job.customer_id ?? '').trim()
  if (!gc || !cust || gc === cust) return false
  return effectiveInvoiceParty(job, null) === 'gc'
}

/** Open bills on the job that the GC pays — the ones the owner would be shown. */
export function ownerShareBills(job: OwnerShareJob, invoices: ReadonlyArray<OwnerShareInvoice>): OwnerShareInvoice[] {
  return invoices.filter((i) => i.job_id === job.id && (i.status ?? '') === PORTAL_OPEN_INVOICE_STATUS && effectiveInvoiceParty(job, i) === 'gc')
}

/**
 * On when the job remembers it and every open GC bill is stamped for the owner; off when
 * neither; partly otherwise (a bill ticked by hand at Bill Customer, or the old next-bills-only
 * tick from Edit Job). Null when the switch does not apply.
 */
export function ownerShareState(job: OwnerShareJob, invoices: ReadonlyArray<OwnerShareInvoice>): OwnerShareState | null {
  if (!ownerShareApplies(job)) return null
  const bills = ownerShareBills(job, invoices)
  const stamped = bills.filter((i) => i.shown_to_party === 'customer').length
  const memory = job.show_bills_to_other_party === true
  if (memory && stamped === bills.length) return 'on'
  if (!memory && stamped === 0) return 'off'
  return 'partly'
}

/** The property's state from its jobs' states: on only when every job is on. */
export function ownerSharePropertyState(states: ReadonlyArray<OwnerShareState | null>): OwnerShareState | null {
  const s = states.filter((x): x is OwnerShareState => x != null)
  if (s.length === 0) return null
  if (s.every((x) => x === 'on')) return 'on'
  if (s.every((x) => x === 'off')) return 'off'
  return 'partly'
}

/**
 * The jobs one flip covers: this job and every other job at the same saved property with the
 * same owner as customer that the switch applies to. A job with no saved property is alone.
 */
export function ownerShareScope<T extends OwnerShareJob>(job: T, candidates: ReadonlyArray<T>): T[] {
  const addr = (job.customer_address_id ?? '').trim()
  if (!addr) return ownerShareApplies(job) ? [job] : []
  const same = candidates.filter((c) => (c.customer_address_id ?? '').trim() === addr && (c.customer_id ?? '') === (job.customer_id ?? '') && ownerShareApplies(c))
  return same.some((c) => c.id === job.id) ? same : ownerShareApplies(job) ? [job, ...same] : same
}

export type OwnerShareWrites = {
  /** Jobs whose `show_bills_to_other_party` becomes `on`. */
  jobIds: string[]
  /** Open GC bills whose `shown_to_party` becomes 'customer' (on) or null (off). */
  invoiceIds: string[]
  on: boolean
}

/**
 * What one flip writes. Off clears only stamps for the owner — a bill ticked for someone else
 * keeps its tick — and only on open bills; a paid bill they have already seen stays in their history.
 */
export function ownerShareWrites(jobs: ReadonlyArray<OwnerShareJob>, invoices: ReadonlyArray<OwnerShareInvoice>, on: boolean): OwnerShareWrites {
  const jobIds = jobs.filter(ownerShareApplies).map((j) => j.id)
  const invoiceIds = jobs
    .filter(ownerShareApplies)
    .flatMap((j) => ownerShareBills(j, invoices))
    .filter((i) => (on ? i.shown_to_party !== 'customer' : i.shown_to_party === 'customer'))
    .map((i) => i.id)
  return { jobIds, invoiceIds, on }
}

/** The chip's words: `owner sees $0` · `owner sees the bills` · `owner sees some bills`. */
export function ownerShareChipWords(state: OwnerShareState): string {
  return state === 'on' ? 'owner sees the bills' : state === 'partly' ? 'owner sees some bills' : 'owner sees $0'
}
