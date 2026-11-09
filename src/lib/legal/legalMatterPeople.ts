/**
 * The people on a legal matter (punch list #174, v2.6705). A matter involves more people than the customer record
 * holds: the GC's president and billing contact, the owner of record, a tenant, an inspector, counsel. On job 891 their
 * addresses lived in the narrative, and the one address the record knew bounced with nothing recording the bounce.
 * This kernel reads the stored rows (`legal_matter_people`), seeds the first ones from the packet's account (the
 * customer record, its contact persons, each property's owner of record), checks a draft the way the RPC does, and
 * picks a letter's recipients: *letters* is a To, *copies* a copy, *never* cannot be picked and says why. Pure.
 */
import type { LegalPacket } from './legalPacket'

export const LEGAL_PERSON_ROLES = ['customer', 'president', 'billing', 'field', 'owner', 'tenant', 'inspector', 'agency', 'supplier', 'counsel', 'witness', 'other'] as const
export type LegalPersonRole = (typeof LEGAL_PERSON_ROLES)[number]

export const LEGAL_PERSON_USES = ['letters', 'copies', 'never'] as const
export type LegalPersonUse = (typeof LEGAL_PERSON_USES)[number]

export type LegalPersonSeededFrom = 'customer' | 'contact_person' | 'property'

export const LEGAL_PERSON_NAME_MAX = 160
export const LEGAL_PERSON_REASON_MAX = 300

export function isPersonRole(raw: unknown): raw is LegalPersonRole {
  return typeof raw === 'string' && (LEGAL_PERSON_ROLES as readonly string[]).includes(raw)
}
export function isPersonUse(raw: unknown): raw is LegalPersonUse {
  return typeof raw === 'string' && (LEGAL_PERSON_USES as readonly string[]).includes(raw)
}

/** The role as the list and the form word it. */
export function personRoleWords(role: LegalPersonRole): string {
  switch (role) {
    case 'customer': return 'the customer'
    case 'president': return 'their president'
    case 'billing': return 'their billing'
    case 'field': return 'their field contact'
    case 'owner': return 'owner of record'
    case 'tenant': return 'tenant'
    case 'inspector': return 'inspector'
    case 'agency': return 'agency'
    case 'supplier': return 'supplier'
    case 'counsel': return 'our counsel'
    case 'witness': return 'witness'
    default: return 'other'
  }
}

/** The use as the list words it; a *never* carries its reason. */
export function personUseWords(use: LegalPersonUse, reason: string): string {
  if (use === 'letters') return 'letters'
  if (use === 'copies') return 'copies'
  return reason.trim() ? `never — ${reason.trim()}` : 'never'
}

/** Where a seeded row came from, for the quiet line under the name. */
export function seededFromWords(from: LegalPersonSeededFrom | null): string {
  if (from === 'customer') return 'seeded from the customer record'
  if (from === 'contact_person') return 'seeded from the customer’s contacts'
  if (from === 'property') return 'seeded from the property record'
  return ''
}

/** A stored row as the list reads it (`legal_matter_people`, live rows only). */
export type LegalMatterPersonRow = {
  id: string
  name: string
  role: string
  organization: string
  email: string
  phone: string
  mailing_address: string
  use: string
  reason: string
  seeded_from: string | null
  added_at: string
}

/** One person as the desk and the letters carry them. */
export type LegalMatterPersonLike = {
  id: string
  name: string
  role: LegalPersonRole
  organization: string
  email: string
  phone: string
  mailingAddress: string
  use: LegalPersonUse
  reason: string
  seededFrom: LegalPersonSeededFrom | null
}

const seededOf = (raw: string | null): LegalPersonSeededFrom | null => (raw === 'customer' || raw === 'contact_person' || raw === 'property' ? raw : null)

/** The stored rows as people, in the order they were added; an unknown role reads as *other*, an unknown use as *copies*. */
export function peopleFromRows(rows: ReadonlyArray<LegalMatterPersonRow>): LegalMatterPersonLike[] {
  return rows
    .slice()
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      role: isPersonRole(r.role) ? r.role : 'other',
      organization: r.organization ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
      mailingAddress: r.mailing_address ?? '',
      use: isPersonUse(r.use) ? r.use : 'copies',
      reason: r.reason ?? '',
      seededFrom: seededOf(r.seeded_from),
    }))
}

