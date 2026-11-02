/**
 * The io half of Index this job's files (punch list #240, PR 1): one call to `drive-link`'s `index_job` as the
 * signed-in person per round. The function's own words come back as the error (`fnProblem`).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { INDEX_FOLDER_WORDS, indexJobFromAnswer, type IndexJobAnswer } from './jobIndexFolder'

export type JobIndexFolderIo = {
  indexJob: (jobId: string, retry: boolean) => Promise<IndexJobAnswer>
}

export async function indexJobFiles(jobId: string, retry: boolean): Promise<IndexJobAnswer> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'index_job', job: { jobs_ledger_id: jobId }, retry } })) as FnResult
  const problem = await fnProblem(r, INDEX_FOLDER_WORDS.failed)
  if (problem) throw new Error(problem)
  return indexJobFromAnswer(r.data)
}

export const supabaseJobIndexFolderIo: JobIndexFolderIo = { indexJob: indexJobFiles }
