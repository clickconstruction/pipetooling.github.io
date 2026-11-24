/**
 * Documents → Agreements (punch list #376): the rules that turn any kind of agreement into one line of one list.
 *
 * The app makes agreements in several places: a job's contract, a warranty in place of one, a GC's own paper, a signed
 * paper the office filed, a person's agreement (staff, a sub, a partner), a sub work order, and in GC mode our contract
 * with the owner, a trade's statement of work and a trade company's agreement. Each keeps its own table,
 * its own window and its own words for where it stands. This kernel reads one row shape, the `agreements_on_file` view's
 * (one branch per table, `security_invoker`, so each table's own row security decides what a reader sees), and answers
 * what a line says: its tag, its name, who it is with, the job, its state in that kind's own words, and its day. The
 * state's words come from the kernels that already hold them (`jobContractChips`, `theirPaperLine`,
 * `workOrderChipLabel`), so a line and the window it opens never disagree.
 *
 * Pure: no React, no supabase. The read is `agreementsLedgerIo.ts`; the tab is `DocumentsAgreementsTab.tsx`.
 */
import { formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { emptyWords, type EmptyWords } from '../emptyWords'
import { pluralNoun } from '../batchWords'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { isGoogleDocsUrl } from '../jobs/jobContractDocument'
import { jobContractChips } from '../jobs/jobContractLifecycle'
import { theirPaperFromRow, theirPaperLine } from '../jobs/theirPaper'
import { buildJobWorkOrderCoverage, workOrderChipLabel } from '../subWorkOrders/workOrderCoverage'
import { weekdayDate } from '../gc/words'
import { isPartyAgreementKind, paperPartyKind, paperSignerFromFacts, paperSignerLine, partyAgreementTag, partyNeedsAList, signingForBeside } from '../contracts/paperParty'
import { partyPaperKindWords } from '../contracts/partyPapers'

/** The kinds the view answers. A kind the kernel does not know still draws, as a plain agreement. */
export type AgreementKind =
  | 'job_contract'
  | 'job_warranty'
  | 'their_paper'
  | 'person_agreement'
  | 'partner_agreement'
  | 'work_order'
  | 'owner_contract'
  | 'sow'
  | 'company_agreement'
  // An outside party's paper (punch list #403), by what the party's contact points at.
  | 'customer_agreement'
  | 'supply_house_agreement'
  | 'trade_agreement'
  | 'outside_agreement'

/**
 * Where an agreement stands, the same for every kind: out to be signed, signed, or over. Since punch list #403's first
 * decision an outside party's paper has a fourth: `not_sent`, made and never sent. No other kind is listed before it is
 * sent, so no other kind reads it.
 */
export type AgreementState = 'waiting' | 'signed' | 'ended' | 'not_sent'

/** One row of `agreements_on_file`. `facts` holds the columns of the kind's own table that its words are made from. */
export interface AgreementRow {
  /** `<kind>:<source_id>`: one per line, and the second sort key. */
  id: string
  kind: string
  source_id: string
  state: string
  /** The template's, the document's or the paper's own name, or the work order's number; '' when it has none. */
  paper_name: string
  /** Who it is with: the customer, the GC, the person, the sub. */
  with_name: string
  job_id: string | null
  job_hcp_number: string | null
  job_click_number: string | null
  /** The job's name. A GC project's paper has no job: its project's name rides here, with `job_id` and the numbers null. */
  job_name: string | null
  job_address: string | null
  /** A signed paper filed over several jobs is one line: how many jobs it covers beyond the one named. */
  more_jobs: number
  person_id: string | null
  /** `people.kind` of a person's agreement: `sub` reads Sub, anything else Staff. */
  person_kind: string | null
  /** The moment the line sorts on. */
  at: string
  /** The day the line shows, in the company's calendar: the signed day, the sent day, or the day it ended. */
  at_day: string | null
  facts: Record<string, unknown> | null
}

export const AGREEMENTS_SELECT =
  'id, kind, source_id, state, paper_name, with_name, job_id, job_hcp_number, job_click_number, job_name, job_address, more_jobs, person_id, person_kind, at, at_day, facts'

/** Rows read per step; Show more reads the next step. */
export const AGREEMENTS_PAGE = 100

/**
 * Who acts on the tab: the four roles the tables' own policies let write a paper. They send one, send one again, open
 * the Contract library and press a line to open its window.
 */
export function canActOnAgreements(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/**
 * Who has the tab: the four roles, and since punch list #403's call 8 an estimator, who reads it and acts on nothing.
 * The list is whatever each table's own row security answers the reader.
 */
export function canSeeAgreements(role: string | null | undefined): boolean {
  return canActOnAgreements(role) || role === 'estimator'
}

/** How a reader holds the tab: the office acts on it, and an estimator reads it. */
export type AgreementsReader = 'office' | 'estimator'

/** The reader a role is. Every role but the estimator reads as the office, which is how the tab was built. */
export function agreementsReader(role: string | null | undefined): AgreementsReader {
  return role === 'estimator' ? 'estimator' : 'office'
}

// ── The chips ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AgreementGroup = 'jobs' | 'warranty' | 'people' | 'outside' | 'partners' | 'orders' | 'gc'
export type KindPick = 'all' | AgreementGroup
export type StatePick = 'live' | AgreementState
/** What a read asks for: a state chip's pick, or `any` under the Search tab, where a voided paper must be findable too. */
export type StateAsk = StatePick | 'any'

/** Which kinds each chip asks the database for. */
export const AGREEMENT_GROUP_KINDS: Readonly<Record<AgreementGroup, ReadonlyArray<AgreementKind>>> = {
  jobs: ['job_contract', 'their_paper'],
  warranty: ['job_warranty'],
  // A trade company that is a party sits with the subs, where the office looks for one (punch list #403).
  people: ['person_agreement', 'trade_agreement'],
  outside: ['customer_agreement', 'supply_house_agreement', 'outside_agreement'],
  partners: ['partner_agreement'],
  orders: ['work_order'],
  gc: ['owner_contract', 'sow', 'company_agreement'],
}

export const AGREEMENT_KIND_CHIPS: ReadonlyArray<{ key: KindPick; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'jobs', label: 'Job contracts' },
  { key: 'warranty', label: 'Warranties' },
  { key: 'people', label: 'Staff and subs' },
  // A customer, a supply house or someone on no list (punch list #403). The tag on each line says which.
  { key: 'outside', label: 'Outside companies' },
  { key: 'partners', label: 'Partners' },
  { key: 'orders', label: 'Work orders' },
  // GC mode's papers. The chip shows to everyone with the tab; the rows are each table's own to open, so an assistant
  // sees a trade company's agreement under it and none of the owner contracts or statements of work.
  { key: 'gc', label: 'GC projects' },
]

/** The tab opens on `live`: sent and signed, so a voided paper stays out of the way until its chip is pressed. */
export const AGREEMENT_STATE_CHIPS: ReadonlyArray<{ key: StatePick; label: string }> = [
  { key: 'live', label: 'Sent and signed' },
  { key: 'waiting', label: 'Waiting on a signature' },
  { key: 'signed', label: 'Signed' },
  // An outside party's paper that was made and never sent (punch list #403). Drawn only while one exists.
  { key: 'not_sent', label: 'Not sent' },
  { key: 'ended', label: 'Voided or ended' },
]

/**
 * The state chips a reader is drawn. **Not sent** shows only while a paper is not sent, or while it is the chip picked:
 * most days nothing is made and left unsent, and a chip that always opens an empty list is noise. `notSent` is the
 * count under the kind picked, or null when it could not be read, which hides the chip as none does.
 */
export function agreementStateChips(notSent: number | null, picked: StatePick): ReadonlyArray<{ key: StatePick; label: string }> {
  return AGREEMENT_STATE_CHIPS.filter((c) => c.key !== 'not_sent' || picked === 'not_sent' || (notSent != null && notSent > 0))
}

/**
 * The chips an estimator has (punch list #403, call 8): the kinds their role reads and no other. An outside company is
 * a customer, a supply house or a trade company, so a trade company's agreement sits under **Outside companies** for
 * them, where the office finds it under **Staff and subs** or **GC projects**. A party on no list is closed to them.
 */
export const ESTIMATOR_GROUP_KINDS: Readonly<Partial<Record<AgreementGroup, ReadonlyArray<AgreementKind>>>> = {
  outside: ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'company_agreement'],
  orders: ['work_order'],
}

