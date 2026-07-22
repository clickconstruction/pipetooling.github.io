/** Pure helpers for the Dispatch → People "copy jobs linked to people" two-stage
 * flow (toolbar chains button): stage 1 selects source blocks, stage 2 applies
 * linked copies of every selected block to each clicked person. The per-leg
 * safety (overlap, duplicate-in-group, group creation) lives in
 * `insertScheduleDispatchCopiedLeg`; these helpers only manage selection state
 * and summarize apply outcomes for the toast. */

export type LinkedCopyMode = {
  stage: 1 | 2
  selectedBlockIds: ReadonlySet<string>
}

/** Toggle a block in the stage-1 selection (returns a new set). */
export function toggleLinkedCopyBlockSelection(
  selected: ReadonlySet<string>,
  blockId: string,
): Set<string> {
  const next = new Set(selected)
  if (next.has(blockId)) next.delete(blockId)
  else next.add(blockId)
  return next
}

export type LinkedCopyLegResult = {
  blockId: string
  error: string | null
}

/** One-line toast summary for a person: "Applied 2 linked copies" /
 * "Applied 1 linked copy · skipped 2 (overlap or already linked)" /
 * "Nothing applied — 3 skipped (overlap or already linked)". */
export function summarizeLinkedCopyApply(results: LinkedCopyLegResult[]): {
  applied: number
  skipped: number
  message: string
  tone: 'success' | 'info' | 'error'
} {
  const applied = results.filter((r) => r.error == null).length
  const skipped = results.length - applied
  const copyWord = (n: number) => (n === 1 ? 'linked copy' : 'linked copies')
  if (applied > 0 && skipped === 0) {
    return { applied, skipped, message: `Applied ${applied} ${copyWord(applied)}.`, tone: 'success' }
  }
  if (applied > 0) {
    return {
      applied,
      skipped,
      message: `Applied ${applied} ${copyWord(applied)} · skipped ${skipped} (overlap or already linked).`,
      tone: 'info',
    }
  }
  return {
    applied,
    skipped,
    message: `Nothing applied — ${skipped} skipped (overlap or already linked).`,
    tone: 'error',
  }
}

/** Combined toast for a stage-2 LANE click (one apply per member × source
 * block). Flattens every leg result into the standard summary and prefixes the
 * lane name + crew size: "Underground crew (3 people): Applied 6 linked copies." */
export function summarizeLinkedCopyLaneApply(
  laneLabel: string,
  peopleCount: number,
  results: LinkedCopyLegResult[],
): { applied: number; skipped: number; message: string; tone: 'success' | 'info' | 'error' } {
  const sum = summarizeLinkedCopyApply(results)
  const who = `${laneLabel} (${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`
  return { ...sum, message: `${who}: ${sum.message}` }
}
