/**
 * Which Jobs tabs kick the shared jobs-list load on arrival (`loadJobs` /
 * `loadJobsScopedForStages` in `Jobs.tsx`). Tabs not listed render off
 * whatever the shared cache already holds.
 *
 * Why this is a kernel: `jobsListLoading` initialises TRUE in
 * `JobsListCacheContext` and only flips when a load runs. Every "wait for the
 * jobs" gate on the page (Edit Job, `?edit=`, the stages deep links) reads that
 * flag — so a tab missing from this list can never satisfy those gates. That
 * was the Job Summary deep-link bug (journey map J6-6): Edit Job from a Job
 * Summary row said "Please wait until jobs finish loading" forever, because on
 * that tab the load never started.
 *
 * - stages / billing / parts: the original three.
 * - subs (v2.2927, was sub_sheet_ledger + work_orders): the pay run's New Sub Labor
 *   picker, the Work board's labels and its assembler all read the cache.
 * - job-summary (Tier-2 #17): its own ledger loader (`useJobSummaryData`) paints
 *   the tab, but Edit Job and the job-window openers read the shared list.
 */
export const JOBS_TABS_THAT_LOAD_THE_JOBS_LIST: ReadonlySet<string> = new Set([
  'stages',
  'billing',
  'parts',
  'subs',
  'job-summary',
])

export function shouldLoadJobsListForTab(tab: string | null | undefined): boolean {
  return tab != null && JOBS_TABS_THAT_LOAD_THE_JOBS_LIST.has(tab)
}
