/**
 * The thread's reply box folded to one row on a short window (v2.6477, the owner's pick A, 2026-11-03): the kinds and a
 * one-line box, so the person's lines get the room until someone writes. A press into the box opens it whole; it folds
 * back once what was written has gone. Only the thread window's foot folds: a job's box and a sheet's stay whole, and
 * so does a text to a number that sent STOP (v2.6487): its field is disabled, so no press could open it, and the fold
 * hid the one line that said why.
 */

export interface ReplyFoldFacts {
  /** The open thread folds its box: a short window or a phone (`OpenThread.foldBox`, v2.6482). */
  foldBox: boolean
  /** The box is a job's, which its card holds: never folded. */
  inJob: boolean
  /** Someone pressed into the box, or picked a kind, since it last sent. */
  woke: boolean
  /** Nothing written yet, or an email's pre-typed opening alone. */
  blank: boolean
  /** Files waiting on the reply. */
  files: number
  /** Something the box opens with on its own: a nudge's reminder, a won bid's words, a settle under way. */
  opensWithWords: boolean
  /** Send texts is off, so the box shows its wait line in place of the box. */
  textWaits: boolean
  /** A text to a number that sent STOP: the field is disabled and the send row holds the reason. */
  blocked: boolean
}

/** The box folds while the thread asks it to and nothing waits in it to be sent. */
export function replyBoxFolded(f: ReplyFoldFacts): boolean {
  return f.foldBox && !f.inJob && !f.woke && f.blank && f.files === 0 && !f.opensWithWords && !f.textWaits && !f.blocked
}
