// What moved to main (the real build) is re-exported from there, so there is one copy.
export { shortDate, weekdayDate } from '../gc/words'

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}
/** An amount in whole thousands, for a glance: 178400 reads "178", 1027746 reads "1,028". The K is drawn beside it. */
export function thousands(n: number): string {
  return Math.round(n / 1000).toLocaleString('en-US')
}
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}
export function daysUntil(iso: string, today: string): number {
  return Math.round(utcDay(iso) - utcDay(today))
}
