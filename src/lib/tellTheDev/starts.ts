/**
 * Tell the dev (punch list #380): the three starts of the wrench's box, and what may be sent.
 *
 * A start is a sentence the box opens for the person: they finish it. The start is also the
 * note's kind, which is how the dev's inbox sorts it and how fast it reaches them. Pure words and
 * rules, no React and no Supabase.
 */

/** A note written from a page. `guide` is the older box under a Help guide and never starts here. */
export type NoteKind = 'want' | 'confusing' | 'broken'
export type AnyNoteKind = NoteKind | 'guide'

export type NoteStart = {
  kind: NoteKind
  /** The row in the box: the sentence with its dots. */
  label: string
  /** The words the sentence opens with, kept on the note so it reads whole in the inbox. */
  lead: string
  /** The chip in the dev's inbox. */
  chip: string
  /** True when the note is nothing without words. The other two say enough with the page alone. */
  needsWords: boolean
}

export const NOTE_STARTS: readonly NoteStart[] = [
  { kind: 'want', label: 'I want…', lead: 'I want', chip: 'Want', needsWords: true },
  { kind: 'confusing', label: 'This page is confusing because…', lead: 'This page is confusing because', chip: 'Confusing', needsWords: false },
  { kind: 'broken', label: 'Something went wrong when I…', lead: 'Something went wrong when I', chip: 'Went wrong', needsWords: false },
]

/** The longest note the table takes (`help_feedback_body_len`). */
export const NOTE_BODY_MAX = 2000

export function isNoteKind(value: unknown): value is NoteKind {
  return value === 'want' || value === 'confusing' || value === 'broken'
}

export function noteStart(kind: NoteKind): NoteStart {
  return NOTE_STARTS.find((s) => s.kind === kind) ?? NOTE_STARTS[0]!
}

/** The chip for any row of the table, a guide's note included. */
export function noteKindChip(kind: string | null | undefined): string {
  if (isNoteKind(kind)) return noteStart(kind).chip
  return 'Guide'
}

/**
 * The note as it is kept: the start's own words, then what the person typed. A person who typed
 * the start again is not made to say it twice. Nothing typed is an empty note, never the bare start.
 */
export function noteBody(kind: NoteKind, typed: string): string {
  const words = typed.replace(/\s+/g, ' ').trim()
  if (!words) return ''
  const lead = noteStart(kind).lead
  if (words.toLowerCase().startsWith(lead.toLowerCase())) return words
  return `${lead} ${words}`
}

export type CanSendNote = { ok: true; body: string } | { ok: false; reason: string }

/** Whether the box may send, with the reason in words when it may not. */
export function canSendNote(kind: NoteKind, typed: string): CanSendNote {
  const body = noteBody(kind, typed)
  if (!body && noteStart(kind).needsWords) return { ok: false, reason: 'Say what you want first.' }
  if (body.length > NOTE_BODY_MAX) return { ok: false, reason: `A note is limited to ${NOTE_BODY_MAX} characters.` }
  return { ok: true, body }
}

/** What the inbox shows for a note with no words. */
export function wordlessNoteLine(kind: string | null | undefined): string {
  if (kind === 'broken') return 'No words. Something went wrong on this page.'
  if (kind === 'confusing') return 'No words. This page is confusing.'
  return 'No words.'
}
