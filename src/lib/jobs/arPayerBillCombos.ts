/**
 * Combination suggestions for the AR bank-payments modal (one check, several
 * bills): among the matched payer's open billed lines, find the sets of 2–4
 * whose remainders sum cents-exactly to the deposit's remaining.
 *
 * Bounded and conservative: at most `maxTargets` bills are considered (the
 * payer section is already capped well below that), combo size is capped at
 * `maxSize`, and enumeration stops early once more than `maxCombos` exact
 * sums exist — the modal only suggests when exactly ONE combo exists, so
 * finding a second is already the answer. Suggestion-only: tapping the chip
 * fills allocation lines for the assistant to review; Apply is unchanged.
 */

export type ComboTargetSlice = { key: string; remaining: number }

const toCents = (v: number): number => Math.round((Number(v) || 0) * 100)

export type PayerBillCombosOptions = {
  /** Max bills per combo (default 4; singles are the existing match chips' job). */
  maxSize?: number
  /** Max bills considered at all — more than this returns [] (default 12). */
  maxTargets?: number
  /** Stop enumerating past this many exact combos (default 3). */
  maxCombos?: number
}

/**
 * All exact-sum combos of 2..maxSize target keys, in the order targets were
 * given (fewest bills first among results). Returns [] when the deposit
 * amount is not positive, when any single bill already equals it (that case
 * belongs to the match chips), or when the target list is too large to
 * enumerate confidently.
 */
export function findExactBillCombos(
  depositRemaining: number,
  targets: ComboTargetSlice[],
  options: PayerBillCombosOptions = {},
): string[][] {
  const maxSize = options.maxSize ?? 4
  const maxTargets = options.maxTargets ?? 12
  const maxCombos = options.maxCombos ?? 3

  const goal = toCents(depositRemaining)
  if (goal <= 0) return []
  const pool = targets
    .map((t) => ({ key: t.key, cents: toCents(t.remaining) }))
    .filter((t) => t.cents > 0)
  if (pool.length < 2 || pool.length > maxTargets) return []
  if (pool.some((t) => t.cents === goal)) return []

  const results: string[][] = []
  const pick: number[] = []

  const walk = (start: number, sum: number): boolean => {
    if (sum === goal && pick.length >= 2) {
      results.push(pick.map((i) => pool[i]!.key))
      return results.length > maxCombos
    }
    if (sum >= goal || pick.length >= maxSize) return false
    for (let i = start; i < pool.length; i++) {
      pick.push(i)
      const stop = walk(i + 1, sum + pool[i]!.cents)
      pick.pop()
      if (stop) return true
    }
    return false
  }
  walk(0, 0)

  if (results.length > maxCombos) return []
  return results.sort((a, b) => a.length - b.length)
}
