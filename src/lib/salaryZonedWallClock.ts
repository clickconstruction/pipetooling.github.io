/** Parse Postgres `time` or `HH:mm` / `HH:mm:ss` into clock components. */
export function salaryPgTimeToHms(t: string): { h: number; m: number; s: number } {
  const p = t.split(':').map((x) => Number(x))
  return { h: p[0] ?? 0, m: p[1] ?? 0, s: p[2] ?? 0 }
}

/** Wall clock in `timeZone` on civil `workDateYmd` → UTC ms (matches Postgres `timestamp AT TIME ZONE`). */
export function salaryZonedWallClockToUtcMs(
  workDateYmd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDateYmd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const matches = (ms: number): boolean => {
    const parts = formatter.formatToParts(new Date(ms))
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN)
    const yy = get('year')
    const mm = get('month')
    const dd = get('day')
    const hh = get('hour')
    const min = get('minute')
    const ss = get('second')
    return yy === y && mm === mo && dd === d && hh === hour && min === minute && ss === second
  }

  const anchor = Date.UTC(y, mo - 1, d, 0, 0, 0)
  // Scan must cover every real UTC offset (-12h..+14h) for any wall time in the day:
  // the previous -420..1500 window could not represent e.g. 20:01+ in America/Chicago
  // (CDT 21:00 = UTC midnight + 26h), silently returning null for late-evening segments.
  for (let deltaMin = -840; deltaMin <= 2160; deltaMin++) {
    const ms = anchor + deltaMin * 60 * 1000
    if (matches(ms)) return ms
  }
  return null
}
