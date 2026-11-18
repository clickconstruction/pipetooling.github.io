import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { LienLastWorkPatch } from '../../lib/jobs/lienLastWorkDay'

/**
 * The one write behind a last day of work (v2.7684, out of `LienLastWorkDayLine` as it stood): the hand-set columns
 * on the job, a toast either way, and the caller's re-read after a save. The line's editor and the timeline's
 * press both save through it, so there is one write and one wording.
 */
export function useLienLastWorkDayWrite(jobId: string, onSaved: () => void): { busy: boolean; write: (patch: LienLastWorkPatch, done: string) => Promise<boolean> } {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const write = async (patch: LienLastWorkPatch, done: string) => {
    setBusy(true)
    const { error } = await supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)
    setBusy(false)
    if (error) {
      showToast(`Could not save the last day of work: ${formatErrorMessage(error)}`, 'error')
      return false
    }
    showToast(done, 'success')
    onSaved()
    return true
  }
  return { busy, write }
}
