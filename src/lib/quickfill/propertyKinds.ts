import { normalizePropertyKind, type PropertyKind } from '../jobs/propertyKind'

/**
 * Quickfill → Property kinds (v2.4727): every unpaid job whose property has no
 * kind yet, as a queue of PROPERTIES — one row per saved property (or per typed
 * address on a customer, for jobs with no saved property yet), the jobs at it
 * listed under the address. A pick on a row is the same write the Pipeline's
 * red ? makes (`savePropertyKind` / `linkJobPropertyAndSaveKind`), so every job
 * at the address follows it and the lien clock reads the right deadline.
 *
 * Rows with a lien clock running (Billed, Collections) come first, biggest
 * balance first, because § 53.056 gives a residential property's notice a
 * month less: those deadlines are already counting on the wrong day. A job with
 * neither a customer nor a GC has nowhere to keep a property and is counted
 * for the foot line instead (it belongs in Missing job info).
 */

export type PropertyKindQueueJob = {
  id: string
  status: string | null
  collections_at: string | null
  customer_id: string | null
  gc_customer_id: string | null
  customer_name: string | null
  gc_name: string | null
  customer_address_id: string | null
  job_address: string | null
  /** The number the row shows — `effectiveJobLedgerNumber(hcp_number, click_number)`. */
  job_number: string
  job_name: string | null
  /** Dollars billed and unpaid on the job (`jobBilledUnpaidDollars`); 0 before billing. */
  open_balance: number
}

export type PropertyKindStage = 'Waiting' | 'Working' | 'Ready to Bill' | 'Billed' | 'Collections'

export type PropertyKindRowJob = { id: string; label: string; stage: PropertyKindStage; openBalance: number }

export type PropertyKindHint = { kind: Exclude<PropertyKind, ''>; why: string }

export type PropertyKindRow = {
  /** Stable across renders: the saved property's id, else the customer + typed address. */
  key: string
  /** The saved property; null when the jobs carry a typed address only (the pick saves it as one). */
  customerAddressId: string | null
  /** The property's home: the job's customer, else its GC (v2.4222). */
  customerId: string
  customerName: string
  gcName: string | null
  address: string
  jobs: PropertyKindRowJob[]
  /** A Billed or Collections job sits at the property: its lien deadline is already running. */
  lienClock: boolean
  openBalance: number
  hint: PropertyKindHint | null
}

/** The stage words the row shows; null for a paid job (not in the queue). */
export function unpaidStage(job: Pick<PropertyKindQueueJob, 'status' | 'collections_at'>): PropertyKindStage | null {
  const status = (job.status ?? 'working') as string
  if (status === 'waiting') return 'Waiting'
  if (status === 'working') return 'Working'
  if (status === 'ready_to_bill') return 'Ready to Bill'
  if (status === 'billed') return job.collections_at != null ? 'Collections' : 'Billed'
  return null
}

const COMMERCIAL_WORDS = /\b(suite|ste\.?|tenant|finish[- ]?out|restaurant|office|church|school|clinic|dental|apartments?|warehouse|retail|store|shop|hotel|plaza|center|llc|inc)\b/i
const RESIDENTIAL_WORDS = /\b(house|home|residence|homeowner)\b/i

/**
 * What the app already knows that leans one way: a GC on the job (a GC's job is
 * a construction project, not somebody's house), the customer's own
 * commercial / residential type, else a telling word in the job's name or
 * address. Never a decision — the row outlines the half and the assistant taps.
 */
export function propertyKindHint(input: { gcOnJob: boolean; customerType: string | null | undefined; words: string }): PropertyKindHint | null {
  if (input.gcOnJob) return { kind: 'non_residential', why: 'a GC on the job' }
  const t = (input.customerType ?? '').trim().toLowerCase()
  if (t === 'commercial') return { kind: 'non_residential', why: 'a commercial account' }
  if (t === 'residential') return { kind: 'residential', why: 'a homeowner account' }
  const c = COMMERCIAL_WORDS.exec(input.words)
  if (c) return { kind: 'non_residential', why: `“${c[0]}” in the job's name` }
  const r = RESIDENTIAL_WORDS.exec(input.words)
  if (r) return { kind: 'residential', why: `“${r[0]}” in the job's name` }
  return null
}

