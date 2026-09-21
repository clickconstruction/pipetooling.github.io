import { formatUsdNoCents } from './jobFormatting'
import { workMonthLabel } from './forecastWorkMonths'

/**
 * The claim, corrected by hand (v2.3682). The notice's claim amount is the job's
 * unpaid balance; when a bill is in dispute the office takes an amount off it —
 * one figure, one reason — and the notice claims the rest. The correction is an
 * amount off, never a snapshot: the balance moves, the correction rides on top,
 * and every later paper says it is carrying it. Under the balance is the
 * office's call; over it (a negative amount off) the leader alone may send.
 */
export type LienClaimCorrection = {
  jobId: string
  /** Dollars off the app's unpaid balance. Negative: the notice claims more than the app says is owed. */
  amountOff: number
  /** 'YYYY-MM' → dollars, only for months a person gave their own figure; the rest share the total. */
  perMonth: Record<string, number> | null
  reason: string
  /** Rides to later notices and the affidavit until cleared. */
  carry: boolean
  setByName: string
  setAt: string
  lookedAt: string | null
  lookedByName: string
}

export type CorrectedClaim = {
  /** What the notice claims. */
  claim: number
  /** claim − balance: negative under the balance, positive over it, 0 when untouched. */
  delta: number
  over: boolean
  corrected: boolean
}

export function correctedClaim(openBalance: number, c: LienClaimCorrection | null | undefined): CorrectedClaim {
  const balance = Math.max(0, openBalance)
  if (!c) return { claim: balance, delta: 0, over: false, corrected: false }
  const claim = Math.max(0, balance - c.amountOff)
  return { claim, delta: claim - balance, over: claim > balance, corrected: true }
}

/** "$1,500 under the $9,800 unpaid in the app" / "$1,400 more than the app says is unpaid" / '' when equal. */
export function claimDeltaWords(delta: number, openBalance: number): string {
  if (Math.abs(delta) < 0.005) return ''
  const balance = formatUsdNoCents(Math.max(0, openBalance))
  return delta < 0 ? `${formatUsdNoCents(-delta)} under the ${balance} unpaid in the app` : `${formatUsdNoCents(delta)} more than the app says is unpaid`
}

/**
 * The per-month split the paper prints, or null when no person gave a month its own
 * figure. Typed months print what was typed; one untyped month gets the rest; with two or
 * more untyped months the split stays off the paper (the rest would be a formula).
 */
export function claimSplit(months: ReadonlyArray<string>, claim: number, perMonth: Record<string, number> | null | undefined): Array<{ month: string; amount: number }> | null {
  if (!perMonth || months.length === 0) return null
  const typed = months.filter((m) => typeof perMonth[m] === 'number')
  if (typed.length === 0) return null
  const untyped = months.filter((m) => typeof perMonth[m] !== 'number')
  if (untyped.length > 1) return null
  const typedSum = typed.reduce((s, m) => s + (perMonth[m] ?? 0), 0)
  return months.map((m) => ({ month: m, amount: typeof perMonth[m] === 'number' ? perMonth[m]! : Math.max(0, claim - typedSum) }))
}

/** "July 2026 $0.00 · August 2026 $5,900.00" — the split as the notice states it. */
export function claimSplitWords(split: ReadonlyArray<{ month: string; amount: number }> | null): string {
  if (!split) return ''
  return split.map((s) => `${workMonthLabel(s.month)} ${s.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`).join(' · ')
}

/** "Taunya · Sep 21 · “GC disputes…”" — the line under the figure and on the leader's card. */
export function correctionSetWords(c: Pick<LienClaimCorrection, 'setByName' | 'setAt' | 'reason'>, formatDay: (ymd: string) => string): string {
  return [c.setByName, c.setAt ? formatDay(c.setAt.slice(0, 10)) : '', `“${c.reason}”`].filter(Boolean).join(' · ')
}

/** A carried correction that nobody has looked at since the last notice went out — the strip asks "still true?". */
export function correctionNeedsLook(c: LienClaimCorrection | null | undefined, lastSentAt: string | null): boolean {
  if (!c || !c.carry || !lastSentAt) return false
  const seen = c.lookedAt && c.lookedAt > c.setAt ? c.lookedAt : c.setAt
  return seen < lastSentAt
}

/**
 * What a corrected claim does to the send: over the balance only the leader's own click
 * sends it (no standing rule, no spoken word); a carried correction not looked at since the
 * last notice cannot go on a standing rule. Null: nothing changes.
 */
export function correctionSendGate(c: LienClaimCorrection | null | undefined, openBalance: number, lastSentAt: string | null): 'leader' | 'look' | null {
  if (!c) return null
  if (correctedClaim(openBalance, c).over) return 'leader'
  if (correctionNeedsLook(c, lastSentAt)) return 'look'
  return null
}

/** Collections' line on a corrected job: the part of the app's balance the notice does not claim — unsecured, chased here. '' when the notice claims all of it. */
export function collectionsClaimGapWords(openBalance: number, c: LienClaimCorrection | null | undefined): string {
  const { delta, corrected } = correctedClaim(openBalance, c)
  if (!corrected || delta >= -0.005) return ''
  return `${formatUsdNoCents(-delta)} not on the lien notice (claim set by hand) — unsecured, chase it here`
}

export function correctionGateWords(gate: 'leader' | 'look' | null): string {
  if (gate === 'leader') return 'the claim is set by hand over the balance — the leader approves it knowingly'
  if (gate === 'look') return 'a carried correction has not been looked at since the last notice — say it is still true, or clear it'
  return ''
}
