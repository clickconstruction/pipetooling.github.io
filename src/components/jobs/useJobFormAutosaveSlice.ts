import { useEffect, useRef, useState } from 'react'
import { flushDirtySliceForClose, type CloseFlushOutcome } from '../../lib/jobs/jobFormCloseFlush'

export type AutosaveSliceStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface JobFormAutosaveSlice {
  status: AutosaveSliceStatus
  /** True when the slice JSON differs from the last persisted baseline. */
  isDirty: () => boolean
  /** True while a save is in flight. */
  isRunning: () => boolean
  /**
   * Dirty AND currently allowed to save. A dirty-but-disabled slice (e.g.
   * identity with a required field blank) is deliberately NOT flushed — an
   * invalid state must never persist; those edits drop on close, exactly as
   * every pre-autosave close discarded them.
   */
  needsFlush: () => boolean
  /** Cancel any pending debounce and, if dirty and enabled, save NOW. */
  flush: () => Promise<void>
  /**
   * Close-guard flush: wait out any in-flight run, then save-and-recheck
   * until clean or failed. Caller wraps in withOperationTimeout.
   */
  flushForClose: () => Promise<CloseFlushOutcome>
  /** Refresh the baseline after an external full save persisted this slice. */
  markSavedNow: () => void
  /** Drop the baseline — job deleted or closing without saving. */
  clearBaseline: () => void
  /** Cancel a pending debounce without saving (an explicit full save supersedes it). */
  cancelPending: () => void
}

/**
 * One autosave slice of the Edit Job form (v2.1078; generalized from the
 * v2.1070 billing-money engine so identity/materials/team can join it).
 *
 * The hook owns the bookkeeping — baseline snapshot, ~1.2s debounce,
 * in-flight/queued serialization, status — while `save` (component-supplied,
 * reading its own refs for the latest rows) owns the actual writes and its
 * own error toast; it resolves `true` on success. The baseline is captured
 * in the same commit that hydrates the form (hydrate sets the job id and the
 * slice state together), so autosave can never fire against pre-hydration
 * empty state and wipe rows.
 *
 * `enabled` gates the debounce (identity slice: required fields present) —
 * a disabled slice stays dirty rather than persisting a half-cleared field.
 */
export function useJobFormAutosaveSlice(params: {
  jobId: string | null
  sliceJson: string
  save: () => Promise<boolean>
  enabled?: boolean
  debounceMs?: number
  onSaved?: () => void
}): JobFormAutosaveSlice {
  const { jobId, sliceJson, enabled = true, debounceMs = 1200 } = params
  const [status, setStatus] = useState<AutosaveSliceStatus>('idle')
  const baselineRef = useRef<{ jobId: string; json: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const queuedRef = useRef(false)
  const sliceJsonRef = useRef(sliceJson)
  sliceJsonRef.current = sliceJson
  const jobIdRef = useRef(jobId)
  jobIdRef.current = jobId
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const saveRef = useRef(params.save)
  saveRef.current = params.save
  const onSavedRef = useRef(params.onSaved)
  onSavedRef.current = params.onSaved

  function isDirty(): boolean {
    const id = jobIdRef.current
    const base = baselineRef.current
    return !!(id && base && base.jobId === id && base.json !== sliceJsonRef.current)
  }

  async function runSave(): Promise<boolean> {
    const id = jobIdRef.current
    if (!id) return true
    if (runningRef.current) {
      queuedRef.current = true
      return true
    }
    runningRef.current = true
    setStatus('saving')
    const sliceWritten = sliceJsonRef.current
    try {
      const ok = await saveRef.current()
      if (!ok) {
        setStatus('error')
        return false
      }
      baselineRef.current = { jobId: id, json: sliceWritten }
      setStatus('saved')
      onSavedRef.current?.()
      return true
    } finally {
      runningRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        void runSave()
      }
    }
  }
  const runSaveRef = useRef(runSave)
  runSaveRef.current = runSave

  function cancelTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function needsFlush(): boolean {
    return enabledRef.current && isDirty()
  }

  async function flush(): Promise<void> {
    cancelTimer()
    if (needsFlush()) await runSaveRef.current()
  }

  async function flushForClose(): Promise<CloseFlushOutcome> {
    cancelTimer()
    if (!enabledRef.current) return 'clean'
    return flushDirtySliceForClose({
      isRunning: () => runningRef.current,
      isDirty,
      runSave: () => runSaveRef.current(),
    })
  }

  function markSavedNow() {
    const id = jobIdRef.current
    if (id) baselineRef.current = { jobId: id, json: sliceJsonRef.current }
    setStatus('idle')
  }

  function clearBaseline() {
    cancelTimer()
    baselineRef.current = null
  }

  useEffect(() => {
    if (!jobId) {
      baselineRef.current = null
      return
    }
    const base = baselineRef.current
    if (!base || base.jobId !== jobId) {
      // First sight of this job: this snapshot IS the persisted state.
      baselineRef.current = { jobId, json: sliceJson }
      setStatus('idle')
      return
    }
    if (base.json === sliceJson) return
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void runSaveRef.current()
    }, debounceMs)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [sliceJson, jobId, enabled, debounceMs])

  return {
    status,
    isDirty,
    isRunning: () => runningRef.current,
    needsFlush,
    flush,
    flushForClose,
    markSavedNow,
    clearBaseline,
    cancelPending: cancelTimer,
  }
}
