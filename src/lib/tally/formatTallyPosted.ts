import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** Intl USD, e.g. -$45.56 (Job Parts Tally displays). */
export function formatTallyCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

/** Posted timestamp → { date: "Aug 8", weekday: "Saturday" } in company time; null-safe. */
export function formatTallyPostedParts(iso: string | null): { date: string; weekday: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ }),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: APP_CALENDAR_TZ }),
    }
  } catch {
    return null
  }
}