/** The kind chips a reader is drawn: all of them for the office, and for an estimator only the kinds they read. */
export function agreementKindChips(reader: AgreementsReader = 'office'): ReadonlyArray<{ key: KindPick; label: string }> {
  if (reader === 'office') return AGREEMENT_KIND_CHIPS
  return AGREEMENT_KIND_CHIPS.filter((c) => c.key === 'all' || ESTIMATOR_GROUP_KINDS[c.key] != null)
}

/** The kinds a kind chip asks for, or null for every kind. A chip a reader does not have asks for no kind at all. */
export function kindsOfPick(pick: KindPick, reader: AgreementsReader = 'office'): ReadonlyArray<string> | null {
  if (pick === 'all') return null
  return reader === 'office' ? AGREEMENT_GROUP_KINDS[pick] : (ESTIMATOR_GROUP_KINDS[pick] ?? [])
}

/** The states a read asks for, or null for every state. */
export function statesOfPick(pick: StateAsk): ReadonlyArray<AgreementState> | null {
  if (pick === 'any') return null
  return pick === 'live' ? ['waiting', 'signed'] : [pick]
}

/** The group a row's tag is coloured by; an unknown kind sits with the job contracts. */
export function agreementGroup(kind: string): AgreementGroup {
  for (const [group, kinds] of Object.entries(AGREEMENT_GROUP_KINDS) as Array<[AgreementGroup, ReadonlyArray<string>]>) {
    if (kinds.includes(kind)) return group
  }
  return 'jobs'
}

