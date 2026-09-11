import type { RobotGap } from './robotRowState'

/**
 * Where the Edit bid form can land when a door opens it (v2.3334). Each key
 * names one input in BidFormModal by its DOM id; the page's focus effect
 * scrolls there, rings it, and puts the cursor in it. Keep the map and the
 * form's ids in step — a focus with no element is a silent no-op.
 */
export type BidFormFocus = 'projectName' | 'gcBuilder' | 'bidValue' | 'plansLink' | 'serviceType' | 'dueDate'

export const BID_FORM_FOCUS_ELEMENT_ID: Record<BidFormFocus, string> = {
  projectName: 'bid-form-project-name',
  gcBuilder: 'bid-form-gc-builder',
  bidValue: 'bid-form-bid-value',
  plansLink: 'bid-form-plans-link',
  serviceType: 'bid-form-service-type',
  dueDate: 'bid-form-bid-due-date',
}

/**
 * The field a robot gap is fixed on. Null when the fix is not a form field
 * (distance fills itself on save; an unreadable-but-shared link is fixed at
 * Drive, not here — though the link field is still the closest landing).
 */
export function focusForRobotGap(key: RobotGap['key'] | null | undefined): BidFormFocus | null {
  switch (key) {
    case 'plans':
    case 'plans-unreadable':
      return 'plansLink'
    case 'gc':
      return 'gcBuilder'
    case 'service-type':
      return 'serviceType'
    case 'due-date':
      return 'dueDate'
    case 'distance':
    default:
      return null
  }
}

export type NeedsDoor = { kind: 'edit-bid'; focus: BidFormFocus } | { kind: 'needs-sheet' }

/**
 * Where a Robot Board "needs a person" door goes (v2.3334). The only fix that
 * is purely a paste — no plans link, nothing asked — skips the needs sheet and
 * opens Edit bid on Job Plans: one click instead of two. Every other need
 * (unshared plans want the intake address, questions want taps) keeps the
 * sheet, which has those.
 */
export function needsDoorFor(need: { gap: RobotGap | null; questions: number } | null | undefined): NeedsDoor {
  if (need?.gap?.key === 'plans' && need.questions === 0) return { kind: 'edit-bid', focus: 'plansLink' }
  return { kind: 'needs-sheet' }
}
