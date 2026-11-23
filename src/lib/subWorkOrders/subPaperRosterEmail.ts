/**
 * A sub's address for their papers, added where it is needed (punch list #350): the send step's own To line.
 *
 * `send-sub-paper-email` mails a paper to the roster's own address for the person, `people.email`, and nowhere
 * else. A sub with none had a dead press and no door: the roster's edit is not drawn for a person tied to a login
 * row, and every sub is. The office roles who send a paper may already write that row, so the To line takes the
 * address in place and saves it there. The function is not changed and still reads the roster itself.
 *
 * A sub who signs in has an address on their login. It is offered, never used unasked: a paper goes only to an
 * address somebody put on the roster row.
 *
 * Pure: no React, no Supabase.
 */

/** The shape `send-sub-paper-email` asks of an address before it sends. One rule, so the line keeps nothing the function would refuse. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Why a typed address cannot be kept, or null when it can. */
export function rosterEmailCheck(draft: string): string | null {
  return EMAIL_SHAPE.test(draft.trim()) ? null : 'That does not look like an email. It needs a name, an @ and a place, like name@example.com.'
}

/** The To line's words for the address: the roster's own, or that there is none. */
export function rosterEmailText(email: string | null): string {
  return email ?? 'no email on the roster'
}

/**
 * The sign-in address to offer for a sub with none on the roster: the words that say whose it is, and the press
 * that puts it on the row. Null when the roster has an address, or the login has none worth offering.
 */
export function rosterEmailOffer(i: { rosterEmail: string | null; loginEmail: string | null | undefined }): { email: string; words: string; label: string } | null {
  if (i.rosterEmail) return null
  const email = (i.loginEmail ?? '').trim()
  if (!EMAIL_SHAPE.test(email)) return null
  return { email, words: `They sign in as ${email}.`, label: `Put ${email} on their roster row` }
}

/** What the line says when the roster row took no change: the save came back with no row. */
export const ROSTER_EMAIL_NOT_KEPT = 'Their roster row was not changed. Your account may not edit it.'
