import type { UserRole } from '../../hooks/useAuth'

/**
 * "money story →" door (journey map Tier 5 X2 / J6-9).
 *
 * Job Summary answers "is this job making money?" but was findable only as a tab
 * (≈0 h / 30 d against 132 h on Pipeline). This kernel owns the one affordance the
 * row proposes: a link from the daily surface (the Stages row's activity header and
 * the Job Detail header) that lands on Job Summary with the job expanded and in view.
 *
 * Audience (Will, 2026-09-06): every role that can see Job Summary EXCEPT assistants.
 * The tab itself shows for `!primary && !superintendent` on /jobs; field roles never
 * reach /jobs; estimators do not reach /jobs either. So: dev, master, controller.
 * A predicate, not a literal role array at the call sites (decision 18).
 */
export function canOpenMoneyStory(role: UserRole | string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}

/** Search-param key Jobs reads to expand + scroll to one Job Summary row. */
export const MONEY_STORY_JOB_PARAM = 'job'

/** `/jobs?tab=job-summary&job=<id>` — the door's destination. */
export function moneyStoryHref(jobId: string): string {
  return `/jobs?tab=job-summary&${MONEY_STORY_JOB_PARAM}=${encodeURIComponent(jobId)}`
}

/** DOM id of a Job Summary main row, for the deep link's scroll. */
export function jobSummaryRowDomId(jobId: string): string {
  return `job-summary-row-${jobId}`
}

/** What the deep link should do once the ledger is loaded: expand + scroll, or say the job is not on the list. */
export function resolveMoneyStoryLanding(
  jobParam: string | null | undefined,
  ledgerJobIds: ReadonlySet<string> | null,
): { kind: 'wait' } | { kind: 'none' } | { kind: 'focus'; jobId: string } | { kind: 'missing'; jobId: string } {
  const id = (jobParam ?? '').trim()
  if (!id) return { kind: 'none' }
  if (ledgerJobIds === null) return { kind: 'wait' }
  return ledgerJobIds.has(id) ? { kind: 'focus', jobId: id } : { kind: 'missing', jobId: id }
}

export const MONEY_STORY_MISSING_TOAST =
  'That job is not on the Job Summary list — it may be below the job-number floor or outside the "Worked in" window.'
