/**
 * See what they see (v2.6846): the press on an Away row that shows the office the screen a teammate who is
 * away meets at sign-in. The owner's ask of 2026-11-10: a button to look at the screen the way the person
 * will, to check the note as they will read it. It is a look and nothing more. Nobody is signed in as the
 * person, no session is made for them, the seal on their login stays as it is and nothing is written.
 *
 * The person's own page reads `my_away_note()` and draws `MyAwayNote`. This kernel builds the same
 * `MyAwayNote` from what the office may already read (the note row, the Away row, the office settings),
 * field for field as the function answers it, so one page view draws both and the two cannot drift. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { awayDraftFromRow, type AwayNoteRow, type AwayOffice, type MyAwayNote } from './awayNote'

export const AWAY_PREVIEW_WORDS = {
  /** The press on the Away row. */
  press: 'See what they see',
  pressTitle: 'A preview of the screen their sign-in opens to. You stay signed in as yourself and nothing is saved.',
  tag: 'Preview',
  close: 'Close the preview',
  today: 'Today',
  onTheDay: 'On the day',
  dayGroup: 'Preview day',
  /** Under the screen. */
  inert: 'The buttons do nothing here. Theirs do.',
  loadFailed: 'Could not read the note',
} as const

/**
 * The name the screen greets, as `my_away_note()` takes it: the first word of the login's own name, spaces
 * trimmed, or none. The roster name never stands in there, so it does not here.
 */
export function awayLoginFirstName(loginName: string | null | undefined): string | null {
  const first = (loginName ?? '').replace(/^ +| +$/g, '').split(' ')[0] ?? ''
  return first.trim() || null
}

/** The window's name: *Preview of Corinne Vela's sign-in screen*. */
export function awayPreviewTitle(displayName: string): string {
  const who = displayName.trim()
  return who ? `Preview of ${who}'s sign-in screen` : 'Preview of their sign-in screen'
}

/** The line beside the Preview tag: whose screen it is, and that the viewer is still themself. */
export function awayPreviewWhoWords(displayName: string, hasLogin: boolean): string {
  const who = displayName.trim() || 'This teammate'
  if (!hasLogin) return `${who} has no login, so nothing opens yet. A login would open to this screen. You are still signed in as yourself.`
  return `${who} meets this screen at sign-in. You are still signed in as yourself.`
}

/**
 * The note as the person's page takes it, from the office's own reads. Null when the note is gone, which the
 * page draws as its resting words. The day it was updated is read in the app's zone, as the function reads it.
 */
export function awayPreviewNote(args: { loginName: string | null | undefined; leftYmd: string | null; row: AwayNoteRow | null; office: AwayOffice }): MyAwayNote | null {
  if (!args.row) return null
  const draft = awayDraftFromRow(args.row)
  const updatedYmd = args.row.updated_at ? calendarYmdInAppTzFromIso(args.row.updated_at) || null : null
  return {
    // The alert is the office's own; the function never sends it to the person.
    draft: { ...draft, alertOnDay: false },
    firstName: awayLoginFirstName(args.loginName),
    leftYmd: args.leftYmd ? args.leftYmd.slice(0, 10) : null,
    updatedYmd,
    office: args.office,
  }
}
