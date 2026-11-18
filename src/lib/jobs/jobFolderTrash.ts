/**
 * A wrong file taken off a lien paper goes to Drive's trash, and can be put back (v2.7699): the words and the small
 * rules, pure. The call is `jobFolderTrashIo.ts`, and the fences are the function's (`_shared/driveTrash.ts`): only a
 * file in the job's Sent by us folder, never one a lien record still names, and trash, never delete.
 *
 * Taking the link off always comes first and always stands. What happens to the file is told apart from it, so a
 * busy Drive never holds the office on a record it has already fixed.
 */

/** Where the file is after its link came off: in Drive's trash, or still in the folder with the reason. */
export type FileTakenOff = { where: 'trash' } | { where: 'drive'; why: string; retry: boolean }

export const TAKE_OFF_FILE_WORDS = {
  /** The second sentence of every ask before a take-off. */
  askTail: 'The file goes to Drive’s trash. Drive keeps it there 30 days.',
  inTrash: 'Taken off. The file is in Drive’s trash.',
  staysLead: 'Taken off. The file stays in Drive.',
  /** After a Replace: the file the new one took the place of. */
  replaced: 'The old one went to Drive’s trash.',
  replacedStaysLead: 'The old one stays in Drive.',
  moving: 'Moving the file to Drive’s trash…',
  putBack: 'Put it back',
  puttingBack: 'Putting it back…',
  putBackFailed: 'The file was not put back.',
  /** Send the file to the trash again, after a failure a second try can get past. */
  tryAgain: 'Try again',
  /** No answer came back from the app at all. */
  lost: 'The app could not be reached. Check the signal.',
  /** The function gave no reason. */
  noReason: 'Drive gave no reason.',
} as const

/** The line under the press once the link is off. */
export function fileTakenOffWords(outcome: FileTakenOff, after: 'take_off' | 'replace' = 'take_off'): string {
  if (outcome.where === 'trash') return after === 'replace' ? TAKE_OFF_FILE_WORDS.replaced : TAKE_OFF_FILE_WORDS.inTrash
  const lead = after === 'replace' ? TAKE_OFF_FILE_WORDS.replacedStaysLead : TAKE_OFF_FILE_WORDS.staysLead
  return `${lead} ${outcome.why}`.trim()
}

/**
 * A Drive file's id out of its link: `/file/d/<id>/…`, `open?id=<id>`, `uc?id=<id>`. Null for anything else, so a
 * link typed by hand to another site is never handed to the trash.
 */
export function driveFileIdOfUrl(url: string | null | undefined): string | null {
  const text = (url ?? '').trim()
  if (!/^https:\/\/(?:drive|docs)\.google\.com\//i.test(text)) return null
  const m = /\/d\/([A-Za-z0-9_-]{10,120})(?:[/?#]|$)/.exec(text) ?? /[?&]id=([A-Za-z0-9_-]{10,120})(?:[&#]|$)/.exec(text)
  return m?.[1] ?? null
}
