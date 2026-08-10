import { splitSignedAmountEqually } from '../splitSignedAmountEqually'

/**
 * Pure split math for Tally Sort mode (mobile: sort purchases to the day's
 * jobs). Amounts are SIGNED dollars, matching what
 * `replace_mercury_job_splits_for_my_linked_card` stores (purchases are
 * negative); the UI shows absolute values and re-applies the sign on input.
 */

export type SortModeSplitLine = { jobId: string; amount: number }

/** Even split of the signed total across the given jobs (whole cents, sums exactly). */
export function buildEvenSortModeSplit(total: number, jobIds: string[]): SortModeSplitLine[] {
  if (jobIds.length === 0) return []
  const amounts = splitSignedAmountEqually(total, jobIds.length)
  return jobIds.map((jobId, i) => ({ jobId, amount: amounts[i] ?? 0 }))
}

const roundCents = (n: number) => Math.round(n * 100) / 100

/**
 * Set one line's signed amount and auto-balance so the lines still sum to the
 * signed total. The balancer is the LAST line other than the edited one; every
 * amount is clamped between 0 and the total (sign-aware), so no line can flip
 * sign or exceed the purchase.
 */
export function setSortModeSplitAmount(
  lines: SortModeSplitLine[],
  jobId: string,
  amount: number,
  total: number,
): SortModeSplitLine[] {
  const idx = lines.findIndex((l) => l.jobId === jobId)
  if (idx < 0) return lines
  const sign = total === 0 ? 1 : Math.sign(total)
  const absTotal = Math.abs(total)
  const clamp = (n: number) => {
    const v = Math.min(absTotal, Math.max(0, Math.abs(roundCents(n))))
    return v === 0 ? 0 : sign * v
  }
  const next = lines.map((l) => ({ ...l }))
  next[idx]!.amount = clamp(sign * Math.abs(amount))
  const balancerIdx = (() => {
    for (let i = next.length - 1; i >= 0; i--) if (i !== idx) return i
    return -1
  })()
  if (balancerIdx >= 0) {
    const othersSum = next.reduce((s, l, i) => (i === balancerIdx ? s : s + l.amount), 0)
    next[balancerIdx]!.amount = clamp(total - othersSum)
  }
  return next
}

/** Signed difference `total − sum(lines)`, rounded to cents; 0 means the split is saveable. */
export function sortModeSplitRemainder(lines: SortModeSplitLine[], total: number): number {
  const sum = lines.reduce((s, l) => s + l.amount, 0)
  return roundCents(total - sum)
}
