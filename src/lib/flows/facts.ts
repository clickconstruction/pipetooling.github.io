/**
 * The flow's facts: the one list in code a flow step picks from (Messages cut 4, `BUILD_PLAN.md` §3).
 *
 * A step is finished by a fact the app keeps, never by a typed word. Each fact names the column it
 * reads, whether its stamp sits on the person, on one job or on one round of a loop, and the paper
 * it reads when it reads one. A fact that is not in this list cannot be picked in Settings → Flows.
 *
 * Lifted from the Messages prototype v1.178 (`FACTS`, `PAPER_NAMES`, `PAPER_SHORT`, `PAPER_LABEL`,
 * `A_PAPER`), with each column checked against main's schema. `kept` says how well main keeps the
 * stamp today; `gap` names what cut 4's SQL adds where it does not.
 */

/** The kind of person a flow is for. An unknown number has a one-step flow until someone names it. */
export type FlowKind = 'customer' | 'trade' | 'arch' | 'unknown'

export const FLOW_KINDS: readonly FlowKind[] = ['customer', 'trade', 'arch', 'unknown']

export type FactId =
  | 'invite_sent'
  | 'portal_opened'
  | 'w9_signed'
  | 'coi_current'
  | 'msa_signed'
  | 'quote_in'
  | 'quote_declined'
  | 'tab_seen'
  | 'carried'
  | 'not_carried'
  | 'sow_signed'
  | 'draw_approved'
  | 'draw_paid'
  | 'final_waiver'
  | 'asked_us'
  | 'bid_sent'
  | 'said_yes'
  | 'declined'
  | 'contract_signed'
  | 'start_sent'
  | 'started'
  | 'payapp_paid'
  | 'closed'
  | 'warranty_over'
  | 'co_answered'
  | 'plans_in'
  | 'question_answered'
  | 'addendum_filed'
  | 'submittal_reviewed'
  | 'certified'
  | 'named'

export type PaperId =
  | 'invitation'
  | 'w9'
  | 'coi'
  | 'msa'
  | 'quote'
  | 'sow'
  | 'waiver'
  | 'final_waiver'
  | 'bid'
  | 'contract'
  | 'schedule'
  | 'payapp'
  | 'co'
  | 'plans'
  | 'addendum'
  | 'submittal'
  | 'certificate'

/** The fact picker's groups, in the order the picker lists them. */
export type FactGroup = 'Their portal' | 'Papers' | 'Our number' | 'Money'

export const FACT_GROUPS: readonly FactGroup[] = ['Their portal', 'Papers', 'Our number', 'Money']

/** Where a fact's stamp lives: on the person (the Once lane), on one job, or on one round of a loop. */
export type FactScope = 'person' | 'job' | 'round'

/**
 * How well main keeps the stamp today. `yes`: a column holds it. `half`: it is read another way
 * (inferred, a press that stands in, a join, a sum), so it can be true with no day of its own.
 * `not_yet`: nothing to read until cut 4's SQL adds `gap`; the fact reads `no` until then.
 */
export type FactKept = 'yes' | 'half' | 'not_yet'

/**
 * A fact's reading for one person. `ok`: true. `no`: not yet. `wait`: it went and waits on them
 * (a paper of ours out for their signature). `bad`: it was true and is not now (insurance ran out).
 */
export type FactMark = 'ok' | 'no' | 'wait' | 'bad'

export type FlowFact = {
  id: FactId
  /** The fact in words, as the editor and the step card show it. */
  text: string
  /** Where the app reads it, in words; the hover card's middle line. */
  small: string
  group: FactGroup
  /** The table and column the loader reads, for the developer. */
  reads: string
  scope: FactScope
  kept: FactKept
  /** What cut 4's SQL adds so the fact is kept in full; null when nothing is missing. */
  gap: string | null
  /** The paper this fact reads, when it reads one. */
  paper?: PaperId
  /** The paper is one we send (Send it, Remind them), not one they hand us (Ask for it). */
  ours?: true
  /** A way out: when it finishes the step the job's lane ends there (they declined to quote, we did not carry it, they declined). */
  endsLane?: true
}

