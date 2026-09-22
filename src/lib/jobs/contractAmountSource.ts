/**
 * Where a job's contract amount comes from (Contract sweep refresh PR 3, v2.3707). The owner:
 * "if this number is set by the line items, perhaps we should not make it easy to change as a
 * whole number and the user should have to go in and adjust line items." So the agreement's
 * amount is the job's amount — the estimate the customer accepted when there is one, else the
 * job's line-item total — read out with its source and one door, never typed. There is no
 * override. A draft that carries a different number (typed before this) is named, kept out of
 * the send, and put right with one press — never rewritten in silence. Pure.
 */

export type ContractAmountSource =
  | { source: 'estimate'; cents: number; acceptedOn: string | null }
  | { source: 'line_items'; cents: number; lineCount: number }
  | { source: 'none'; cents: null }

export type JobForContractAmount = {
  revenue: number | null
  fixtures?: ReadonlyArray<{ name: string | null }>
}

/** The same preference order `buildJobContractPrefill` has always used: the accepted estimate's total, else the job's revenue (its line items plus rider fees). */
export function contractAmountSource(input: { job: JobForContractAmount; acceptedTotalCents: number | null; acceptedOn?: string | null }): ContractAmountSource {
  if (input.acceptedTotalCents != null && Number.isFinite(input.acceptedTotalCents) && input.acceptedTotalCents > 0) {
    return { source: 'estimate', cents: Math.round(input.acceptedTotalCents), acceptedOn: input.acceptedOn ?? null }
  }
  const revenue = Number(input.job.revenue)
  if (input.job.revenue != null && Number.isFinite(revenue) && revenue > 0) {
    return { source: 'line_items', cents: Math.round(revenue * 100), lineCount: (input.job.fixtures ?? []).filter((f) => (f.name ?? '').trim()).length }
  }
  return { source: 'none', cents: null }
}

/** The words beside the number. */
export function contractAmountSourceLabel(src: ContractAmountSource, formatDate: (iso: string) => string): string {
  switch (src.source) {
    case 'estimate':
      return src.acceptedOn ? `from the estimate the customer accepted ${formatDate(src.acceptedOn)}` : 'from the estimate the customer accepted'
    case 'line_items':
      return src.lineCount > 0 ? `from the job's ${src.lineCount} line item${src.lineCount === 1 ? '' : 's'}` : "from the job's amount"
    default:
      return 'the agreement says time and materials, billed at completion'
  }
}

/** The one door beside the number — it opens the job, where the number is set. */
export function contractAmountDoorLabel(src: ContractAmountSource): string {
  switch (src.source) {
    case 'estimate':
      return 'Open the job ›'
    case 'line_items':
      return 'Adjust line items ›'
    default:
      return 'Add line items ›'
  }
}

/**
 * A draft that does not carry the job's number: what it says instead (null = the draft says time
 * and materials), or null when the draft agrees. `draftCents` undefined = the job has no draft.
 */
export function contractAmountDrift(src: ContractAmountSource, draftCents: number | null | undefined): { draftCents: number | null } | null {
  if (draftCents === undefined) return null
  return (draftCents ?? null) === (src.cents ?? null) ? null : { draftCents: draftCents ?? null }
}
