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

export type LienSignerUser = { id: string; name: string | null; notes?: string | null; phone?: string | null }

export function lienSignerNameFor(users: ReadonlyArray<LienSignerUser>, masterUserId: string | null, sessionName: string): string {
  const session = sessionName.trim()
  if (!masterUserId) return session
  const row = users.find((u) => u.id === masterUserId)
  return row?.notes?.trim() || row?.name?.trim() || session
}

export function lienSignerPhoneFor(users: ReadonlyArray<LienSignerUser>, masterUserId: string | null, letterheadPhone: string | null | undefined): string {
  const fallback = (letterheadPhone ?? '').trim()
  if (!masterUserId) return fallback
  const row = users.find((u) => u.id === masterUserId)
  return row?.phone?.trim() || fallback
}

/** What the fills card says `{{phone}}` is — the signer's own number when he has one. */
export const SIGNER_PHONE_FILL_WORDS = "the signer's own phone, or the letterhead's when he has none"
