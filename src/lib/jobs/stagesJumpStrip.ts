/**
 * Jump-strip counts (v2.1959): the "Waiting (N) → Working (N) → …" strip used
 * to read loaded rows only, so collapsed (unfetched) sections showed (0) until
 * opened. Same resolution rule as the section headers' `sectionHdr` (v2.1824):
 * live rows once the scope is merged (or a search narrows the board), the lean
 * header-stats count before that, '…' while the first stats load is in flight.
 */
export function stagesJumpStripCount(opts: {
  /** An active board search: counts must describe the (live) matches. */
  searchActive: boolean
  /** This section's scope has been fetched into the board cache. */
  scopeMerged: boolean
  /** Count from the lean header-stats spine; null while stats haven't loaded. */
  statsCount: number | null
  liveCount: number
}): string {
  if (opts.searchActive || opts.scopeMerged) return String(opts.liveCount)
  return opts.statsCount != null ? String(opts.statsCount) : '…'
}
