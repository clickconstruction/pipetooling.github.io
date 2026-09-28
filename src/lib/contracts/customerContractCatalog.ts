/**
 * The catalog behind Settings → Contracts & terms: every contract text a customer accepts or
 * signs, and every notice they receive, in one registry — what it is, where the wording lives,
 * where it is edited, where the customer meets it and where their copy is kept.
 *
 * The texts stay where they are (a Settings text, the Contract Book, a per-record box, the code);
 * this file only names them. `customerContractCatalog.test.ts` reads the real route registry and
 * the real page sources, so a customer-facing page cannot ship without an entry here or a stated
 * reason, and a sentence pinned below cannot change on its page without changing here.
 *
 * Pure data + pure functions; the tab does the I/O.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../subcontractorLikeRole'
import type { Journey, JourneyId } from '../customerJourneys'
import type { SurfaceEntry } from '../customerSurfaceRegistry'
import {
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
} from '../appSettingsKeys'
import { ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY } from '../estimatePublicTerms'
import { ESTIMATE_APP_SETTING_KEYS, builtinEstimateExperience } from '../estimateCustomerExperience'
import { DEFAULT_COVER_LETTER_CLOSING, DEFAULT_EXCLUSIONS, DEFAULT_TERMS_AND_WARRANTY } from '../bidDocuments/coverLetter'
import { LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER, LIEN_RELEASE_DEFAULT_PAYMENT_TERMS } from '../bidDocuments/lienRelease'
import { bidBasisClause } from '../bids/bidBasis'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN, paymentTermsSentence } from '../jobs/jobContractDocument'
import { ESIGN_CONSENT_VERSION, esignConsentText } from '../esignConsent'
import { effectiveBookVersionPlainDate } from '../contractBookVersionDate'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export const CONTRACTS_TAB_ID = 'settings-contracts'
/** Every card's DOM id, and the hash a deep link lands on: `#settings-contract-<entry id>`. */
export const CONTRACT_ANCHOR_PREFIX = 'settings-contract-'

export type ContractCatalogGroup = 'signed' | 'notice'

export const CONTRACT_GROUP_LABELS: Readonly<Record<ContractCatalogGroup, string>> = {
  signed: 'Contracts customers accept or sign',
  notice: 'Notices customers receive',
}

export const CONTRACT_GROUP_HINTS: Readonly<Record<ContractCatalogGroup, string>> = {
  signed: 'Wording a customer agrees to — with a signature, a checkbox, or by accepting the document it rides on.',
  notice: 'Wording we send that binds or informs a customer and that they do not sign.',
}

export type ContractCatalogArea = 'estimates' | 'bids' | 'jobs' | 'signing' | 'billing' | 'liens'

export const CONTRACT_AREA_LABELS: Readonly<Record<ContractCatalogArea, string>> = {
  estimates: 'Estimates',
  bids: 'Bids',
  jobs: 'Jobs',
  signing: 'Every signing page',
  billing: 'Billing',
  liens: 'Liens & collections',
}

export type ContractCatalogAudience = 'homeowner' | 'gc' | 'everyone' | 'owner'

export const CONTRACT_AUDIENCE_LABELS: Readonly<Record<ContractCatalogAudience, string>> = {
  homeowner: 'Homeowner',
  gc: 'Contractor',
  everyone: 'Everyone who signs',
  owner: 'Property owner',
}

/** Where the wording is kept. */
export type ContractTextSource =
  /** Contract Book documents with the customer audience; the built-in wording when the Book has none. */
  | { kind: 'contract_book'; builtIn: string; builtInName: string }
  /** One `app_settings.value_text` row; `builtIn` is what the app prints when the row is blank (null: nothing). */
  | { kind: 'app_setting'; key: string; builtIn: string | null }
  /** Written in the app. `text` null: built from the record each time — the sample is the place to read it. */
  | { kind: 'code'; text: string | null; version?: string }
  /** Typed on each record. */
  | { kind: 'per_record'; where: string; startsFrom: string }
  /** Set in a Settings block that has its own shape (presets, a form) — not one text this tab can print. */
  | { kind: 'settings_block'; where: string }

/** Where the wording is changed. */
export type ContractEditDoor =
  /** The Book document's own editor, opened on the card. */
  | { kind: 'standard_terms' }
  /** A section on another Settings tab. */
  | { kind: 'settings'; tabId: string; anchorId: string; label: string; devOnly: boolean }
  /** A page of the app. */
  | { kind: 'page'; to: string; label: string }
  /** Nowhere in the app. */
  | { kind: 'code'; note: string }

