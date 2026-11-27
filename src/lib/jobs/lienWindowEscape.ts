/**
 * Escape on a job's Lien window (finding 284 of the fixing thread's ledger, the walk of 2026-11-27: one Escape did not
 * close it, and its × did). The window had never listened for the key, while the windows around it close on it.
 *
 * The rule, the managing session's pick of 2026-11-27, the person's to flip: Escape closes the window as the app's other
 * windows close, except while a field inside it holds words a person typed and has not saved. Then Escape does nothing
 * to the window, and the form's own Cancel and the window's × stand. A window over this one takes the key first, as it
 * does today: a confirm, a paper's preview, the serve window, a value changed in place.
 *
 * Pure. `LienInstrumentsModal.tsx` feeds it the key's state, and `useUnsavedWords.ts` the typed fields.
 */

export type LienWindowEscapeState = {
  /** A window or a field over this one already took the key (`defaultPrevented`). */
  handled: boolean
  /** This is the window on top of the app's window stack (`modalStack.ts`). */
  topmost: boolean
  /** A write is in flight: a send being recorded, a PDF being built, an email going out. */
  busy: boolean
  /** A field in the window holds words typed since it was first touched. */
  unsavedWords: boolean
}

/** `ignore`: the key is not this window's. `stay`: it is, and the window stays over typed words. `close`: it closes. */
export type LienWindowEscapeAction = 'ignore' | 'stay' | 'close'

export function lienWindowEscapeAction(s: LienWindowEscapeState): LienWindowEscapeAction {
  if (s.handled || !s.topmost || s.busy) return 'ignore'
  return s.unsavedWords ? 'stay' : 'close'
}

/** The kinds of `<input>` a person types words, a number or a day into. A tick, a file and a press are not words. */
const WORD_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'number', 'password', 'date', 'time', 'datetime-local', 'month', 'week'])

/**
 * Whether a field holds typed words: a text box of any typed kind, a text area, or an editable block. A select, a tick
 * box, a radio, a file and a button do not, so changing one never holds the window.
 */
export function isWordField(field: { tagName: string; type?: string | null; editable?: boolean }): boolean {
  if (field.editable) return true
  const tag = field.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (tag !== 'input') return false
  return WORD_INPUT_TYPES.has((field.type ?? '').toLowerCase())
}

/** A typed field as the window follows it: what it held when it was first touched, and what it holds now. */
export type TouchedField = { first: string; now: string }

/** Whether any touched field holds other words than it did when it was first touched. */
export function fieldsHoldUnsavedWords(fields: ReadonlyArray<TouchedField>): boolean {
  return fields.some((f) => f.now !== f.first)
}
