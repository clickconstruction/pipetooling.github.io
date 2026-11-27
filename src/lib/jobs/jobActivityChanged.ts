/**
 * How a list of a job's Activity hears that lines were taken off it (punch list #443, row 1, finding 283 of the
 * fixing thread's ledger).
 *
 * The lists hear a new line from the database: they listen for an insert on `job_activity_events`. Nothing told
 * them of a delete. So after the Lien window's **Clear…** took three lines off a test job, the job window behind it
 * went on drawing them until the job was opened again. A delete's own signal from the database names the row and not
 * its job, so the press that deleted says so here instead.
 *
 * A window event, as the counter tickets and the task photos use: a list that is not mounted hears nothing and loses
 * nothing, since it reads on its next open. It reaches the lists of this tab alone. Another tab or another person's
 * screen still reads on its next open.
 */
export const JOB_ACTIVITY_CHANGED_EVENT = 'job-activity-changed'

/** Say that a job's Activity lines changed in a way the database's insert signal does not carry: a delete. */
export function announceJobActivityChanged(jobId: string): void {
  if (typeof window === 'undefined' || !jobId) return
  window.dispatchEvent(new CustomEvent(JOB_ACTIVITY_CHANGED_EVENT, { detail: jobId }))
}

/** The job an event names, or null when it names none. */
export function jobActivityChangedJobId(event: Event): string | null {
  const detail = (event as CustomEvent).detail
  return typeof detail === 'string' && detail !== '' ? detail : null
}

/** Hear every change until the returned function is called. */
export function onJobActivityChanged(listener: (jobId: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const jobId = jobActivityChangedJobId(e)
    if (jobId) listener(jobId)
  }
  window.addEventListener(JOB_ACTIVITY_CHANGED_EVENT, handler)
  return () => window.removeEventListener(JOB_ACTIVITY_CHANGED_EVENT, handler)
}
