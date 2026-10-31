/**
 * Affidavits from the Legal desk (punch list #220, v2.6208): the kernel behind the *Swear a
 * statement…* window. Pure: no React, no supabase. The window, the Timeline and the Evidence row
 * all read a statement through here, and the paper the affiant signs is built here as
 * `FilingDocBlock`s for `filingDocPrintHtml`, so the Lien desk's papers and this one print alike.
 *
 * A STATEMENT is a `legal_matter_entries` row of kind `statement` (migration 20261031040000):
 * `occurred_on` is the day it is about (where it sits on the Timeline's Said lane), `body` is the
 * statement's paragraphs, and `meta` carries `{ title, affiant: { kind, user_id, name, role }, form,
 * incident_to, venue_county, state, prints, signed_on, hand_changed, document_id, source }`. It is
 * held from counsel under `held_overrides` key `statement:<id>`, like a planned step.
 *
 * Two Texas forms, picked once per draft (*How it is signed*):
 *
 *   - BEFORE A NOTARY: an affidavit under Tex. Gov't Code § 312.011(1), the jurat in
 *     `juratWords.ts`. The office has notaries on staff (the owner, 2026-10-30), so this is the
 *     default for every affiant.
 *   - NO NOTARY, UNDER PENALTY OF PERJURY: an unsworn declaration under Tex. Civ. Prac. & Rem. Code
 *     § 132.001, the jurat of subsection (d) quoted whole (`DECLARATION_STATUTE_FORM`). § 132.001(b)
 *     keeps it off any paper the county clerk files, so the § 53.054 lien affidavit never takes it.
 *     The declarant's date of birth and address are typed at print time and never saved. The block names the
 *     declarant by *Their full name* from the draft, so the paper names them one way (v2.6243).
 *
 * Three print faces under each form: the whole paper, the statement alone (to read over together),
 * and the signing page alone, which names the handwritten statement it is stapled to. The signing
 * day is never pre-printed; the notary or the declarant fills the blanks, and the office reads it
 * off the scan when it files the signed copy.
 */
