import { APP_CALENDAR_TZ } from '../utils/dateUtils'

const MS_MINUTE = 60_000
const MS_DAY = 86_400_000

/**
 * Label for when a Stripe invoice email was last sent (collect payment step 3).
 * Uses company calendar TZ for clock/date display.
 */
export function formatCollectPaymentInvoiceEmailLastSentLabel(
  nowMs: number,
  sentAtIso: string | null | undefined,
): string | null {
  if (sentAtIso == null || String(sentAtIso).trim() === '') return null
  const sentMs = Date.parse(sentAtIso)
  if (Number.isNaN(sentMs)) return null
  const elapsed = nowMs - sentMs
  if (elapsed < MS_MINUTE) {
    return 'Less than one minute ago'
  }
  const sentDate = new Date(sentMs)
  if (elapsed < MS_DAY) {
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      hour: 'numeric',
      minute: '2-digit',
    })
    return `Last emailed at ${timeFmt.format(sentDate)}`
  }
  const dtFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Last emailed at ${dtFmt.format(sentDate)}`
}
