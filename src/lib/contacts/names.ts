/**
 * Messages, cut 1 (the spine): what a contact is called, split from `kernel.ts` (which re-exports it) so the Quo edge
 * functions can name a line by the same rule. Nothing here imports, so the edge copy (`scripts/edge-kernels.mjs`) holds
 * it whole. Lifted from the Messages prototype v1.178 (`firstName`, `initials`, `kindWord`).
 */

export type ContactKind = 'customer' | 'trade' | 'arch' | 'lead' | 'supply_house' | 'candidate' | 'sub' | 'team' | 'unknown'

const TITLE = /^(Dr|Mr|Mrs|Ms)\.?$/i

/**
 * What a greeting calls a full name: the first name, or a title with the last name ("Dr. Priya Raman" is "Dr. Raman",
 * the Board's rule). '' for no name. Owner Billing's `customerGreeting` reads the same rule.
 */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const titled = words.length > 1 && TITLE.test(words[0]!)
  return titled ? `${words[0]} ${words[words.length - 1]}` : words[0]!
}

/**
 * What we call them, in a greeting and in a sentence: what they go by, else `greetingName`, so a title on the record is
 * never dropped. '' for a number nobody has named; a sentence says "they" there.
 */
export function firstName(c: { name: string; goesBy?: string | null; kind?: ContactKind }): string {
  const goesBy = c.goesBy?.trim()
  if (goesBy) return goesBy
  if (c.kind === 'unknown') return ''
  return greetingName(c.name)
}

/** The face's two letters, a title skipped: "PR" for Dr. Priya Raman. "?" for a number nobody has named. */
export function initials(c: { name: string; kind?: ContactKind }): string {
  if (c.kind === 'unknown') return '?'
  return c.name
    .split(/\s+/)
    .filter((w) => w && !TITLE.test(w))
    .map((w) => w[0]!)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const KIND_WORD: Record<ContactKind, string> = {
  customer: 'customer',
  trade: 'trade partner',
  arch: 'architect',
  lead: 'lead',
  supply_house: 'supply house',
  candidate: 'candidate',
  sub: 'sub',
  team: 'teammate',
  unknown: 'who is this?',
}

/** "trade partner": what they are to us, for the line under a name. */
export function kindWord(kind: ContactKind): string {
  return KIND_WORD[kind]
}