import type { FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'
import type { LegalEntryRow } from './legalMatters'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** Who wrote it: the office at the desk, or a dev's robot through dev-mcp (a later verb pair). */
export type StatementSource = 'office' | 'mcp'

const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function ymdValid(ymd: string): boolean {
  if (!YMD.test(ymd)) return false
  const d = new Date(`${ymd}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}

// ---------- the shape ----------

/** How the paper is signed. */
export type AffidavitForm = 'notary' | 'declaration'
export const AFFIDAVIT_FORMS: ReadonlyArray<{ form: AffidavitForm; label: string }> = [
  { form: 'notary', label: 'Before a notary' },
  { form: 'declaration', label: 'No notary, under penalty of perjury' },
]

/** Who swears it: one of our team, from the roster, or a third-party witness, typed. */
export type AffiantKind = 'team' | 'witness'

export type StatementAffiant = {
  kind: AffiantKind
  /** The roster row for one of our team; null for a witness. */
  userId: string | null
  name: string
  /** Their role in one line: *Responsible Master Plumber of record for Click Plumbing and Electrical, License No. M-00000* · *foreman for Brightline Electric, the electrical subcontractor on the job*. */
  role: string
}

/** The row's life: a draft, printed at least once, the signed scan filed. */
export type StatementState = 'draft' | 'printed' | 'signed'

/** Which face a print was. */
export type StatementFace = 'whole' | 'statement' | 'signing'
export const STATEMENT_FACES: ReadonlyArray<{ face: StatementFace; label: string }> = [
  { face: 'whole', label: 'The whole paper' },
  { face: 'statement', label: 'The statement alone' },
  { face: 'signing', label: 'The signing page alone' },
]

/** One print, appended to the row by `legal_statement_print`: when, by whom, which face, and the text as printed. */
export type StatementPrint = { at: string; by: string | null; face: StatementFace; text: string }

export type StatementMeta = {
  title: string
  affiant: StatementAffiant
  form: AffidavitForm
  /** The last day of a span (*Sept 3 to Sept 17*), `YYYY-MM-DD`; null for one day. */
  incidentTo: string | null
  /** The county on the venue line; null leaves the blank for the notary's hand. */
  venueCounty: string | null
  state: StatementState
  prints: StatementPrint[]
  /** The day the paper was signed, read off the jurat when the scan was filed; null until then. */
  signedOn: string | null
  /** The signed paper differs from the text as last printed; the scan governs. */
  handChanged: boolean
  /** The Evidence row holding the signed scan; null until filed. */
  documentId: string | null
  source: StatementSource
}

export function isStatementEntry(e: Pick<LegalEntryRow, 'kind'>): boolean {
  return e.kind === 'statement'
}

/** The `held_overrides` key that holds a statement back from counsel. */
export function statementHoldKey(entryId: string): string {
  return `statement:${entryId}`
}

function faceOf(raw: unknown): StatementFace {
  return raw === 'statement' || raw === 'signing' ? raw : 'whole'
}

/** A statement's meta, read defensively: a row with none is a draft by an unnamed team member, before a notary. */
export function statementMetaOf(meta: unknown): StatementMeta {
  const m = isRecord(meta) ? meta : {}
  const a = isRecord(m.affiant) ? m.affiant : {}
  const prints = Array.isArray(m.prints)
    ? m.prints.filter(isRecord).map((p): StatementPrint => ({ at: typeof p.at === 'string' ? p.at : '', by: typeof p.by === 'string' && p.by ? p.by : null, face: faceOf(p.face), text: typeof p.text === 'string' ? p.text : '' }))
    : []
  const state: StatementState = m.state === 'signed' ? 'signed' : m.state === 'printed' || prints.length > 0 ? 'printed' : 'draft'
  return {
    title: typeof m.title === 'string' ? m.title : '',
    affiant: { kind: a.kind === 'witness' ? 'witness' : 'team', userId: typeof a.user_id === 'string' && a.user_id ? a.user_id : null, name: typeof a.name === 'string' ? a.name : '', role: typeof a.role === 'string' ? a.role : '' },
    form: m.form === 'declaration' ? 'declaration' : 'notary',
    incidentTo: typeof m.incident_to === 'string' && YMD.test(m.incident_to) ? m.incident_to : null,
    venueCounty: typeof m.venue_county === 'string' && m.venue_county.trim() ? m.venue_county.trim() : null,
    state,
    prints,
    signedOn: typeof m.signed_on === 'string' && YMD.test(m.signed_on) ? m.signed_on : null,
    handChanged: m.hand_changed === true,
    documentId: typeof m.document_id === 'string' && m.document_id ? m.document_id : null,
    source: m.source === 'mcp' ? 'mcp' : 'office',
  }
}

// ---------- the draft and its rules ----------

/** What the window types; the RPC (`legal_statement_add` / `_update`) holds the same caps. */
export type StatementDraft = {
  title: string
  affiant: StatementAffiant
  /** The day it is about, `YYYY-MM-DD`. */
  incidentOn: string
  /** The last day of the span, or '' for one day. */
  incidentTo: string
  form: AffidavitForm
  /** The county on the venue line; '' leaves the blank for the notary. */
  venueCounty: string
  /** The paragraphs, one per line or blank-line separated; the opener is added at print. */
  body: string
}

export const STATEMENT_TITLE_MAX = 200
export const STATEMENT_ROLE_MAX = 300
export const STATEMENT_BODY_MAX = 20_000

/** The office has notaries on staff (the owner, 2026-10-30), so a notary is no trip: every affiant defaults to the sworn form. */
export function defaultStatementForm(_kind: AffiantKind): AffidavitForm {
  void _kind
  return 'notary'
}

/** The title the window offers once the affiant is named: *Affidavit of Daniel Alvarez* · *Statement of Thanh Nguyen*. */
export function suggestedStatementTitle(affiant: Pick<StatementAffiant, 'name' | 'kind'>, form: AffidavitForm): string {
  const name = affiant.name.trim()
  if (!name) return ''
  return form === 'notary' ? `Affidavit of ${name}` : `Declaration of ${name}`
}

/** Why the draft cannot be saved as typed; null when it can. */
export function statementDraftProblem(d: StatementDraft, todayYmd: string): string | null {
  // v2.6238: a picked team member's roster name may be a first name only; the paper needs the name on their ID.
  if (!d.affiant.name.trim()) return d.affiant.kind === 'witness' ? 'Type the witness’s full name.' : d.affiant.userId ? 'Type their full name, as it reads on their ID.' : 'Pick who swears it.'
  if (d.affiant.role.trim().length > STATEMENT_ROLE_MAX) return `Keep the role line under ${STATEMENT_ROLE_MAX} characters.`
  if (!d.title.trim()) return 'Give the statement a title.'
  if (d.title.trim().length > STATEMENT_TITLE_MAX) return `Keep the title under ${STATEMENT_TITLE_MAX} characters.`
  if (!ymdValid(d.incidentOn)) return 'Pick the day it is about.'
  if (d.incidentOn > todayYmd) return 'The day it is about cannot be ahead of today.'
  if (d.incidentTo) {
    if (!ymdValid(d.incidentTo)) return 'Pick the last day of the span, or clear it.'
    if (d.incidentTo < d.incidentOn) return 'The last day of the span comes before the first. Swap them.'
    if (d.incidentTo > todayYmd) return 'The span cannot run past today.'
  }
  if (!d.body.trim()) return 'Type the statement.'
  if (d.body.trim().length > STATEMENT_BODY_MAX) return `Keep the statement under ${STATEMENT_BODY_MAX.toLocaleString('en-US')} characters.`
  return null
}

// ---------- the venue line ----------

/** The office's county until `app_settings.office_county` says otherwise (the owner, 2026-10-30: the overwhelming majority are sworn in Guadalupe County). */
export const OFFICE_COUNTY_DEFAULT = 'Guadalupe'

export type VenueChoice = { value: string; words: string; /** What the line under the pick says. */ note: string }

/**
 * The county picks, in order: the office's county (the default before a notary), the property's county
 * (the default for a declaration, signed where the declarant stands), and the blank for the notary's hand.
 * Two picks that name one county collapse to one.
 */
export function venueChoices(input: { officeCounty: string; propertyCounty: string | null; form: AffidavitForm }): VenueChoice[] {
  const office = input.officeCounty.trim()
  const property = (input.propertyCounty ?? '').trim()
  const declaration = input.form === 'declaration'
  const same = Boolean(property) && property.toLowerCase() === office.toLowerCase()
  const out: VenueChoice[] = []
  // v2.6245: a declaration has no notary, so its lines name the signer. The property's county is the declaration's
  // default; when it is the office's county too, the one pick says so, or it reads as a trip to the office.
  if (office) out.push({ value: office, words: `${office} County · the office’s${same ? ' and the property’s' : ''}`, note: declaration ? 'Where they sign. The declaration says Executed in this county.' : 'Where the notary watches the signing. Not where the job is.' })
  if (property && !same) out.push({ value: property, words: `${property} County · the property’s`, note: declaration ? 'Where they sign. The declaration says Executed in this county.' : 'For a signing on site.' })
  out.push(declaration ? { value: '', words: 'Leave it blank for the signer', note: 'They write the county in by hand where they sign.' } : { value: '', words: 'Leave it blank for the notary', note: 'The notary writes the county in by hand where the paper is signed.' })
  return out
}

/** The county the window starts on: the office's before a notary, the property's for a declaration (the office's when the property has none). */
export function defaultVenueCounty(input: { officeCounty: string; propertyCounty: string | null; form: AffidavitForm }): string {
  const office = input.officeCounty.trim()
  const property = (input.propertyCounty ?? '').trim()
  return input.form === 'declaration' && property ? property : office
}

/** The one line under *How it is signed*. */
export const FORM_HELP_WORDS = 'A notary is a trip. The declaration is a signature. A court reads both. Only a paper the county clerk files needs the notary.'

// ---------- the words on the paper ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** *Oct 29* — inside a sentence on the desk. */
export function statementShortDay(ymd: string): string {
  if (!YMD.test(ymd)) return ymd
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** *September 3, 2026* — on the paper. */
export function statementLongDay(ymd: string): string {
  if (!YMD.test(ymd)) return ymd
  return `${MONTHS_LONG[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}, ${ymd.slice(0, 4)}`
}

/** *7:12 AM* in the company's zone: a clock session's edge, a print's moment. */
export function clockWordsInAppTz(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** *Sep 3* · *Sep 3 to Sep 17* — the span as the desk says it. */
export function incidentSpanWords(incidentOn: string, incidentTo: string | null): string {
  const a = statementShortDay(incidentOn)
  return incidentTo && incidentTo !== incidentOn ? `${a} to ${statementShortDay(incidentTo)}` : a
}

/**
 * The first paragraph, which the window writes and the affiant reads: who they are, that they are of age
 * and sound mind, and that the facts are their own. A witness also says their role and that they have no
 * stake. The noun follows the form: an affidavit before a notary, a declaration without one.
 */
/** A name as the paper prints it: trimmed, one space between words (v2.6243). */
export function fullNameWords(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).join(' ')
}

/** A single word: the roster may hold a first name only, and § 132.001(d) asks for a first and a last name. */
export function isOneWordName(name: string): boolean {
  const n = fullNameWords(name)
  return n !== '' && !n.includes(' ')
}

export function statementOpener(affiant: StatementAffiant, form: AffidavitForm): string {
  const noun = form === 'notary' ? 'affidavit' : 'declaration'
  const name = fullNameWords(affiant.name) || '_______________'
  const base = `My name is ${name}. I am over eighteen years of age, of sound mind, and capable of making this ${noun}.`
  if (affiant.kind === 'witness') {
    const role = affiant.role.trim()
    return `${base}${role ? ` I am ${role.replace(/\.$/, '')}.` : ''} I have no interest in the outcome of this dispute. The facts stated here are within my personal knowledge and are true and correct.`
  }
  return `${base} The facts stated in it are within my personal knowledge and are true and correct.`
}

/** The body as paragraphs: split on line breaks, a number the writer typed (`3.` · `3)`) dropped since the paper numbers them. */
export function statementParagraphs(body: string): string[] {
  return body
    .split(/\n+/)
    .map((l) => l.trim().replace(/^\d{1,3}[.)]\s+/, ''))
    .filter(Boolean)
}

/**
 * Tex. Civ. Prac. & Rem. Code § 132.001(d), the unsworn declaration's jurat, quoted whole with its blanks.
 * The kernel fills the blanks only at print time (`declarationJurat`) and never keeps what it filled.
 */
export const DECLARATION_STATUTE_FORM =
  'My name is __________ (First) __________ (Middle) __________ (Last), my date of birth is __________, and my address is __________ (Street), __________ (City), __________ (State), __________ (Zip Code), and __________ (Country). I declare under penalty of perjury that the foregoing is true and correct. Executed in __________ County, State of __________, on the ______ day of __________ (Month), __________ (Year).'

/** The sentence every declaration carries, word for word from § 132.001(d). */
export const DECLARATION_PERJURY_SENTENCE = 'I declare under penalty of perjury that the foregoing is true and correct.'

/**
 * What the declarant types when the office presses Print on a declaration: held for the session, never saved. The
 * name is not asked again here (v2.6243): the block reads *Their full name* from the draft, so the title, ¶1, the
 * block and the signature name the declarant one way.
 */
export type DeclarantDetails = { dateOfBirth: string; street: string; city: string; state: string; zip: string; country: string }

export const DECLARANT_BLANK: DeclarantDetails = { dateOfBirth: '', street: '', city: '', state: 'Texas', zip: '', country: 'United States of America' }

/** Why the declaration's block cannot print yet; null when it is whole. A one-word name waits too, for the statute's first and last. */
export function declarantProblem(d: DeclarantDetails, name: string): string | null {
  if (!fullNameWords(name)) return 'Type their full name on the statement first.'
  if (isOneWordName(name)) return 'Their full name is one word. Texas asks for a first and a last name. Go back and type it as it reads on their ID.'
  if (!d.dateOfBirth.trim()) return 'Type the declarant’s date of birth.'
  if (!d.street.trim() || !d.city.trim() || !d.state.trim() || !d.zip.trim() || !d.country.trim()) return 'Type the declarant’s street, city, state, zip code and country.'
  return null
}

/**
 * The § 132.001(d) block as the paper prints it: the two sentences with the draft's full name and the declarant's
 * details, then the *Executed in* line with the county named (or the blank) and the day left blank for the
 * declarant's hand. With no details, the statute's own blanks print, so a paper can still be filled by hand.
 */
export function declarationJurat(details: DeclarantDetails | null, venueCounty: string, name: string): { statement: string; executed: string } {
  const county = venueCounty.trim() || '__________'
  const executed = `Executed in ${county} County, State of Texas, on the ______ day of __________, __________.`
  if (!details) return { statement: DECLARATION_STATUTE_FORM.slice(0, DECLARATION_STATUTE_FORM.indexOf(' Executed in')), executed }
  const dob = details.dateOfBirth.trim()
  const address = `${details.street.trim()}, ${details.city.trim()}, ${details.state.trim()} ${details.zip.trim()}, and ${details.country.trim()}`
  return { statement: `My name is ${fullNameWords(name) || '__________'}, my date of birth is ${YMD.test(dob) ? statementLongDay(dob) : dob}, and my address is ${address}. ${DECLARATION_PERJURY_SENTENCE}`, executed }
}

/** The signing page alone names what it is stapled to, so no notary or court calls it a loose jurat. */
export function attachedToLine(form: AffidavitForm, affiantName: string): string {
  const noun = form === 'notary' ? 'This jurat' : 'This declaration'
  return `${noun} is attached to the handwritten statement of ${fullNameWords(affiantName) || '_______________'}, _____ pages, each initialed by the signer.`
}

/** The line over the affiant's signature on a sworn paper: the day is the notary's to fill. */
export const SIGNED_ON_LINE = 'Signed on the _____ day of _____________, ______.'

export type StatementPaperInput = {
  draft: StatementDraft
  face: StatementFace
  /** The declarant's details for a declaration, typed at print time; null prints the statute's blanks. */
  declarant?: DeclarantDetails | null
}

/**
 * The paper as blocks for `filingDocPrintHtml` (and `filingDocHtml` on the window's own sheet). Under each
 * form the three faces: the whole paper (the title, the venue caption before a notary, the opener as ¶1 and
 * the paragraphs numbered after it, the affiant's signature, then the jurat or the declaration block), the
 * statement alone (no signing block), and the signing page alone (the *attached to* line and the block).
 */
export function statementPaperBlocks(input: StatementPaperInput): FilingDocBlock[] {
  const { draft, face } = input
  const name = fullNameWords(draft.affiant.name) || '_______________'
  const title = draft.title.trim() || (draft.form === 'notary' ? 'Affidavit' : 'Declaration')
  const blocks: FilingDocBlock[] = []
  if (face === 'signing') {
    blocks.push({ kind: 'title', lines: [draft.form === 'notary' ? 'Jurat' : 'Declaration'] })
    blocks.push({ kind: 'paragraph', text: attachedToLine(draft.form, name) })
    blocks.push(...signingBlocks(input, name))
    return blocks
  }
  blocks.push({ kind: 'title', lines: [title] })
  if (draft.form === 'notary') blocks.push({ kind: 'jurisdiction', county: draft.venueCounty })
  const paragraphs = [statementOpener(draft.affiant, draft.form), ...statementParagraphs(draft.body)]
  paragraphs.forEach((text, i) => blocks.push({ kind: 'numbered', n: i + 1, text }))
  if (face === 'statement') return blocks
  blocks.push(...signingBlocks(input, name))
  return blocks
}

/**
 * The role as it reads under a signature (v2.6238): a witness's line is written to follow *I am …* (*the foreman for
 * Brightline Electric*), so under the signature its leading article goes and its first letter rises (*Foreman for
 * Brightline Electric*). A line already capitalized reads as typed; a closing full stop goes.
 */
export function signatureRoleLine(role: string): string {
  const r = role.trim().replace(/\.$/, '').replace(/^(the|a|an)\s+/i, '')
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : ''
}

function signingBlocks(input: StatementPaperInput, name: string): FilingDocBlock[] {
  const { draft } = input
  const role = signatureRoleLine(draft.affiant.role)
  if (draft.form === 'notary') {
    return [
      { kind: 'paragraph', text: SIGNED_ON_LINE },
      { kind: 'signature', lines: [`${name}, Affiant`, ...(role ? [role] : [])] },
      { kind: 'notarial', who: name, county: draft.venueCounty, courtesy: true },
    ]
  }
  const j = declarationJurat(input.declarant ?? null, draft.venueCounty, draft.affiant.name)
  return [
    { kind: 'paragraph', text: j.statement },
    { kind: 'paragraph', text: j.executed },
    { kind: 'signature', lines: [`${name}, Declarant`, ...(role ? [role] : [])] },
  ]
}

/** The title the print tab and the PDF carry: *Affidavit of Daniel Alvarez* · *Jurat · Affidavit of Daniel Alvarez*. */
export function statementPrintTitle(draft: Pick<StatementDraft, 'title' | 'form'>, face: StatementFace): string {
  const t = draft.title.trim() || (draft.form === 'notary' ? 'Affidavit' : 'Declaration')
  if (face === 'signing') return `${draft.form === 'notary' ? 'Jurat' : 'Declaration'} · ${t}`
  if (face === 'statement') return `${t} · the statement alone`
  return t
}

/** The text a print keeps on the row: the paragraphs as printed, numbered, so the record shows what was handed over. */
export function statementPrintedText(draft: Pick<StatementDraft, 'affiant' | 'form' | 'body'>): string {
  return [statementOpener(draft.affiant, draft.form), ...statementParagraphs(draft.body)].map((p, i) => `${i + 1}. ${p}`).join('\n')
}

// ---------- the state in words ----------

/** A draft printed this long ago with no signed copy turns amber on the line. */
export const STATEMENT_DRAFT_AMBER_DAYS = 14

function utcOf(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
}

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((utcOf(toYmd) - utcOf(fromYmd)) / 86_400_000)
}

/** *Printed once* · *Printed twice* · *Printed 3 times*. */
export function printCountWords(n: number): string {
  return n === 1 ? 'Printed once' : n === 2 ? 'Printed twice' : `Printed ${n} times`
}

const FACE_WORDS: Record<StatementFace, string> = { whole: 'the whole paper', statement: 'the statement alone', signing: 'the signing page alone' }

export function statementFaceWords(face: StatementFace): string {
  return FACE_WORDS[face]
}

/** *Sworn Oct 29 before a notary in Guadalupe County.* · *Signed Oct 29 under penalty of perjury in Williamson County.* */
export function statementSignedWords(meta: Pick<StatementMeta, 'form' | 'signedOn' | 'venueCounty'>): string {
  const day = meta.signedOn ? ` ${statementShortDay(meta.signedOn)}` : ''
  const where = meta.venueCounty ? ` in ${meta.venueCounty} County` : ''
  return meta.form === 'notary' ? `Sworn${day} before a notary${where}.` : `Signed${day} under penalty of perjury${where}.`
}

/** How the line draws it: `planned` a fresh draft (a ring), `stale` a print a fortnight old with no signed copy (amber), `happened` once signed, `undone` when dropped. */
export type StatementLineState = 'planned' | 'stale' | 'happened' | 'undone'

/**
 * The words under a statement on the line, and the state they draw in:
 *   - a draft never printed: *Draft · not signed.*
 *   - printed, waiting: *Printed twice · last Oct 28 · not signed.*, amber after fourteen days (*Printed 14 days ago · no signed copy.*)
 *   - signed: the sworn words, then *The signed copy is on Evidence.* and the print count, and *Changed by hand; the scan governs.* when so
 *   - undone: *Undone: the reason.*
 */
export function statementStateWords(meta: StatementMeta, args: { todayYmd: string; voided: boolean; voidReason: string; dayOfIso: (iso: string) => string }): { state: StatementLineState; words: string } {
  if (args.voided) return { state: 'undone', words: `Undone${args.voidReason ? `: ${args.voidReason}` : '.'}` }
  const n = meta.prints.length
  if (meta.state === 'signed') {
    const prints = n ? ` ${printCountWords(n)} before the signing.` : ''
    const hand = meta.handChanged ? ' Changed by hand; the scan governs.' : ''
    return { state: 'happened', words: `${statementSignedWords(meta)} The signed copy is on Evidence.${prints}${hand}` }
  }
  if (n === 0) return { state: 'planned', words: 'Draft · not signed.' }
  const last = meta.prints[n - 1]!
  const lastDay = last.at ? args.dayOfIso(last.at) : ''
  const ago = lastDay && YMD.test(lastDay) ? daysBetween(lastDay, args.todayYmd) : 0
  if (ago >= STATEMENT_DRAFT_AMBER_DAYS) return { state: 'stale', words: `Printed ${ago} days ago · no signed copy.` }
  const which = n === 1 && last.face !== 'whole' ? `, ${FACE_WORDS[last.face]}` : ''
  return { state: 'planned', words: `${printCountWords(n)}${lastDay ? ` · last ${statementShortDay(lastDay)}` : ''}${which} · not signed.` }
}

/** The kind chip on the desk: *sworn statement* · *declaration*, with *· draft* while nothing is signed. */
export function statementKindWords(meta: Pick<StatementMeta, 'form' | 'state'>): string {
  const base = meta.form === 'notary' ? 'sworn statement' : 'declaration'
  return meta.state === 'signed' ? base : `${base} · draft`
}

/** The firm's words for the same chip: whose statement it is, in a lawyer's vocabulary. */
export function statementFirmKindWords(meta: Pick<StatementMeta, 'form' | 'state' | 'affiant'>): string {
  const base = meta.form === 'notary' ? 'sworn statement' : 'unsworn declaration'
  const who = meta.affiant.kind === 'witness' ? 'by a witness' : "by the office's team"
  return meta.state === 'signed' ? `${base} ${who}` : `${base} ${who} · draft, not signed`
}

/** *Daniel Alvarez · team* · *Thanh Nguyen · witness* — the by-line on the desk. */
export function statementByWords(affiant: Pick<StatementAffiant, 'name' | 'kind'>): string {
  return `${affiant.name.trim() || 'unnamed'} · ${affiant.kind === 'witness' ? 'witness' : 'team'}`
}

/** The chip's short form on the Evidence draft row and the window's header: *draft · not signed* · *printed 2× · last Oct 28* · *signed Oct 29*. */
export function statementChipWords(meta: StatementMeta, dayOfIso: (iso: string) => string): string {
  if (meta.state === 'signed') return `signed${meta.signedOn ? ` ${statementShortDay(meta.signedOn)}` : ''}`
  const n = meta.prints.length
  if (n === 0) return 'draft · not signed'
  const last = meta.prints[n - 1]!
  const lastDay = last.at ? dayOfIso(last.at) : ''
  return `printed ${n}×${lastDay ? ` · last ${statementShortDay(lastDay)}` : ''}`
}

/** The desk's toast once the scan is filed (v2.6246): the signing day in words, never the typed `YYYY-MM-DD`. */
export function statementFiledWords(signedOn: string): string {
  return `Filed. The signed copy is on Evidence on ${statementShortDay(signedOn)}. The statement reads sworn on the Timeline.`
}

/** The Evidence row's *shows* line when the scan is filed: the sworn words, then the span it is about. */
export function statementShowsLine(meta: Pick<StatementMeta, 'form' | 'signedOn' | 'venueCounty' | 'incidentTo'>, incidentOn: string): string {
  return `${statementSignedWords(meta)} What was seen or heard on ${incidentSpanWords(incidentOn, meta.incidentTo)}.`
}

// ---------- the record check beside the day ----------

export type RecordCheckLine = { ymd: string; kind: 'clock' | 'report' | 'note'; text: string; /** True when the line is the affiant's own (their session, their report, their note). */ theirs: boolean }

/**
 * What the record says about the days a statement is about: the account's clock sessions, field reports and
 * job-thread notes dated inside the span, the affiant's own first, and a line for each day in the span with
 * nothing on it, so a date is caught before anyone swears to it. Nothing here goes on the paper.
 */
export function recordCheckLines(input: {
  incidentOn: string
  incidentTo: string | null
  affiant: Pick<StatementAffiant, 'userId' | 'name'>
  sessions: ReadonlyArray<{ userId: string | null; userName: string | null; workDate: string; clockedInAt: string; clockedOutAt: string | null; jobLabel: string }>
  reports: ReadonlyArray<{ authorName: string; templateName: string; createdOn: string; jobLabel: string }>
  notes: ReadonlyArray<{ authorName: string | null; createdOn: string; body: string }>
  /** `HH:MM` in the app's zone for a clock instant. */
  clockWords: (iso: string) => string
}): RecordCheckLine[] {
  if (!YMD.test(input.incidentOn)) return []
  const from = input.incidentOn
  const to = input.incidentTo && YMD.test(input.incidentTo) && input.incidentTo >= from ? input.incidentTo : from
  const inSpan = (ymd: string) => ymd >= from && ymd <= to
  const affiantName = input.affiant.name.trim().toLowerCase()
  const isTheirs = (userId: string | null, name: string | null) => (input.affiant.userId && userId ? userId === input.affiant.userId : Boolean(affiantName) && (name ?? '').trim().toLowerCase() === affiantName)
  const lines: RecordCheckLine[] = []
  for (const s of input.sessions) {
    if (!inSpan(s.workDate)) continue
    const who = s.userName?.trim() || 'someone'
    lines.push({ ymd: s.workDate, kind: 'clock', text: `Clock session · ${who} · ${input.clockWords(s.clockedInAt)}${s.clockedOutAt ? ` to ${input.clockWords(s.clockedOutAt)}` : ', still open'} · job ${s.jobLabel}`, theirs: isTheirs(s.userId, s.userName) })
  }
  for (const r of input.reports) {
    if (!inSpan(r.createdOn)) continue
    lines.push({ ymd: r.createdOn, kind: 'report', text: `Field report · ${r.authorName.trim() || 'someone'}${r.templateName ? ` · ${r.templateName}` : ''} · job ${r.jobLabel}`, theirs: isTheirs(null, r.authorName) })
  }
  for (const n of input.notes) {
    if (!inSpan(n.createdOn)) continue
    const body = n.body.trim().replace(/\s+/g, ' ')
    lines.push({ ymd: n.createdOn, kind: 'note', text: `Job thread · ${n.authorName?.trim() || 'the office'} · “${body.length > 90 ? `${body.slice(0, 89)}…` : body}”`, theirs: isTheirs(null, n.authorName) })
  }
  const days = new Set(lines.map((l) => l.ymd))
  // A day in the span with nothing on it is said so, up to a fortnight of them; a longer span says only the first.
  const span = daysBetween(from, to)
  if (span <= 14) {
    for (let i = 0; i <= span; i++) {
      const d = new Date(utcOf(from) + i * 86_400_000).toISOString().slice(0, 10)
      if (!days.has(d)) lines.push({ ymd: d, kind: 'note', text: 'Nothing recorded on this day. No clock session, report or note. The paragraph that names it rests on the affiant’s word alone.', theirs: false })
    }
  }
  return lines.sort((a, b) => a.ymd.localeCompare(b.ymd) || Number(b.theirs) - Number(a.theirs) || a.text.localeCompare(b.text))
}

/** The record check's heading: *What the record says about Sep 3 to Sep 17*. */
export function recordCheckHeading(incidentOn: string, incidentTo: string | null): string {
  return YMD.test(incidentOn) ? `What the record says about ${incidentSpanWords(incidentOn, incidentTo)}` : 'What the record says about those days'
}

// ---------- filing the signed copy (PR 5, v2.6212) ----------

import type { LegalDocumentWhose } from './legalMatterDocuments'

/** What *File the signed copy…* asks: the scan is the file beside it. */
export type StatementFilingDraft = {
  /** The day it was signed, read off the jurat; the Evidence row's day. */
  signedOn: string
  /** The signed paper reads as the text last printed (false: changed by hand; the scan governs). */
  asPrinted: boolean
  /** The day it is about, confirmed or corrected, and the span's last day or ''. */
  incidentOn: string
  incidentTo: string
  /** Whose paper the scan is on Evidence; null is our record. */
  whose: LegalDocumentWhose | null
  /** The Evidence row's one line. */
  shows: string
}

/** The row's *shows* line as the filing form prefills it, re-derived while untouched. */
export function statementFilingShows(meta: Pick<StatementMeta, 'form' | 'venueCounty'>, d: Pick<StatementFilingDraft, 'signedOn' | 'incidentOn' | 'incidentTo'>): string {
  return statementShowsLine({ form: meta.form, venueCounty: meta.venueCounty, signedOn: YMD.test(d.signedOn) ? d.signedOn : null, incidentTo: d.incidentTo || null }, d.incidentOn)
}

/** *Oct 28 at 2:14 PM*, the last print the question names; '' when nothing was printed from the desk. */
export function lastPrintWords(meta: Pick<StatementMeta, 'prints'>, dayOfIso: (iso: string) => string, clockWords: (iso: string) => string): string {
  const last = meta.prints[meta.prints.length - 1]
  if (!last || !last.at) return ''
  return `${statementShortDay(dayOfIso(last.at))} at ${clockWords(last.at)}`
}

/** Why the signed copy cannot be filed as typed; null when it can. The RPC (`legal_statement_sign`) holds the same rules. */
export function statementFilingProblem(d: StatementFilingDraft, file: { size: number; type: string; name: string } | null, todayYmd: string): string | null {
  if (!file) return 'Choose the signed scan.'
  if (!ymdValid(d.incidentOn)) return 'Pick the day it is about.'
  if (d.incidentOn > todayYmd) return 'The day it is about cannot be ahead of today.'
  if (d.incidentTo) {
    if (!ymdValid(d.incidentTo)) return 'Pick the last day of the span, or clear it.'
    if (d.incidentTo < d.incidentOn) return 'The last day of the span comes before the first. Swap them.'
  }
  if (!ymdValid(d.signedOn)) return 'Type the day it was signed, off the jurat.'
  if (d.signedOn > todayYmd) return 'The day it was signed cannot be ahead of today.'
  if (d.signedOn < d.incidentOn) return 'The day it was signed comes before the day it is about. Check the jurat.'
  if (!d.shows.trim()) return 'Say in one line what it shows.'
  return null
}
