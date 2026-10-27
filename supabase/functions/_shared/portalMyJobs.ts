/**
 * Your jobs on a homeowner's portal (v2.5948, punch list #185 PR 5; the plan `to-dos/customer-reviews/README.md`). The
 * one link that is theirs is worth keeping only if it says where their job is: each of their own open jobs, and each
 * paid one they were asked to review, with its stage on the Pipeline as they feel it (Booked, Working, Done, Billed,
 * Paid) and the review, a link to `/rate` while the ask is open and their stars after. The stage is the Pipeline's own
 * status, which the portal reads already; the residential flow's reading needs the flow's whole loader and stays on
 * the office's screens. Deno-free: the function builds it, `src/lib/portal/portalPayload.ts` parses it, and
 * `src/lib/portal/portalMyJobs.test.ts` imports this file.
 */

/** The stages as the customer feels them, by the Pipeline's status (`jobs_ledger.status`). */
export const PORTAL_JOB_STATUS_STAGE: Readonly<Record<string, number>> = { waiting: 0, working: 1, ready_to_bill: 2, billed: 3, paid: 4 }

export const PORTAL_JOB_STAGES = {
  en: ['Booked', 'Working', 'Done', 'Billed', 'Paid'],
  es: ['Agendado', 'Trabajando', 'Terminado', 'Facturado', 'Pagado'],
} as const

export type PortalMyJobRow = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  status?: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  /** GC mode's billing job (O4a): bookkeeping, never a job the customer follows. */
  billing_only?: boolean | null
}

export type PortalMyJobRating = { job_id: string | null; public_token: string | null; asked_at: string | null; answered_at: string | null; score: number | null }

export type PortalMyJob = {
  jobId: string
  /** The job as the customer knows it: its name, else its address, else its number. */
  label: string
  address: string | null
  /** 0 Booked · 1 Working · 2 Done · 3 Billed · 4 Paid. */
  stage: number
  /** The newest open review ask's token, for `/rate?t=`; null when none is open. */
  rateToken: string | null
  /** Their stars on the newest answered ask; null when none. */
  stars: number | null
}

/** At most this many jobs on the card: the newest open ones, then the paid ones with a review. */
export const PORTAL_MY_JOBS_MAX = 6

/**
 * The viewer's own jobs for the card: jobs they are the customer on (never one they GC for someone else), open ones
 * first by how far along they are, then paid ones they were asked to review. A paid job with no ask stays off: there is
 * nothing on it for them to do or read.
 */
export function portalMyJobs(jobs: readonly PortalMyJobRow[], ratings: readonly PortalMyJobRating[], viewerCustomerId: string, max: number = PORTAL_MY_JOBS_MAX): PortalMyJob[] {
  const byJob = new Map<string, PortalMyJobRating[]>()
  for (const r of ratings) {
    if (!r.job_id) continue
    const list = byJob.get(r.job_id)
    if (list) list.push(r)
    else byJob.set(r.job_id, [r])
  }
  const out: PortalMyJob[] = []
  for (const j of jobs) {
    if (j.customer_id !== viewerCustomerId) continue
    if (j.gc_customer_id && j.gc_customer_id !== viewerCustomerId) continue
    if (j.billing_only) continue
    const stage = PORTAL_JOB_STATUS_STAGE[j.status ?? '']
    if (stage === undefined) continue
    const asks = [...(byJob.get(j.id) ?? [])].sort((a, b) => (b.asked_at ?? '').localeCompare(a.asked_at ?? ''))
    if (stage === 4 && !asks.length) continue
    const open = asks.find((a) => !a.answered_at && a.public_token)
    const answered = asks.find((a) => a.answered_at && a.score != null)
    const number = (j.click_number ?? j.hcp_number ?? '').trim()
    out.push({
      jobId: j.id,
      label: (j.job_name ?? '').trim() || (j.job_address ?? '').trim() || (number ? `Job ${number}` : 'Your job'),
      address: (j.job_address ?? '').trim() || null,
      stage,
      rateToken: open?.public_token ?? null,
      stars: answered ? (answered.score as number) : null,
    })
  }
  const open = out.filter((j) => j.stage < 4).sort((a, b) => b.stage - a.stage)
  const paid = out.filter((j) => j.stage === 4).sort((a, b) => Number(Boolean(b.rateToken)) - Number(Boolean(a.rateToken)))
  return [...open, ...paid].slice(0, max)
}

/** What customers see's sample: a job being worked on, and a paid one with its review open. */
export const SAMPLE_MY_JOBS: readonly PortalMyJob[] = [
  { jobId: 'sample-job-2', label: 'Kitchen sink', address: '100 Sample St, Kyle, TX 78640', stage: 1, rateToken: null, stars: null },
  { jobId: 'sample-job-1', label: 'Water heater', address: '100 Sample St, Kyle, TX 78640', stage: 4, rateToken: 'sample', stars: null },
]
