import { ymdDaysBetween } from '../../utils/dateUtils'

/**
 * Licenses by where they stand against today (v2.6424; the People → Paperwork spike, v2.6392 →
 * Left): the Licenses tab's strip kept today ≤ expiry ≤ today + 30 and nothing else, so a license
 * already past its expiry showed nowhere, and the tab said nothing expires while most of the
 * licenses on file had lapsed. Pure: the rows in, three lists out — the expired ones with the days
 * since, the most recently lapsed first; the ones expiring inside the window with the days left,
 * the soonest first; the rest. The tab draws Expired first, then the thirty-day strip.
 */
export const LICENSE_EXPIRING_WINDOW_DAYS = 30

export type LicenseExpiryRow = { date_of_expiry: string }

export type ExpiredLicense<T> = T & { daysSince: number }
export type ExpiringLicense<T> = T & { daysLeft: number }

export type LicenseExpiryBuckets<T> = {
  /** Past their expiry: the most recently lapsed first, the rows' own order between equals. */
  expired: Array<ExpiredLicense<T>>
  /** Today through today + the window: the soonest first. Today reads 0 days left. */
  expiringSoon: Array<ExpiringLicense<T>>
  /** Beyond the window, and a row whose date the kernel cannot read. */
  current: T[]
}

export function licenseExpiryBuckets<T extends LicenseExpiryRow>(
  licenses: readonly T[],
  todayYmd: string,
  windowDays: number = LICENSE_EXPIRING_WINDOW_DAYS,
): LicenseExpiryBuckets<T> {
  const expired: Array<ExpiredLicense<T>> = []
  const expiringSoon: Array<ExpiringLicense<T>> = []
  const current: T[] = []
  for (const license of licenses) {
    const days = ymdDaysBetween(todayYmd, license.date_of_expiry)
    if (days == null) {
      current.push(license)
    } else if (days < 0) {
      expired.push({ ...license, daysSince: -days })
    } else if (days <= windowDays) {
      expiringSoon.push({ ...license, daysLeft: days })
    } else {
      current.push(license)
    }
  }
  expired.sort((a, b) => a.daysSince - b.daysSince)
  expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft)
  return { expired, expiringSoon, current }
}

/** The Expired section's heading carries the count, so a phone reads it without scrolling the rows. */
export function expiredLicensesHeading(count: number): string {
  if (count <= 0) return 'Expired licenses'
  return count === 1 ? '1 expired license' : `${count} expired licenses`
}

/** The Days ago cell: *1 day ago*, *412 days ago*. */
export function lapsedWords(daysSince: number): string {
  return daysSince === 1 ? '1 day ago' : `${daysSince} days ago`
}
