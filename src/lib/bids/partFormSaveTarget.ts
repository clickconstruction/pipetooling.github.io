/**
 * Where a newly-created part goes after the Takeoffs part form saves (v2.1395).
 *
 * Pulled out of BidsTakeoffTab's inline if/else chain after the rough-part-line
 * route silently broke: the chain read `takeoffRoughPartPickerLineId`, but the
 * part form focuses its Name input on open, which blurs the row's search box,
 * whose onBlur nulls that id 150ms later. By save time the id was gone, the
 * chain fell through to the Add-Assembly branch, and the part was created but
 * never landed on the line ("SAVE AND ADD DID NOT ADD" — Wendi, 2026-08-04).
 *
 * The fix is `capturedRoughLineId`: recorded when the user clicks "Add Part",
 * so it cannot be cleared by focus moving into the modal. It wins over the
 * live picker state, which is kept only as a fallback for any path that opens
 * the form without capturing.
 */

export type PartFormSaveTarget =
  | { kind: 'addPartsToTemplate' }
  | { kind: 'editTemplateItem' }
  | { kind: 'roughLine'; lineId: string }
  | { kind: 'assemblyDraftItem' }

export function resolvePartFormSaveTarget(input: {
  /** Line id captured at click time — immune to the blur race. */
  capturedRoughLineId: string | null
  addPartsToTemplateModalOpen: boolean
  editTemplateModalOpen: boolean
  /** Live picker state; may already be null by save time. */
  livePickerLineId: string | null
}): PartFormSaveTarget {
  const captured = input.capturedRoughLineId?.trim()
  if (captured) return { kind: 'roughLine', lineId: captured }
  if (input.addPartsToTemplateModalOpen) return { kind: 'addPartsToTemplate' }
  if (input.editTemplateModalOpen) return { kind: 'editTemplateItem' }
  const live = input.livePickerLineId?.trim()
  if (live) return { kind: 'roughLine', lineId: live }
  return { kind: 'assemblyDraftItem' }
}
