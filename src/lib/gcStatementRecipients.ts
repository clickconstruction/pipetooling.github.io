/**
 * The statement email's header, as one list of people (GC Review → Send →
 * *Email statement to <GC>*, v2.4262). The window used to draw nine teammate
 * pills over a To box and eight more over a CC box, with "Replies go to"
 * as a list under the portal tick; a pill on To replaced the address, the
 * same pill on CC toggled it, and the copy the reply choice adds to the CC
 * was never shown. Now the three lines share one menu built here — the GC's
 * own contact people first, then the office — and one sentence reads the
 * send back before it goes.
 *
 * The state stays what the send functions take: one To address, the CC as
 * text (`gcStatementCc.ts` parses it), a reply-to user id. This kernel only
 * decides who is on the menu, which rows are picked or held, and what the
 * sentence says.
 */
import { GC_STATEMENT_CC_MAX } from './gcStatementCc'
import { canTakeStatementReplies, resolveStatementReplyTo, type ReplyToPerson } from './gcStatementReplyTo'
import { OFFICE_CAPABLE_ROLES } from './teammateEmailChips'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RecipientGroup = 'gc' | 'office' | 'typed'

export type RecipientPerson = {
  /** Lower-cased email — the identity a To or CC line holds. */
  email: string
  name: string
  group: RecipientGroup
  /** A short word beside the row: *main address*, *gets bill copies*, *account man*, *you*. */
  tag?: string
  /** Office people only: the `users.id` the reply-to takes. */
  userId?: string
  role?: string
}

export type RecipientUser = { id: string; name: string; email: string | null; role: string }

export type GcContactPerson = { name: string; email: string | null; gets_bill_copies?: boolean | null }

export const RECIPIENT_GROUP_LABELS: Record<RecipientGroup, (gcName: string) => string> = {
  gc: (gcName) => `At ${gcName}`,
  office: () => 'Our office',
  typed: () => 'Typed',
}

function norm(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/** True for an address the send functions accept. */
export function isEmailAddress(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/**
 * Everyone the menu offers: the GC's main address and its contact people
 * (`customer_contact_persons`, those with an address, the main address not
 * repeated), then the office roles that already served as pills. The signed-in
 * person is tagged *you* and the GC's account man *account man*. Typed
 * addresses are added by `withTypedAddress` as they are used.
 */
export function buildRecipientPeople(input: {
  gcName: string
  gcEmail: string | null | undefined
  contacts: readonly GcContactPerson[]
  users: readonly RecipientUser[]
  meId: string | null | undefined
  accountManId: string | null | undefined
}): RecipientPerson[] {
  const out: RecipientPerson[] = []
  const seen = new Set<string>()
  const gcName = input.gcName.trim() || 'GC'
  const main = norm(input.gcEmail)
  if (main && EMAIL_RE.test(main)) {
    seen.add(main)
    out.push({ email: main, name: gcName, group: 'gc', tag: 'main address' })
  }
  for (const c of input.contacts) {
    const e = norm(c.email)
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) continue
    seen.add(e)
    out.push({ email: e, name: c.name.trim() || e, group: 'gc', tag: c.gets_bill_copies ? 'gets bill copies' : 'contact' })
  }
  const office = input.users
    .filter((u) => (OFFICE_CAPABLE_ROLES as readonly string[]).includes(u.role) && EMAIL_RE.test(norm(u.email)))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const u of office) {
    const e = norm(u.email)
    if (seen.has(e)) continue
    seen.add(e)
    const tag = u.id === input.meId ? 'you' : u.id === input.accountManId ? 'account man' : undefined
    out.push({ email: e, name: u.name.trim() || e, group: 'office', ...(tag ? { tag } : {}), userId: u.id, role: u.role })
  }
  return out
}

/** The person behind an address on a line; a typed address nobody on the menu owns becomes its own row. */
export function personForEmail(people: readonly RecipientPerson[], email: string): RecipientPerson | null {
  const e = norm(email)
  if (!e) return null
  return people.find((p) => p.email === e) ?? (EMAIL_RE.test(e) ? { email: e, name: e, group: 'typed' } : null)
}

/** The menu with a typed address kept on it once used, so it can be taken off and put back like anyone else. */
export function withTypedAddress(people: readonly RecipientPerson[], email: string): RecipientPerson[] {
  const e = norm(email)
  if (!e || !EMAIL_RE.test(e) || people.some((p) => p.email === e)) return [...people]
  return [...people, { email: e, name: e, group: 'typed' }]
}

