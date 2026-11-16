/**
 * Who signs the lien paper, and the number the owner is told to call (pure).
 *
 * The signer is the job's master — his "Full name and title" (`users.notes`)
 * or his name — else the person at the keyboard. Counsel (2026-09-22, answer
 * 7): "Master plumber signs and is the callback. That is the persuasive
 * signature, not an officer's." So `{{phone}}` on the cover letters is the
 * signer's OWN phone (`users.phone`, v2.3753), and only when he has none the
 * letterhead's number (Settings → Company), as it was before.
 */

export type LienSignerUser = { id: string; name: string | null; notes?: string | null; phone?: string | null; role?: string | null }

export function lienSignerNameFor(users: ReadonlyArray<LienSignerUser>, masterUserId: string | null, sessionName: string): string {
  const session = sessionName.trim()
  if (!masterUserId) return session
  const row = users.find((u) => u.id === masterUserId)
  return row?.notes?.trim() || row?.name?.trim() || session
}

/**
 * The name a signature carries on a lien notice (v2.7395, Taunya's ask of 2026-11-15): his full name, not the short
 * name on his account. A leader's is his "Full name and title" (`users.notes`) up to the first comma — "Malachi
 * Whites" from "Malachi Whites, Master Plumber (#RMP41130)" — else his account name. A dev's is his account name,
 * since a dev's notes are not a title line. The waiver's rule (`lienWaiverSignerName`, v2.5231), and the database's
 * (`sign_lien_desk_item_with_code`, `check_lien_sign_code`). '' when the row has no name at all.
 */
export function lienSignatureName(u: Pick<LienSignerUser, 'name' | 'notes' | 'role'>): string {
  const named = (u.name ?? '').trim()
  if (u.role === 'dev') return named
  return ((u.notes ?? '').trim() || named).replace(/,.*$/, '').trim() || named
}

/** `lienSignatureName` for one user of the desk's list; `fallback` when he is not on it or has no name. */
export function lienSignatureNameFor(users: ReadonlyArray<LienSignerUser>, userId: string | null, fallback: string): string {
  const row = userId ? users.find((u) => u.id === userId) : null
  return (row ? lienSignatureName(row) : '') || fallback.trim()
}

export function lienSignerPhoneFor(users: ReadonlyArray<LienSignerUser>, masterUserId: string | null, letterheadPhone: string | null | undefined): string {
  const fallback = (letterheadPhone ?? '').trim()
  if (!masterUserId) return fallback
  const row = users.find((u) => u.id === masterUserId)
  return row?.phone?.trim() || fallback
}

/** What the fills card says `{{phone}}` is — the signer's own number when he has one. */
export const SIGNER_PHONE_FILL_WORDS = "the signer's own phone, or the letterhead's when he has none"
