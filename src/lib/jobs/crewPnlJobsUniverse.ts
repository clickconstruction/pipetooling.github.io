/**
 * Crew P&L "jobs universe" notice (journey-map Tier-3 B8, J8-F5).
 * The tab self-loads the COMPLETE jobs list (v2.976/v2.978) because the page's
 * shared cache lazily omits Paid in Full — most of a P&L. When that load is
 * still running, or failed on a page, the table is computed from the partial
 * cache; the incident log calls this the "billing is missing" shape. This
 * kernel decides what the tab must say about it, so the numbers never lie in
 * silence.
 */
export type CrewPnlJobsUniverseState =
  | { status: 'loading' }
  | { status: 'complete'; count: number }
  | { status: 'failed'; failedAtMs: number; cachedCount: number; message: string | null }

export type CrewPnlJobsUniverseNotice = {
  tone: 'muted' | 'warning'
  text: string
  /** True when a Refresh button should retry the complete load. */
  canRetry: boolean
}

export function crewPnlJobsUniverseNotice(
  state: CrewPnlJobsUniverseState,
  formatTime: (ms: number) => string,
): CrewPnlJobsUniverseNotice | null {
  if (state.status === 'complete') return null
  if (state.status === 'loading') {
    return {
      tone: 'muted',
      text: 'Loading the complete job list — the figures below come from the page cache and may change in a moment.',
      canRetry: false,
    }
  }
  const reason = state.message?.trim() ? ` (${state.message.trim()})` : ''
  const cached = state.cachedCount === 1 ? '1 cached job' : `${state.cachedCount} cached jobs`
  return {
    tone: 'warning',
    text: `Showing cached figures from ${formatTime(state.failedAtMs)} — the complete job list didn't load${reason}, so these rows use ${cached} and paid jobs may be missing. Billed and Profit can read low. Refresh to retry.`,
    canRetry: true,
  }
}
