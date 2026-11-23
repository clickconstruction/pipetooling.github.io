/**
 * Merging two customer rows (v2.8324, punch list #307's last leftover): the plan the database answers before a merge,
 * in the words the merge window shows. `preview_merge_customers` counts what the row that goes holds, by table and
 * column (`holds`), what the rules will do where two rows may not both stand (`left_behind`), the portal address that
 * stops answering, the jobs that name the two as customer and GC, and whether a legal matter on each blocks the merge.
 * A table the app has no words for still shows, by its own name, so nothing the database counts is hidden.
 * Pure: no React, no Supabase.
 */

/** One kind of thing that moves, as the window lists it: "3 jobs". */
export type MergeHoldLine = { key: string; count: number; words: string }

/** One rule the merge will act on, as the window lists it. */
export type MergeRuleLine = { what: string; count: number; words: string }

export type MergePlan = {
  /** What the customer that goes holds, the largest first. */
  holds: MergeHoldLine[]
  /** What the rules will drop, close or turn off. Empty when the two hold nothing in common. */
  rules: MergeRuleLine[]
  /** Jobs that name one as the customer and the other as the GC. */
  sameJob: number
  /** Both rows hold a legal matter: the merge is refused until a dev joins them. */
  legalBlocked: boolean
}

type Noun = { one: string; many: string }

/**
 * The words for each reference the database counts, keyed by table.column. Two columns that name the same row
 * (a legal matter's customer and its payer key) share one line and its larger count.
 */
const HOLD_NOUNS: Record<string, Noun & { line?: string }> = {
  'bids.customer_id': { one: 'bid', many: 'bids' },
  'bid_versions.customer_id': { one: 'bid version priced for them', many: 'bid versions priced for them' },
  'bid_gcs.customer_id': { one: 'due date on a bid they are another GC on', many: 'due dates on bids they are another GC on' },
  'bid_gc_recipients.customer_id': { one: 'bid they are listed on as another GC', many: 'bids they are listed on as another GC' },
  'bid_proposal_rooms.customer_id': { one: 'proposal room', many: 'proposal rooms' },
  'bids_submission_entries.gc_customer_id': { one: 'bid follow-up note', many: 'bid follow-up notes' },
  'jobs_ledger.customer_id': { one: 'job', many: 'jobs' },
  'jobs_ledger.gc_customer_id': { one: 'job they are the GC on', many: 'jobs they are the GC on' },
  'estimates.customer_id': { one: 'estimate', many: 'estimates' },
  'projects.customer_id': { one: 'project', many: 'projects' },
  'customer_contacts.customer_id': { one: 'line in the old call log', many: 'lines in the old call log' },
  'customer_contact_persons.customer_id': { one: 'person at the customer', many: 'people at the customer' },
  'contacts.customer_id': { one: 'Messages contact', many: 'Messages contacts' },
  'customer_addresses.customer_id': { one: 'property', many: 'properties' },
  'customer_followup_prefs.customer_id': { one: 'follow-up setting', many: 'follow-up settings' },
  'customer_portal_links.customer_id': { one: 'portal link', many: 'portal links' },
  'customer_portal_slugs.customer_id': { one: 'portal address', many: 'portal addresses' },
  'customer_portal_slug_events.customer_id': { one: 'line of portal address history', many: 'lines of portal address history' },
  'public_page_views.entity_id': { one: 'portal visit', many: 'portal visits' },
  'gc_customer_contacts.customer_id': { one: 'line in the GC call log', many: 'lines in the GC call log' },
  'gc_projects.architect_customer_id': { one: 'GC project they drew', many: 'GC projects they drew' },
  'gc_projects.property_owner_customer_id': { one: 'GC project they own', many: 'GC projects they own' },
  'gc_review_certifications.gc_customer_id': { one: 'GC review sign-off', many: 'GC review sign-offs' },
  'gc_statement_email_requests.gc_customer_id': { one: 'statement email waiting to send', many: 'statement emails waiting to send' },
  'gc_statement_emails.gc_customer_id': { one: 'statement email sent', many: 'statement emails sent' },
  'gc_statement_round_marks.gc_customer_id': { one: 'weekly statement mark', many: 'weekly statement marks' },
  'gc_word_asks.gc_ids': { one: 'word ask that lists them', many: 'word asks that list them' },
  'gc_word_ask_answers.gc_customer_id': { one: 'answer to a word ask', many: 'answers to word asks' },
  'gc_difficulty_ratings.customer_id': { one: 'difficulty rating', many: 'difficulty ratings' },
  'gc_difficulty_asks.customer_id': { one: 'ask to rate them', many: 'asks to rate them' },
  'gc_office_notices.recipient_customer_id': { one: 'office notice', many: 'office notices' },
  'gc_owner_contract_sends.customer_id': { one: 'owner contract sent', many: 'owner contracts sent' },
  'gc_change_order_sends.customer_id': { one: 'change order sent', many: 'change orders sent' },
  'builder_customer_answers.customer_id': { one: 'answer on a name on permits', many: 'answers on names on permits' },
  'payer_pay_calendars.payer_customer_id': { one: 'pay calendar', many: 'pay calendars' },
  'job_payment_chase_touches.customer_id': { one: 'payment chase note', many: 'payment chase notes' },
  'job_payment_promises.customer_id': { one: 'payment promise', many: 'payment promises' },
  'document_builder_sends.customer_id': { one: 'document sent to them', many: 'documents sent to them' },
  'developments.gc_customer_id': { one: 'development they are the GC on', many: 'developments they are the GC on' },
  'development_history_entries.customer_id': { one: 'line of development history', many: 'lines of development history' },
  'file_index.customer_id': { one: 'file in the file index', many: 'files in the file index' },
  'sent_documents.customer_id': { one: 'paper sent to them', many: 'papers sent to them' },
  'legal_matters.customer_id': { one: 'legal matter', many: 'legal matters', line: 'legal_matters' },
  'legal_matters.payer_key': { one: 'legal matter', many: 'legal matters', line: 'legal_matters' },
  'lien_owner_record_requests.customer_id': { one: 'owner record request', many: 'owner record requests' },
  'lien_owner_record_requests.gc_customer_id': { one: 'owner record request for them as GC', many: 'owner record requests for them as GC' },
  'prospects.customer_id': { one: 'prospect linked to them', many: 'prospects linked to them' },
  'prospects.converted_customer_id': { one: 'prospect that became them', many: 'prospects that became them' },
  'in_kind_arrangements.customer_id': { one: 'pay in kind deal', many: 'pay in kind deals' },
  'dispatch_requests.pending_payload': { one: 'open dispatch request', many: 'open dispatch requests' },
  'estimator_requests.pending_payload': { one: 'open estimator request', many: 'open estimator requests' },
}

