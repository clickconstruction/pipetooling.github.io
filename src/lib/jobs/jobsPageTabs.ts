/**
 * The Jobs page's row of tabs: which tabs a role sees, in the row's order, with their words.
 *
 * The page used to decide this inside its markup, one condition a button. The rule is the same one, moved
 * here so one list draws the row at a desk and on a phone, and so a test can say what each role sees. The
 * row has two thin bars: one after Pipeline and one before Inspections.
 *
 * The Billing tab left the row in v2.8698 (punch list #190, decision 5): bills are made on the Pipeline, and
 * an old `?tab=billing` link lands there (`retiredJobsTab` below, read by the page).
 *
 * Two roles are read, as the page reads them: the one the sign-in carries and the one read from the person's
 * own row. Until either is known the row is Reports alone, so no tab flashes that the role does not have.
 */
import { isAssistantLike } from '../subcontractorLikeRole'

/** A tab of the row, by the `?tab=` value that opens it. */
export type JobsPageTabKey =
  | 'teams-summary'
  | 'reports'
  | 'stages'
  | 'combined-labor'
  | 'subs'
  | 'parts'
  | 'materials'
  | 'job-summary'
  | 'inspections'

export type JobsPageTab = {
  key: JobsPageTabKey
  /** The tab's words. */
  label: string
  /** The words a pointer resting on the tab reads, where the tab has any. */
  title?: string
  /** A thin bar is drawn before this tab. */
  barBefore: boolean
}

/** Every tab of the row with its words, in the row's order. */
const ROW: readonly Omit<JobsPageTab, 'barBefore'>[] = [
  { key: 'teams-summary', label: 'Crew P&L' },
  { key: 'reports', label: 'Reports' },
  { key: 'stages', label: 'Pipeline' },
  { key: 'combined-labor', label: 'Team' },
  { key: 'subs', label: 'Subs' },
  { key: 'parts', label: 'Parts' },
  {
    key: 'materials',
    label: 'Materials',
    title: 'Materials on site: what is in the cages and boxes on every job, what went missing, which containers are due a count',
  },
  { key: 'job-summary', label: 'Job Summary' },
  { key: 'inspections', label: 'Inspections' },
]

/** The tab that always has a thin bar before it. The other bar follows Pipeline, whichever tab that is for the role. */
const BAR_BEFORE: ReadonlySet<JobsPageTabKey> = new Set(['inspections'])

/**
 * The `?tab=` values of tabs the row no longer has, each with the tab that answers it now. `ledger` was
 * Billing's own older name. The page lands an old link on the answer and says so once.
 */
const RETIRED_TABS: ReadonlyMap<string, JobsPageTabKey> = new Map([
  ['billing', 'stages'],
  ['ledger', 'stages'],
])

/** The tab an old link's `?tab=` lands on now, or null for a tab the row still has. */
export function retiredJobsTab(tab: string | null | undefined): JobsPageTabKey | null {
  return (tab != null ? RETIRED_TABS.get(tab) : null) ?? null
}

/** What a person who followed an old Billing link reads, once, on the Pipeline. */
export const BILLING_TAB_RETIRED_WORDS = 'The Billing tab is gone. Bills are made here on the Pipeline.'

export type JobsPageTabRoles = {
  /** The role the sign-in carries. Null until it is read. */
  authRole: string | null
  /** The role on the person's own row. Null until it is read. */
  myRole: string | null
}

/** The tabs this person's row holds, in order. */
export function jobsPageTabs({ authRole, myRole }: JobsPageTabRoles): JobsPageTab[] {
  // A primary, and anyone whose role is not known yet, sees Reports alone.
  const primaryOrUnknown = authRole === 'primary' || myRole === 'primary' || (authRole === null && myRole === null)
  const restricted = !primaryOrUnknown
  const superintendent = authRole === 'superintendent' || myRole === 'superintendent'
  const assistantLike = isAssistantLike(authRole) || isAssistantLike(myRole)
  const assistant = authRole === 'assistant' || myRole === 'assistant'
  const shown: Record<JobsPageTabKey, boolean> = {
    // Crew P&L is the owner's and a dev's (punch list #188 row 1).
    'teams-summary': restricted && !assistantLike && !superintendent,
    reports: true,
    stages: restricted && !superintendent,
    'combined-labor': restricted && !assistant && !superintendent,
    subs: restricted,
    parts: restricted && !superintendent,
    materials: restricted && !superintendent,
    'job-summary': restricted && !superintendent,
    inspections: restricted && !superintendent,
  }
  const row = ROW.filter((t) => shown[t.key])
  return row.map((t, i) => ({ ...t, barBefore: BAR_BEFORE.has(t.key) || (i > 0 && row[i - 1]?.key === 'stages') }))
}
