import { useEffect, useState } from 'react'
import { useBulkDeleteAlerts, type BulkDeleteAlert } from './useBulkDeleteAlerts'
import {
  loadBulkDeleteAlertDismissState,
  saveBulkDeleteAlertDismissState,
  shouldShowBulkDeleteAlert,
  type BulkDeleteAlertDismissState,
} from '../lib/bulkDeleteAlertDismiss'

const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * Bulk-deletion alert for the Needs You card (v2.2491): wraps
 * useBulkDeleteAlerts with the per-user snooze/dismiss state the banner
 * owned, so both surfaces share visibility AND the dismiss actions. Unlike
 * the work-queue items a deletion never drains to zero on its own, so the
 * dismissal semantics survive the move into the card.
 */
export function useBulkDeleteNudge(userId: string | undefined): {
  /** The bursts to show, or null when hidden (non-dev, loading, snoozed, dismissed, or empty). */
  visibleAlerts: BulkDeleteAlert[] | null
  snooze24h: () => void
  dismissUntilCountIncreases: () => void
} {
  const { alerts, loading } = useBulkDeleteAlerts(!!userId)
  const [dismissState, setDismissState] = useState<BulkDeleteAlertDismissState>({})

  useEffect(() => {
    if (!userId) {
      setDismissState({})
      return
    }
    setDismissState(loadBulkDeleteAlertDismissState(userId))
  }, [userId])

  const persist = (next: BulkDeleteAlertDismissState) => {
    if (!userId) return
    saveBulkDeleteAlertDismissState(userId, next)
    setDismissState(next)
  }

  const visible = Boolean(userId) && !loading && shouldShowBulkDeleteAlert(alerts.length, dismissState)

  return {
    visibleAlerts: visible ? alerts : null,
    snooze24h: () => persist({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS }),
    dismissUntilCountIncreases: () => persist({ ...dismissState, dismissedCount: alerts.length }),
  }
}