export const FLOW_FACTS: readonly FlowFact[] = [
  {
    id: 'invite_sent',
    text: 'the invitation email went',
    small: 'the welcome email to their portal went',
    group: 'Their portal',
    reads: "gc_trade_messages.sent_on where kind = 'invite'",
    scope: 'person',
    kept: 'yes',
    gap: null,
    paper: 'invitation',
    ours: true,
  },
  {
    id: 'portal_opened',
    text: 'they opened their portal',
    small: 'their press on Got it in their portal stands in for their first visit',
    group: 'Their portal',
    reads: 'gc_trade_portal_links.first_opened_at, else gc_companies.portal_opened_on',
    scope: 'person',
    kept: 'half',
    gap: 'gc_trade_portal_links.first_opened_at, the first visit to their link',
  },
  {
    id: 'w9_signed',
    text: 'their W-9 is signed',
    small: "a W-9 on the company's Documents, signed",
    group: 'Papers',
    reads: "person_contract_documents.signed_at where doc_type = 'w9'",
    scope: 'person',
    kept: 'yes',
    gap: null,
    paper: 'w9',
  },
  {
    id: 'coi_current',
    text: 'their insurance is current',
    small: 'a certificate on file whose expiry is ahead of today',
    group: 'Papers',
    reads: "person_contract_documents.expires_at where doc_type = 'coi' (gc_company_paper_states)",
    scope: 'person',
    kept: 'yes',
    gap: null,
    paper: 'coi',
  },
  {
    id: 'msa_signed',
    text: 'the master agreement is signed',
    small: "the agreement on the company's Documents, signed. A customer signs one only when they come back for more work",
    group: 'Papers',
    reads: "person_contract_documents.signed_at where doc_type = 'agreement'",
    scope: 'person',
    kept: 'yes',
    gap: null,
    paper: 'msa',
    ours: true,
  },
  {
    id: 'quote_in',
    text: 'their quote is in the portal',
    small: 'a quote submitted on the ask',
    group: 'Their portal',
    reads: 'gc_quotes.submitted_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'quote',
  },
  {
    id: 'quote_declined',
    text: 'they declined to quote',
    small: 'their no on the ask, pressed in their portal or taken by the office',
    group: 'Their portal',
    reads: "gc_invites.status = 'declined', declined_on",
    scope: 'round',
    kept: 'yes',
    gap: null,
    endsLane: true,
  },
  {
    id: 'tab_seen',
    text: 'they saw the bid results',
    small: 'the shared bid results opened',
    group: 'Their portal',
    reads: 'gc_bid_tab_views',
    scope: 'job',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'carried',
    text: 'we carried their quote',
    small: 'their quote in our number',
    group: 'Our number',
    reads: 'gc_trade_packages.carried_invite_id',
    scope: 'job',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'not_carried',
    text: 'we did not carry it',
    small: 'another quote carried, or none. Read from the package today, since no lost mark is kept',
    group: 'Our number',
    reads: 'gc_invites.lost_on, else gc_trade_packages.carried_invite_id names another invite',
    scope: 'job',
    kept: 'half',
    gap: 'a lost mark per invite: gc_invites.lost_on',
    endsLane: true,
  },
  {
    id: 'sow_signed',
    text: 'the statement of work is signed',
    small: "the job's statement of work with this company, signed",
    group: 'Papers',
    reads: 'gc_sows.signed_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'sow',
    ours: true,
  },
  {
    id: 'draw_approved',
    text: 'the draw is approved',
    small: 'a draw of theirs approved by us',
    group: 'Money',
    reads: 'gc_draws.approved_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'draw_paid',
    text: 'the draw is paid',
    small: 'a draw of theirs paid',
    group: 'Money',
    reads: 'gc_draws.paid_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'waiver',
  },
  {
    id: 'final_waiver',
    text: 'the unconditional final waiver is in',
    small: "the final draw's waiver, unconditional",
    group: 'Papers',
    reads: "gc_draws.waiver_on where waiver = 'unconditional' on the final draw; gc_trade_files.paper = 'unconditional_final'",
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'final_waiver',
  },
  {
    id: 'asked_us',
    text: 'they asked us',
    small: 'the ask or the plans came in for this job. The day is the day we entered the job, until the plans give one',
    group: 'Their portal',
    reads: 'gc_projects.created_at, or the first gc_plan_sets.issued_on',
    scope: 'job',
    kept: 'half',
    gap: 'the day they asked: gc_projects.created_at is the day we entered it',
  },
  {
    id: 'bid_sent',
    text: 'our bid went',
    small: 'our bid sent to the customer',
    group: 'Papers',
    reads: 'gc_projects.our_bid_sent_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'bid',
    ours: true,
  },
  {
    id: 'said_yes',
    text: 'they said yes',
    small: 'the job moved to buyout. No day is kept for the yes',
    group: 'Our number',
    reads: "gc_projects.won_on, else stage in ('buyout', 'building', 'closed') with no lost_on",
    scope: 'job',
    kept: 'half',
    gap: 'the day they said yes: gc_projects.won_on',
  },
  {
    id: 'declined',
    text: 'they declined',
    small: 'the job marked lost, with its reason',
    group: 'Our number',
    reads: 'gc_projects.lost_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
    endsLane: true,
  },
  {
    id: 'contract_signed',
    text: 'our contract is signed',
    small: 'the contract with the customer, signed',
    group: 'Papers',
    reads: 'gc_projects.owner_contract_signed_on (gc_owner_contract_sends.signed_on)',
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'contract',
    ours: true,
  },
  {
    id: 'start_sent',
    text: 'the start date went',
    small: 'the schedule letter sent',
    group: 'Papers',
    reads: 'gc_schedule_sends.sent_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'schedule',
    ours: true,
  },
  {
    id: 'started',
    text: 'the job started',
    small: 'the first day on site',
    group: 'Money',
    reads: 'gc_projects.started_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'payapp_paid',
    text: 'the pay application is paid',
    small: 'the pay application paid, read through its invoice. The pay application keeps no paid day',
    group: 'Money',
    reads: "gc_owner_pay_apps.paid_on, else its invoice's paid day (invoice_id)",
    scope: 'round',
    kept: 'half',
    gap: 'a paid day on the pay application: gc_owner_pay_apps.paid_on',
    paper: 'payapp',
    ours: true,
  },
  {
    id: 'closed',
    text: 'the job is closed',
    small: 'the job closed out',
    group: 'Money',
    reads: 'gc_projects.closed_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'warranty_over',
    text: 'the warranty year ended',
    small: 'a year after the customer accepted the work. No column holds the end',
    group: 'Money',
    reads: 'gc_owner_acceptances.accepted_on plus a year',
    scope: 'job',
    kept: 'half',
    gap: null,
  },
  {
    id: 'co_answered',
    text: 'the change order is signed or declined',
    small: 'the change order answered',
    group: 'Papers',
    reads: 'gc_change_orders.status, gc_change_orders.answered_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'co',
    ours: true,
  },
  {
    id: 'plans_in',
    text: 'the plan set is filed',
    small: 'the plan set issued and filed',
    group: 'Papers',
    reads: 'gc_plan_sets.issued_on',
    scope: 'job',
    kept: 'yes',
    gap: null,
    paper: 'plans',
  },
  {
    id: 'question_answered',
    text: 'their answer came',
    small: 'an answer to a question while bidding, or to an RFI while building',
    group: 'Their portal',
    reads: 'gc_plan_questions.answered_on, gc_rfis.answered_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
  },
  {
    id: 'addendum_filed',
    text: 'the addendum is filed and sent',
    small: 'an addendum filed with the plan sets and sent to the trades',
    group: 'Papers',
    reads: "gc_plan_sets where kind = 'addendum', sent by gc_plan_set_sends.sent_at",
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'addendum',
  },
  {
    id: 'submittal_reviewed',
    text: 'the submittal is reviewed',
    small: 'the architect answered the submittal',
    group: 'Papers',
    reads: 'gc_submittal_rounds.answered_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'submittal',
  },
  {
    id: 'certified',
    text: 'the certificate is recorded',
    small: "the architect's certificate on the pay application",
    group: 'Papers',
    reads: 'gc_owner_pay_apps.certified_on',
    scope: 'round',
    kept: 'yes',
    gap: null,
    paper: 'certificate',
  },
  {
    id: 'named',
    text: 'someone said who this is',
    small: 'the number or address named as one of our people',
    group: 'Their portal',
    reads: 'contacts, once Who is this? points it at a person',
    scope: 'person',
    kept: 'not_yet',
    gap: 'the contacts table (cut 1)',
  },
]

