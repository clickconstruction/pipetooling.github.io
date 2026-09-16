/**
 * Accounts Receivable — the "this is a tip" offer (v2.3496).
 *
 * A customer who pays more than their bills leaves a remainder on the deposit, and neither
 * existing allocation choice will take it: both want a bill, and there is no bill for a tip.
 * When money is left over on a deposit that HAS been matched, this decides whether to offer
 * recording the difference as a `Tip` line on the job that earned it.
 *
 * The rule deliberately stays narrow. A deposit nobody has touched is unmatched, not a tip —
 * offering there would invite the office to bury real unmatched money on a job. The offer only
 * appears once at least one bill on the deposit has been settled.
 *
 * Pure: no Supabase, no React. The write lives in `record_job_tip_from_deposit`.
 */

/** Matches the list RPC's remainder rule and the modal's own `AR_BANK_REMAINING_EPS`. */
export const AR_TIP_OFFER_EPS = 0.0005

/** One already-applied allocation on the deposit (a row of `list_ar_allocations_for_mercury_transaction`). */
export type ArTipAllocation = {
  job_id: string | null
  job_name: string | null
  hcp_number: string | null
  amount: number | null
}

export type ArTipOfferInput = {
  /** `remaining_available` from the deposit row: the deposit total less what is applied. */
  remaining: number | null | undefined
  /** What the deposit has already paid. Empty means nobody has matched it yet. */
  allocations: ReadonlyArray<ArTipAllocation>
  /** Deposits flagged as bounced are never a tip. */
  returned?: boolean
}

export type ArTipJobChoice = { jobId: string; label: string }

export type ArTipOffer = {
  /** Always the whole remainder — a tip is by definition the difference. */
  amount: number
  /** The one job every applied row shares, or null when the office must choose. */
  jobId: string | null
  /** "960 · Elaine Giesber-Installations Pcv & Lavatory Sink", or null when there is no single job. */
  jobLabel: string | null
  /**
   * The jobs this deposit actually paid, first-seen order. The tip belongs to one of them, so
   * the office picks from a closed list rather than searching every job in the app.
   */
  jobChoices: ReadonlyArray<ArTipJobChoice>
  /** "$50.00 more than the bills." */
  headline: string
  /** The line under the headline. */
  sentence: string
  /** The primary button's words. */
  buttonLabel: string
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The modal's own convention for naming a job in the applied breakdown. */
export function arTipJobLabel(row: ArTipAllocation): string {
  const hcp = (row.hcp_number ?? '').trim() || '—'
  const name = (row.job_name ?? '').trim() || '—'
  return `${hcp} · ${name}`
}

/**
 * The single job every applied row shares, or null when the rows disagree (or there are none).
 */
export function soleJobOfAllocations(
  allocations: ReadonlyArray<ArTipAllocation>,
): { jobId: string; label: string } | null {
  let found: { jobId: string; label: string } | null = null
  for (const row of allocations) {
    const id = (row.job_id ?? '').trim()
    if (!id) return null
    if (found === null) found = { jobId: id, label: arTipJobLabel(row) }
    else if (found.jobId !== id) return null
  }
  return found
}

/**
 * Returns the offer to show, or null when this deposit is not a tip case.
 */
export function buildArTipOffer(input: ArTipOfferInput): ArTipOffer | null {
  if (input.returned === true) return null

  const remaining = Number(input.remaining ?? 0)
  if (!Number.isFinite(remaining) || remaining <= AR_TIP_OFFER_EPS) return null

  // Nothing applied yet: this deposit is unmatched, not overpaid.
  if (input.allocations.length === 0) return null

  const amount = Math.round(remaining * 100) / 100
  if (amount <= 0) return null

  const jobChoices = jobChoicesFromAllocations(input.allocations)
  if (jobChoices.length === 0) return null

  const sole = jobChoices.length === 1 ? jobChoices[0]! : null
  return {
    amount,
    jobId: sole?.jobId ?? null,
    jobLabel: sole?.label ?? null,
    jobChoices,
    headline: `${money(amount)} more than the bills.`,
    sentence: sole
      ? `They paid over. Record it as a tip on ${sole.label}.`
      : 'They paid over. This deposit covers more than one job — pick the one that earned it.',
    buttonLabel: `Add a ${money(amount)} Tip line`,
  }
}

/** The distinct jobs this deposit paid, in the order they first appear. */
export function jobChoicesFromAllocations(
  allocations: ReadonlyArray<ArTipAllocation>,
): ArTipJobChoice[] {
  const seen = new Map<string, ArTipJobChoice>()
  for (const row of allocations) {
    const jobId = (row.job_id ?? '').trim()
    if (!jobId || seen.has(jobId)) continue
    seen.set(jobId, { jobId, label: arTipJobLabel(row) })
  }
  return [...seen.values()]
}
