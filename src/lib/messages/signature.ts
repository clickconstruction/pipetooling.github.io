/**
 * Messages, punch list #207 PR 1 (`to-dos/messages-estimator-mailbox/README.md` → Finding 2, the owner's call 4): the
 * signature a person keeps on Settings → Your account, under their words on every email they send from Messages. The
 * name and the cell are the account's (`users.name`, `users.phone`); the title is `users.title` (cut 3's SQL); the two
 * free lines are `users.signature_lines` (migration 20261028230000), for the company's email, a licence number, or
 * nothing. Nothing the app writes goes after it: the owner's *Email back, text, or call.* left the generated lines with
 * this PR, and he types it into his own. The lines as the email carries them are `signatureLines` in `compose.ts`; this
 * file holds the card's words, its draft and the rules. Pure.
 */

/** How many lines of their own a person keeps under the name, the title and the cell. */
export const SIGNATURE_FREE_LINES_MAX = 2

/** A line of the signature, the title included (`users_title_short`), holds this many characters. */
export const SIGNATURE_LINE_MAX = 80

export const SIGNATURE_WORDS = {
  title: 'Your signature on an email',
  lead: 'Goes under your words on every email you send from Messages. Nothing is added after it.',
  name: 'Name',
  cell: 'Cell',
  fromAccount: 'from your account, under My Profile',
  noCell: 'no cell on your account, so the line is left out',
  jobTitle: 'Title',
  titleHint: 'Estimator, Office manager, or nothing',
  lines: 'Two more lines',
  line1: 'Line 1',
  line2: 'Line 2',
  lineHint: 'Leave empty for nothing',
  linesWait: 'The two lines arrive with the next database update. The title saves now.',
  preview: 'As it goes',
  previewNote: 'The company line reads Click Plumbing and Electrical on a Pipeline job.',
  save: 'Save the signature',
  saved: 'Signature saved.',
  notSaved: 'The signature was not saved.',
  loading: 'Reading your signature…',
  tooLong: `A signature line holds ${SIGNATURE_LINE_MAX} characters at most.`,
} as const

/** What the row keeps: the title, null for none, and the free lines, trimmed, with no empty line, two at most. */
export interface SignatureKept {
  title: string | null
  lines: string[]
}

/** The card's boxes: the title and the two lines, each as typed. `lines` always holds `SIGNATURE_FREE_LINES_MAX` entries. */
export interface SignatureDraft {
  title: string
  lines: string[]
}

/** The free lines as the row holds them: strings, trimmed, the empty ones out, the first two kept. Anything else is none. */
export function freeLinesOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, SIGNATURE_FREE_LINES_MAX)
}

/** The card's boxes from what is kept: the title or blank, and two lines, blank where none is kept. */
export function signatureDraftFrom(kept: SignatureKept): SignatureDraft {
  return { title: kept.title ?? '', lines: Array.from({ length: SIGNATURE_FREE_LINES_MAX }, (_, i) => kept.lines[i] ?? '') }
}

/** What the boxes save: the title trimmed, or null when blank; the lines trimmed, the blank ones out. */
export function signatureKeptOf(draft: SignatureDraft): SignatureKept {
  const title = draft.title.trim()
  return { title: title || null, lines: freeLinesOf(draft.lines) }
}

/** Why the draft cannot save, in words, or null: a title or a line past `SIGNATURE_LINE_MAX`. */
export function signatureDraftProblem(draft: SignatureDraft): string | null {
  return [draft.title, ...draft.lines].some((l) => l.trim().length > SIGNATURE_LINE_MAX) ? SIGNATURE_WORDS.tooLong : null
}

/** Whether two kept signatures are the same, so Save lights only on a change. */
export function sameSignature(a: SignatureKept, b: SignatureKept): boolean {
  return a.title === b.title && a.lines.length === b.lines.length && a.lines.every((l, i) => l === b.lines[i])
}