export type FlowPaper = {
  id: PaperId
  /** In a sentence: "Send their W-9", "waiting on the master agreement". */
  name: string
  /** On a paper mark: "W-9 ✓", "insurance !". */
  short: string
  /** As a heading or a column: "Insurance certificate". */
  label: string
  /** With its article: "A W-9", "An addendum". */
  aName: string
}

export const FLOW_PAPERS: Readonly<Record<PaperId, FlowPaper>> = {
  invitation: { id: 'invitation', name: 'the invitation', short: 'email', label: 'Invitation', aName: 'An invitation' },
  w9: { id: 'w9', name: 'their W-9', short: 'W-9', label: 'W-9', aName: 'A W-9' },
  coi: { id: 'coi', name: 'their certificate of insurance', short: 'insurance', label: 'Insurance certificate', aName: 'A certificate' },
  msa: { id: 'msa', name: 'the master agreement', short: 'MSA', label: 'Master agreement', aName: 'An agreement' },
  quote: { id: 'quote', name: 'their quote', short: 'quote', label: 'Quote', aName: 'A quote' },
  sow: { id: 'sow', name: 'the statement of work', short: 'SOW', label: 'Statement of work', aName: 'A statement of work' },
  waiver: { id: 'waiver', name: 'the waiver', short: 'waiver', label: 'Lien waiver', aName: 'A waiver' },
  final_waiver: { id: 'final_waiver', name: 'the final waiver', short: 'final waiver', label: 'Final lien waiver', aName: 'A final waiver' },
  bid: { id: 'bid', name: 'our bid', short: 'bid', label: 'Our bid', aName: 'A bid' },
  contract: { id: 'contract', name: 'our contract', short: 'contract', label: 'Our contract', aName: 'A contract' },
  schedule: { id: 'schedule', name: 'the schedule', short: 'schedule', label: 'Start date letter', aName: 'A schedule' },
  payapp: { id: 'payapp', name: 'the pay application', short: 'pay app', label: 'Pay application', aName: 'A pay application' },
  co: { id: 'co', name: 'the change order', short: 'CO', label: 'Change order', aName: 'A change order' },
  plans: { id: 'plans', name: 'the plan set', short: 'plans', label: 'Plan set', aName: 'A plan set' },
  addendum: { id: 'addendum', name: 'the addendum', short: 'addendum', label: 'Addendum', aName: 'An addendum' },
  submittal: { id: 'submittal', name: 'the submittal', short: 'submittal', label: 'Submittal', aName: 'A submittal' },
  certificate: { id: 'certificate', name: 'the certificate', short: 'certificate', label: "Architect's certificate", aName: 'A certificate' },
}

