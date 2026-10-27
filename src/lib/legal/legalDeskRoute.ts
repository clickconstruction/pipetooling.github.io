/**
 * The Legal desk's address (punch list #182, PR 1): the desk is a page at `/legal-desk`, and
 * what it shows is in the address, so a reload keeps your place and the address bar is the
 * link to paste. `?account=<payer key>` is the account, `&tab=` one of the six tabs by a plain
 * name, `&view=map` the county map. The default view and the default tab are never written.
 *
 * `/legal` is the firm's own portal, so the desk's route is `/legal-desk`.
 *
 * The links in the wild keep working: `/jobs?tab=stages&legal=1`, `?legal=<key>` and
 * `&legalTab=fees|timeline` (the Dashboard's Needs you line, the guides, bookmarks) are mapped
 * by `legalDeskRedirect` and the Jobs page sends them here with `replace`.
 */
import type { DeskView, Tab } from '../../components/jobs/legal/legalDeskShared'

export const LEGAL_DESK_PATH = '/legal-desk'

/** The six tabs by the names the address uses. `fees` is the old name of `firm` and still reads. */
const TAB_BY_ADDRESS: Record<string, Tab> = {
  narrative: 'narrative',
  account: 'account',
  paper: 'paper',
  evidence: 'evidence',
  firm: 'fees_steps',
  fees: 'fees_steps',
  timeline: 'timeline',
}

const ADDRESS_BY_TAB: Record<Tab, string> = {
  narrative: 'narrative',
  account: 'account',
  paper: 'paper',
  evidence: 'evidence',
  fees_steps: 'firm',
  timeline: 'timeline',
}

/** The tab the desk opens on when the address names none. */
export const LEGAL_DESK_DEFAULT_TAB: Tab = 'account'

export type LegalDeskAddress = {
  /** The payer key of the account to show; null for the rail's own pick. */
  account: string | null
  /** Which tab; null when the address names none (the default applies). */
  tab: Tab | null
  view: DeskView
}

/** The tab an address word names, or null for a word the desk does not know. */
export function legalDeskTabFromWord(word: string | null | undefined): Tab | null {
  if (!word) return null
  return TAB_BY_ADDRESS[word] ?? null
}

/** The address of a tab, a view and an account: `/legal-desk?account=…&tab=…` or `/legal-desk?view=map`. */
export function legalDeskHref(parts: { account?: string | null; tab?: Tab | null; view?: DeskView | null } = {}): string {
  const q = new URLSearchParams()
  if (parts.account) q.set('account', parts.account)
  if (parts.tab && parts.tab !== LEGAL_DESK_DEFAULT_TAB) q.set('tab', ADDRESS_BY_TAB[parts.tab])
  // The map keeps the account and the tab in the address: Accounts brings them back as they were.
  if (parts.view === 'map') q.set('view', 'map')
  const s = q.toString()
  return s ? `${LEGAL_DESK_PATH}?${s}` : LEGAL_DESK_PATH
}

/** What the address asks the desk to show. An unknown tab word reads as no tab. */
export function legalDeskFromSearch(search: URLSearchParams): LegalDeskAddress {
  const account = (search.get('account') ?? '').trim()
  return {
    account: account || null,
    tab: legalDeskTabFromWord(search.get('tab')),
    view: search.get('view') === 'map' ? 'map' : 'accounts',
  }
}

/**
 * The old links, mapped: `?legal=1` / `?legal=true` opens the desk, `?legal=<key>` one account,
 * `&legalTab=fees` the firm tab and `&legalTab=timeline` the timeline. Null when the search
 * carries no `legal` param, so the caller leaves the page alone.
 */
export function legalDeskRedirect(search: URLSearchParams): string | null {
  const legal = search.get('legal')
  if (legal == null || legal === '') return null
  const account = legal === '1' || legal === 'true' ? null : legal
  return legalDeskHref({ account, tab: legalDeskTabFromWord(search.get('legalTab')) })
}

/** The Pipeline's own address; its one-shot doors (`?stagesJob=`, `?chase=1`, `?lienwindow=`) ride on it. */
export const PIPELINE_HREF = '/jobs?tab=stages'

/** The Pipeline opened at a job's row: the desk's door back onto the board. */
export function pipelineJobHref(jobId: string): string {
  return `${PIPELINE_HREF}&stagesJob=${encodeURIComponent(jobId)}`
}
