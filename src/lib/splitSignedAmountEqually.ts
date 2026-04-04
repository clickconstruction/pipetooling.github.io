/**
 * Split a signed dollar total across `count` lines in whole cents so the sum
 * equals `total` (matches replace_mercury_job_splits_for_my_linked_card checks).
 */
export function splitSignedAmountEqually(total: number, count: number): number[] {
  if (count < 1) {
    throw new Error('splitSignedAmountEqually: count must be at least 1')
  }
  if (!Number.isFinite(total)) {
    throw new Error('splitSignedAmountEqually: total must be finite')
  }
  const sign = total === 0 ? 1 : Math.sign(total)
  const absTotal = Math.abs(total)
  const centsTotal = Math.round(absTotal * 100)
  const base = Math.floor(centsTotal / count)
  const extra = centsTotal % count
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const c = base + (i < extra ? 1 : 0)
    out.push((sign * c) / 100)
  }
  return out
}
