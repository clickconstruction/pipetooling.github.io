// Pure job-split math for Mercury transaction allocations. Extracted verbatim from
// MercuryTransactionAllocationsModal so the TransactionDetail editor can reuse the exact
// dollar/percent + equal-redistribution logic without duplicating it. No React here.

export type SplitMode = 'dollars' | 'percent'

export type SplitLine = {
  jobId: string
  jobLabel: string
  mode: SplitMode
  valueStr: string
  note: string
}

export const sumEpsilon = 0.0001

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Dollars a line represents against `displayTotal`; null when the input is blank/invalid. */
export function lineDisplayDollars(ln: SplitLine, displayTotal: number): number | null {
  const raw = ln.valueStr.trim()
  if (raw === '') return null
  const v = Number(raw)
  if (!Number.isFinite(v) || v < 0) return null
  if (ln.mode === 'dollars') return round2(v)
  if (displayTotal <= 0) return null
  return round2((displayTotal * v) / 100)
}

/** Equal % shares on add/remove; last line may switch to dollars to close cent drift vs displayTotal. */
export function redistributeEqualSplit(lines: SplitLine[], displayTotal: number): SplitLine[] {
  if (lines.length === 0) return []
  if (displayTotal <= 0) return lines

  const n = lines.length
  const base = (ln: SplitLine) => ({
    jobId: ln.jobId,
    jobLabel: ln.jobLabel,
    note: ln.note,
  })

  let next: SplitLine[]
  if (n === 1) {
    const only = lines[0]
    if (!only) return []
    next = [{ ...base(only), mode: 'percent', valueStr: '100' }]
  } else {
    const pct = round2(100 / n)
    const pctLast = round2(100 - (n - 1) * pct)
    next = lines.map((ln, i) => ({
      ...base(ln),
      mode: 'percent' as SplitMode,
      valueStr: i < n - 1 ? String(pct) : String(pctLast),
    }))
  }

  let sum = 0
  for (const ln of next) {
    const d = lineDisplayDollars(ln, displayTotal)
    if (d === null) return lines
    sum += d
  }
  sum = round2(sum)
  if (Math.abs(displayTotal - sum) <= sumEpsilon) return next

  const lastIdx = next.length - 1
  let sumFirst = 0
  for (let i = 0; i < lastIdx; i++) {
    const row = next[i]
    if (!row) return lines
    const d = lineDisplayDollars(row, displayTotal)
    if (d === null) return lines
    sumFirst += d
  }
  sumFirst = round2(sumFirst)
  const rem = round2(displayTotal - sumFirst)
  return next.map((ln, i) =>
    i === lastIdx ? { ...ln, mode: 'dollars', valueStr: String(rem) } : ln,
  )
}