export type ContractStepRef = { journeyId: JourneyId; stepId: string }

/** A sentence this file repeats from a page or a builder, and the file it must still be in. */
export type ContractPin = { file: string; text: string }

export type ContractCatalogEntry = {
  id: string
  name: string
  group: ContractCatalogGroup
  area: ContractCatalogArea
  audience: ContractCatalogAudience
  /** What it is, in one sentence. */
  what: string
  /** How the customer takes it on. */
  customerAction: string
  source: ContractTextSource
  edit: ContractEditDoor
  /** Where the customer's own copy is kept; null when none is. */
  copyKept: string | null
  /** The steps on What customers see that show it. */
  seenOn: ContractStepRef[]
  /** The public routes it is served on (App.tsx spelling). */
  routes?: string[]
  /** The help guide that covers it. */
  guide?: string
  pins?: ContractPin[]
}

const H = (stepId: string): ContractStepRef => ({ journeyId: 'homeowner', stepId })
const G = (stepId: string): ContractStepRef => ({ journeyId: 'gc', stepId })

const CX_BUILTIN = builtinEstimateExperience()

const BIDS_AND_MATERIALS = 'settings-catalogs'
export const ANCHOR_ESTIMATE_PUBLIC_TERMS = 'settings-estimate-public-terms'
export const ANCHOR_ESTIMATE_CX_DEFAULTS = 'settings-estimate-cx-defaults'
export const ANCHOR_BID_COVER_LETTER_DEFAULTS = 'settings-bid-cover-letter-defaults'

const ESTIMATE_SIGNING_SENTENCE =
  'By signing, you accept this estimate, its associated costs, and the Terms and Conditions. Additional requests to approve modifications to this estimate will not void this agreement unless otherwise stated.'
const JOB_SIGNING_SENTENCE = 'Your signature below applies to the scope, price, and terms shown on this page.'
const JOB_AGREE_SENTENCE = 'I agree to do business electronically and accept this agreement, its scope, price, and terms.'
const BID_AGREE_SENTENCE = 'I agree to conduct business electronically and accept this proposal, its inclusions, exclusions, and terms.'
const BID_CHANGE_ORDER_AGREE_SENTENCE = 'I agree to this change order and its impact on cost and schedule.'
const BID_ACCEPTANCE_BLOCK = 'The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.'

function lines(parts: ReadonlyArray<readonly [string, string]>): string {
  return parts.map(([label, text]) => `${label}\n${text}`).join('\n\n')
}

