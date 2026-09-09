/**
 * "% of total" for the Job Summary expanded row's cost-by-person table
 * (v2.3181): a row's Total as a share of the table's Total row. Whole
 * percentages; a real but tiny share reads "<1%" rather than "0%"; no total
 * (loading, or a job with no cost yet) → null, which the cell shows as "—".
 */
export function shareOfTotalLabel(rowTotal: number | null | undefined, grandTotal: number | null | undefined): string | null {
  if (rowTotal == null || grandTotal == null) return null
  if (!Number.isFinite(rowTotal) || !Number.isFinite(grandTotal) || grandTotal <= 0) return null
  if (rowTotal <= 0) return null
  const pct = (rowTotal / grandTotal) * 100
  if (pct < 0.5) return '<1%'
  return `${Math.round(pct)}%`
}