/** How to reach them, as the list's Reach cell: the email, else the phone, else the mailing address. */
export function reachWords(p: Pick<LegalMatterPersonLike, 'email' | 'phone' | 'mailingAddress'>): string {
  return p.email.trim() || p.phone.trim() || p.mailingAddress.trim() || 'no way to reach them on file'
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export type LegalPersonDraft = { name: string; role: LegalPersonRole; organization: string; email: string; phone: string; mailingAddress: string; use: LegalPersonUse; reason: string }

export function emptyPersonDraft(role: LegalPersonRole = 'billing'): LegalPersonDraft {
  return { name: '', role, organization: '', email: '', phone: '', mailingAddress: '', use: role === 'witness' || role === 'inspector' ? 'never' : 'letters', reason: '' }
}

export function personDraftOf(p: LegalMatterPersonLike): LegalPersonDraft {
  return { name: p.name, role: p.role, organization: p.organization, email: p.email, phone: p.phone, mailingAddress: p.mailingAddress, use: p.use, reason: p.reason }
}

/** Why a person cannot be saved as typed; null when they can. The RPC holds the same rules. */
export function personDraftProblem(draft: LegalPersonDraft): string | null {
  if (!draft.name.trim()) return 'Name the person.'
  if (draft.name.trim().length > LEGAL_PERSON_NAME_MAX) return `Keep the name under ${LEGAL_PERSON_NAME_MAX} characters.`
  if (!isPersonRole(draft.role)) return 'Pick what they are to the matter.'
  if (!isPersonUse(draft.use)) return 'Pick how letters use them.'
  if (draft.use === 'never' && !draft.reason.trim()) return 'Say why letters never go to them.'
  if (draft.reason.trim().length > LEGAL_PERSON_REASON_MAX) return `Keep the reason under ${LEGAL_PERSON_REASON_MAX} characters.`
  return null
}

// ---------------------------------------------------------------------------
// The seed
// ---------------------------------------------------------------------------

/** A row the seed sends (`legal_matter_people_seed`'s jsonb), the database's column names. */
export type LegalPersonSeedRow = { name: string; role: LegalPersonRole; organization: string; email: string; phone: string; mailing_address: string; use: LegalPersonUse; reason: string; seeded_from: LegalPersonSeededFrom }

/**
 * The people the record already knows, as the first rows of the list: the payer itself (its first email and phone,
 * its address; a letter's To), each contact person on the customer (letters), and each property's owner of record
 * with their mailing address (copies). A payer that is a name only still seeds its row, so the letter has a To.
 */
export function seedPeople(account: Pick<LegalPacket['account'], 'payer' | 'customerAddress' | 'contacts' | 'emails' | 'phones' | 'properties'>): LegalPersonSeedRow[] {
  const out: LegalPersonSeedRow[] = []
  const seen = new Set<string>()
  const push = (row: LegalPersonSeedRow) => {
    const key = `${row.name.trim().toLowerCase()}|${row.email.trim().toLowerCase()}`
    if (!row.name.trim() || seen.has(key)) return
    seen.add(key)
    out.push(row)
  }
  push({ name: account.payer.name, role: 'customer', organization: account.payer.name, email: account.emails[0] ?? '', phone: account.phones[0] ?? '', mailing_address: account.customerAddress, use: 'letters', reason: '', seeded_from: 'customer' })
  for (const c of account.contacts) {
    push({ name: c.name, role: 'billing', organization: account.payer.name, email: c.email ?? '', phone: c.phone ?? '', mailing_address: '', use: 'letters', reason: '', seeded_from: 'contact_person' })
  }
  for (const p of account.properties) {
    if (!p.owner.trim()) continue
    push({ name: p.owner, role: 'owner', organization: '', email: '', phone: '', mailing_address: p.ownerMailingAddress, use: 'copies', reason: '', seeded_from: 'property' })
  }
  return out
}

// ---------------------------------------------------------------------------
// A letter's recipients
// ---------------------------------------------------------------------------

/** One chip of a letter's picker: a To, a copy, or a row that refuses with why. */
export type LetterRecipient = { person: LegalMatterPersonLike; label: string; refused: string | null }

export type LetterRecipients = { to: LetterRecipient[]; copies: LetterRecipient[]; never: LetterRecipient[] }

/** The chip's words: the name, then their role, like *R. Calloway · their president*. */
export function recipientLabel(p: Pick<LegalMatterPersonLike, 'name' | 'role'>): string {
  return `${p.name} · ${personRoleWords(p.role)}`
}

/** Why a row cannot be picked: a *never* says its reason; a To with no email and no address has nowhere to go. */
export function recipientRefusal(p: LegalMatterPersonLike): string | null {
  if (p.use === 'never') return p.reason.trim() ? `never — ${p.reason.trim()}` : 'never'
  if (!p.email.trim() && !p.mailingAddress.trim()) return 'no email or mailing address on file'
  return null
}

/** The letter's picker from the matter's people: the To rows, the copies, and the rows that refuse. */
export function letterRecipients(people: ReadonlyArray<LegalMatterPersonLike>): LetterRecipients {
  const out: LetterRecipients = { to: [], copies: [], never: [] }
  for (const person of people) {
    const row: LetterRecipient = { person, label: recipientLabel(person), refused: recipientRefusal(person) }
    if (person.use === 'never') out.never.push(row)
    else if (person.use === 'letters') out.to.push(row)
    else out.copies.push(row)
  }
  return out
}

/** The words under the picker when the list refuses some: *legal@… can't be picked — bounces.* */
export function refusedWords(rows: ReadonlyArray<LetterRecipient>): string[] {
  return rows.filter((r) => r.refused).map((r) => `${r.person.name} cannot be picked: ${r.refused}.`)
}

/** One copy of a letter as the letter's *Copies to* line reads it (v2.6741): the person, the role in words, where. */
export type LetterCopy = { personId: string; name: string; role: string; address: string }

/** The letter's copies from the matter's people: every row marked *copies*, in the list's order; a *never* and a To are not copies. */
export function letterCopies(people: ReadonlyArray<LegalMatterPersonLike>): LetterCopy[] {
  return people.filter((p) => p.use === 'copies').map((p) => ({ personId: p.id, name: p.name, role: personRoleWords(p.role), address: p.mailingAddress }))
}

export const PEOPLE_EMPTY_WORDS = 'Nobody on the matter yet. Add the people the record knows, or add a person.'
export const PEOPLE_SEED_LABEL = 'Add the people the record knows'
