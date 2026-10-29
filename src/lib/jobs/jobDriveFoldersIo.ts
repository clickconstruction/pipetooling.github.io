/**
 * The io half of a job's Drive folders (Materials on site, punch list #209, v2.6054): one call to the
 * `job-drive-folders` edge function, which makes the folders as the service account and records the links on the
 * job. The function's own words come back as the error (`fnProblem`, as gc-drive-access's calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { jobDriveFoldersFromAnswer, type JobDriveFolders } from './jobDriveFolders'

/** Make a Pipeline job's Drive folders under Jobs, or fill the missing ones inside the folder it has. */
export async function makeJobDriveFolders(jobId: string): Promise<JobDriveFolders> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { job_id: jobId } })) as FnResult
  const problem = await fnProblem(r, 'The folders were not made.')
  if (problem) throw new Error(problem)
  return jobDriveFoldersFromAnswer(r.data)
}
