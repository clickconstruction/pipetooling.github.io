/**
 * What a lien paper is still missing (v2.4632, the owner's ask): the Do now chip opens the
 * paper as it stands today, and every blank the statute needs is numbered on the page and
 * listed beside it with the button that fills it. Pure: the gaps come from the property
 * record, the owner lookup, the GC and the issuer the desk already holds; the marks ride
 * inside the fields the paper builders print, as a token this file paints red afterwards.
 */
import type { LienAffidavitFields, LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'

export type LienPaperKind = 'notice' | 'affidavit'

/** Which act fills the blank: the row's own button when it is that rung, else words alone. */
export type LienPaperFix = 'find_owner' | 'fix_property' | 'edit_job' | 'settings' | 'notices' | 'counsel'

export type LienPaperGap = {
  /** 1-based, in page order. */
  n: number
  key: 'owner' | 'owner_address' | 'county' | 'legal' | 'gc' | 'signer' | 'company_address' | 'notices' | 'homestead'
  label: string
  why: string
  /** On the envelope line above a notice (the form itself does not name the owner), on the form, or on the record alone (a gate the paper does not print). */
  where: 'envelope' | 'form' | 'record'
  fix: LienPaperFix
  fixWords: string
  /** The paper field that carries the mark, when the blank is on the form. */
  field?: keyof LienNoticeFields | keyof LienAffidavitFields
}

export type LienPaperFacts = {
  ownerName: string
  ownerAddress: string
  county: string
  legalDescription: string
  gcName: string
  /** The signer's name and title. */
  contactPerson: string
  /** The company's address on the letterhead. */
  claimantAddress: string
  /** The affidavit's gates as the desk computes them; the ones the paper does not print (notices recorded, homestead) become record gaps. */
  affidavitGates?: ReadonlyArray<{ key: 'owner' | 'legal' | 'notice' | 'homestead'; ok: boolean }>
}

const FIX_WORDS: Record<LienPaperFix, string> = {
  find_owner: 'Find the owner',
  fix_property: 'Fix the property',
  edit_job: 'Set it in Edit Job',
  settings: 'Set it in Settings',
  notices: 'Send the notices first',
  counsel: 'Talk to counsel',
}

export function lienPaperGaps(kind: LienPaperKind, f: LienPaperFacts): LienPaperGap[] {
  const out: Omit<LienPaperGap, 'n'>[] = []
  const blank = (s: string) => !s.trim()
  if (kind === 'notice') {
    if (blank(f.ownerName)) out.push({ key: 'owner', label: 'Owner of record', why: 'The notice goes to the owner by certified mail. Nobody is named on the property record yet.', where: 'envelope', fix: 'find_owner', fixWords: FIX_WORDS.find_owner })
    else if (blank(f.ownerAddress)) out.push({ key: 'owner_address', label: "Owner's mailing address", why: 'The owner is named but has no address to mail to.', where: 'envelope', fix: 'find_owner', fixWords: FIX_WORDS.find_owner })
    if (blank(f.gcName)) out.push({ key: 'gc', label: 'Original contractor', why: 'The form names the GC, and the GC gets a copy.', where: 'form', fix: 'edit_job', fixWords: FIX_WORDS.edit_job, field: 'originalContractorName' })
    if (blank(f.contactPerson)) out.push({ key: 'signer', label: 'Contact person', why: 'The form carries the signer, name and title.', where: 'form', fix: 'settings', fixWords: FIX_WORDS.settings, field: 'contactPerson' })
    if (blank(f.claimantAddress)) out.push({ key: 'company_address', label: "Claimant's address", why: 'The form carries the company address.', where: 'form', fix: 'settings', fixWords: FIX_WORDS.settings, field: 'claimantAddress' })
  } else {
    if (blank(f.county)) out.push({ key: 'county', label: 'County', why: 'The affidavit is filed with the clerk of the county the property is in.', where: 'form', fix: 'fix_property', fixWords: FIX_WORDS.fix_property, field: 'county' })
    if (blank(f.legalDescription)) out.push({ key: 'legal', label: 'Legal description', why: 'The lien attaches to the land the deed describes, not a street address alone.', where: 'form', fix: 'fix_property', fixWords: FIX_WORDS.fix_property, field: 'legalDescription' })
    if (blank(f.ownerName)) out.push({ key: 'owner', label: 'Owner of record', why: 'The affidavit names the owner and is served on them within five days of filing.', where: 'form', fix: 'fix_property', fixWords: FIX_WORDS.fix_property, field: 'ownerName' })
    else if (blank(f.ownerAddress)) out.push({ key: 'owner_address', label: "Owner's address", why: 'The affidavit gives the owner’s last known address, and service goes there.', where: 'form', fix: 'fix_property', fixWords: FIX_WORDS.fix_property, field: 'ownerAddress' })
    if (blank(f.gcName)) out.push({ key: 'gc', label: 'Original contractor', why: 'The affidavit names the original contractor.', where: 'form', fix: 'edit_job', fixWords: FIX_WORDS.edit_job, field: 'originalContractorName' })
    for (const g of f.affidavitGates ?? []) {
      if (g.ok) continue
      if (g.key === 'notice') out.push({ key: 'notices', label: 'Notices on record', why: 'A sub\u2019s affidavit needs its § 53.056 notices sent and recorded on the job first.', where: 'record', fix: 'notices', fixWords: FIX_WORDS.notices })
      if (g.key === 'homestead') out.push({ key: 'homestead', label: 'Homestead', why: 'Lien rights on a homestead need a pre-work contract signed by both spouses and recorded (§ 53.254).', where: 'record', fix: 'counsel', fixWords: FIX_WORDS.counsel })
    }
  }
  return out.map((g, i) => ({ ...g, n: i + 1 }))
}

const TOKEN = (n: number) => `⟦GAP:${n}⟧`
const TOKEN_RE = /⟦GAP:(\d+)⟧/g
const FRESH_OPEN = '⟦NEW⟧'
const FRESH_CLOSE = '⟦END⟧'
const FRESH_RE = /⟦NEW⟧([\s\S]*?)⟦END⟧/g

/**
 * Fix it from the paper (v2.4719, Taunya's ask): which window a blank opens over the paper.
 * The property record holds the county, the legal description and the owner; the GC is the
 * job's own pick. The signer, the company address, the notices and the homestead stay words.
 */
export type LienPaperFixWindow = 'property' | 'gc'

export function lienPaperFixWindow(g: Pick<LienPaperGap, 'fix' | 'key'>): LienPaperFixWindow | null {
  if (g.fix === 'fix_property' || g.fix === 'find_owner') return 'property'
  if (g.fix === 'edit_job' && g.key === 'gc') return 'gc'
  return null
}

/** The button on a blank's card: the property window keeps the rung's words, the GC window says what it does. */
export function lienPaperFixButtonWords(g: Pick<LienPaperGap, 'fix' | 'key' | 'fixWords'>): string {
  return lienPaperFixWindow(g) === 'gc' ? 'Pick the GC' : g.fixWords
}

/** The paper fields each blank prints into. */
const GAP_FIELDS: Record<LienPaperGap['key'], ReadonlyArray<string>> = {
  county: ['county'],
  legal: ['legalDescription'],
  owner: ['ownerName', 'ownerAddress'],
  owner_address: ['ownerAddress'],
  gc: ['originalContractorName'],
  signer: ['contactPerson'],
  company_address: ['claimantAddress'],
  notices: [],
  homestead: [],
}

/**
 * The blanks a fix window just filled: a blank before it opened that is gone now. An owner
 * named but still without an address is not filled (the blank became the address).
 */
export function lienPaperFilledSince(before: ReadonlyArray<LienPaperGap>, now: ReadonlyArray<LienPaperGap>): LienPaperGap[] {
  const still = new Set(now.map((g) => g.key))
  return before.filter((g) => !still.has(g.key) && !(g.key === 'owner' && still.has('owner_address')))
}

/** The fields with each just-filled blank's value wrapped, so the paper shows what changed. */
export function withFreshMarks<F extends Record<string, unknown>>(fields: F, filled: ReadonlyArray<Pick<LienPaperGap, 'key'>>): F {
  const out: Record<string, unknown> = { ...fields }
  for (const g of filled) {
    for (const field of GAP_FIELDS[g.key]) {
      const v = out[field]
      if (typeof v === 'string' && v.trim() && !v.startsWith(FRESH_OPEN)) out[field] = `${FRESH_OPEN}${v}${FRESH_CLOSE}`
    }
  }
  return out as F
}

/** A just-filled value on the envelope line: already-escaped HTML wrapped as the fresh mark. */
export function freshHtml(html: string): string {
  return `<span class="lienPaperFresh">${html}</span>`
}

/** The fields with each form gap's value replaced by its token, so the paper builder prints the mark where the blank is. */
export function withGapTokens<F extends Record<string, unknown>>(fields: F, gaps: ReadonlyArray<LienPaperGap>): F {
  const out: Record<string, unknown> = { ...fields }
  for (const g of gaps) if (g.field && g.where === 'form') out[g.field] = TOKEN(g.n)
  return out as F
}

/** The token for an envelope gap, for the line the overlay draws above a notice. */
export function gapToken(n: number): string {
  return TOKEN(n)
}

/** Every token in the paper's HTML painted as the numbered red mark (the label comes from the gap), and every just-filled value as the green one. */
export function paintGaps(html: string, gaps: ReadonlyArray<LienPaperGap>): string {
  return html.replace(TOKEN_RE, (_m, n: string) => {
    const g = gaps.find((x) => x.n === Number(n))
    const label = g ? g.label : 'Missing'
    return `<span class="lienPaperGap" data-gap="${n}"><b>${n}</b>${escapeHtml(label)}</span>`
  }).replace(FRESH_RE, (_m, inner: string) => freshHtml(inner))
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

/** The banner's words: how many blanks, or that the paper is whole and what comes next. */
export function lienPaperBannerWords(kind: LienPaperKind, gaps: ReadonlyArray<LienPaperGap>, next: string, deadline: string): { tone: 'red' | 'green'; words: string } {
  const paper = kind === 'affidavit' ? 'affidavit' : 'notice'
  if (gaps.length === 0) return { tone: 'green', words: `Nothing missing. Ready for the next step: ${next}. ${deadline}.` }
  return { tone: 'red', words: `${gaps.length} ${gaps.length === 1 ? 'detail' : 'details'} missing before this ${paper} can ${kind === 'affidavit' ? 'be filed' : 'go'}. ${deadline}.` }
}
