/** Session flag set when leaving Edit Job via Ready to Bill "View in Stages"; Jobs Stages tab shows "Back to Edit Job". */

export const RETURN_EDIT_JOB_SESSION_KEY = 'pipetooling_return_edit_job'

export type ReturnEditJobPayload = { jobId: string; at: number }

const MAX_AGE_MS = 15 * 60 * 1000

export function setReturnEditJobFromStages(jobId: string): void {
  try {
    const id = String(jobId).trim()
    if (!id) return
    sessionStorage.setItem(RETURN_EDIT_JOB_SESSION_KEY, JSON.stringify({ jobId: id, at: Date.now() }))
  } catch {
    /* quota / private mode */
  }
}

function parseReturnEditJobPayload(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as ReturnEditJobPayload
    if (!parsed?.jobId || typeof parsed.jobId !== 'string') return null
    const id = parsed.jobId.trim()
    if (!id) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > MAX_AGE_MS) return null
    return id
  } catch {
    return null
  }
}

/** Read valid job id without removing (survives React Strict Mode remount; clear on dismiss). */
export function peekReturnEditJobFromStages(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_EDIT_JOB_SESSION_KEY)
    if (!raw) return null
    const id = parseReturnEditJobPayload(raw)
    if (!id) sessionStorage.removeItem(RETURN_EDIT_JOB_SESSION_KEY)
    return id
  } catch {
    return null
  }
}

/** Reads and removes the key. Returns jobId or null if missing, invalid, or expired. */
export function consumeReturnEditJobFromStages(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_EDIT_JOB_SESSION_KEY)
    if (!raw) return null
    sessionStorage.removeItem(RETURN_EDIT_JOB_SESSION_KEY)
    return parseReturnEditJobPayload(raw)
  } catch {
    return null
  }
}

export function clearReturnEditJobFromStages(): void {
  try {
    sessionStorage.removeItem(RETURN_EDIT_JOB_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
