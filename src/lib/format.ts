export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Thousands-of-dollars label for aggregates (e.g. weekly bid sent totals); not per-line currency precision. */
export function formatDollarsAsThousandsK(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0'

  const fmt = (value: number): string => {
    const k = value / 1000
    const rounded = Math.round(k)
    if (rounded === 0 && value > 0) return `$${k.toFixed(1)}K`
    return `$${rounded.toLocaleString('en-US')}K`
  }

  if (n < 0) {
    return `-${fmt(-n)}`
  }
  return fmt(n)
}

export function decimalHoursToHhMm(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}:${mins.toString().padStart(2, '0')}`
}

export function formatDateWithRelativeLabel(dateStr: string): { formatted: string; isTodayOrTomorrow: boolean } {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10) || 0)
  const [y = 0, m = 1, d = 1] = parts
  const selected = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  selected.setHours(0, 0, 0, 0)
  const diffMs = selected.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  let label: string
  if (diffDays === 0) label = '(Today)'
  else if (diffDays === -1) label = '(Yesterday)'
  else if (diffDays === 1) label = '(Tomorrow)'
  else if (diffDays < -1) label = `(${Math.abs(diffDays)} days ago)`
  else label = `(in ${diffDays} days)`

  return {
    formatted: label,
    isTodayOrTomorrow: diffDays === 0 || diffDays === 1,
  }
}