/** A tag's pair per group, theme tokens only, the way Sent copies colours its kinds. */
export const AGREEMENT_GROUP_COLORS: Readonly<Record<AgreementGroup, { background: string; color: string }>> = {
  jobs: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  warranty: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  people: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  outside: { background: 'var(--bg-teal-tint)', color: 'var(--text-teal-700)' },
  partners: { background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' },
  orders: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  gc: { background: 'var(--bg-subtle)', color: 'var(--text-700)' },
}

/** A state chip's pair per tone: the contract chips' own colours (`jobContractChipColors`). */
export const AGREEMENT_STATE_COLORS: Readonly<Record<AgreementState, { background: string; color: string }>> = {
  waiting: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  signed: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  ended: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  // The quiet pair the party's own page gives *not sent* (`PARTY_PAPER_TONE_COLORS.unsent`).
  not_sent: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
}

/** *Waiting on a signature · 3*: the chip carries the count when something waits, and the words alone when nothing does. */
export function waitingChipLabel(label: string, waiting: number | null): string {
  return waiting != null && waiting > 0 ? `${label} · ${waiting}` : label
}

// ── The find box ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AgreementsQuery {
  kind: KindPick
  state: StateAsk
  typed: string
  limit: number
  /** Whose chips these are. Left out, the office's. */
  reader?: AgreementsReader
}

/**
 * What was typed, as the words the database must each find in a row's `find_text`: lower case, letters, digits and a
 * few marks only, five words at most. Fewer than two characters asks nothing.
 */