const FACT_BY_ID: ReadonlyMap<string, FlowFact> = new Map(FLOW_FACTS.map((f) => [f.id, f]))

export function factById(id: string): FlowFact | null {
  return FACT_BY_ID.get(id) ?? null
}

export function isFactId(id: string): id is FactId {
  return FACT_BY_ID.has(id)
}

export function isPaperId(id: string): id is PaperId {
  return Object.prototype.hasOwnProperty.call(FLOW_PAPERS, id)
}

/** The fact that reads a paper; the first in the list when two do (a draw's waiver is read by `draw_paid`). */
export function factForPaper(paper: PaperId): FlowFact | null {
  return FLOW_FACTS.find((f) => f.paper === paper) ?? null
}

/** The fact picker's list: each group in order with its facts. */
export function factGroups(): { group: FactGroup; facts: FlowFact[] }[] {
  return FACT_GROUPS.map((group) => ({ group, facts: FLOW_FACTS.filter((f) => f.group === group) }))
}

/** A step's facts in one phrase: "their W-9 is signed and their insurance is current"; `or` on a fork. */
export function factsWords(facts: readonly string[], join: 'and' | 'or'): string {
  return facts.map((id) => stepFactById(id)?.text ?? id).join(join === 'or' ? ' or ' : ' and ')
}

