/**
 * A page that fell behind (punch list #404). A builder's draft and a job's sheet's draft are saved a moment after the
 * typing rests, and a save or a publish names the draft's number its page read. When the row moved on since, because
 * a teammate or another tab saved or published it, the write lands on no row and the io hands back the row as it now
 * reads (`Landed.movedOn`).
 *
 * The screen then holds that one thing: its saves wait, what the person typed stays on the page, and a panel offers
 * two presses. **Load the newer one** takes the row as it now reads and drops what was typed here. **Save mine over
 * it** saves what was typed here over the newer draft. Nothing is thrown away until the person chooses.
 *
 * This file is the panel's words. Pure: no React, no supabase, no clock.
 */

export type MovedOnWords = {
  title: string
  /** What happened, then what it means for what was typed here. */
  lines: string[]
  /** Under the presses: what each one drops. */
  costs: string[]
  load: string
  keep: string
}

export const MOVED_ON_LOAD = 'Load the newer one'
export const MOVED_ON_KEEP = 'Save mine over it'

/**
 * The panel for one thing that moved on. `what` names it as a title starts: *Your usual sheet*, *Sub NDA*. `mine` is
 * the revision this page read and `newer` the one the row is on now.
 */
export function movedOnWords(what: string, mine: { revision: number }, newer: { revision: number }): MovedOnWords {
  const published = newer.revision > mine.revision
  return {
    title: `${what} changed somewhere else`,
    lines: [
      published ? `Revision ${newer.revision} was published after this page read it.` : 'A newer draft was saved after this page read it.',
      'What you typed here is not saved. It stays on this page until you choose.',
    ],
    costs: [
      `${MOVED_ON_LOAD} drops what you typed here.`,
      published ? `${MOVED_ON_KEEP} drops the newer draft. Revision ${newer.revision} stays published.` : `${MOVED_ON_KEEP} drops the newer draft.`,
    ],
    load: MOVED_ON_LOAD,
    keep: MOVED_ON_KEEP,
  }
}

/** What a job's sheet is called in the panel's title. */
export function movedOnJobName(jobName: string): string {
  return jobName.trim() ? `The sheet for ${jobName.trim()}` : "This job's sheet"
}

export const MOVED_ON_USUAL = 'Your usual sheet'