export const CUSTOMER_CONTRACT_CATALOG: readonly ContractCatalogEntry[] = [
  // ---- Estimates ----
  {
    id: 'estimate-terms',
    name: 'Estimate Terms and Conditions',
    group: 'signed',
    area: 'estimates',
    audience: 'homeowner',
    what: 'The public terms page every estimate links to, and the page the electronic-signature disclosure sits on.',
    customerAction: 'Agrees to it with the checkbox when accepting an estimate or a change order.',
    source: { kind: 'app_setting', key: ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY, builtIn: null },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_ESTIMATE_PUBLIC_TERMS, label: 'Settings → Bids & materials → Public estimate Terms and Conditions', devOnly: true },
    copyKept: null,
    seenOn: [H('estimate-terms'), H('estimate-page')],
    routes: ['/estimate/terms'],
    guide: 'send-an-estimate-and-turn-it-into-a-job',
  },
  {
    id: 'estimate-terms-box',
    name: 'Terms box on each estimate',
    group: 'signed',
    area: 'estimates',
    audience: 'homeowner',
    what: 'Free text under the Terms heading on one estimate or change order, above the link to the Terms and Conditions.',
    customerAction: 'Agrees to it with the checkbox when accepting that estimate.',
    source: { kind: 'per_record', where: 'Typed on each estimate', startsFrom: 'Starts blank. A proposal signed in the bid room files its inclusions, exclusions and terms here.' },
    edit: { kind: 'page', to: '/estimates', label: 'Estimates → open a draft → Terms' },
    copyKept: 'Frozen on the estimate when it is first sent.',
    seenOn: [H('estimate-page')],
    routes: ['/estimate/accept'],
    guide: 'send-an-estimate-and-turn-it-into-a-job',
  },
  {
    id: 'estimate-agree-sentence',
    name: 'Estimate agreement checkbox',
    group: 'signed',
    area: 'estimates',
    audience: 'homeowner',
    what: 'The sentence beside the checkbox a customer ticks to accept an estimate.',
    customerAction: 'Ticks it, then types or draws a signature.',
    source: { kind: 'app_setting', key: ESTIMATE_APP_SETTING_KEYS.accept_checkbox_label, builtIn: CX_BUILTIN.accept_checkbox_label },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_ESTIMATE_CX_DEFAULTS, label: 'Settings → Bids & materials → Estimate customer experience defaults', devOnly: true },
    copyKept: 'Frozen on the estimate when it is sent. One estimate can carry its own wording.',
    seenOn: [H('estimate-page')],
    routes: ['/estimate/accept'],
    guide: 'send-an-estimate-and-turn-it-into-a-job',
  },
  // ---- Bids ----
  {
    id: 'bid-terms',
    name: 'Bid terms & warranty',
    group: 'signed',
    area: 'bids',
    audience: 'gc',
    what: 'The terms paragraph on the bid cover letter and the Terms section of the bid room.',
    customerAction: 'Signs the proposal in the bid room, or signs the printed letter.',
    source: { kind: 'app_setting', key: APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT, builtIn: DEFAULT_TERMS_AND_WARRANTY },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_BID_COVER_LETTER_DEFAULTS, label: 'Settings → Bids & materials → Bid Cover Letter Defaults', devOnly: true },
    copyKept: 'In the bid room, frozen in each published revision and filed on the signed proposal. A printed letter keeps no copy.',
    seenOn: [G('bid-room'), G('bid-room-email')],
    routes: ['/bid-room'],
    guide: 'send-a-bid-for-signature',
  },
  {
    id: 'bid-exclusions',
    name: 'Bid exclusions',
    group: 'signed',
    area: 'bids',
    audience: 'gc',
    what: 'The exclusions list on the bid cover letter and the Exclusions section of the bid room.',
    customerAction: 'Signs the proposal in the bid room, or signs the printed letter.',
    source: { kind: 'app_setting', key: APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT, builtIn: DEFAULT_EXCLUSIONS },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_BID_COVER_LETTER_DEFAULTS, label: 'Settings → Bids & materials → Bid Cover Letter Defaults', devOnly: true },
    copyKept: 'In the bid room, frozen in each published revision and filed on the signed proposal. A printed letter keeps no copy.',
    seenOn: [G('bid-room')],
    routes: ['/bid-room'],
    guide: 'send-a-bid-for-signature',
  },
  {
    id: 'bid-closing',
    name: 'Bid letter closing',
    group: 'signed',
    area: 'bids',
    audience: 'gc',
    what: 'The closing lines of the printed cover letter, before "Respectfully submitted". Not shown in the bid room.',
    customerAction: 'Signs the printed letter.',
    source: { kind: 'app_setting', key: APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING, builtIn: DEFAULT_COVER_LETTER_CLOSING },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_BID_COVER_LETTER_DEFAULTS, label: 'Settings → Bids & materials → Bid Cover Letter Defaults', devOnly: true },
    copyKept: null,
    seenOn: [],
    guide: 'send-a-bid-for-signature',
  },
  {
    id: 'bid-letter-fixed',
    name: 'Bid letter acceptance block and bid basis',
    group: 'signed',
    area: 'bids',
    audience: 'gc',
    what: 'Two fixed passages on the printed cover letter: the signature block a bid can switch on, and the clause a bid to marked-up plans carries. Neither is shown in the bid room.',
    customerAction: 'Signs the printed letter in ink.',
    source: {
      kind: 'code',
      text: lines([
        ['Acceptance of estimate (when the bid has the signature block on)', BID_ACCEPTANCE_BLOCK],
        ['Bid basis (when the bid is to our marked-up plans)', bidBasisClause({ planDateFormatted: null, sheets: [] })],
      ]),
    },
    edit: { kind: 'code', note: 'Fixed in the app. Each bid switches them on or off on Bids → Cover Letter.' },
    copyKept: null,
    seenOn: [],
    guide: 'send-a-bid-for-signature',
    pins: [
      { file: 'src/lib/bidDocuments/coverLetter.ts', text: BID_ACCEPTANCE_BLOCK },
      { file: 'src/lib/bids/bidBasis.ts', text: 'Where our marks and the issued drawings differ, our marks govern.' },
    ],
  },
  // ---- Jobs ----
  {
    id: 'job-standard-terms',
    name: 'Job service agreement — standard terms',
    group: 'signed',
    area: 'jobs',
    audience: 'homeowner',
    what: 'The numbered legal paragraphs every job service agreement prints under its scope and price.',
    customerAction: 'Signs the agreement on its page, or on paper.',
    source: { kind: 'contract_book', builtIn: DEFAULT_JOB_CONTRACT_TERMS_PLAIN, builtInName: 'Built-in service agreement terms' },
    edit: { kind: 'standard_terms' },
    copyKept: 'Each agreement keeps the wording and the version date it went out with.',
    seenOn: [H('job-contract-page'), H('job-contract-email'), H('job-contract-signed')],
    routes: ['/contract/sign'],
    guide: 'get-a-job-contract-signed',
  },
  {
    id: 'job-payment-line',
    name: 'Job service agreement — payment line',
    group: 'signed',
    area: 'jobs',
    audience: 'homeowner',
    what: 'The payment sentence under the price. Each agreement picks one; Custom is typed on the agreement.',
    customerAction: 'Signs the agreement on its page, or on paper.',
    source: {
      kind: 'code',
      text: lines([
        ['50% down, balance on completion', paymentTermsSentence({ amount_cents: null, payment_terms_key: 'half_down', payment_terms_text: '' })],
        ['Due on completion', paymentTermsSentence({ amount_cents: null, payment_terms_key: 'on_completion', payment_terms_text: '' })],
        ['Progress billing', paymentTermsSentence({ amount_cents: null, payment_terms_key: 'progress', payment_terms_text: '' })],
      ]),
    },
    edit: { kind: 'code', note: 'The three sentences are fixed in the app. Each agreement picks one, or types its own, in the Contract window.' },
    copyKept: 'Each agreement keeps the payment line it was sent with.',
    seenOn: [H('job-contract-page')],
    routes: ['/contract/sign'],
    guide: 'get-a-job-contract-signed',
  },
  // ---- Every signing page ----
  {
    id: 'signing-sentences',
    name: 'Signing page sentences',
    group: 'signed',
    area: 'signing',
    audience: 'everyone',
    what: 'The fixed sentences beside the signature on the three signing pages, and on a change order in the bid room.',
    customerAction: 'Reads them and ticks the box before signing.',
    source: {
      kind: 'code',
      text: lines([
        ['Estimate — above the signature', ESTIMATE_SIGNING_SENTENCE],
        ['Job agreement — above the signature', JOB_SIGNING_SENTENCE],
        ['Job agreement — the checkbox', JOB_AGREE_SENTENCE],
        ['Bid room — the checkbox', BID_AGREE_SENTENCE],
        ['Bid room, a change order — the checkbox', BID_CHANGE_ORDER_AGREE_SENTENCE],
      ]),
    },
    edit: { kind: 'code', note: 'Fixed in the app.' },
    copyKept: null,
    seenOn: [H('estimate-page'), H('job-contract-page'), G('bid-room')],
    routes: ['/estimate/accept', '/contract/sign', '/bid-room'],
    pins: [
      { file: 'src/components/estimates/EstimateAcceptBody.tsx', text: 'By signing, you accept this estimate, its associated costs, and the Terms and Conditions. ' },
      { file: 'src/components/estimates/EstimateAcceptBody.tsx', text: 'Additional requests to approve modifications to this estimate will not void this agreement unless otherwise stated.' },
      { file: 'src/pages/JobContractSign.tsx', text: JOB_SIGNING_SENTENCE },
      { file: 'src/pages/JobContractSign.tsx', text: JOB_AGREE_SENTENCE },
      { file: 'src/pages/BidRoom.tsx', text: BID_AGREE_SENTENCE },
      { file: 'src/pages/BidRoom.tsx', text: BID_CHANGE_ORDER_AGREE_SENTENCE },
    ],
  },
  {
    id: 'esign-consent',
    name: 'Electronic-signature consent',
    group: 'signed',
    area: 'signing',
    audience: 'everyone',
    what: 'The consent shown beside every electronic signature, with the full disclosure on the terms page. English and Spanish.',
    customerAction: 'Ticks "I agree to sign electronically." before signing.',
    source: {
      kind: 'code',
      version: `version ${ESIGN_CONSENT_VERSION}`,
      text: lines([
        ['A homeowner signing an agreement', esignConsentText({ audience: 'customer', documentNoun: 'this agreement' }).clauseText],
        ['A contractor approving a proposal', esignConsentText({ audience: 'gc', documentNoun: 'this proposal' }).clauseText],
      ]),
    },
    edit: { kind: 'code', note: 'Fixed in the app, and versioned: a change to the wording raises the version number.' },
    copyKept: 'The words shown are stored beside each signature, with the version and the language.',
    seenOn: [H('estimate-page'), H('job-contract-page'), G('bid-room'), H('estimate-terms')],
    routes: ['/estimate/accept', '/contract/sign', '/bid-room', '/estimate/terms'],
  },
  // ---- Notices ----
  {
    id: 'bid-lien-release',
    name: 'Conditional waiver with payment terms (Bids)',
    group: 'notice',
    area: 'bids',
    audience: 'gc',
    what: 'The conditional waiver and the late-payment terms on Bids → Lien Release. The amounts and the owner\'s name are filled in per bid.',
    customerAction: 'Receives it with the invoice; we sign it.',
    source: {
      kind: 'code',
      text: lines([
        ['Conditional waiver', LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER],
        ['Payment terms and late payment', LIEN_RELEASE_DEFAULT_PAYMENT_TERMS],
      ]),
    },
    edit: { kind: 'page', to: '/bids', label: 'Bids → open a bid → Lien Release (the boxes start from this wording and are not saved)' },
    copyKept: null,
    seenOn: [],
  },
  {
    id: 'job-lien-waiver',
    name: 'Lien waiver and release (Jobs)',
    group: 'notice',
    area: 'liens',
    audience: 'homeowner',
    what: 'The conditional or unconditional waiver on a progress or final payment. The paragraphs are fixed; the blanks come from the job.',
    customerAction: 'Receives it by email; we sign it.',
    source: { kind: 'code', text: null },
    edit: { kind: 'code', note: 'The paragraphs are fixed in the app. The blanks are filled on the job\'s lien release.' },
    copyKept: 'The PDF as issued is kept on the release.',
    seenOn: [H('lien-release')],
  },
  {
    id: 'owner-lien-notice',
    name: 'Notice to the owner (§ 53.056) and homestead statement',
    group: 'notice',
    area: 'liens',
    audience: 'owner',
    what: 'The statutory notice, its cover letter and the homestead statement sent to a property owner when a contractor has not paid. Also the notice card on the owner\'s portal.',
    customerAction: 'Receives it by certified mail, with a courtesy email.',
    source: { kind: 'code', text: null },
    edit: { kind: 'code', note: 'The sworn text is fixed in the app. A cover letter can be edited per packet on the Lien desk.' },
    copyKept: 'The blanks as filed are kept on the filing.',
    seenOn: [G('owner-notice'), H('customer-portal')],
    routes: ['/portal', '/p/:slug'],
  },
  {
    id: 'demand-letter',
    name: 'Final demand letter',
    group: 'notice',
    area: 'liens',
    audience: 'homeowner',
    what: 'The last letter before collections, with the statement of account.',
    customerAction: 'Receives it by email or mail.',
    source: { kind: 'code', text: null },
    edit: { kind: 'code', note: 'The wording is fixed in the app. The legal lines are switched on or off per letter.' },
    copyKept: 'The choices made on each letter are kept on it.',
    seenOn: [H('demand-letter')],
  },
  {
    id: 'hazmat-notice',
    name: 'Biohazard fee notice',
    group: 'notice',
    area: 'billing',
    audience: 'homeowner',
    what: 'The notice of a biohazard fee. It quotes clause 11 of the Estimate Terms and Conditions, word for word.',
    customerAction: 'Receives it with the bill.',
    source: { kind: 'settings_block', where: 'Clause 11 of the Estimate Terms and Conditions; the rest of the notice is written in the app' },
    edit: { kind: 'settings', tabId: BIDS_AND_MATERIALS, anchorId: ANCHOR_ESTIMATE_PUBLIC_TERMS, label: 'The clause is part of the Estimate Terms and Conditions', devOnly: true },
    copyKept: 'The clause as quoted is kept on each notice.',
    seenOn: [H('hazmat-notice')],
    routes: ['/hazmat-notice'],
  },
  {
    id: 'invoice-footers',
    name: 'Invoice footers',
    group: 'notice',
    area: 'billing',
    audience: 'homeowner',
    what: 'The license and regulator lines, and the payment lines, at the foot of a bill.',
    customerAction: 'Receives them on every bill.',
    source: { kind: 'settings_block', where: 'Footer presets in Settings → Jobs & billing, one set for Stripe bills and one for paper bills' },
    edit: { kind: 'settings', tabId: 'settings-jobs', anchorId: 'settings-jobs', label: 'Settings → Jobs & billing → invoice footers', devOnly: true },
    copyKept: 'Each Stripe bill keeps the footer it was sent with.',
    seenOn: [H('bill-email'), H('bill-by-email')],
  },
  {
    id: 'test-report-certification',
    name: 'Test report certification',
    group: 'notice',
    area: 'jobs',
    audience: 'gc',
    what: 'The "I hereby certify" statement on a test report.',
    customerAction: 'Receives the report by email and on the portal.',
    source: { kind: 'settings_block', where: 'The test report settings in Settings → Jobs & billing' },
    edit: { kind: 'settings', tabId: 'settings-jobs', anchorId: 'settings-jobs', label: 'Settings → Jobs & billing → Test reports', devOnly: true },
    copyKept: 'The PDF as sent is kept on the report.',
    seenOn: [G('test-report-email')],
  },
]

