/**
 * Which job-card dispatch requests a job save can retire on its own.
 *
 * The red phone / red photos icons on Dashboard job cards file a
 * `dispatch_requests` row with `pending_action = 'add_job_phone'` /
 * `'link_job_pictures'`. Until v2.2880 only the pictures request auto-closed
 * when the office filled the field in; the phone request sat open until
 * someone closed it by hand (J19/J2 — journey-map Tier-2 #25). Both now share
 * one rule: a field going blank → set on save closes that job's open request
 * of the matching kind, with a fixed audit note.
 */

export type JobDispatchAutoCloseAction = 'link_job_pictures' | 'add_job_phone'

/** Audit note stamped on the auto-closed row (also what the requester's push carries). */
export const JOB_DISPATCH_AUTO_CLOSE_NOTES: Record<JobDispatchAutoCloseAction, string> = {
  link_job_pictures: 'Customer Pictures URL added',
  add_job_phone: 'Customer phone number added',
}

/** Blank/whitespace counts as absent on both sides. */
export function fieldWentBlankToSet(prev: string | null | undefined, next: string | null | undefined): boolean {
  return (prev ?? '').trim() === '' && (next ?? '').trim() !== ''
}

/**
 * The pending actions to close for this save, in a stable order. Only a
 * blank → set transition qualifies: editing an existing number/link, or
 * clearing one, never closes anything.
 */
export function pickJobDispatchAutoCloses(input: {
  prevPicturesLink: string | null | undefined
  nextPicturesLink: string | null | undefined
  prevPhone: string | null | undefined
  nextPhone: string | null | undefined
}): JobDispatchAutoCloseAction[] {
  const out: JobDispatchAutoCloseAction[] = []
  if (fieldWentBlankToSet(input.prevPicturesLink, input.nextPicturesLink)) out.push('link_job_pictures')
  if (fieldWentBlankToSet(input.prevPhone, input.nextPhone)) out.push('add_job_phone')
  return out
}