// ---------- papers made at runtime: the Contract library's documents ----------

/** A paper the editor's New paper window made: its Contract library document, `doc:<uuid>`. */
export type DocPaperId = `doc:${string}`

/** What a library paper's row says: on file, current (its last day ahead), signed, or sent. */
export type DocFactKind = 'on_file' | 'current' | 'signed' | 'sent'

export const DOC_FACT_KINDS: readonly DocFactKind[] = ['on_file', 'current', 'signed', 'sent']

/** A fact on a library paper: `doc:<uuid>:signed`. */
export type DocFactId = `doc:${string}:${DocFactKind}`

/** What a step may pick: a fact from the list or one on a library paper; a paper from the list or a library one. */
export type StepFactId = FactId | DocFactId
export type StepPaperId = PaperId | DocPaperId

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const DOC_PAPER = new RegExp(`^doc:(${UUID})$`)
const DOC_FACT = new RegExp(`^doc:(${UUID}):(on_file|current|signed|sent)$`)

export function isDocPaperId(id: string): id is DocPaperId {
  return DOC_PAPER.test(id)
}

/** The library document and the kind a `doc:<uuid>:<kind>` fact reads; null for any other id. */
export function docFactOf(id: string): { docId: string; kind: DocFactKind } | null {
  const m = DOC_FACT.exec(id)
  return m ? { docId: m[1] ?? '', kind: (m[2] ?? 'on_file') as DocFactKind } : null
}

export const docFactId = (docId: string, kind: DocFactKind): DocFactId => `doc:${docId}:${kind}`

const DOC_WORDS: Readonly<Record<DocFactKind, (name: string) => string>> = {
  on_file: (name) => `${name} is on file`,
  current: (name) => `${name} is current`,
  signed: (name) => `${name} is signed`,
  sent: (name) => `${name} went`,
}

/**
 * A fact on a library paper, read like the list's: a Papers fact on the person, kept in full. `name` is the library
 * document's, "the paper" until the caller knows it. Its `id` is the runtime id; it borrows `FactId`'s type, since a
 * reading names its fact by the step's id and nothing indexes the list by a runtime one.
 */
export function docFact(id: DocFactId, name = 'the paper'): FlowFact {
  const of = docFactOf(id)
  const kind = of?.kind ?? 'on_file'
  return {
    id: id as unknown as FactId,
    text: DOC_WORDS[kind](name),
    small: `${name}, from the Contract library, as its row on their Documents says`,
    group: 'Papers',
    reads: `person_contract_documents where applied_contract_template_document_id = ${of?.docId ?? '?'}`,
    scope: 'person',
    kept: 'yes',
    gap: null,
  }
}

/** A step's fact by its id: from the list, or one on a library paper; null for neither. */
export function stepFactById(id: string, docName?: string): FlowFact | null {
  return factById(id) ?? (docFactOf(id) ? docFact(id as DocFactId, docName) : null)
}