export function agreementFindWords(typed: string): string[] {
  const q = typed
    .toLowerCase()
    .replace(/[^a-z0-9 @._#'&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  if (q.length < 2) return []
  return q.split(' ').filter(Boolean).slice(0, 5)
}

/** Whether a chip or the box narrows the list, for the empty state's words. The default state chip does not. */
export function agreementsNarrowed(q: Pick<AgreementsQuery, 'kind' | 'state' | 'typed'>): boolean {
  return q.kind !== 'all' || q.state !== 'live' || agreementFindWords(q.typed).length > 0
}

/** Where the empty list's press goes: the Pipeline, where a contract is sent to sign. */
export const AGREEMENTS_EMPTY_PAGE = { label: 'Pipeline', to: '/jobs?tab=stages', tail: 'is where a contract is sent to sign.' } as const

/** What an estimator's empty list says after its first sentence: the office sends, and they read. */
export const AGREEMENTS_READER_EMPTY_TAIL = 'The office sends a paper to an outside company from this tab.'

/**
 * What an estimator's list says at its foot (punch list #403, the owner's second decision). A signed line's name is a
 * press that opens its record, and a paper that waits has none. A training account reads the lines and opens nothing.
 */
export const AGREEMENTS_READER_DOORS = 'Press a signed paper’s name to open its record. A paper that is not signed yet has nothing to open.'
export const AGREEMENTS_TRAINING_DOORS = 'This list is for reading. A training account opens no signed paper.'

/** The foot of an estimator's list: `opensRecords` is `canOpenSignedRecord` for the reader. */
export function agreementsReaderDoorsWords(opensRecords: boolean): string {
  return opensRecords ? AGREEMENTS_READER_DOORS : AGREEMENTS_TRAINING_DOORS
}

/**
 * The empty list's words: nothing matches the search (*Clear the search*), nothing matches the chips (*Clear the
 * filters*), or nothing is on file at all, which names the page that fills it. The tab adds the press.
 */
export function agreementsEmptyWords(q: Pick<AgreementsQuery, 'kind' | 'state' | 'typed'>, reader: AgreementsReader = 'office'): EmptyWords {
  if (!agreementsNarrowed(q)) {
    const office = emptyWords({ kind: 'data', noun: 'agreements', page: { label: AGREEMENTS_EMPTY_PAGE.label, tail: AGREEMENTS_EMPTY_PAGE.tail } })
    // An estimator sends nothing, so their empty list names who does and offers no press.
    return reader === 'office' ? office : { main: office.main, next: '', tail: AGREEMENTS_READER_EMPTY_TAIL }
  }
  const query = agreementFindWords(q.typed).length > 0 ? q.typed.trim() : ''
  return emptyWords({ kind: 'filter', noun: 'agreements', query })
}

/** *1 agreement*, *13 agreements*. */
export function agreementCountWords(n: number): string {
  return `${n} ${pluralNoun('agreement', n)}`
}

// ── A line ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function fact(row: Pick<AgreementRow, 'facts'>, key: string): unknown {
  return row.facts && typeof row.facts === 'object' ? row.facts[key] : undefined
}

function stateOf(row: Pick<AgreementRow, 'state'>): AgreementState {
  return row.state === 'waiting' || row.state === 'signed' || row.state === 'not_sent' ? row.state : 'ended'
}

/**
 * The tag on a line: the exact kind in a word or two, in its group's colours. A party on no list is `plain`: its tag is
 * an outline, since it belongs to no group yet.
 */
export function agreementTag(row: Pick<AgreementRow, 'kind' | 'person_kind'> & Partial<Pick<AgreementRow, 'facts'>>): { words: string; group: AgreementGroup; plain?: boolean } {
  const group = agreementGroup(row.kind)
  if (isPartyAgreementKind(row.kind)) {
    const partyKind = row.facts ? fact(row as Pick<AgreementRow, 'facts'>, 'party_kind') : undefined
    const words = partyAgreementTag(row.kind, partyKind)
    return row.kind === 'outside_agreement' ? { words, group, plain: true } : { words, group }
  }
  switch (row.kind) {
    case 'job_contract':
      return { words: 'Contract', group }
    case 'job_warranty':
      return { words: 'Warranty', group }
    case 'their_paper':
      return { words: 'Their paper', group }
    case 'person_agreement':
      return { words: row.person_kind === 'sub' ? 'Sub' : 'Staff', group }
    case 'partner_agreement':
      return { words: 'Partner', group }
    case 'work_order':
      return { words: 'Work order', group }
    case 'owner_contract':
      return { words: 'Owner contract', group }
    case 'sow':
      return { words: 'Statement of work', group }
    case 'company_agreement':
      return { words: 'Trade company', group }
    default:
      return { words: 'Agreement', group }
  }
}

/** Whether a job contract row is a signed paper the office filed, not one signed through the link. */
function filedPaper(row: Pick<AgreementRow, 'kind' | 'facts'>): boolean {
  return row.kind !== 'their_paper' && (fact(row, 'signer_mode') === 'paper' || fact(row, 'co_signer_mode') === 'paper')
}

/**
 * The name a line is pressed by: the paper's own name when it has one. A filed paper with no name reads *Signed paper ·
 * Google Doc*, *· scan* or alone, as the Customer page's Agreements card names it; anything else falls back to its kind.
 */
export function agreementName(row: Pick<AgreementRow, 'kind' | 'paper_name' | 'facts'>): string {
  const name = str(row.paper_name)
  if (name) return name
  if (filedPaper(row)) {
    const url = str(fact(row, 'signed_document_url'))
    if (url) return isGoogleDocsUrl(url) ? 'Signed paper · Google Doc' : 'Signed paper · link'
    return fact(row, 'has_upload') === true ? 'Signed paper · scan' : 'Signed paper'
  }
  switch (row.kind) {
    case 'job_contract':
      return 'Contract'
    case 'job_warranty':
      return 'Warranty'
    case 'their_paper':
      return 'Their paper'
    case 'work_order':
      return 'Work order'
    case 'owner_contract':
      return 'Our contract with the owner'
    case 'sow':
      return 'Statement of work'
    default:
      return 'Agreement'
  }
}

/**
 * Who signs, after the party on a line: *Lena Park signs, Branch manager*, then *signed by Dana Ruiz, Project manager*.
 * '' when the paper kept no signer, and when the signer is the party named beside it with no title to add: a person's
 * own paper does not say their name twice. '' for every kind but a person's, a trade company's and a party's paper.
 */
export function agreementSignerWords(row: Pick<AgreementRow, 'kind' | 'state' | 'with_name' | 'facts'>): string {
  // A person's paper, a trade company's and an outside party's keep a signer. A job's contract, a work order and GC
  // mode's papers say who signed in their own windows, and their lines are left as they were.
  if (row.kind !== 'person_agreement' && row.kind !== 'partner_agreement' && row.kind !== 'company_agreement' && !isPartyAgreementKind(row.kind)) return ''
  const signer = paperSignerFromFacts(row.facts)
  const signed = str(fact(row, 'status')) === 'signed'
  const name = (signed ? (signer.printedName ?? signer.name) : signer.name) ?? ''
  if (!name) return ''
  if (!signer.title && name.toLowerCase() === str(row.with_name).toLowerCase()) return ''
  return paperSignerLine(signer, signed)
}

/**
 * *signing for Haddad Engineering*, after who signs on a line: the business the paper itself names, said when it is not
 * the party named beside it. Someone typed in for one company and added to a list under another keeps the company
 * their paper says. '' when the paper kept no business, when the line's party is that business, and for every kind
 * that keeps no signer.
 */
export function agreementSigningForWords(row: Pick<AgreementRow, 'kind' | 'with_name' | 'facts'>): string {
  if (row.kind !== 'person_agreement' && row.kind !== 'partner_agreement' && row.kind !== 'company_agreement' && !isPartyAgreementKind(row.kind)) return ''
  const signer = paperSignerFromFacts(row.facts)
  return signingForBeside(signer.signingFor, [row.with_name, signer.name, signer.printedName])
}

/**
 * What kind of paper a party's line is, when it is not an agreement: *W-9*, *Insurance certificate*, *License*. Since
 * punch list #403's first decision the tab lists every paper that is with an outside party, so a line may be a tax
 * form or a certificate, and a second tag says so. '' for an agreement, for a row that says no kind, and for every
 * line that is not a party's: those are agreements, which the tab is named for.
 */
export function agreementPaperKindWords(row: Pick<AgreementRow, 'kind' | 'facts'>): string {
  if (!isPartyAgreementKind(row.kind)) return ''
  const docType = str(fact(row, 'doc_type'))
  if (!docType || docType === 'agreement') return ''
  return partyPaperKindWords(docType)
}

/** Whether a line carries **Add to a list**: an outside party's paper whose party has no record yet, signed or not. */
export function agreementNeedsAList(row: Pick<AgreementRow, 'kind' | 'facts'>): boolean {
  return isPartyAgreementKind(row.kind) && partyNeedsAList(paperPartyKind(fact(row, 'party_kind')))
}

/** The job a line names: *J2418 · Pierce kitchen repipe*, the number alone, the name alone, or null with no job. */
export function agreementJobTitle(row: Pick<AgreementRow, 'job_id' | 'job_hcp_number' | 'job_click_number' | 'job_name'>): string | null {
  const num = effectiveJobLedgerNumber(row.job_hcp_number, row.job_click_number)
  const name = str(row.job_name)
  if (!num && !name) return null
  if (!num) return name
  return name ? `J${num} · ${name}` : `J${num}`
}

/** What follows the job on the sub line: *and 2 more jobs* for a paper over several, else the job's address. */
export function agreementJobTail(row: Pick<AgreementRow, 'more_jobs' | 'job_address'>): string {
  const more = Number(row.more_jobs) || 0
  if (more > 0) return `and ${more} more ${pluralNoun('job', more)}`
  return str(row.job_address)
}

/**
 * The state chip: the tone every kind shares and the words that kind's own window uses. `todayYmd` is the company's
 * day, for a work order's offer that ran out.
 */
export function agreementStateChip(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>, todayYmd: string): { words: string; tone: AgreementState } {
  const tone = stateOf(row)
  const facts = row.facts ?? {}
  if (row.kind === 'job_contract' || row.kind === 'job_warranty' || row.kind === 'their_paper') {
    const status = str(fact(row, 'status'))
    const voided = fact(row, 'voided_at') != null || status === 'voided'
    if (row.kind === 'their_paper' && !voided) {
      const rec = theirPaperFromRow({ ...(facts as Record<string, never>), id: '', job_id: '', status })
      return { words: theirPaperLine(rec).replace(/^Their paper · /, ''), tone }
    }
    const chip = jobContractChips({
      ...(facts as Record<string, never>),
      status,
      voided_at: (fact(row, 'voided_at') as string | null | undefined) ?? null,
      signer_mode: (fact(row, 'signer_mode') as string | null | undefined) ?? null,
      send_count: Number(fact(row, 'send_count')) || 0,
      view_count: Number(fact(row, 'view_count')) || 0,
      sent_channel: (fact(row, 'sent_channel') as string | null | undefined) ?? null,
    })[0]
    return { words: chip?.label ?? status, tone }
  }
  if (row.kind === 'person_agreement' || row.kind === 'partner_agreement' || row.kind === 'company_agreement' || isPartyAgreementKind(row.kind)) {
    if (fact(row, 'replaced') === true) return { words: 'replaced by a newer one', tone }
    if (tone === 'signed') return { words: 'signed ✓', tone }
    // The party's own page says *not sent* of the same paper (`partyPaperLine`): one word for it on both.
    if (tone === 'not_sent') return { words: 'not sent', tone }
    return { words: fact(row, 'signer_last_viewed_at') != null ? 'viewed, not signed' : 'never opened', tone }
  }
  if (row.kind === 'work_order') {
    const status = str(fact(row, 'status'))
    if (status === 'cancelled') return { words: 'Cancelled', tone }
    const coverage = buildJobWorkOrderCoverage(
      [
        {
          id: '',
          status,
          amount: null,
          display_name: '',
          job_id: null,
          labor_job_id: null,
          step_id: null,
          record_id: null,
          offered_at: (fact(row, 'offered_at') as string | null | undefined) ?? null,
          offer_expires_at: (fact(row, 'offer_expires_at') as string | null | undefined) ?? null,
          signed_at: (fact(row, 'signed_at') as string | null | undefined) ?? null,
          accepted_at: (fact(row, 'accepted_at') as string | null | undefined) ?? null,
          declined_at: (fact(row, 'declined_at') as string | null | undefined) ?? null,
          decline_reason: null,
          created_at: '',
        },
      ],
      todayYmd,
    )
    return { words: workOrderChipLabel(coverage), tone }
  }
  if (row.kind === 'owner_contract') {
    // GC mode's own words for our contract with the owner (`gc/customerContract.ts`): late once the sign-by day passed.
    if (tone === 'signed') return { words: 'signed ✓', tone }
    const by = str(fact(row, 'sign_by'))
    return { words: by && by < todayYmd ? `late, asked to sign by ${weekdayDate(by)}` : 'waiting on their signature', tone }
  }
  if (row.kind === 'sow') {
    // A trade's statement of work, as its card says it (`GcTradeSow.tsx`).
    if (tone === 'signed') return { words: 'signed ✓', tone }
    return { words: tone === 'waiting' ? 'waiting on their signature' : 'cancelled', tone }
  }
  return { words: tone === 'waiting' ? 'waiting on a signature' : tone === 'signed' ? 'signed ✓' : tone === 'not_sent' ? 'not sent' : 'ended', tone }
}

/** The verb before the day: what happened on it. */
function dayVerb(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>): string {
  const tone = stateOf(row)
  if (tone === 'signed') return 'Signed'
  if (tone === 'waiting') return 'Sent'
  // A paper that was never sent has one day to show: the day it was made.
  if (tone === 'not_sent') return 'Made'
  const status = str(fact(row, 'status'))
  if (row.kind === 'work_order') return status === 'declined' ? 'Declined' : status === 'cancelled' ? 'Cancelled' : 'Expired'
  // A cancelled statement of work keeps no cancel day: the day on its line is the day it was sent.
  if (row.kind === 'sow') return 'Sent'
  if (fact(row, 'replaced') === true) return 'Signed'
  return 'Voided'
}

/** *Signed Nov 14*, *Sent Nov 16*, *Voided Oct 15*, with the year once it is not this one; '' with no day. */
export function agreementDayWords(row: Pick<AgreementRow, 'kind' | 'state' | 'facts' | 'at_day'>, todayYmd: string): string {
  const ymd = str(row.at_day)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const day = ymd.slice(0, 4) === todayYmd.slice(0, 4) ? formatWorkDateYmdMonthDayShort(ymd) : formatWorkDateYmdFriendly(ymd)
  return `${dayVerb(row)} ${day}`
}

// ── The list ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

export interface AgreementMonthGroup<T> {
  /** `YYYY-MM`, or '' for rows with no day. */
  ym: string
  label: string
  rows: T[]
}

/** The rows under one band per month, in the order given (newest first): *November 2026*, then *No date* last if any. */
export function agreementMonthGroups<T extends Pick<AgreementRow, 'at_day'>>(rows: ReadonlyArray<T>): AgreementMonthGroup<T>[] {
  const out: AgreementMonthGroup<T>[] = []
  for (const row of rows) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(str(row.at_day))
    const month = m ? Number(m[2]) : 0
    const ym = m && month >= 1 && month <= 12 ? `${m[1]}-${m[2]}` : ''
    const last = out[out.length - 1]
    if (last && last.ym === ym) {
      last.rows.push(row)
      continue
    }
    out.push({ ym, label: ym ? `${MONTHS[month - 1]} ${ym.slice(0, 4)}` : 'No date', rows: [row] })
  }
  return out
}

