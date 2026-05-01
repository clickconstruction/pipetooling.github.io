import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export type JobThreadStampKind = 'arrived' | 'leaving'

const PHRASE: Record<JobThreadStampKind, string> = {
  arrived: 'Arrived at job',
  leaving: 'Leaving job',
}

const stampDateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function buildJobThreadStampBody(
  displayName: string | null | undefined,
  kind: JobThreadStampKind,
  at: Date,
): string {
  const name = displayName?.trim() ? displayName.trim() : 'Someone'
  const when = stampDateTimeFmt.format(at)
  return `${name} · ${when} — ${PHRASE[kind]}`
}
