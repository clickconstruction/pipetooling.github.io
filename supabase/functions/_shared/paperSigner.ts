/**
 * Who signs a paper, as the paper keeps them (punch list #403). A send writes the signer on the paper's own row:
 * `signer_name`, `signer_title` and `signer_email` of `person_contract_documents`. This is the one place the app and
 * the send function shape those words, so the window's boxes and the function's write never disagree. The table's
 * check (`person_contract_documents_party_words`) refuses an empty word and an address with no `@`, so a word is
 * trimmed text or null. Dependency-free: the app imports it straight from here.
 */
import { isCompanyPaperName } from './companyPaper.ts'

/** The longest a name, a title or a business may be, as the table's check holds it. */
export const PAPER_WORD_MAX = 200
/** The longest an address may be. */
export const SIGNER_EMAIL_MAX = 320

/** The start of a party's stored name: `party:<contact id>`. The database holds the shape both ways. */
export const PARTY_PAPER_PREFIX = 'party:'

/** True for a party's paper: its stored name starts with the prefix. A person's name never does. */
export function isPartyPaperName(name: string | null | undefined): boolean {
  return (name ?? '').startsWith(PARTY_PAPER_PREFIX)
}

/** A word as the paper keeps it: trimmed, inner spaces single, and null when nothing is left. */
export function paperWord(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const word = value.replace(/\s+/g, ' ').trim()
  return word ? word.slice(0, PAPER_WORD_MAX) : null
}

/** An address as the paper keeps it: trimmed, and null when it is none. */
export function signerEmailWord(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (email.length < 3 || email.length > SIGNER_EMAIL_MAX || email.indexOf('@') < 1) return null
  return email
}

/** What the office posts about who signs, beside the request's own fields. */
export interface SignerRequestBody {
  signer_name?: unknown
  signer_title?: unknown
  /** The business a party's signer signs for. Named only for a party's paper; sent as nothing, it clears. */
  signing_for?: unknown
}

/** The paper's row as far as the signer's write reads it. */
export interface SignerRow {
  /** The name the paper is filed under: a person's, or a stored name no person can have. */
  person_name: string
  signer_name: string | null
}

/**
 * The name a paper's signer takes when the office named nobody: the person the paper is filed under. A trade company's
 * paper and a party's are filed under a stored name, which is never a signer's.
 */
export function filedSignerName(personName: string | null | undefined): string | null {
  if (isCompanyPaperName(personName) || isPartyPaperName(personName)) return null
  return paperWord(personName)
}

/**
 * The signer columns one send writes on the paper's row.
 *
 * An emailed send keeps the address the link went to, the name and the title: the name as the office typed it, else
 * the one the row already holds, else the person the paper is filed under. A request that names no title leaves the
 * row's alone, so an older window never wipes one; a title sent as nothing clears it. The business they sign for is
 * kept the same way, and only a party's send names one.
 *
 * A link made to hand over (nothing emailed) has no address to keep. It only gives a paper with no signer the person
 * it is filed under.
 */
export function signerRowPatch(args: { mode: 'email' | 'link'; body: SignerRequestBody; signerEmail: string | null | undefined; row: SignerRow }): Record<string, string | null> {
  const patch: Record<string, string | null> = {}
  const kept = paperWord(args.row.signer_name)
  if (args.mode === 'link') {
    const name = kept ?? filedSignerName(args.row.person_name)
    if (!kept && name) patch.signer_name = name
    return patch
  }
  const name = paperWord(args.body.signer_name) ?? kept ?? filedSignerName(args.row.person_name)
  if (name) patch.signer_name = name
  if (args.body.signer_title !== undefined) patch.signer_title = paperWord(args.body.signer_title)
  if (args.body.signing_for !== undefined) patch.signing_for = paperWord(args.body.signing_for)
  const email = signerEmailWord(args.signerEmail)
  if (email) patch.signer_email = email
  return patch
}

/** A paper's row as far as naming who it is for reads it. */
export interface PaperForRow {
  person_name: string | null
  party_name?: string | null
  signer_name?: string | null
}

/**
 * Who a paper is for, in words a person may read: the email's *For* line, the sent copy's recipient, a download's name.
 * A person's paper is for the person it is filed under. A party's is for whoever signs, else the party, and never its
 * stored name. A trade company's paper is named by its own helper (`paperForName`).
 */
export function paperForWords(row: PaperForRow, signerName?: string | null): string {
  if (!isPartyPaperName(row.person_name)) return (row.person_name ?? '').trim()
  return paperWord(signerName) ?? paperWord(row.signer_name) ?? paperWord(row.party_name) ?? 'the signer'
}

/** The party of a party's paper as a download names it: the business, else the signer. '' for a person's paper. */
export function partyFileWords(row: PaperForRow): string {
  if (!isPartyPaperName(row.person_name)) return ''
  return paperWord(row.party_name) ?? paperWord(row.signer_name) ?? 'an outside party'
}

/** Who a signer is to us, as the e-sign ledger keeps it: a customer, a sub (a subcontractor or a teammate), or neither. */
export type PaperAudience = 'customer' | 'sub' | 'outside'

/** A party's contact as far as the audience reads it. */
export interface PartyContactRow {
  customer_id?: string | null
  customer_contact_person_id?: string | null
  gc_company_id?: string | null
  gc_company_person_id?: string | null
}

/**
 * The audience of one paper's signer. A person's own paper and a trade company's are a sub's, as they were. A party's
 * follows what its contact points at today: a customer's is a customer's, a trade company's a sub's, and a supply
 * house's, a vendor's or someone's on no list is neither: `outside`.
 */
export function paperAudience(row: Pick<PaperForRow, 'person_name'>, partyContact: PartyContactRow | null | undefined): PaperAudience {
  if (!isPartyPaperName(row.person_name)) return 'sub'
  if (partyContact?.customer_id || partyContact?.customer_contact_person_id) return 'customer'
  if (partyContact?.gc_company_id || partyContact?.gc_company_person_id) return 'sub'
  return 'outside'
}