// ── What a press opens ────────────────────────────────────────────────────────────────────────────────────────────────

/** GC mode's page. */
export const AGREEMENTS_GC_PAGE = '/gc'

/** Each kind keeps the window it has: the tab builds no viewer of its own. */
export type AgreementDoor =
  /** The Contract window on that record, or on the job for one that waits; a voided one opens its preview (`agreementOpensContractWindow`). */
  | { kind: 'contract'; jobId: string; recordId: string; signed: boolean }
  /** The signed record window People → Contracts uses. */
  | { kind: 'person-signed'; documentId: string }
  /** People → Contracts on that paper's own row. Its line here also carries Send again and Copy the signing link (`agreementsActs.ts`). */
  | { kind: 'people-contracts'; to: string }
  /** GC mode's page, for a paper of a GC project: it has no address of its own to open one project on. */
  | { kind: 'gc'; to: string }
  /** The work order window on that job. */
  | { kind: 'work-order'; jobId: string; commitmentId: string }
  | { kind: 'none' }

export function agreementDoor(row: Pick<AgreementRow, 'kind' | 'source_id' | 'state' | 'job_id' | 'facts'>): AgreementDoor {
  if (row.kind === 'job_contract' || row.kind === 'job_warranty' || row.kind === 'their_paper') {
    if (!row.job_id) return { kind: 'none' }
    return { kind: 'contract', jobId: row.job_id, recordId: row.source_id, signed: fact(row, 'signed_at') != null }
  }
  if (row.kind === 'person_agreement' || row.kind === 'partner_agreement') {
    if (str(fact(row, 'status')) === 'signed') return { kind: 'person-signed', documentId: row.source_id }
    return { kind: 'people-contracts', to: `/people?tab=contracts&doc=${encodeURIComponent(row.source_id)}` }
  }
  if (row.kind === 'work_order') {
    return row.job_id ? { kind: 'work-order', jobId: row.job_id, commitmentId: row.source_id } : { kind: 'none' }
  }
  if (row.kind === 'company_agreement' && str(fact(row, 'status')) === 'signed') return { kind: 'person-signed', documentId: row.source_id }
  // An outside party's paper has no page of its own yet: signed, it opens the signed record; waiting, its acts sit on
  // its line (`agreementsActs.ts`).
  if (isPartyAgreementKind(row.kind)) return str(fact(row, 'status')) === 'signed' ? { kind: 'person-signed', documentId: row.source_id } : { kind: 'none' }
  if (row.kind === 'owner_contract' || row.kind === 'sow' || row.kind === 'company_agreement') return { kind: 'gc', to: AGREEMENTS_GC_PAGE }
  return { kind: 'none' }
}

/**
 * What a press opens for an estimator, who reads the tab and acts on nothing (punch list #403, the owner's second
 * decision): a signed paper opens the signed record, the one window their role reads whole, and every other line is
 * plain words. A waiting paper, a work order and a GC paper keep no press. `opensRecords` is `canOpenSignedRecord`:
 * a training account opens nothing.
 */
export function agreementReaderDoor(row: Pick<AgreementRow, 'kind' | 'source_id' | 'state' | 'job_id' | 'facts'>, opensRecords: boolean): AgreementDoor {
  if (!opensRecords) return { kind: 'none' }
  const door = agreementDoor(row)
  return door.kind === 'person-signed' ? door : { kind: 'none' }
}
