/** Bridge `<input type="datetime-local">` (browser-local interpret) with epoch ms. */

export function msToDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

export function parseDatetimeLocalToMs(value: string): number | null {
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/** Browser-local `HH:mm` for `<input type="time">` (minute precision, matches datetime-local). */
export function msToTimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getHours())}:${z(d.getMinutes())}`
}

/** YYYY-MM-DD from cluster start, same encoding as `msToDatetimeLocalValue` date half. */
export function anchorDateYmdFromClusterStart(t0: number): string {
  return msToDatetimeLocalValue(t0).slice(0, 10)
}

/** Parse `timeHm` (e.g. from `type="time"`) on anchor calendar day in local TZ. */
export function parseTimeOnAnchorDateToMs(anchorYmd: string, timeHm: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorYmd)) return null
  const t = Date.parse(`${anchorYmd}T${timeHm}`)
  return Number.isNaN(t) ? null : t
}
