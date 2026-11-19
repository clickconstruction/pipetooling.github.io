/**
 * Sending a person's paper to sign: the rules the Send for signature window runs on, wherever it is mounted (People →
 * Contracts, and Documents → Agreements since punch list #376's second train). Who the email goes to by default, who it
 * is from, what an address must look like, and what the app says once the send comes back. Pure: no React, no supabase.
 * The calls are `personPaperSendIo.ts`; the window is `components/contracts/ContractSendWindow.tsx`.
 */

/** A roster row as far as a send needs it. */
export type SendRosterPerson = { id: string; name: string | null; email: string | null }
/** A login row as far as a send needs it. */
export type SendRosterUser = { id: string; name: string | null; email: string | null }

/** How long a signing link works, in days: `send-contract-for-signature` mints it for this long. */
export const PERSON_PAPER_LINK_DAYS = 14

/** The address the window opens on: the roster's for that name, else a login's of that name, else none. */
export function rosterEmailForName(personName: string, people: ReadonlyArray<SendRosterPerson>, users: ReadonlyArray<SendRosterUser>): string {
  const wanted = personName.trim()
  if (!wanted) return ''
  const fromPeople = people.find((p) => (p.name ?? '').trim() === wanted)?.email
  if (fromPeople?.trim()) return fromPeople.trim()
  const fromUsers = users.find((u) => (u.name ?? '').trim() === wanted)?.email
  return fromUsers?.trim() ?? ''
}

/**
 * The one roster person a name finds, or null when it finds none or more than one: the send function files the sent
 * copy and reads the portal address the same way, so the preview shows the portal band only when the email will.
 */
export function onePersonIdForName(personName: string, people: ReadonlyArray<SendRosterPerson>): string | null {
  const wanted = personName.trim()
  if (!wanted) return null
  const matches = people.filter((p) => (p.name ?? '').trim() === wanted)
  return matches.length === 1 ? matches[0]!.id : null
}

/** The staff member pressing send, for the preview's Reply-To and reach line; null with no address on their login. */
export function sendWindowSender(currentUserId: string | null | undefined, users: ReadonlyArray<SendRosterUser>): { name: string; email: string } | null {
  const me = currentUserId ? users.find((u) => u.id === currentUserId) : undefined
  return me?.email ? { name: (me.name ?? '').trim(), email: me.email.trim() } : null
}

/** Why an address cannot be sent to, in the window's words; null when it can. */
export function signerEmailRefusal(email: string): string | null {
  const typed = email.trim()
  if (!typed) return 'Enter a valid signer email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) return 'Enter a valid email address.'
  return null
}

/** What `send-contract-for-signature` answered, as the app keeps it. */
export type PersonPaperSendResult = {
  /** The signing link. The email carries it; in link mode it is the office's to hand on. */
  acceptUrl: string | null
  emailed: boolean
  /** Why no email went, when the link was made and the mail was not. */
  emailNote: string | null
}

/** The toast after a send from the window: the email went, or the link is ready and the mail did not go. */
export function sentToastWords(result: PersonPaperSendResult): { words: string; tone: 'success' | 'info' } {
  if (result.emailed) return { words: 'Signing link emailed.', tone: 'success' }
  if (result.emailNote) return { words: `Link ready${result.acceptUrl ? ` — ${result.acceptUrl}` : ''}`, tone: 'info' }
  return { words: 'Signing link created.', tone: 'info' }
}