/** Customer-facing public routes with no contract wording of ours, and why. */
export const CONTRACT_ROUTE_REASONS: Readonly<Record<string, string>> = {
  '/pay/:id': 'Names the bill and hands over to Stripe, which takes the payment on its own page.',
  '/submittal': 'The reviewer approves or returns submittals; no terms are offered.',
}

// ---------------------------------------------------------------------------
// Resolving the wording
// ---------------------------------------------------------------------------

export type ContractBookDoc = {
  id: string
  document_name: string
  book_body_html: string | null
  book_body_format: string
  book_version_date: string | null
  updated_at?: string | null
}

export type ContractCatalogData = {
  /** `app_settings.key` → `value_text`, for the keys in `contractSettingKeys()`. */
  settings: ReadonlyMap<string, string | null>
  /** Contract Book documents with the customer audience. */
  bookDocs: readonly ContractBookDoc[]
}

export type ContractTextStatus = 'yours' | 'built_in' | 'blank' | 'fixed' | 'per_record' | 'in_settings'

export const CONTRACT_STATUS_LABELS: Readonly<Record<ContractTextStatus, string>> = {
  yours: 'Your wording',
  built_in: 'Built-in wording',
  blank: 'Nothing set',
  fixed: 'Fixed in the app',
  per_record: 'Typed each time',
  in_settings: 'Set in Settings',
}

