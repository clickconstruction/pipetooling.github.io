/**
 * "New estimate" is not the commit (decision 17, journey map 2026-09-05).
 *
 * The estimate editor is row-backed — `saveDraft` UPDATEs by id, autosave
 * diffs against a hydrated row, 27 effects key on `row.id` — so the button
 * still mints the row. What changed: a fresh draft the user walks away from
 * without ever committing (no autosave landed, no Save draft, no Send) is
 * deleted again on leave. The first real commit keeps it. This kernel is the
 * leave-time decision; `isEmptyEstimateDraft` (the Pipeline sweep's rule)
 * defines "nothing anyone would miss".
 */
import { isEmptyEstimateDraft, type EstimatePipelineRowLike } from './estimatePipelineRefresh'

export type EstimateDraftFormSnapshotInput = {
  status: string | null | undefined
  docKind: string | null | undefined
  title: string
  customerId: string | null
  /** The editor's live line items (JSON-shaped; normalized by the emptiness rule). */
  lines: unknown
  terms: string
  changeOrderFields: unknown
}

/** The editor's live form state in the shape the emptiness rule reads. */
export function estimateDraftFormSnapshot(input: EstimateDraftFormSnapshotInput): EstimatePipelineRowLike {
  return {
    status: input.status ?? '',
    customer_id: input.customerId,
    title: input.title,
    line_items_snapshot: input.lines,
    total_cents: 0,
    doc_kind: input.docKind ?? null,
    change_order_fields: input.changeOrderFields,
    terms_snapshot: input.terms,
  }
}

export type FreshDraftLeaveInput = {
  /** This row was minted by New estimate / New change order / the Projects deep link in this visit. */
  fresh: boolean
  /** Any write since the mint — autosave, Save draft, the pre-send save. */
  everSaved: boolean
  /** Live form state (not the stale hydrated row — autosave skips the reload). */
  form: EstimatePipelineRowLike
}

/**
 * Delete the row on leave iff it was minted by this visit, never committed,
 * and still empty. Any one of those false → keep it (a kept empty row is what
 * the Pipeline's "Clean up empty drafts" sweep still exists for).
 */
export function shouldDiscardFreshEstimateDraftOnLeave(input: FreshDraftLeaveInput): boolean {
  if (!input.fresh) return false
  if (input.everSaved) return false
  return isEmptyEstimateDraft(input.form)
}
