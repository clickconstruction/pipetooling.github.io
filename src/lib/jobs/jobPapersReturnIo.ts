/**
 * The way back to a job after signing one of its papers (papers before a job opens, step 3). The prompt leaves for
 * the signing page, a full page load, so the trip is remembered in this tab's session storage:
 *   1. the prompt writes where it was and which job (`JOB_PAPERS_RETURN_KEY`) before it leaves;
 *   2. the signing page's thank-you reads it and offers **Back to the job**; the press arms the job's id;
 *   3. the job window's provider takes the armed id once and opens that job, where the prompt says what is left.
 * Nothing here is trusted beyond an in-app path and an id: the job still asks the database who owes what.
 */
import { JOB_PAPERS_RETURN_KEY, type JobPapersReturn, parseJobPapersReturn } from './jobPapers'

const BACK_KEY = 'job-papers-back'

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** The trip the prompt remembered, if this tab left a job to sign a paper. */
export function readJobPapersReturn(): JobPapersReturn | null {
  return parseJobPapersReturn(storage()?.getItem(JOB_PAPERS_RETURN_KEY) ?? null)
}

/** Pressed on Back to the job: the trip is over and the job is armed to open. */
export function armJobPapersBack(jobId: string): void {
  const s = storage()
  if (!s) return
  s.removeItem(JOB_PAPERS_RETURN_KEY)
  s.setItem(BACK_KEY, jobId)
}

/** The job to open on the way back, taken once. */
export function takeJobPapersBack(): string | null {
  const s = storage()
  if (!s) return null
  const jobId = s.getItem(BACK_KEY)
  if (jobId) s.removeItem(BACK_KEY)
  return jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? jobId : null
}