export type ResolvedContractText = {
  /** Stable across loads: the entry id, plus the document id for a Book document. */
  key: string
  entryId: string
  /** The entry's name, or the entry's name and the document's when the Book holds more than one. */
  title: string
  /** The wording; '' when there is none to show. */
  text: string
  format: 'plain' | 'html' | 'markdown'
  status: ContractTextStatus
  /** "Sep 20" for a dated Book document, "version 2" for the consent; null when nothing dates it. */
  versionLabel: string | null
  /** The Book document behind it, when there is one. */
  doc: ContractBookDoc | null
}

function bodyFormat(v: string | null | undefined): 'plain' | 'html' | 'markdown' {
  return v === 'html' || v === 'markdown' ? v : 'plain'
}

/** Every `app_settings` key the catalog reads — one fetch for the whole tab. */
export function contractSettingKeys(entries: ReadonlyArray<ContractCatalogEntry> = CUSTOMER_CONTRACT_CATALOG): string[] {
  const keys = new Set<string>()
  for (const e of entries) if (e.source.kind === 'app_setting') keys.add(e.source.key)
  return [...keys]
}

/** The wording an entry stands for today. A Book entry resolves to one text per customer document. */
export function resolveContractTexts(entry: ContractCatalogEntry, data: ContractCatalogData): ResolvedContractText[] {
  const base = { entryId: entry.id, doc: null, versionLabel: null, format: 'plain' as const }
  const s = entry.source
  if (s.kind === 'app_setting') {
    const mine = (data.settings.get(s.key) ?? '').trim()
    if (mine) return [{ ...base, key: entry.id, title: entry.name, text: mine, status: 'yours' }]
    const builtIn = (s.builtIn ?? '').trim()
    if (builtIn) return [{ ...base, key: entry.id, title: entry.name, text: builtIn, status: 'built_in' }]
    return [{ ...base, key: entry.id, title: entry.name, text: '', status: 'blank' }]
  }
  if (s.kind === 'contract_book') {
    if (data.bookDocs.length === 0) return [{ ...base, key: entry.id, title: `${entry.name} · ${s.builtInName}`, text: s.builtIn, status: 'built_in' }]
    return data.bookDocs.map((doc) => {
      const ymd = effectiveBookVersionPlainDate(doc)
      return {
        ...base,
        key: `${entry.id}:${doc.id}`,
        title: data.bookDocs.length > 1 ? `${entry.name} · ${doc.document_name}` : entry.name,
        text: doc.book_body_html ?? '',
        format: bodyFormat(doc.book_body_format),
        status: (doc.book_body_html ?? '').trim() ? ('yours' as const) : ('blank' as const),
        versionLabel: ymd ? formatWorkDateYmdMonthDayShort(ymd) : null,
        doc,
      }
    })
  }
  if (s.kind === 'code') return [{ ...base, key: entry.id, title: entry.name, text: s.text ?? '', status: 'fixed', versionLabel: s.version ?? null }]
  if (s.kind === 'settings_block') return [{ ...base, key: entry.id, title: entry.name, text: '', status: 'in_settings' }]
  return [{ ...base, key: entry.id, title: entry.name, text: '', status: 'per_record' }]
}

