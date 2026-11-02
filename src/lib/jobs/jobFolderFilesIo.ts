/**
 * The read behind the job window's folder listing (v2.6299): `job-photos`' `files` action, which lists a job's five
 * folders through the service account and names what the app filed itself. The screen takes this io so its test runs
 * over a fake.
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { jobFolderFilesFromAnswer, type JobFolderFilesRead } from './jobFolderFiles'

const FN = 'job-photos'

export async function listJobFolderFiles(jobId: string): Promise<JobFolderFilesRead> {
  const r = (await supabase.functions.invoke(FN, { body: { action: 'files', job_id: jobId } })) as FnResult
  const problem = await fnProblem(r, 'The job’s folders did not read.')
  if (problem) throw new Error(problem)
  return jobFolderFilesFromAnswer(r.data)
}

export interface JobFolderFilesIo {
  list: (jobId: string) => Promise<JobFolderFilesRead>
}

export function supabaseJobFolderFilesIo(): JobFolderFilesIo {
  return { list: listJobFolderFiles }
}
