/** One display row for Dashboard Ready to Bill (job, merged job+line, or standalone invoice). */
export type ReadyToBillDashboardUnit<J, I> =
  | { kind: 'job'; job: J }
  | { kind: 'job_bundle'; job: J; inv: I }
  | { kind: 'invoice'; inv: I }

type ReadyToBillJobShape = {
  id: string
  revenue: number | null
  payments_made: number | null
}

type ReadyToBillInvoiceShape = {
  id: string
  job_id: string
  amount: number | null
  status: string
  is_primary_rtb_bundle: boolean | null
}

function jobRemainingCents(job: ReadyToBillJobShape): number {
  const remaining = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
  return Math.round(remaining * 100)
}

function invoiceAmountCents(inv: Pick<ReadyToBillInvoiceShape, 'amount'>): number {
  return Math.round(Number(inv.amount ?? 0) * 100)
}

/** Unallocated billing cents (gross − RTB − billed) for one job; aligns with ensure RPC. */
function dashboardJobBillingUnallocCents<
  J extends ReadyToBillJobShape,
  I extends ReadyToBillInvoiceShape,
>(job: J, invoices: I[]): number {
  const g = jobRemainingCents(job)
  let alloc = 0
  for (const i of invoices) {
    if (i.job_id !== job.id) continue
    if (i.status === 'ready_to_bill' || i.status === 'billed') {
      alloc += invoiceAmountCents(i)
    }
  }
  return Math.max(0, g - alloc)
}

export function buildReadyToBillDashboardUnits<
  J extends ReadyToBillJobShape,
  I extends ReadyToBillInvoiceShape,
>(jobs: J[], invoices: I[]): ReadyToBillDashboardUnit<J, I>[] {
  const bundledIds = new Set<string>()
  const out: ReadyToBillDashboardUnit<J, I>[] = []
  for (const job of jobs) {
    const primary = invoices.find((i) => i.job_id === job.id && i.is_primary_rtb_bundle === true)
    if (primary) {
      const rtbOnJob = invoices.filter((i) => i.job_id === job.id && i.status === 'ready_to_bill')
      const u = dashboardJobBillingUnallocCents(job, invoices)
      if (rtbOnJob.length === 1 && u > 0) {
        out.push({ kind: 'job', job })
        continue
      }
      bundledIds.add(primary.id)
      out.push({ kind: 'job_bundle', job, inv: primary })
      continue
    }
    const rtbOnJob = invoices.filter((i) => i.job_id === job.id && i.status === 'ready_to_bill')
    const remCents = jobRemainingCents(job)
    if (
      rtbOnJob.length === 1 &&
      invoiceAmountCents(rtbOnJob[0]!) === remCents
    ) {
      const inv = rtbOnJob[0]!
      bundledIds.add(inv.id)
      out.push({ kind: 'job_bundle', job, inv })
    } else {
      out.push({ kind: 'job', job })
    }
  }
  for (const inv of invoices) {
    if (!bundledIds.has(inv.id)) out.push({ kind: 'invoice', inv })
  }
  return out
}

/** For Field queue **Prepare Bill**: same target as Dashboard Ready to Bill **Bill Customer** for `jobId`. */
export type ResolveReadyToBillBillCustomerTargetResult<J, I> =
  | { mode: 'invoice'; inv: I }
  | { mode: 'job'; job: J }
  | { mode: 'none' }
  | { mode: 'ambiguous'; count: number }

export function resolveReadyToBillBillCustomerTarget<
  J extends { id: string },
  I extends { id: string; job_id: string },
>(
  jobId: string,
  units: ReadyToBillDashboardUnit<J, I>[],
): ResolveReadyToBillBillCustomerTargetResult<J, I> {
  const bundle = units.find(
    (u): u is { kind: 'job_bundle'; job: J; inv: I } =>
      u.kind === 'job_bundle' && u.job.id === jobId,
  )
  if (bundle) return { mode: 'invoice', inv: bundle.inv }

  const jobUnit = units.find(
    (u): u is { kind: 'job'; job: J } => u.kind === 'job' && u.job.id === jobId,
  )
  if (jobUnit) return { mode: 'job', job: jobUnit.job }

  const invUnits = units.filter(
    (u): u is { kind: 'invoice'; inv: I } => u.kind === 'invoice' && u.inv.job_id === jobId,
  )
  if (invUnits.length === 1) return { mode: 'invoice', inv: invUnits[0]!.inv }
  if (invUnits.length > 1) return { mode: 'ambiguous', count: invUnits.length }
  return { mode: 'none' }
}
