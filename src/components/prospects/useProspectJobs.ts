import { useState } from 'react'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { NewProspectJob, ProspectJob } from '../../lib/prospects/gcLeadLane'
import { addProspectJob, deleteProspectJob, loadProspectJobs, setProspectJobStatus, updateProspectJob } from '../../lib/prospects/gcLeadLaneIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * A GC lead's jobs (v2.5561): each lead's `prospect_jobs`, merged in beside both of the page's loaders, and the
 * five writes of the card's Jobs box. Moved out of `src/pages/Prospects.tsx` unchanged.
 *
 * The status, lost and remove writes patch the cache under the deck's card (`currentProspectId`), while add takes
 * the prospect's id and edit uses the job's own (the map's quirk 30). They agree because the Jobs box draws on
 * the deck's card.
 */
export function useProspectJobs({ userId, currentProspectId }: { userId: string | null; currentProspectId: string | null }) {
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const [jobsByProspect, setJobsByProspect] = useState<Record<string, ProspectJob[]>>({})

  async function mergeJobs(ids: string[]) {
    if (ids.length === 0) return {}
    try {
      const jobs = await loadProspectJobs(ids)
      setJobsByProspect((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = jobs[id] ?? []
        return next
      })
      return jobs
    } catch {
      return {}
    }
  }

  /** + Add a job on a lead's card (v2.5561): the box shows a refusal's words, so this throws. */
  async function addJobFor(prospectId: string, job: NewProspectJob) {
    if (!userId) throw new Error('Sign in first.')
    const made = await addProspectJob(prospectId, job, userId)
    setJobsByProspect((prev) => ({ ...prev, [prospectId]: [...(prev[prospectId] ?? []), made] }))
  }

  /** Edit in place (v2.5580): the row's changes saved, the box re-sorts on the new bid day. */
  async function editJobFor(job: ProspectJob, changes: NewProspectJob) {
    const saved = await updateProspectJob(job.id, changes)
    setJobsByProspect((prev) => ({ ...prev, [job.prospect_id]: (prev[job.prospect_id] ?? []).map((j) => (j.id === job.id ? saved : j)) }))
  }

  async function changeJob(job: ProspectJob, status: 'open' | 'dropped', wonBy: string | null = null) {
    if (!currentProspectId) return
    const pid = currentProspectId
    try {
      await setProspectJobStatus(job.id, status, wonBy)
      setJobsByProspect((prev) => ({ ...prev, [pid]: (prev[pid] ?? []).map((j) => (j.id === job.id ? { ...j, status, won_by: wonBy } : j)) }))
    } catch (err) {
      showToast(formatErrorMessage(err, 'That did not save.'), 'error')
    }
  }

  async function markJobLost(job: ProspectJob) {
    if (!currentProspectId) return
    const who = await promptDialog({ title: 'Who got it?', message: `${job.name}: the builder that won, if you know.`, placeholder: 'Another builder', confirmLabel: 'Mark lost' })
    if (who === null) return
    const pid = currentProspectId
    try {
      await setProspectJobStatus(job.id, 'lost', who.trim() || null)
      setJobsByProspect((prev) => ({ ...prev, [pid]: (prev[pid] ?? []).map((j) => (j.id === job.id ? { ...j, status: 'lost', won_by: who.trim() || null } : j)) }))
    } catch (err) {
      showToast(formatErrorMessage(err, 'That did not save.'), 'error')
    }
  }

  async function removeJob(job: ProspectJob) {
    if (!currentProspectId) return
    const pid = currentProspectId
    try {
      await deleteProspectJob(job.id)
      setJobsByProspect((prev) => ({ ...prev, [pid]: (prev[pid] ?? []).filter((j) => j.id !== job.id) }))
    } catch (err) {
      showToast(formatErrorMessage(err, 'That did not save.'), 'error')
    }
  }

  return { jobsByProspect, mergeJobs, addJobFor, editJobFor, changeJob, markJobLost, removeJob }
}
