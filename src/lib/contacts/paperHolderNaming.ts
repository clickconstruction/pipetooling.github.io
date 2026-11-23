/**
 * Naming a contact that holds a paper (punch list #403, the owner's second decision of 2026-11-22). Messages' *Who is
 * this?* is the whole office team's, an estimator among them, and a paper follows its contact. So the database keeps
 * the naming of a contact that holds a paper to the office's four roles: a dev, a leader, an assistant and the
 * controller (`20261123184149_estimator_reach.sql`, the guard `paper_holder_named_by_office` on `contacts` and the
 * refusal in `contacts_fold_papers`). Anyone else is refused with the code and the sentence below.
 *
 * Nobody signed in may ask whether a contact holds a paper, so the screen cannot know before the press. It presses,
 * and reads the refusal here. A contact that holds no paper is named as before.
 */

/** The database's code for the refusal (`RAISE EXCEPTION 'officeNamesPaperHolder'`). */
export const PAPER_HOLDER_NAMING_CODE = 'officeNamesPaperHolder'

/** The database's own sentence, word for word: the migration's `DETAIL`. `paperHolderNaming.test.ts` holds the two equal. */
export const PAPER_HOLDER_NAMING_REASON = 'They hold a paper, so only the office says who they are.'

/** What the person refused does next. */
export const PAPER_HOLDER_NAMING_NEXT = 'Ask a leader, an assistant or the controller to name them.'

/** What the screen says: the reason, then the next step. */
export const PAPER_HOLDER_NAMING_WORDS = `${PAPER_HOLDER_NAMING_REASON} ${PAPER_HOLDER_NAMING_NEXT}`

function wordsOf(e: unknown): string[] {
  if (typeof e === 'string') return [e]
  if (e == null || typeof e !== 'object') return []
  const o = e as { message?: unknown; details?: unknown; serverMessage?: unknown }
  return [o.message, o.details, o.serverMessage].filter((v): v is string => typeof v === 'string')
}

/**
 * The words for a failed naming when it is this refusal, else null: the caller then says the failure as it would any
 * other. Reads the code from the error's message, its details or the server's own message, so it finds it on a
 * `DatabaseError`, on a plain Supabase error and on a string.
 */
export function paperHolderNamingRefusal(e: unknown): string | null {
  return wordsOf(e).some((w) => w.includes(PAPER_HOLDER_NAMING_CODE)) ? PAPER_HOLDER_NAMING_WORDS : null
}
