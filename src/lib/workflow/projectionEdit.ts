/**
 * The Workflow page's Add / Edit Projection window: what it opens with, what
 * it refuses, the fields a save writes, and what a refused write says.
 */

export type ProjectionPlacement = 'before' | 'after'

type ProjectionForEdit = {
  stage_name: string
  memo: string
  amount: number | null
  step_id: string | null
  placement: string | null
}

export type EditingProjection<P> = {
  /** The projection being edited; null for a new one. */
  item: P | null
  stage_name: string
  memo: string
  amount: string
  /** The step it is attached to; '' for none. */
  step_id: string
  placement: ProjectionPlacement
}

/**
 * The window's opening values. An existing projection opens on its own
 * fields; a new one opens blank, attached to the step and side the opener
 * names (the Money drawer's "add" seeds both). Placement is "after" unless
 * it is "before".
 */
export function seedEditingProjection<P extends ProjectionForEdit>(
  item: P | null,
  seed?: { step_id?: string; placement?: ProjectionPlacement },
): EditingProjection<P> {
  return {
    item,
    stage_name: item?.stage_name || '',
    memo: item?.memo || '',
    amount: item?.amount?.toString() || '',
    step_id: item?.step_id ?? seed?.step_id ?? '',
    placement: item?.placement === 'before' ? 'before' : (seed?.placement ?? 'after'),
  }
}

/** What a save refuses: a blank step name or a blank memo. Null when it may go ahead. */
export function projectionSaveProblem(stageName: string, memo: string): string | null {
  if (!stageName.trim() || !memo.trim()) return 'Step name and memo are required'
  return null
}

/** Attached: the step and its side. Not attached ('' step): both null — the side only means something on a step. */
export function projectionAnchorFields(anchor?: { step_id: string; placement: ProjectionPlacement }): {
  step_id: string | null
  placement: ProjectionPlacement | null
} {
  return {
    step_id: anchor?.step_id ? anchor.step_id : null,
    placement: anchor?.step_id ? anchor.placement : null,
  }
}

/** The fields an update writes; an insert adds the workflow and the sequence. An unreadable amount is 0. */
export function projectionWriteFields(
  stageName: string,
  memo: string,
  amount: string,
  anchor?: { step_id: string; placement: ProjectionPlacement },
) {
  return {
    stage_name: stageName.trim(),
    memo: memo.trim(),
    amount: parseFloat(amount) || 0,
    ...projectionAnchorFields(anchor),
  }
}

/** One past the highest sequence among the projections in hand; 1 for the first. */
export function nextProjectionSequence(projections: ReadonlyArray<{ sequence_order: number }>): number {
  return Math.max(0, ...projections.map((p) => p.sequence_order)) + 1
}

/** What a refused insert, update or delete says, in the database's own words. Null when the write went through. */
export function projectionWriteError(
  action: 'insert' | 'update' | 'delete',
  error: { message: string } | null,
): string | null {
  if (!error) return null
  return `Failed to ${action} projection: ${error.message}`
}
