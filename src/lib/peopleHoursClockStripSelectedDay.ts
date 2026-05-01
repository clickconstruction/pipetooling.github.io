/** Pure Gregorian YYYY-MM-DD ± n days (civil dates). */
export function shiftWorkDateYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const base = new Date(Date.UTC(y, mo, d))
  base.setUTCDate(base.getUTCDate() + deltaDays)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Sunday–Saturday week (en-CA YYYY-MM-DD) containing the given civil date,
 * matching `weekStartEndEnCA` in useDashboardMyTeamSectionState.
 */
export function enCaWeekRangeContainingYmd(ymd: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    const end = new Date(d)
    end.setDate(d.getDate() - day + 6)
    return { start: start.toLocaleDateString('en-CA'), end: end.toLocaleDateString('en-CA') }
  }
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const base = new Date(y, mo, d)
  const day = base.getDay()
  const start = new Date(base)
  start.setDate(base.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: start.toLocaleDateString('en-CA'), end: end.toLocaleDateString('en-CA') }
}
