/**
 * Tiered glance-figure money format for dashboard cards:
 * - ≥ $100k → "$151k"   (whole thousands)
 * - ≥ $10k  → "$51.6k"  (one decimal)
 * - < $10k  → "$9,820"  (whole dollars)
 * Thousands truncate (floor) rather than round so glance figures never overstate.
 */
export function formatMoneyShortK(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100_000) return `${sign}$${Math.floor(abs / 1000).toLocaleString('en-US')}k`
  if (abs >= 10_000) return `${sign}$${(Math.floor(abs / 100) / 10).toFixed(1)}k`
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
}
