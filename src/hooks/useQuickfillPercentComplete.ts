import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { progressPaymentForJob } from '../lib/jobs/progressPaymentForJob'
import { composePctAutoNoteBody } from '../lib/jobs/stagesPctNote'
import {
  PERCENT_COMPLETE_SNOOZE_KIND,
  isOpenJobStatus,
  percentCompleteList,
  percentCompleteNoteBody,
  type PercentCompleteCard,
  type PercentCompleteJobInput,
  type PercentCompleteList,
} from '../lib/quickfill/percentComplete'
import { fetchQuickfillSnoozes, saveJobPercentFromQuickfill, snoozeQuickfillItem, unsnoozeQuickfillItem } from '../lib/quickfill/percentCompleteWrite'

/**
 * Quickfill → Percent complete (v2.5764): the open jobs from the jobs cache (the list
 * Property kinds and Missing job info read), each run through the Pipeline row's own
 * models (`progressPaymentForJob`), folded into cards by the kernel, the office's live
 * dismissals held back. Office roles only, the same roles the Pipeline's % done box lets
 * set. The cards wait for the cache's enrichment (fixtures land a moment after the rows),
 * so a stage job never reads as a plain one first.
 *
 * A save writes the Pipeline box's path and lays the new percent over the cache row, so
 * the card leaves at once; a dismissal lands in `quickfill_item_snoozes` and is remembered
 * here the same way. Both can be taken back from the line the card leaves behind. `enabled`
 * (punch list #183 PR 4): false holds every read while the station is off screen on the Roller;
 * `fetchEnabled` still says whether the role sees the station.
 */
export function useQuickfillPercentComplete(enabled = true): {
  list: PercentCompleteList
  loading: boolean
  fetchEnabled: boolean
  /** False before the snoozes table exists: Dismiss says so instead of failing quietly. */
  snoozeAvailable: boolean
  save: (card: PercentCompleteCard, pct: number) => Promise<void>
  /** Put the percent back as it was before the save. */
  undoSave: (card: PercentCompleteCard) => Promise<void>
  /** Resolves the `until` written. */
  dismiss: (card: PercentCompleteCard) => Promise<string>
  undoDismiss: (card: PercentCompleteCard) => Promise<void>
} {
  const { user: authUser, role } = useAuth()
  const { jobs, jobsListLoading, jobsListEnriching, runFetchJobs } = useJobsListCache()
  const fetchEnabled = Boolean(authUser?.id && (role === 'dev' || role === 'master_technician' || isAssistantLike(role)))
  const active = fetchEnabled && enabled

  useEffect(() => {
    if (!active) return
    void runFetchJobs(null)
  }, [active, runFetchJobs])

  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  const [snoozes, setSnoozes] = useState<{ byKey: Map<string, string>; available: boolean } | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void fetchQuickfillSnoozes(PERCENT_COMPLETE_SNOOZE_KIND, nowIso).then((s) => {
      if (!cancelled) setSnoozes(s)
    })
    return () => {
      cancelled = true
    }
    // One read per mount: dismissals made here are remembered below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // The percents set here this visit, laid over the cache rows until the next fetch.
  const [pctOverlay, setPctOverlay] = useState<Map<string, number | null>>(() => new Map())

  const inputs = useMemo<PercentCompleteJobInput[]>(() => {
    if (!active) return []
    const out: PercentCompleteJobInput[] = []
    for (const j of jobs) {
      if (!isOpenJobStatus(j.status)) continue
      const pct = pctOverlay.has(j.id) ? (pctOverlay.get(j.id) ?? null) : (j.pct_complete ?? null)
      const { model, view } = progressPaymentForJob({ ...j, pct_complete: pct }, null)
      let newestPaidOn: string | null = null
      for (const p of j.payments ?? []) if (p.paid_on && (!newestPaidOn || p.paid_on > newestPaidOn)) newestPaidOn = p.paid_on
      out.push({ id: j.id, jobNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) ?? '', jobName: j.job_name ?? null, status: j.status, pct, money: model, view, newestPaidOn })
    }
    return out
  }, [active, jobs, pctOverlay])

  const list = useMemo(() => percentCompleteList(inputs, snoozes?.byKey ?? new Map(), nowIso), [inputs, snoozes, nowIso])

  const save = useCallback(
    async (card: PercentCompleteCard, pct: number) => {
      await saveJobPercentFromQuickfill({ jobId: card.jobId, pct, noteBody: percentCompleteNoteBody(pct, card), authUserId: authUser?.id ?? null })
      setPctOverlay((prev) => new Map(prev).set(card.jobId, pct))
    },
    [authUser?.id],
  )

  const undoSave = useCallback(
    async (card: PercentCompleteCard) => {
      const overlaid = pctOverlay.get(card.jobId) ?? null
      await saveJobPercentFromQuickfill({ jobId: card.jobId, pct: card.pct, noteBody: `${composePctAutoNoteBody(card.pct, overlaid)} Undone in Quickfill.`, authUserId: authUser?.id ?? null })
      setPctOverlay((prev) => new Map(prev).set(card.jobId, card.pct))
    },
    [authUser?.id, pctOverlay],
  )

  const dismiss = useCallback(
    async (card: PercentCompleteCard) => {
      const now = new Date().toISOString()
      const until = await snoozeQuickfillItem({ itemKey: card.itemKey, byUserId: authUser?.id ?? null, nowIso: now })
      setNowIso(now)
      setSnoozes((prev) => ({ byKey: new Map(prev?.byKey ?? []).set(card.itemKey, until), available: true }))
      return until
    },
    [authUser?.id],
  )

  const undoDismiss = useCallback(async (card: PercentCompleteCard) => {
    await unsnoozeQuickfillItem({ itemKey: card.itemKey })
    setSnoozes((prev) => {
      const byKey = new Map(prev?.byKey ?? [])
      byKey.delete(card.itemKey)
      return { byKey, available: prev?.available ?? true }
    })
  }, [])

  return {
    list,
    loading: active && (jobsListLoading || jobsListEnriching || snoozes == null),
    fetchEnabled,
    snoozeAvailable: snoozes?.available ?? true,
    save,
    undoSave,
    dismiss,
    undoDismiss,
  }
}