const count = (n: number, noun: Noun): string => `${n} ${n === 1 ? noun.one : noun.many}`

/** A table the app has no words for, by its own name: "2 rows in merge bed later". */
function unknownWords(key: string, n: number): string {
  const table = key.split('.')[0] ?? key
  return `${n} ${n === 1 ? 'row' : 'rows'} in ${table.replace(/_/g, ' ')}`
}

/** One line for one reference, in words. */
export function holdWords(key: string, n: number): string {
  const noun = HOLD_NOUNS[key]
  return noun ? count(n, noun) : unknownWords(key, n)
}

const toCount = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** The holds as lines, two columns of one row shown once, the largest first. */
export function holdLines(holds: Record<string, unknown>): MergeHoldLine[] {
  const byLine = new Map<string, MergeHoldLine>()
  for (const [key, raw] of Object.entries(holds)) {
    const n = toCount(raw)
    if (n === 0) continue
    const line = HOLD_NOUNS[key]?.line ?? key
    const held = byLine.get(line)
    if (held && held.count >= n) continue
    byLine.set(line, { key, count: n, words: holdWords(key, n) })
  }
  return [...byLine.values()].sort((a, b) => b.count - a.count || a.words.localeCompare(b.words))
}

/** One rule the merge will act on, in words. `address` is the portal address that stops answering. */
export function ruleWords(what: string, n: number, address: string | null): string {
  switch (what) {
    case 'followup_prefs':
      return 'Their follow-up setting is dropped. This customer’s stays.'
    case 'portal_address':
      return address ? `Their portal address ${address} stops working. This customer’s stays.` : 'Their portal address stops working. This customer’s stays.'
    case 'pay_calendar':
      return n === 1 ? 'Their pay calendar is dropped. This customer’s stays.' : `${n} of their pay calendars are dropped. This customer’s stay.`
    case 'portal_link':
      return n === 1 ? 'One of their portal links is turned off and kept. This customer’s stays live.' : `${n} of their portal links are turned off and kept. This customer’s stay live.`
    case 'week_mark':
      return n === 1 ? 'Both have a statement mark for one week. The older mark is dropped.' : `Both have statement marks for ${n} weeks. The older mark each week is dropped.`
    case 'ask_answer':
      return n === 1 ? 'Both answered one word ask. The older answer is dropped.' : `Both answered ${n} word asks. The older answer each time is dropped.`
    case 'bid_recipient':
      return n === 1 ? 'Both are listed on one bid. Their listing is dropped.' : `Both are listed on ${n} bids. Their listings are dropped.`
    case 'bid_gc_line':
      return n === 1 ? 'Both have a due date on one bid. Theirs is dropped and this customer’s stays.' : `Both have due dates on ${n} bids. Theirs are dropped and this customer’s stay.`
    case 'proposal_room':
      return n === 1 ? 'Both have an open proposal room on one bid. Theirs is closed and kept.' : `Both have open proposal rooms on ${n} bids. Theirs are closed and kept.`
    case 'document_send':
      return n === 1 ? 'Both have one paper sent and live. Their send is taken off and kept.' : `Both have ${n} papers sent and live. Their sends are taken off and kept.`
    case 'property':
      return n === 1 ? 'One of their properties is one this customer has. It folds into this customer’s.' : `${n} of their properties are ones this customer has. They fold into this customer’s.`
    default:
      return `${n} ${what.replace(/_/g, ' ')} ${n === 1 ? 'row is' : 'rows are'} settled by a rule.`
  }
}

