/**
 * The Schedule Dispatch hub's multi-cell add: one job dropped onto every
 * selected person × day cell. This is what the hub says when it is done.
 */

export type MultiCellAddCounts = {
  /** Cells that got a block. */
  added: number
  /** Cells left alone because the person already had something in that window. */
  skippedOverlap: number
  /** Cells that could not be read or written, or whose key could not be parsed. */
  failed: number
}

export type MultiCellAddSummary = {
  message: string
  tone: 'success' | 'error' | 'info'
}

/**
 * One toast for the whole selection: "Added 3 blocks. Skipped 1 (overlap). 2 failed."
 * — each part only when it happened. It reads as a success whenever anything
 * was added, as an error when nothing was and something failed, and as plain
 * information when every cell was skipped or there was nothing to do.
 */
export function summarizeMultiCellAddResult(counts: MultiCellAddCounts): MultiCellAddSummary {
  const { added, skippedOverlap, failed } = counts
  const parts: string[] = []
  if (added > 0) parts.push(`Added ${added} block${added === 1 ? '' : 's'}`)
  if (skippedOverlap > 0) parts.push(`Skipped ${skippedOverlap} (overlap)`)
  if (failed > 0) parts.push(`${failed} failed`)
  return {
    message: parts.length > 0 ? `${parts.join('. ')}.` : 'No blocks added.',
    tone: added > 0 ? 'success' : failed > 0 ? 'error' : 'info',
  }
}
