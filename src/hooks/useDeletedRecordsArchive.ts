import { useCallback, useEffect, useState } from 'react'
import {
  listDeletedRecords,
  restoreDeletedRecords,
  type DeletedRecordBundle,
  type RestoreDeletedRecordsResult,
} from '../lib/deletedRecordsArchive'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * Dev-only "Recently deleted" state: load restorable bundles, preview a restore, commit it.
 *
 * Preview gates the commit (same interlock as the merge-users dialog): `preview` must exist for the
 * group before Restore is offered, and it is cleared whenever the list reloads, so a stale preview
 * can never authorize a commit.
 */
export function useDeletedRecordsArchive({ enabled }: { enabled: boolean }) {
  const [bundles, setBundles] = useState<DeletedRecordBundle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Preview for a single group at a time — keyed so a preview can't be applied to another bundle. */
  const [preview, setPreview] = useState<{ groupKey: string; result: RestoreDeletedRecordsResult } | null>(null)
  /** Which row is working, and which action — so Re-preview doesn't make the Restore button say "Restoring…". */
  const [busy, setBusy] = useState<{ groupKey: string; action: 'preview' | 'restore' } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBundles(await listDeletedRecords(50))
      setPreview(null)
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  /** Dry run: reports what would be inserted, plus warnings/blockers. Commits nothing. */
  const runPreview = useCallback(async (groupKey: string) => {
    setSubmitting(true)
    setBusy({ groupKey, action: 'preview' })
    setError(null)
    try {
      setPreview({ groupKey, result: await restoreDeletedRecords(groupKey, true) })
    } catch (e) {
      setError(formatErrorMessage(e))
      setPreview(null)
    } finally {
      setSubmitting(false)
      setBusy(null)
    }
  }, [])

  /** Commit. Returns the envelope so the caller can toast/report; reloads on success. */
  const runRestore = useCallback(
    async (groupKey: string): Promise<RestoreDeletedRecordsResult | null> => {
      setSubmitting(true)
      setBusy({ groupKey, action: 'restore' })
      setError(null)
      try {
        const result = await restoreDeletedRecords(groupKey, false)
        if (!result.ok) {
          setError(result.error || 'Restore failed.')
          return result
        }
        await load()
        return result
      } catch (e) {
        setError(formatErrorMessage(e))
        return null
      } finally {
        setSubmitting(false)
        setBusy(null)
      }
    },
    [load],
  )

  return {
    bundles,
    loading,
    error,
    preview,
    clearPreview: () => setPreview(null),
    busy,
    submitting,
    load,
    runPreview,
    runRestore,
  }
}
