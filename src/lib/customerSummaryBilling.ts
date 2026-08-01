/**
 * Billed summary for the Dispatch Mode Customer Summary modal (v2.1237):
 * per-customer outstanding money computed as job total minus payments —
 * everything not yet collected, including work not yet invoiced. Pure kernel;
 * the modal renders outstanding jobs as rows and compresses paid-in-full jobs
 * to a count line. Cents-exact (integer cents internally).
 */

export type CustomerBillingJobInput = {
  id: string
  numberLabel: string
  jobName: string
  jobAddress: string
  /** jobs_ledger.revenue — the job total; null/0 means no total set. */
  revenueDollars: number | null
  paymentsMadeDollars: number
}

export type CustomerBillingOutstandingJob = {
  id: string
  numberLabel: string
  jobName: string
  jobAddress: string
  outstandingDollars: number
}

export type CustomerBillingSummary = {
  /** Sum of job totals across jobs that have one. */
  totalDollars: number
  /** Sum of per-job max(0, total − payments). */
  outstandingDollars: number
  /** Jobs still carrying a balance, largest first. */
  outstandingJobs: CustomerBillingOutstandingJob[]
  /** Jobs with a total that is fully covered by payments. */
  paidInFullCount: number
  /** Jobs with no job total set (excluded from the money math). */
  noTotalCount: number
}

const toCents = (n: number) => Math.round(n * 100)

export function summarizeCustomerJobsBilling(jobs: CustomerBillingJobInput[]): CustomerBillingSummary {
  let totalCents = 0
  let outstandingCents = 0
  let paidInFullCount = 0
  let noTotalCount = 0
  const outstandingJobs: CustomerBillingOutstandingJob[] = []
  for (const j of jobs) {
    const revenueCents = j.revenueDollars != null ? toCents(j.revenueDollars) : 0
    if (revenueCents <= 0) {
      noTotalCount += 1
      continue
    }
    totalCents += revenueCents
    const jobOutstandingCents = Math.max(0, revenueCents - toCents(j.paymentsMadeDollars))
    outstandingCents += jobOutstandingCents
    if (jobOutstandingCents > 0) {
      outstandingJobs.push({
        id: j.id,
        numberLabel: j.numberLabel,
        jobName: j.jobName,
        jobAddress: j.jobAddress,
        outstandingDollars: jobOutstandingCents / 100,
      })
    } else {
      paidInFullCount += 1
    }
  }
  outstandingJobs.sort((a, b) => b.outstandingDollars - a.outstandingDollars)
  return {
    totalDollars: totalCents / 100,
    outstandingDollars: outstandingCents / 100,
    outstandingJobs,
    paidInFullCount,
    noTotalCount,
  }
}
