import { isSentBill } from '../jobs/paymentAttribution'

/**
 * The retainage the claim adds (punch list #213, finding 1; v2.6103). *How much?* on the Legal
 * desk reads the claim as the open bills plus the retainage held (v2.5849). That is right when the
 * bills went out net of retainage, as the AIA window's bill does (`current_payment_due`): the
 * retainage then sits on no bill. It counted twice when a bill went out for the whole amount and
 * the GC paid it short by the retainage: the open remainder of that bill is the retainage, and the
 * lien details hold the same figure. This kernel says, per job, what part of the held figure the
 * sent bills already carry, so the claim adds only the rest. Pure; the packet feeds it.
 *
 * - A bill tied to a pay application (`job_pay_applications.invoice_id`, v2.5032) carries that
 *   application's period retainage when its amount is above the application's payment due by that
 *   much — a bill sent for the whole amount. A bill that equals the payment due carries none;
 *   between, the difference. A later application whose retainage to date dropped is the release
 *   (the final application at zero, v2.6017), and its sent bill carries the drop.
 * - The release bill (`jobs_ledger_invoices.retainage_release`, v2.6017), once sent, carries the
 *   figure up to its amount.
 * - A draft bill carries nothing, so nothing leaves the claim early. An application with no bill,
 *   or whose bill the job no longer lists, carries nothing.
 * - What the bills carry stays inside the open bills (the balance); `added = held − onBills`, never
 *   below zero.
 *
 * What it cannot tell: a bill made by hand for the whole amount on a job with no pay application.
 * The typed figure is added there, and the card's sentence names what was added.
 */

/** One live pay application on a job, as the packet reads it. */
export type LegalPayApplicationLike = {
  jobId: string
  applicationNumber: number
  /** Retainage to date on the application (G702 line 5). */
  retainageHeld: number
  /** Current payment due (G702 line 8): what the application's bill asks for when sent net. */
  currentPaymentDue: number
  /** The bill it became, or null while untied. */
  invoiceId: string | null
}

/** One bill on the job, as the job row carries it. */
export type ClaimRetainageBill = {
  id: string
  amount: number | string | null
  status: string | null
  /** The release bill's mark (v2.6017); absent or null on an older row. */
  retainage_release?: boolean | null
}

export type ClaimRetainageJob = {
  id: string
  /** The figure the lien details hold (`jobs_ledger.lien_retainage_held`): the application's mirror, or the typed figure. */
  lien_retainage_held?: number | string | null
  invoices?: ReadonlyArray<ClaimRetainageBill> | null
}

export type ClaimRetainage = {
  /** The figure the job holds; 0 when none. */
  held: number
  /** The part a sent bill already carries: inside the open bills, never added again. */
  onBills: number
  /** held − onBills: the retainage no sent bill asks for, the part the claim adds. */
  added: number
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : 0
  return Number.isFinite(n) ? n : 0
}
const positive = (v: unknown): number => Math.max(0, round2(num(v)))

/** One job's retainage as the claim reads it. */
export function claimRetainage(job: ClaimRetainageJob, applications: ReadonlyArray<Pick<LegalPayApplicationLike, 'applicationNumber' | 'retainageHeld' | 'currentPaymentDue' | 'invoiceId'>>): ClaimRetainage {
  const held = positive(job.lien_retainage_held)
  if (held <= 0) return { held: 0, onBills: 0, added: 0 }
  const sent = new Map<string, ClaimRetainageBill>()
  for (const b of job.invoices ?? []) if (isSentBill(b.status)) sent.set(b.id, b)

  let onBills = 0
  // The release bill, once sent, asks for the figure: whether paid or not, the retainage is on it.
  for (const b of sent.values()) if (b.retainage_release === true) onBills += positive(b.amount)

  // Each application's period, by number: a rise is the period's retainage, a drop its release.
  const apps = [...applications].sort((a, b) => a.applicationNumber - b.applicationNumber)
  let previous = 0
  for (const a of apps) {
    const toDate = positive(a.retainageHeld)
    const delta = round2(toDate - previous)
    previous = toDate
    const bill = a.invoiceId ? sent.get(a.invoiceId) : undefined
    if (!bill || bill.retainage_release === true) continue
    if (delta > 0) {
      // A bill sent for the whole amount is the payment due plus the period's retainage; a net bill equals the payment due.
      const above = round2(positive(bill.amount) - positive(a.currentPaymentDue))
      onBills += Math.min(delta, Math.max(0, above))
    } else if (delta < 0) {
      onBills += Math.min(-delta, positive(bill.amount))
    }
  }
  onBills = Math.min(held, round2(onBills))
  return { held, onBills, added: round2(held - onBills) }
}

/** The account's three figures: Σ over its jobs, each read with its own applications. */
export function claimRetainageForAccount(jobs: ReadonlyArray<ClaimRetainageJob>, applications: ReadonlyArray<LegalPayApplicationLike>): ClaimRetainage {
  const byJob = new Map<string, LegalPayApplicationLike[]>()
  for (const a of applications) byJob.set(a.jobId, [...(byJob.get(a.jobId) ?? []), a])
  let held = 0
  let onBills = 0
  for (const j of jobs) {
    const r = claimRetainage(j, byJob.get(j.id) ?? [])
    held += r.held
    onBills += r.onBills
  }
  held = round2(held)
  onBills = round2(onBills)
  return { held, onBills, added: round2(held - onBills) }
}
