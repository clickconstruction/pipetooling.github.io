/** Local-calendar YYYY-MM-DD: `days` after `base` (default today). */
export function addCalendarDaysYmd(days: number, base: Date = new Date()): string {
  const y = base.getFullYear()
  const m = base.getMonth()
  const d = base.getDate()
  const dt = new Date(y, m, d + days)
  if (!Number.isFinite(dt.getTime())) return ''
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const PRESET_OFFSETS = [7, 15, 30] as const

export type ValidUntilPresetDays = (typeof PRESET_OFFSETS)[number]

/** If `validUntilYmd` equals today+7/+15/+30 (local), return that offset; else null. */
export function presetMatchingTodayOffset(
  validUntilYmd: string,
  base: Date = new Date(),
): ValidUntilPresetDays | null {
  const t = validUntilYmd.trim()
  if (!t) return null
  for (const n of PRESET_OFFSETS) {
    if (t === addCalendarDaysYmd(n, base)) return n
  }
  return null
}
