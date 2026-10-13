/**
 * Messages, cut 7f: Save to Drive on a file that came in (the mock-up `files-out-mockups.html`, screen 8, on branch
 * spike/gc-mode; cut 6's message window, its Attachments' second button). Our copy goes into the job's Drive folder
 * through `drive-link`'s `save`, and the row keeps the Drive file, so the job's one list shows it once, where it lives.
 * Where it goes follows the function: a photo into the job's photos; on a GC project, Team only for a quote and Plans
 * for anything else, the person's pick in the sheet (the lead, 2026-10-12); a bid's or a Pipeline job's folder has no
 * halves, so the file goes into the folder, which only the team sees. A message on nobody's job asks for one first.
 * Pure.
 */
import { isImageFile, saveHalfFor } from '../../../supabase/functions/_shared/driveLink'
import { jobRefOf } from './load'

export type DriveHalf = 'plans' | 'team_only'

/** Where Save to Drive puts the file, and whether the person picks the half. */
export type SaveTarget = { kind: 'noJob' } | { kind: 'photos' } | { kind: 'folder' } | { kind: 'halves'; pick: DriveHalf }

/** A file's name that reads as a quote or a bid: it saves to Team only, so trades never read another's price. */
export function looksLikeQuote(name: string): boolean {
  return /\b(quote|quotes|quoted|bid|bids|proposal|estimate|pricing|price)\b/i.test(name.replace(/[_-]+/g, ' '))
}

/** Where the file saves for this line's job. */
export function saveTarget(file: { name: string; mime: string | null }, jobKey: string | null): SaveTarget {
  const job = jobRefOf(jobKey)
  if (!job) return { kind: 'noJob' }
  if (isImageFile(file)) return { kind: 'photos' }
  if (job.kind !== 'project') return { kind: 'folder' }
  return { kind: 'halves', pick: saveHalfFor({ kind: 'file', mime: file.mime, name: file.name, isQuote: looksLikeQuote(file.name) }) }
}

/** The sheet's words. Each sentence is one idea, as a first-timer reads it. */
export const SAVE_WORDS = {
  button: 'Save to Drive',
  title: (job: string) => `Save it to ${job}’s Drive folder`,
  teamOnly: { label: 'Team only', hint: 'Only the team sees it there. A quote or a photo goes here.' },
  plans: { label: 'Plans', hint: 'Anyone with the folder’s link reads it, so trades see it with the plans.' },
  photos: 'It goes into the job’s photos, named by its day and who sent it.',
  folder: 'It goes into the job’s Drive folder. Only the team sees it there.',
  noJob: 'This message is on nobody’s job. Tie it to a job first, so the file has a folder.',
  notNow: 'Not now',
  save: 'Save it',
  saving: 'Saving…',
  openInDrive: 'Open in Drive',
} as const

/** The line once it is saved. A file saved before this window was opened says only that it is in Drive. */
export function savedWords(target: SaveTarget | null, half: DriveHalf | null): string {
  if (target?.kind === 'photos') return 'Saved to the job’s photos.'
  if (target?.kind === 'halves' && half === 'plans') return 'Saved to the job’s Plans folder.'
  if (target?.kind === 'halves') return 'Saved to the job’s Team only folder, under From email.'
  if (target?.kind === 'folder') return 'Saved to the job’s Drive folder.'
  return 'Saved to the job’s Drive.'
}
