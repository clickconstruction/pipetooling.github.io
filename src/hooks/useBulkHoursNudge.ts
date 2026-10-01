import { useEffect, useState } from 'react'
import { useBulkHoursAlerts } from './useBulkHoursAlerts'
import type { BulkHoursAlert } from '../lib/clock/bulkHoursAlert'
import {
  loadBulkHoursAlertDismissState,
  saveBulkHoursAlertDismissState,
  shouldShowBulkHoursAlert,
  type BulkHoursAlertDismissState,
} from '../lib/bulkHoursAlertDismiss'

const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * "Hours added in bulk" for the Needs You card (v2.4281): wraps useBulkHoursAlerts with the
 * per-user snooze / dismiss state, exactly as useBulkDeleteNudge does for deletions — a burst
 * never drains to zero on its own, so the card needs a way to be quiet until new ones arrive.
 */
export function useBulkHoursNudge(userId: string | undefined): {
  /** The bursts to show, or null when hidden (not an approver, loading, snoozed, dismissed, or empty). */
  visibleAlerts: BulkHoursAlert[] | null
  snooze24h: () => void
  dismissUntilCountIncreases: () => void
} {
  const { alerts, loading } = useBulkHoursAlerts(!!userId)
  const [dismissState, setDismissState] = useState<BulkHoursAlertDismissState>({})

  useEffect(() => {
    if (!userId) {
      setDismissState({})
      return
    }
    setDismissState(loadBulkHoursAlertDismissState(userId))
  }, [userId])

  const persist = (next: BulkHoursAlertDismissState) => {
    if (!userId) return
    saveBulkHoursAlertDismissState(userId, next)
    setDismissState(next)
  }

  const visible = Boolean(userId) && !loading && shouldShowBulkHoursAlert(alerts.length, dismissState)

  return {
    visibleAlerts: visible ? alerts : null,
    snooze24h: () => persist({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS }),
    dismissUntilCountIncreases: () => persist({ ...dismissState, dismissedCount: alerts.length }),
  }
}
