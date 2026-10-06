/**
 * GC mode, the real build, PR 1b: the budgets against the size, moved word for word from the GC
 * mode prototype (branch spike/gc-mode, `gcNewProject.ts`; the owner, 2026-10-04: "show the amount
 * of square feet added at the prior page and then the cost per square foot, broken down by trade,
 * and the total"). The rough rates and the budget from a size are in `plans.ts`.
 */

/** An amount per square foot, to the cent: 12.3529 reads "$12.35/sq ft". */
export function perSqFtWords(perSqFt: number): string {
  return `$${perSqFt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sq ft`
}

/** One trade's budget and what it comes to a square foot (null: no size given). */
export interface BudgetLine {
  trade: string
  amount: number
  ours: boolean
  perSqFt: number | null
}

/** Each ticked trade's budget over the project's size, and the total. No size: amounts only. */
export function budgetBySize(
  lines: { trade: string; amount: number; ours: boolean }[],
  sqFt: number | null,
): { lines: BudgetLine[]; total: number; totalPerSqFt: number | null } {
  const per = (amount: number) => (sqFt && sqFt > 0 ? amount / sqFt : null)
  const total = lines.reduce((n, l) => n + l.amount, 0)
  return { lines: lines.map((l) => ({ ...l, perSqFt: per(l.amount) })), total, totalPerSqFt: per(total) }
}
