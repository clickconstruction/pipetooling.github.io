/**
 * Settings → Jobs & billing, drawn by the question a person brings (punch list #261): six
 * headings in order, each card's anchor, name, one-line of what it sets, who sees it and
 * whether it folds. The page draws the headings from here, the strip reads them, the deep
 * links register every anchor from here and the doors test holds a door for each. A card is
 * mounted only for a role that sees it, as the page's own gates did before.
 *
 * The fold rule is the card's call 1: a switch stays open, since its On or Off is the one
 * fact it holds; a form folds to its name and line. The usage ledger holds no per-card count
 * yet (no Settings card wrote a press until this), so the rule decides and the fold header
 * counts from now on.
 */
import type { UserRole } from '../../hooks/useAuth'
import { canSeeGcMoney } from '../gc/access'
import { isAssistantLike } from '../subcontractorLikeRole'

export const JOBS_BILLING_TAB = 'settings-jobs'

/** Who a card is mounted for. */
export type JobsBillingWho = 'dev' | 'dev-master' | 'dev-master-office' | 'money-team'

export type JobsBillingSlug =
  | 'rates'
  | 'markup'
  | 'trip-charges'
  | 'labor-rate'
  | 'job-book'
  | 'gc-card'
  | 'gc-cutoff'
  | 'sub-pay'
  | 'stage-checklists'
  | 'machine-templates'
  | 'photos'
  | 'test-reports'
  | 'developments'
  | 'city-lines'
  | 'county-suggestions'
  | 'invoice-issuer'
  | 'invoice-footer'
  | 'stripe-footer'
  | 'bill-memo'
  | 'owner-of-record'
  | 'legal-firm'
  | 'office-county'
  | 'uncollectible'
  | 'docsmit'
  | 'gc-office-notices'
  | 'gc-customer-notice'
  | 'company-owner'
  | 'hide-hcp'
  | 'hcp-reconcile'

export type JobsBillingGroupId = 'money' | 'record' | 'bill' | 'liens' | 'notices' | 'repairs'

export interface JobsBillingCard {
  slug: JobsBillingSlug
  /** The element id a link lands on; `settings-jobs-<slug>`, but the law firms keep the anchor the Legal desk has linked since v2.4711. */
  anchor: string
  title: string
  /** One line of what the card sets, under its name on the fold header. */
  line: string
  who: JobsBillingWho
  /** A form folds; a switch stays open and draws no header of its own. */
  fold: boolean
}

export interface JobsBillingGroup {
  id: JobsBillingGroupId
  anchor: string
  name: string
  /** The strip's word for the heading. */
  short: string
  /** One line under the heading. */
  line: string
  cards: readonly JobsBillingCard[]
}

function card(slug: JobsBillingSlug, title: string, line: string, who: JobsBillingWho, fold = true): JobsBillingCard {
  return { slug, anchor: slug === 'legal-firm' ? 'settings-legal-firm' : `settings-jobs-${slug}`, title, line, who, fold }
}

