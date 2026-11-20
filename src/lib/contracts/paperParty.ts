/**
 * Where an outside signer lives (punch list #403): the rules that say what a paper reads for the party it is with.
 *
 * A paper is with a **party** and is signed by a **signer**, and they are two things. The party is a record: a
 * customer, a supply house, a trade company, or someone on no list yet. The paper points at the party's contact
 * (`person_contract_documents.party_contact_id`, a `contacts` row) and is filed under a name no person can have. The
 * signer is a name, a title and an address, kept on the paper as it was sent (`signer_name`, `signer_title`,
 * `signer_email`), with the business they sign for in words (`signing_for`).
 *
 * This kernel answers the words: the kinds the `agreements_on_file` view gives a party's paper, the tag on its line,
 * who signs as the line says it, and the sentence the paper will say. Pure: no React, no supabase. The view is
 * migration `20261120010000_paper_party.sql`; the list's own words are `documents/agreementsLedger.ts`. The words a
 * paper keeps and the stored name's prefix are the send function's own (`_shared/paperSigner.ts`): one copy, read here.
 */
import { PAPER_WORD_MAX, PARTY_PAPER_PREFIX, SIGNER_EMAIL_MAX, isPartyPaperName, paperWord, signerEmailWord } from '../../../supabase/functions/_shared/paperSigner'

export { PAPER_WORD_MAX, PARTY_PAPER_PREFIX, SIGNER_EMAIL_MAX, isPartyPaperName, paperWord, signerEmailWord }

// ── The name a party's paper is filed under ───────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** A party's stored name on its papers. Never shown: the party's own name is. */
export function partyPaperName(contactId: string): string {
  return `${PARTY_PAPER_PREFIX}${contactId}`
}

/** The contact a stored name is for. Null for a person's name, or a stored name that is not well formed. */
export function partyContactIdFromPaperName(name: string | null | undefined): string | null {
  if (!isPartyPaperName(name)) return null
  const id = (name ?? '').slice(PARTY_PAPER_PREFIX.length)
  return UUID.test(id) ? id : null
}

// ── What the party is ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What a party's contact points at today, as the view answers it in `facts.party_kind`: a customer or a person at one,
 * a supply house or a rep, a trade company or a person at one, someone on the roster, some other record (a lead, a
 * candidate), or no record at all.
 */
export type PaperPartyKind = 'customer' | 'supply_house' | 'trade' | 'person' | 'other' | 'none'

const PARTY_KINDS: ReadonlyArray<PaperPartyKind> = ['customer', 'supply_house', 'trade', 'person', 'other', 'none']

/** `facts.party_kind` as a kind, or null when the row is no party's paper. A word the kernel does not know reads `other`. */
export function paperPartyKind(value: unknown): PaperPartyKind | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return (PARTY_KINDS as ReadonlyArray<string>).includes(value) ? (value as PaperPartyKind) : 'other'
}

/** The four kinds `agreements_on_file` gives a party's paper. */
export const PARTY_AGREEMENT_KINDS = ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement'] as const
export type PartyAgreementKind = (typeof PARTY_AGREEMENT_KINDS)[number]

/** True for a row of the view that is a party's paper. */
export function isPartyAgreementKind(kind: string | null | undefined): kind is PartyAgreementKind {
  return (PARTY_AGREEMENT_KINDS as ReadonlyArray<string>).includes(kind ?? '')
}

/** The view's kind for a party, as its SQL decides it: the three records by name, and everyone else outside. */
export function partyAgreementKind(party: PaperPartyKind): PartyAgreementKind {
  if (party === 'customer') return 'customer_agreement'
  if (party === 'supply_house') return 'supply_house_agreement'
  if (party === 'trade') return 'trade_agreement'
  return 'outside_agreement'
}

/** The words on a line's tag. A party the view could not place reads *Outside party*. */
export function paperPartyTag(party: PaperPartyKind | null): string {
  switch (party) {
    case 'customer':
      return 'Customer'
    case 'supply_house':
      return 'Supply house'
    case 'trade':
      return 'Trade company'
    case 'none':
      return 'Not on a list'
    case 'person':
      return 'On the roster'
    default:
      return 'Outside party'
  }
}

/** The tag for a row, from its kind when the facts carry no party: a row read before the party was known. */
export function partyAgreementTag(kind: string, partyKind: unknown): string {
  const party = paperPartyKind(partyKind)
  if (party) return paperPartyTag(party)
  if (kind === 'customer_agreement') return paperPartyTag('customer')
  if (kind === 'supply_house_agreement') return paperPartyTag('supply_house')
  if (kind === 'trade_agreement') return paperPartyTag('trade')
  return paperPartyTag('none')
}

/** Whether **Add to a list** belongs on a line: only a party with no record behind it. Signed or not. */
export function partyNeedsAList(party: PaperPartyKind | null): boolean {
  return party === 'none'
}

// ── Who signs ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Who signs a paper, as the paper keeps them. */
export type PaperSigner = {
  /** Who signs, as the office named them. */
  name?: string | null
  title?: string | null
  /** The business they sign for. None when they sign for themselves. */
  signingFor?: string | null
  /** What the signer typed when they signed. It wins over the office's name once it is there. */
  printedName?: string | null
}

function sameName(a: string | null, b: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

/**
 * The business a signer signs for, from the party and the signer: the party's name, or none when the signer is the
 * party, which is a person signing for themselves.
 */
export function signingForOf(partyName: string | null | undefined, signerName: string | null | undefined): string | null {
  const party = paperWord(partyName)
  if (!party) return null
  return sameName(party, paperWord(signerName)) ? null : party
}

/**
 * Who signs, as a line says it: *Lena Park signs, Branch manager* while the paper waits, and *signed by Dana Ruiz,
 * Project manager* once it is signed. '' with no name to say. A signed line reads the name the signer typed.
 */
export function paperSignerLine(signer: PaperSigner, signed: boolean): string {
  const title = paperWord(signer.title)
  const name = signed ? (paperWord(signer.printedName) ?? paperWord(signer.name)) : paperWord(signer.name)
  if (!name) return ''
  const who = signed ? `signed by ${name}` : `${name} signs`
  return title ? `${who}, ${title}` : who
}

/**
 * What the paper says about its signer: *Lena Park, Branch manager, signing for Tallgrass Supply Co.* A signer with no
 * business signs for themselves: *Pat Tallman*. '' with no name.
 */
export function paperSaysLine(signer: PaperSigner): string {
  const name = paperWord(signer.name)
  if (!name) return ''
  const parts = [name]
  const title = paperWord(signer.title)
  if (title) parts.push(title)
  const business = paperWord(signer.signingFor)
  if (business && !sameName(business, name)) parts.push(`signing for ${business}`)
  return parts.join(', ')
}

/** *signing for Juniper Mechanical LLC*, the tail a person's own paper carries; '' when they sign for themselves. */
export function signingForTail(signer: PaperSigner): string {
  const business = paperWord(signer.signingFor)
  if (!business || sameName(business, paperWord(signer.name))) return ''
  return `signing for ${business}`
}

/** A row's signer, read from the view's `facts`. */
export function paperSignerFromFacts(facts: Record<string, unknown> | null | undefined): PaperSigner {
  const read = (key: string): string | null => {
    const v = facts && typeof facts === 'object' ? facts[key] : undefined
    return typeof v === 'string' ? paperWord(v) : null
  }
  return { name: read('signer_name'), title: read('signer_title'), signingFor: read('signing_for'), printedName: read('signer_printed_name') }
}