/** Where the wording is kept, in the office's words. */
export function contractSourceLine(entry: ContractCatalogEntry): string {
  const s = entry.source
  if (s.kind === 'app_setting') return s.builtIn ? 'A Settings text. Blank falls back to the built-in wording.' : 'A Settings text. Blank leaves the page empty.'
  if (s.kind === 'contract_book') return 'The Contract Book, as a customer document.'
  if (s.kind === 'code') return s.text == null ? 'Written in the app, around the facts of each record.' : 'Written in the app.'
  if (s.kind === 'settings_block') return `${s.where}.`
  return `${s.where}. ${s.startsFrom}`
}

// ---------------------------------------------------------------------------
// The doors
// ---------------------------------------------------------------------------

/** Who may change a Contract Book document — the rule `update_contract_book_entry` enforces. */
export function canEditStandardTerms(role: UserRole | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

export type ContractEditAction =
  | { kind: 'modal'; label: string }
  | { kind: 'settings'; label: string; tabId: string; anchorId: string }
  | { kind: 'page'; label: string; to: string }
  | { kind: 'note'; text: string }

/** What the Edit door does for this viewer. */
export function contractEditAction(entry: ContractCatalogEntry, text: ResolvedContractText, role: UserRole | null): ContractEditAction {
  const d = entry.edit
  if (d.kind === 'standard_terms') {
    if (!text.doc) return { kind: 'note', text: 'The built-in wording has no editor. Add a customer document in People → Contracts → Contract library to make it yours.' }
    if (!canEditStandardTerms(role)) return { kind: 'note', text: 'The office edits this document.' }
    return { kind: 'modal', label: 'Edit the wording' }
  }
  if (d.kind === 'settings') {
    if (d.devOnly && role !== 'dev') return { kind: 'note', text: `A dev edits this: ${d.label}.` }
    return { kind: 'settings', label: 'Open where it is edited', tabId: d.tabId, anchorId: d.anchorId }
  }
  if (d.kind === 'page') return { kind: 'page', label: d.label, to: d.to }
  return { kind: 'note', text: d.note }
}

/** The catalog entries a step on What customers see shows. */
export function contractEntriesForStep(journeyId: JourneyId, stepId: string, entries: ReadonlyArray<ContractCatalogEntry> = CUSTOMER_CONTRACT_CATALOG): ContractCatalogEntry[] {
  return entries.filter((e) => e.seenOn.some((s) => s.journeyId === journeyId && s.stepId === stepId))
}

/** `homeowner/estimate-terms` — the What customers see `?step=` value. */
export function stepParam(ref: ContractStepRef): string {
  return `${ref.journeyId}/${ref.stepId}`
}

export function parseStepParam(raw: string | null, journeys: ReadonlyArray<Journey>): ContractStepRef | null {
  if (!raw) return null
  const [journeyId, stepId, ...rest] = raw.split('/')
  if (!journeyId || !stepId || rest.length > 0) return null
  const journey = journeys.find((j) => j.id === journeyId)
  if (!journey || !journey.steps.some((s) => s.id === stepId)) return null
  return { journeyId: journey.id, stepId }
}

export function contractAnchorId(entryId: string): string {
  return `${CONTRACT_ANCHOR_PREFIX}${entryId}`
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

export const COMPARE_MAX = 3

/** Tick or untick a text for the side-by-side view. A fourth pick replaces the oldest. */
export function toggleCompare(picked: readonly string[], key: string, max: number = COMPARE_MAX): string[] {
  if (picked.includes(key)) return picked.filter((k) => k !== key)
  const next = [...picked, key]
  return next.length > max ? next.slice(next.length - max) : next
}

// ---------------------------------------------------------------------------
// The count, and the guard
// ---------------------------------------------------------------------------

export type ContractCatalogCounts = { texts: number; yours: number; builtIn: number; blank: number; fixed: number; perRecord: number; inSettings: number; dated: number }

export function contractCatalogCounts(texts: ReadonlyArray<ResolvedContractText>): ContractCatalogCounts {
  const n = (s: ContractTextStatus) => texts.filter((t) => t.status === s).length
  return { texts: texts.length, yours: n('yours'), builtIn: n('built_in'), blank: n('blank'), fixed: n('fixed'), perRecord: n('per_record'), inSettings: n('in_settings'), dated: texts.filter((t) => t.versionLabel != null).length }
}

/** "12 texts · 3 your wording · 4 built-in · 1 with nothing set · 4 fixed in the app · 2 dated" */
export function contractCountsLine(c: ContractCatalogCounts): string {
  const parts = [`${c.texts} ${c.texts === 1 ? 'text' : 'texts'}`]
  if (c.yours > 0) parts.push(`${c.yours} your wording`)
  if (c.builtIn > 0) parts.push(`${c.builtIn} built-in`)
  if (c.blank > 0) parts.push(`${c.blank} with nothing set`)
  if (c.fixed > 0) parts.push(`${c.fixed} fixed in the app`)
  if (c.perRecord > 0) parts.push(`${c.perRecord} typed each time`)
  if (c.inSettings > 0) parts.push(`${c.inSettings} set in Settings`)
  parts.push(`${c.dated} dated`)
  return parts.join(' · ')
}

/** The audiences whose public pages must be accounted for here. */
const CONTRACT_AUDIENCES: ReadonlyArray<SurfaceEntry['audience']> = ['homeowner', 'gc', 'owner']

/** Every way the catalog, the route registry and the journeys can disagree. */
export function contractCatalogProblems(input: {
  entries: ReadonlyArray<ContractCatalogEntry>
  journeys: ReadonlyArray<Journey>
  surfaces: ReadonlyArray<SurfaceEntry>
  routeReasons: Readonly<Record<string, string>>
}): string[] {
  const problems: string[] = []
  const stepIds = new Set(input.journeys.flatMap((j) => j.steps.map((s) => `${j.id}/${s.id}`)))
  const customerRoutes = input.surfaces.filter((s) => s.kind === 'route' && CONTRACT_AUDIENCES.includes(s.audience)).map((s) => s.ref)
  const covered = new Set(input.entries.flatMap((e) => e.routes ?? []))

  const seen = new Set<string>()
  for (const e of input.entries) {
    if (seen.has(e.id)) problems.push(`entry ${e.id} is listed twice`)
    seen.add(e.id)
    if (!/^[a-z][a-z0-9-]*$/.test(e.id)) problems.push(`entry ${e.id} needs a lowercase-dash id — it is a DOM id and a link target`)
    for (const s of e.seenOn) if (!stepIds.has(`${s.journeyId}/${s.stepId}`)) problems.push(`entry ${e.id} names step ${s.journeyId}/${s.stepId}, which is not in customerJourneys()`)
    for (const r of e.routes ?? []) if (!customerRoutes.includes(r)) problems.push(`entry ${e.id} names route ${r}, which is not a customer-facing public route`)
    if (((e.source.kind === 'code' && e.source.text == null) || e.source.kind === 'settings_block') && e.seenOn.length === 0) problems.push(`entry ${e.id} shows no wording and no sample — give it one or the other`)
  }
  for (const r of customerRoutes) {
    const reason = (input.routeReasons[r] ?? '').trim()
    if (!covered.has(r) && !reason) problems.push(`customer-facing route ${r} has no entry in CUSTOMER_CONTRACT_CATALOG — add the wording it offers, or a reason in CONTRACT_ROUTE_REASONS`)
    if (covered.has(r) && reason) problems.push(`route ${r} is both in the catalog and in CONTRACT_ROUTE_REASONS — pick one`)
  }
  for (const r of Object.keys(input.routeReasons)) if (!customerRoutes.includes(r)) problems.push(`CONTRACT_ROUTE_REASONS names ${r}, which is not a customer-facing public route any more`)
  return problems
}

/** The pinned sentences that are no longer in their file. `read` returns the file's text, or null when it is gone. */
export function contractPinProblems(entries: ReadonlyArray<ContractCatalogEntry>, read: (file: string) => string | null): string[] {
  const problems: string[] = []
  for (const e of entries) {
    for (const p of e.pins ?? []) {
      const src = read(p.file)
      if (src == null) problems.push(`entry ${e.id} pins a sentence to ${p.file}, which does not exist`)
      else if (!src.includes(p.text)) problems.push(`entry ${e.id}: "${p.text.slice(0, 60)}…" is no longer in ${p.file} — the page changed its wording; change it here too`)
    }
  }
  return problems
}