export const JOBS_BILLING_GROUPS: readonly JobsBillingGroup[] = [
  {
    id: 'money',
    anchor: 'settings-jobs-group-money',
    name: 'Billing and money',
    short: 'Money',
    line: 'What an hour, a part and a trip cost the customer, and the pay rhythm.',
    cards: [
      card('rates', 'Rates charged by crew', 'the rate card by who was out, and who counts as what', 'dev'),
      card('markup', 'Markup on materials', 'percent over cost', 'dev'),
      card('trip-charges', 'Turnaway Trip Charges', 'the amount per turnaway reason', 'dev'),
      card('labor-rate', 'Default labor rate', 'what a new labor job starts at, in dollars an hour', 'dev'),
      card('job-book', 'Job Book', 'the Collect Payment line items', 'dev-master-office'),
      card('gc-card', 'GC jobs · pay by card', 'the Pay by card switch on certified bills', 'dev-master', false),
      card('gc-cutoff', 'GC jobs · the trades’ cut-off', 'days before bill day', 'money-team', false),
      card('sub-pay', 'Sub portal · pay schedule', 'the pay-run weekday and the words on the subs’ portal', 'dev'),
    ],
  },
  {
    id: 'record',
    anchor: 'settings-jobs-group-record',
    name: 'The job’s record',
    short: 'The job’s record',
    line: 'What a job carries: its stages, photos, test papers, development and address.',
    cards: [
      card('stage-checklists', 'Stage checklists', 'the questions for Rough In, Top Out and Trim Set', 'dev-master-office'),
      card('machine-templates', 'Machine templates', 'the gauges and the walk for small, medium and large excavators, skid steers and drills', 'dev-master-office'),
      card('photos', 'Photos', 'the size a report photo is shrunk to', 'dev-master-office', false),
      card('test-reports', 'Test reports', 'who certifies, the words on the paper, who sends', 'dev-master-office'),
      card('developments', 'Manage developments', 'the list: rename, the default GC, archive', 'dev'),
      card('city-lines', 'Job address city line breaks', 'extra city names the address reader knows', 'dev'),
      card('county-suggestions', 'Property county suggestions', 'extra city = county pairs', 'dev'),
    ],
  },
  {
    id: 'bill',
    anchor: 'settings-jobs-group-bill',
    name: 'What a bill says',
    short: 'The bill',
    line: 'The company block, the footers and the memo that print on a bill.',
    cards: [
      card('invoice-issuer', 'Physical invoice — company on PDF', 'the company block on paper bills, and who signs for the company', 'dev'),
      card('invoice-footer', 'Physical invoice footer presets', 'the paper bill’s footers', 'dev'),
      card('stripe-footer', 'Stripe invoice footer presets', 'the plumbing and electrical footers', 'dev'),
      card('bill-memo', 'Bill Customer memo presets', 'the memo presets on Bill Customer', 'dev'),
    ],
  },
  {
    id: 'liens',
    anchor: 'settings-jobs-group-liens',
    name: 'Liens, collections and papers',
    short: 'Liens and papers',
    line: 'Owners of record, the law firms, the county and certified mail.',
    cards: [
      card('owner-of-record', 'Liens · owner of record', 'the nightly save-from-the-roll switch', 'dev-master', false),
      card('legal-firm', '⚖ Collections law firms', 'each firm, its people, its fee model and the counties it covers', 'dev'),
      card('office-county', 'The office’s county for sworn statements', 'where a sworn statement opens its venue line', 'dev'),
      card('uncollectible', "Uncollectible: the accountant's list", 'the bills the office gave up on, by year, with a CSV for the books', 'dev'),
      card('docsmit', 'Docsmit · certified mail from the app', 'the service’s secrets and switches, and a test of the connection', 'dev'),
    ],
  },
  {
    id: 'notices',
    anchor: 'settings-jobs-group-notices',
    name: 'Notices the app sends',
    short: 'Notices',
    line: 'The emails the app sends on its own about GC bills.',
    cards: [
      card('gc-office-notices', 'GC jobs · the office’s notices', 'the project manager and the architect, before bill day', 'dev-master', false),
      card('gc-customer-notice', 'GC jobs · the customer’s notice before a bill is due', '3 days before a bill is due', 'dev-master', false),
    ],
  },
  {
    id: 'repairs',
    anchor: 'settings-jobs-group-repairs',
    name: 'Repairs and old records',
    short: 'Repairs',
    line: 'One-time fixes and what is left of HouseCall Pro.',
    cards: [
      card('company-owner', 'Company owner account', 'the account company rows are filed under, and re-assign jobs', 'dev'),
      card('hide-hcp', 'Hide the HCP field on New/Edit Job', 'the empty HCP box off the job form', 'dev', false),
      card('hcp-reconcile', 'HCP reconcile', 'import billing history from HouseCall Pro exports, previewed before anything is written', 'dev'),
    ],
  },
]

export const JOBS_BILLING_CARDS: readonly JobsBillingCard[] = JOBS_BILLING_GROUPS.flatMap((g) => g.cards)

/** An anchor inside a card that a link may name instead of the card's own: the rate card's Who counts as what list. */
export const JOBS_BILLING_CHILD_ANCHORS: Readonly<Record<string, string>> = {
  'who-counts-as-what': 'settings-jobs-rates',
}

/** Pure: whether the role is mounted the card. */
export function jobsBillingCardVisible(c: JobsBillingCard, role: UserRole | null | undefined): boolean {
  if (!role) return false
  switch (c.who) {
    case 'dev':
      return role === 'dev'
    case 'dev-master':
      return role === 'dev' || role === 'master_technician'
    case 'dev-master-office':
      return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
    case 'money-team':
      return canSeeGcMoney(role)
  }
}

/** Pure: the headings the role sees, each with only its visible cards; an empty heading is not drawn. */
export function jobsBillingGroupsFor(role: UserRole | null | undefined): JobsBillingGroup[] {
  return JOBS_BILLING_GROUPS.map((g) => ({ ...g, cards: g.cards.filter((c) => jobsBillingCardVisible(c, role)) })).filter((g) => g.cards.length > 0)
}

export function jobsBillingCardBySlug(slug: JobsBillingSlug): JobsBillingCard {
  const found = JOBS_BILLING_CARDS.find((c) => c.slug === slug)
  if (!found) throw new Error(`No Jobs & billing card ${slug}`)
  return found
}

/** Pure: every anchor the tab answers to, each mapped to the tab, for the deep links. */
export function jobsBillingAnchorToTab(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const g of JOBS_BILLING_GROUPS) {
    out[g.anchor] = JOBS_BILLING_TAB
    for (const c of g.cards) out[c.anchor] = JOBS_BILLING_TAB
  }
  return out
}

/** Pure: whether an announced id is this card, or a child anchor inside it. */
export function jobsBillingCardIsTarget(c: JobsBillingCard, id: string): boolean {
  if (!id) return false
  return id === c.anchor || JOBS_BILLING_CHILD_ANCHORS[id] === c.anchor
}

/** Pure: the heading being scrolled through, the last whose top is above the line; null before the first. */
export function jobsBillingActiveGroup(tops: ReadonlyArray<{ id: JobsBillingGroupId; top: number | null }>, line: number): JobsBillingGroupId | null {
  let active: JobsBillingGroupId | null = null
  for (const t of tops) if (t.top != null && t.top <= line) active = t.id
  return active
}

/** The strip draws at this many headings or more (call 7). */
export const JOBS_BILLING_STRIP_MIN_GROUPS = 2
