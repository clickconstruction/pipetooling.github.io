/**
 * GC mode, the real build, the schedule's PR 9a: a schedule press's state, for the cards under the chart and the bar's
 * form (`GcScheduleCards.tsx`, `GcSplitBars.tsx`). Busy while it saves; what someone else changed when a plan write was
 * refused (G-134), and the schedule reads again; or a failure's words. `run` says whether the press saved.
 */
import { useState } from 'react'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import { formatErrorMessage } from '../../utils/errorHandling'

export function useSchedulePress(onReload?: () => void) {
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<ScheduleChange[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const run = async (press: () => Promise<void>, fallback: string): Promise<boolean> => {
    setBusy(true)
    setRefused(null)
    setFailed(null)
    try {
      await press()
      return true
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        setRefused(refusal.changes)
        onReload?.()
      } else setFailed(formatErrorMessage(e, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, refused, failed, run }
}

