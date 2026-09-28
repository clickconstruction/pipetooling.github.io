/**
 * Bids tabs — the keys, the two lens groups, who may open the page, and what the URL router
 * does with a `?tab=` for a role.
 *
 * Stage A of the Bids.tsx second pass (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended
 * extraction order, step 2): before this file the page allowlist was written out five times
 * (one copy spelling `assistant` / `controller` where the others called `isAssistantLike`),
 * the Followup group's keys three times, and the router's role gates as five inline branches.
 * The server (RLS, RPC gates) stays authoritative; these only decide what the page draws and
 * where a link lands.
 *
 * Adding a role: edit the sets here (see `docs/ADDING_A_NEW_ROLE.md`), then run the matrix
 * test — it pins every gate for every role.
 */
import { isAssistantLike } from '../subcontractorLikeRole'
import { canOpenDayBook } from '../people/dayBookAccess'
import { canSeeBidCosts } from './bidPursuit'

type Role = string | null | undefined

/** Every `?tab=` the page knows, in strip order. `robot-shadows` is an alias kept for old links. */
export const BIDS_TABS = [
  'bid-board',
  'robot-board',
  'audits',
  'robot-shadows',
  'robot-queue',
  'robot-scoreboard',
  'robot-console',
  'builder-review',
  'call-queue',
  'working',
  'bid-costs',
  'day-book',
  'estimators',
  'counts',
  'takeoffs',
  'labor',
  'pricing',
  'cover-letter',
  'submittals',
  'submission-followup',
  'why-we-lost',
  'waiting-to-hear',
  'job-accounts',
  'rfi',
  'change-order',
  'lien-release',
] as const

export type BidsTabKey = (typeof BIDS_TABS)[number]

export function isBidsTabKey(tab: string | null | undefined): tab is BidsTabKey {
  return tab != null && (BIDS_TABS as readonly string[]).includes(tab)
}

/** The 🤖 Robots group: the group tab lights for any of these and the Robots lens bar draws. */
export const ROBOT_LENS_KEYS: ReadonlySet<string> = new Set(['robot-board', 'audits', 'robot-shadows', 'robot-queue', 'robot-scoreboard', 'robot-console'])
export const isRobotLens = (tab: string): boolean => ROBOT_LENS_KEYS.has(tab)

/** The Followup group: By builder · Call queue · By status · Why we lost · Waiting to hear · Job accounts. */
export const FOLLOWUP_LENS_KEYS: ReadonlySet<string> = new Set(['builder-review', 'call-queue', 'submission-followup', 'why-we-lost', 'waiting-to-hear', 'job-accounts'])
export const isFollowupLens = (tab: string): boolean => FOLLOWUP_LENS_KEYS.has(tab)

/**
 * Journey map P-B1/P-B2/P-B3: a customer-side principal holds the board and the three
 * customer-facing lenses (RFI, Change Order, Lien Release) — never pricing, the cover letter,
 * followup, the estimating workbench or other builders' bids.
 */
export const PRIMARY_BIDS_TABS = ['bid-board', 'rfi', 'change-order', 'lien-release'] as const

/** The office tabs a superintendent is turned away from; By builder is the one Followup lens they keep. */
export const SUPERINTENDENT_OFFICE_BIDS_TABS = ['pricing', 'cover-letter', 'submittals', 'submission-followup', 'why-we-lost', 'waiting-to-hear', 'job-accounts', 'call-queue'] as const

export type BidsRole = 'dev' | 'master_technician' | 'assistant' | 'controller' | 'estimator' | 'primary' | 'superintendent'

/** Who opens the Bids page at all: dev · master · assistant · controller · estimator · primary · superintendent. */
export function canOpenBids(role: Role): role is BidsRole {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator' || role === 'primary' || role === 'superintendent'
}

/**
 * What the router does with a tab this role may not open:
 * - `silent` — rewrite to the Bid board without a word (dev-only robot lenses, Day book, Bid Costs);
 * - `announced` — say so first through the role gate (`bids-office-tab`, v2.2882), then land on the board.
 * `null` lets the tab stand. A role that has not loaded yet (`null`) is never bounced.
 *
 * `robot-scoreboard` is not bounced here: its body is gated at render by `canWorkRobotAudits`.
 */
export type BidsTabBounce = 'silent' | 'announced'

export function bidsTabBounce(tab: string | null | undefined, role: Role): BidsTabBounce | null {
  if (!tab || role == null) return null
  if ((tab === 'robot-queue' || tab === 'robot-console') && role !== 'dev') return 'silent'
  if (tab === 'day-book' && !canOpenDayBook(role)) return 'silent'
  if (tab === 'bid-costs' && !canSeeBidCosts(role)) return 'silent'
  if (role === 'primary' && !(PRIMARY_BIDS_TABS as readonly string[]).includes(tab)) return 'announced'
  if (role === 'superintendent' && (SUPERINTENDENT_OFFICE_BIDS_TABS as readonly string[]).includes(tab)) return 'announced'
  return null
}

/** True when a link to this tab stands for the role — what the two tab strips draw. */
export function bidsTabOpenFor(tab: BidsTabKey, role: Role): boolean {
  return bidsTabBounce(tab, role) == null
}

/** Renamed slugs: old links and bookmarks land on the tab that replaced them. */
const BIDS_TAB_ALIASES: Readonly<Record<string, BidsTabKey>> = {
  // Back-compat: the Bids "Cost Estimate" tab slug was renamed to "labor".
  'cost-estimate': 'labor',
  // v2.3222: the Shadows lens folded into the Robot Board mirror — old links (the Dashboard's
  // "Open Shadows", bookmarks) land on the mirror.
  'robot-shadows': 'robot-board',
}

export type BidsTabRoute = {
  /** The tab after alias rewrites — what the rest of the router reads. */
  tab: string | null
  /** True when an alias changed the tab: the router writes `tab` back into the URL. */
  aliased: boolean
  /** Set when the role may not open `tab`: the router lands on the Bid board. */
  bounce: BidsTabBounce | null
}

/** One decision for a `?tab=` value: alias first, then the role gates on what the alias became. */
export function resolveBidsTabRoute(rawTab: string | null | undefined, role: Role): BidsTabRoute {
  const alias = rawTab != null ? BIDS_TAB_ALIASES[rawTab] : undefined
  const tab = alias ?? rawTab ?? null
  return { tab, aliased: alias != null, bounce: bidsTabBounce(tab, role) }
}
