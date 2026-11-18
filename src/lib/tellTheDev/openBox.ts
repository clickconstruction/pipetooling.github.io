/**
 * Tell the dev (punch list #380): how a door opens the box.
 *
 * The wrench has several doors (the floating one, the header's, an error line's, a window's
 * title row) and one box, mounted once in the shell. A door asks through a window event, so a
 * toast outside the shell and a window deep inside a page reach the same box with no prop passed
 * down. The event is handled inside the press that fired it, which is when the page is read.
 */
import type { NoteDoor } from './noteContext'
import type { NoteKind } from './starts'

export const TELL_THE_DEV_OPEN_EVENT = 'pipetooling:tell-the-dev-open'

export type TellTheDevOpenRequest = {
  door: NoteDoor
  /** The start to open on; the box keeps its last one otherwise. */
  kind?: NoteKind
}

export function requestTellTheDev(request: TellTheDevOpenRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<TellTheDevOpenRequest>(TELL_THE_DEV_OPEN_EVENT, { detail: request }))
}

/**
 * Whether a box is there to answer: the shell is mounted, a person is signed in and Fix Mode is
 * on. A door drawn outside the shell (an error line, a window's title row) asks this before it
 * shows, so a public page and a person with Fix Mode off see no wrench.
 */
let listening = false

export function setTellTheDevListening(on: boolean): void {
  listening = on
}

export function isTellTheDevListening(): boolean {
  return listening
}

/** The ledger's names for the test's two counts: a box opened, a note sent. */
export const TELL_THE_DEV_OPEN_CONTROL = 'tell_the_dev_open'
export const TELL_THE_DEV_SENT_CONTROL = 'tell_the_dev_sent'
