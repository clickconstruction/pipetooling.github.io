/**
 * The two flags the jobs cache hands out while the board this device remembered is on screen
 * (v2.3610, through `useKeptRead` since v2.6031).
 *
 * The remembered rows stay up until every read of the board landed, the enrichment too, so a half
 * board is never kept. The Pipeline's status line reads these flags: refreshing with a remembered
 * board is *Updating jobs…*, and a remembered board that is neither loading nor refreshing is
 * *the refresh did not land*. So while the remembered rows show, refreshing is on until the live
 * read failed. Before v2.7953 it went off when the main read landed, and the line said the refresh
 * did not land for as long as the enrichment took, with every read answered.
 *
 *   - no remembered rows on screen → the cache's own flags, untouched;
 *   - remembered rows, a read out (the main read, a refresh or the enrichment) → refreshing;
 *   - remembered rows, nothing out, not failed → refreshing: the render between the last read
 *     landing and the hook handing the live rows over, never a failure;
 *   - remembered rows, the live read failed and nothing is out → not refreshing, so the line says so.
 */

export interface KeptBoardFlagsInput {
  /** The rows on screen are the ones this device kept. */
  showingKept: boolean
  /** The cache's own flags. */
  loading: boolean
  refreshing: boolean
  enriching: boolean
  /** `useKeptRead` says the kept rows stayed up because the live read failed. */
  keptFailed: boolean
}

export interface KeptBoardFlags {
  jobsListLoading: boolean
  jobsListRefreshing: boolean
}

export function keptBoardFlags(input: KeptBoardFlagsInput): KeptBoardFlags {
  const { showingKept, loading, refreshing, enriching, keptFailed } = input
  if (!showingKept) return { jobsListLoading: loading, jobsListRefreshing: refreshing }
  const readOut = loading || refreshing || enriching
  return { jobsListLoading: false, jobsListRefreshing: readOut || !keptFailed }
}
