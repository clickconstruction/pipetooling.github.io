/**
 * How a Workflow stage card starts out before anyone touches it: folded or
 * open, which of its sections are open, and whether the step is empty enough
 * to delete without typing its name.
 */

export type StageCardSection = 'notify' | 'notes' | 'privateNotes' | 'lineItems'

type StepForDefaults = {
  status: string
  assigned_to_name?: string | null
  notes?: string | null
  private_notes?: string | null
  started_at?: string | null
}

/** A card starts folded unless the step is in progress or rejected. */
export function isRowDefaultCollapsed(step: Pick<StepForDefaults, 'status'>): boolean {
  return step.status === 'completed' || step.status === 'approved' || step.status === 'skipped' || step.status === 'pending'
}

/**
 * Nothing to lose by deleting it: pending, never started, nobody assigned, no
 * notes of either kind and no line items. Blank-only text counts as none.
 */
export function isStepEmpty(step: StepForDefaults, lineItemCount: number): boolean {
  const hasAssignee = !!(step.assigned_to_name?.trim())
  const hasNotes = !!(step.notes?.trim())
  const hasPrivateNotes = !!(step.private_notes?.trim())
  const hasLineItems = lineItemCount > 0
  const hasStarted = !!step.started_at
  const isPending = step.status === 'pending'
  return !hasAssignee && !hasNotes && !hasPrivateNotes && !hasLineItems && !hasStarted && isPending
}

/** Line items start open, Notify starts closed, the two notes open only when written. */
export function isSectionDefaultExpanded(
  step: Pick<StepForDefaults, 'notes' | 'private_notes'>,
  section: StageCardSection,
): boolean {
  if (section === 'notify') return false
  if (section === 'notes') return !!(step.notes?.trim())
  if (section === 'privateNotes') return !!(step.private_notes?.trim())
  if (section === 'lineItems') return true
  return false
}
