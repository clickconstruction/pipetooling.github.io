/** Format seconds as h:mm for activity totals. */
export function formatActiveSeconds(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}
