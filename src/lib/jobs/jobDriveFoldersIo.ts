/**
 * The io half of a job's Drive folders (Materials on site, punch list #209, v2.6054): one call to the
 * `job-drive-folders` edge function, which makes the folders as the service account and records the links on the
 * job. The function's own words come back as the error (`fnProblem`, as gc-drive-access's calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { jobDriveFoldersFromAnswer, type JobDriveFolders } from './jobDriveFolders'
import { jobFolderTrashAnswer, jobFolderTrashOffered, jobFolderTrashProblem, jobFolderTrashToast, type JobFolderTrashAnswer, type JobFolderTrashJob } from './deletedJobFolderOffer'

/** Make a Pipeline job's Drive folders under Jobs, or fill the missing ones inside the folder it has. */
export async function makeJobDriveFolders(jobId: string): Promise<JobDriveFolders> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { job_id: jobId } })) as FnResult
  const problem = await fnProblem(r, 'The folders were not made.')
  if (problem) throw new Error(problem)
  return jobDriveFoldersFromAnswer(r.data)
}

/** What the app says when the function answered nothing it can read. */
const NOT_MOVED = 'Its Drive folder was not moved to the trash.'

/**
 * Ask for a deleted ZZ test job's own Drive folder to go to Drive's trash (punch list #443, row 18). The job's id is
 * all that is sent: the function reads the job from Deleted records and decides. Throws with the function's words
 * when it refuses.
 */
export async function trashDeletedJobFolder(jobId: string): Promise<JobFolderTrashAnswer> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { trash: { job_id: jobId } } })) as FnResult
  const problem = await fnProblem(r, NOT_MOVED)
  if (problem) throw new Error(jobFolderTrashProblem(problem))
  const answer = jobFolderTrashAnswer(r.data)
  if (!answer) throw new Error(NOT_MOVED)
  return answer
}

/**
 * The step after a job's delete went through: its folder to the trash when the rule offers it, and the toast's
 * words. Null when it is not offered, so nothing is asked and nothing is said. Never throws: the job is already
 * gone, and a folder that stays is said, not failed.
 */
export async function afterDeleteJobFolder(jobId: string, job: JobFolderTrashJob | null | undefined, role: string | null | undefined): Promise<{ words: string; tone: 'success' | 'warning' } | null> {
  if (!jobFolderTrashOffered(role, job)) return null
  try {
    return jobFolderTrashToast({ answer: await trashDeletedJobFolder(jobId) })
  } catch (e) {
    return jobFolderTrashToast({ problem: formatErrorMessage(e, NOT_MOVED) })
  }
}