/** The rows a search leaves: a name or an address that contains the words typed. */
export function filterRecipientPeople(people: readonly RecipientPerson[], query: string): RecipientPerson[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...people]
  return people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q))
}

/** A typed address the menu can offer as *Use …*: email-shaped and not already a row. */
export function typedAddressOffer(people: readonly RecipientPerson[], query: string): string | null {
  const e = norm(query)
  if (!EMAIL_RE.test(e) || people.some((p) => p.email === e)) return null
  return e
}

export type RecipientRowState = {
  person: RecipientPerson
  /** On the line already. */
  picked: boolean
  /** Cannot be picked from this line, with the reason. */
  held: string | null
}

/**
 * How each menu row reads on a line. To is one pick, so a row on the CC is
 * offered with a note; the CC greys whoever is on To, and the sender's copy
 * the reply choice adds is shown ticked and held.
 */
export function recipientRowsForLine(
  line: 'to' | 'cc',
  people: readonly RecipientPerson[],
  state: { toEmail: string; ccEmails: readonly string[]; lockedCopyEmail: string | null },
): RecipientRowState[] {
  const to = norm(state.toEmail)
  const cc = new Set(state.ccEmails.map(norm))
  return people.map((person) => {
    if (line === 'to') return { person, picked: person.email === to, held: null }
    if (person.email === to) return { person, picked: false, held: 'on To' }
    if (person.email === state.lockedCopyEmail) return { person, picked: true, held: 'copied by Reply to' }
    return { person, picked: cc.has(person.email), held: null }
  })
}

/** The office people who can take the GC's reply, the signed-in person first. */
export function replyTakers(users: readonly RecipientUser[], meId: string): RecipientUser[] {
  return users
    .filter((u) => canTakeStatementReplies(u))
    .slice()
    .sort((a, b) => Number(b.id === meId) - Number(a.id === meId) || a.name.localeCompare(b.name))
}

/**
 * The address the reply choice copies at send, when it copies one: the
 * sender's, when replies go to someone else and she is not on To or the CC
 * already. Read off the same rule the send function runs, so the line shows
 * exactly what will happen.
 */
export function lockedCopyEmail(input: { sender: ReplyToPerson; replyToPerson: ReplyToPerson | null; toEmail: string; ccEmails: readonly string[] }): string | null {
  const r = resolveStatementReplyTo({ sender: input.sender, replyToPerson: input.replyToPerson, toEmail: input.toEmail, ccEmails: input.ccEmails, ccMax: GC_STATEMENT_CC_MAX })
  if (!r.ok || !r.onBehalf || r.cc.length === input.ccEmails.length) return null
  return r.cc[r.cc.length - 1] ?? null
}

/** Adding one more to the CC: refused past the cap, with the words the line shows. */
export function ccAddRefusal(ccCount: number): string | null {
  return ccCount >= GC_STATEMENT_CC_MAX ? `Up to ${GC_STATEMENT_CC_MAX} on the Cc line.` : null
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * One sentence under the header that says the send back, in plain words:
 * *Goes to RMC- Dudley Mason. Their reply goes to Malachi. You get a copy.*
 */
export function recipientReadback(input: {
  toName: string | null
  replyToName: string
  replyIsMe: boolean
  ccNames: readonly string[]
  /** True when the reply choice copies the sender. */
  copiesMe: boolean
  scheduled: boolean
}): string {
  if (!input.toName) return 'Pick who gets the statement. It cannot send without a To.'
  const parts = [`Goes to ${input.toName}.`]
  parts.push(input.replyIsMe ? 'Their reply comes to you.' : `Their reply goes to ${input.replyToName}.`)
  const copies = [...input.ccNames]
  if (input.copiesMe) copies.push('you')
  if (copies.length) {
    const first = copies[0] === 'you' ? 'You' : copies[0]!
    const single = copies.length === 1 && copies[0] !== 'you'
    parts.push(`${joinNames([first, ...copies.slice(1)])} ${single ? 'gets' : 'get'} a copy.`)
  }
  if (input.scheduled) parts.push('A scheduled send is rebuilt fresh when it goes out.')
  return parts.join(' ')
}