function normalizedAddress(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The queue. `kindByJobId` is `usePropertyKinds`' answer (null while its first
 * read is out → `loading`); `customerTypeById` the customers' own type for the
 * hint. Jobs already paid, already marked, or with nowhere to keep a property
 * are left out; the last are counted in `noCustomerCount`.
 */
export function propertyKindRows(
  jobs: ReadonlyArray<PropertyKindQueueJob>,
  kindByJobId: ReadonlyMap<string, string> | null,
  customerTypeById: ReadonlyMap<string, string | null>,
): { rows: PropertyKindRow[]; noCustomerCount: number; loading: boolean } {
  if (!kindByJobId) return { rows: [], noCustomerCount: 0, loading: true }
  const byKey = new Map<string, PropertyKindRow>()
  let noCustomerCount = 0
  for (const job of jobs) {
    const stage = unpaidStage(job)
    if (!stage) continue
    const home = job.customer_id ?? job.gc_customer_id ?? null
    if (!job.customer_address_id && !home) {
      noCustomerCount += 1
      continue
    }
    if (normalizePropertyKind(kindByJobId.get(job.id) ?? '') !== '') continue
    const key = job.customer_address_id ? `addr:${job.customer_address_id}` : `typed:${home}:${normalizedAddress(job.job_address)}`
    const label = `${job.job_number || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
    const rowJob: PropertyKindRowJob = { id: job.id, label, stage, openBalance: Math.max(0, job.open_balance || 0) }
    const lien = stage === 'Billed' || stage === 'Collections'
    const existing = byKey.get(key)
    if (existing) {
      existing.jobs.push(rowJob)
      existing.lienClock = existing.lienClock || lien
      existing.openBalance += rowJob.openBalance
      if (!existing.gcName && job.gc_name) existing.gcName = job.gc_name.trim() || null
      continue
    }
    byKey.set(key, {
      key,
      customerAddressId: job.customer_address_id ?? null,
      customerId: home ?? '',
      customerName: (job.customer_name ?? '').trim() || (job.gc_name ?? '').trim() || 'No name',
      gcName: (job.gc_name ?? '').trim() || null,
      address: (job.job_address ?? '').trim(),
      jobs: [rowJob],
      lienClock: lien,
      openBalance: rowJob.openBalance,
      hint: null,
    })
  }
  const rows = [...byKey.values()]
  for (const row of rows) {
    const home = row.customerId
    const gcOnJob = jobs.some((j) => row.jobs.some((rj) => rj.id === j.id) && j.gc_customer_id != null)
    const words = [row.address, ...row.jobs.map((j) => j.label)].join(' ')
    row.hint = propertyKindHint({ gcOnJob, customerType: customerTypeById.get(home) ?? null, words })
  }
  rows.sort((a, b) => Number(b.lienClock) - Number(a.lienClock) || b.openBalance - a.openBalance || a.address.localeCompare(b.address))
  return { rows, noCustomerCount, loading: false }
}

/** "HCP 1211 and 1240" / "HCP 863 and 2 other jobs" — the jobs a pick carries, for the green line. */
export function propertyKindFollowWords(jobs: ReadonlyArray<PropertyKindRowJob>): string {
  const number = (j: PropertyKindRowJob | undefined) => (j?.label ?? '').split(' · ')[0] ?? ''
  if (jobs.length === 0) return 'no jobs'
  if (jobs.length === 1) return number(jobs[0])
  const first = number(jobs[0])
  if (jobs.length === 2) return `${first} and ${number(jobs[1])}`
  return `${first} and ${jobs.length - 1} other jobs`
}
