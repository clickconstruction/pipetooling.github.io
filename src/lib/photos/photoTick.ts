/**
 * Messages, cut 10 (photos saved on arrival): the job's tick on screen, *Save every photo on this job to Drive as it
 * comes in* (the prototype's `quo-messages-mockup.html` draft 9, on branch spike/gc-mode). Main has no Save to Drive
 * button yet, so the tick sits under a message's Attachments, for the job the line is tied to, when a picture came with
 * it. `photo_saves` keeps the tick and `set_photo_save` turns it on or off; the `photo-save` sweep does the copying
 * (`photoSave.ts`). Pure, and outside the edge copy.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fileKindOf } from '../documents/jobFiles'
import { weekdayDate } from '../gc/words'
import { jobRefOf } from '../messages/load'
import type { LineFile } from '../messages/lineFiles'

/** The tick's words, as the prototype has them. */
export const PHOTO_TICK_WORDS = 'Save every photo on this job to Drive as it comes in'

/** A picture among a line's files: a file, never a link, that reads as an image by its type or its name. */
export function lineHasPhoto(files: readonly Pick<LineFile, 'kept' | 'mime' | 'name'>[] | undefined): boolean {
  return (files ?? []).some((f) => f.kept !== 'link' && fileKindOf(f.mime ?? '', f.name) === 'image')
}

/** The job whose tick a line shows: the job it is tied to, when a picture came with it. Null shows no tick. */
export function photoTickJob(message: { jobId: string | null; files?: readonly Pick<LineFile, 'kept' | 'mime' | 'name'>[] }): string | null {
  return message.jobId && jobRefOf(message.jobId) && lineHasPhoto(message.files) ? message.jobId : null
}

/** `set_photo_save`'s job, one of its three ids set, from a line's job key. Null for a key that is not one. */
export function photoSaveArgs(jobKey: string): { p_bid_id: string | null; p_project_id: string | null; p_jobs_ledger_id: string | null } | null {
  const ref = jobRefOf(jobKey)
  if (!ref) return null
  return {
    p_bid_id: ref.kind === 'bid' ? ref.id : null,
    p_project_id: ref.kind === 'project' ? ref.id : null,
    p_jobs_ledger_id: ref.kind === 'pipeline' ? ref.id : null,
  }
}

/** The column `photo_saves` keeps a job's tick under, and its id, from a line's job key. */
export function photoSaveColumn(jobKey: string): { column: 'bid_id' | 'project_id' | 'jobs_ledger_id'; id: string } | null {
  const ref = jobRefOf(jobKey)
  if (!ref) return null
  return { column: ref.kind === 'bid' ? 'bid_id' : ref.kind === 'project' ? 'project_id' : 'jobs_ledger_id', id: ref.id }
}

/** The words under the tick once it is on: since when, and what that leaves out. '' while it is off. */
export function photoTickNote(onSince: string | null): string {
  if (!onSince || Number.isNaN(Date.parse(onSince))) return ''
  return `On since ${weekdayDate(calendarYmdInAppTzFromIso(onSince))}. Photos that came in before then are not copied.`
}

/** The toast once a press lands. It names the setting, not a copy: the sweep copies on its own time. */
export function photoTickDone(on: boolean): string {
  return on ? 'This job is set to save its photos to Drive.' : 'This job is set not to save its photos to Drive.'
}