/** The order rules are told in: what stops working first, then what is dropped, then what is only closed or folded. */
const RULE_ORDER = ['portal_address', 'followup_prefs', 'pay_calendar', 'bid_gc_line', 'bid_recipient', 'week_mark', 'ask_answer', 'portal_link', 'proposal_room', 'document_send', 'property']

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * The plan inside a preview's answer, or null when the answer has none: a database from before v2.8324 answers the six
 * counts alone, and the window shows those as it always did.
 */
export function parseMergePlan(raw: unknown): MergePlan | null {
  if (!isRecord(raw) || !isRecord(raw.holds)) return null
  const address = typeof raw.portal_address_lost === 'string' && raw.portal_address_lost.trim() !== '' ? raw.portal_address_lost : null
  const left = isRecord(raw.left_behind) ? raw.left_behind : {}
  const rules = Object.entries(left)
    .map(([what, v]) => ({ what, count: toCount(v) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => {
      const ia = RULE_ORDER.indexOf(a.what)
      const ib = RULE_ORDER.indexOf(b.what)
      return (ia < 0 ? RULE_ORDER.length : ia) - (ib < 0 ? RULE_ORDER.length : ib) || a.what.localeCompare(b.what)
    })
    .map((r) => ({ ...r, words: ruleWords(r.what, r.count, address) }))
  return { holds: holdLines(raw.holds), rules, sameJob: toCount(raw.same_job), legalBlocked: raw.legal_blocked === true }
}

/** The line about jobs that name the two as customer and GC, or null when there are none. */
export function sameJobWords(n: number): string | null {
  if (n <= 0) return null
  return n === 1
    ? 'One job names one of them as the customer and the other as the GC. After the merge it names the GC only and bills the GC.'
    : `${n} jobs name one of them as the customer and the other as the GC. After the merge they name the GC only and bill the GC.`
}

/** Why a merge of two rows that each hold a legal matter is refused, and what to do. */
export const LEGAL_BLOCKED_WORDS = 'Both have a legal matter, and one payer can hold only one. Ask a dev to join the two matters first.'

/** How many records a finished merge moved, from its answer's `moved`. Zero when the answer has none. */
export function mergeMovedTotal(raw: unknown): number {
  if (!isRecord(raw) || !isRecord(raw.moved)) return 0
  return Object.values(raw.moved).reduce<number>((sum, v) => sum + toCount(v), 0)
}

/** The words after a merge: how many records came over, when the database said. */
export function mergedToastWords(raw: unknown): string {
  const n = mergeMovedTotal(raw)
  return n > 0 ? `Customers merged. ${n} linked ${n === 1 ? 'record' : 'records'} moved over.` : 'Customers merged'
}
