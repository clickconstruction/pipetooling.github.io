import type { BidEditFormValues } from './useBidEditForm'
import { normalizeBidDateInput } from '../bidDateSentDisplay'

/**
 * Edit-Bid saves used to write EVERY payload column back, so a field the user
 * never touched clobbered any write that landed after the board row was
 * fetched — e.g. drive-intake stamped `plans_link` server-side, the modal was
 * seeded from the stale cached row, and an untouched Save nulled the stamp
 * (bid b403, 2026-08-30). Pruning to dirty-only fields closes the whole
 * open→save window for every column at once, including cross-user edits and
 * the legacy `gc_builder_id` self-clobber.
 *
 * Groups couple payload keys whose saved values are derived from each other
 * (e.g. `loss_reason` is nulled unless `outcome === 'lost'`): if any driver
 * field changed, the whole group is written so the derivation stays intact.
 */
type FieldGroup = {
  keys: readonly string[]
  dirty: (current: BidEditFormValues, initial: BidEditFormValues) => boolean
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

const FIELD_GROUPS: readonly FieldGroup[] = [
  { keys: ['drive_link'], dirty: (c, i) => c.driveLink !== i.driveLink },
  { keys: ['plans_link'], dirty: (c, i) => c.plansLink !== i.plansLink },
  { keys: ['count_tooling_plans_link'], dirty: (c, i) => c.countToolingPlansLink !== i.countToolingPlansLink },
  { keys: ['bid_submission_link'], dirty: (c, i) => c.bidSubmissionLink !== i.bidSubmissionLink },
  { keys: ['itb_links'], dirty: (c, i) => !sameList(c.itbLinks, i.itbLinks) },
  { keys: ['design_drawing_plan_date'], dirty: (c, i) => c.designDrawingPlanDate !== i.designDrawingPlanDate },
  // The save payload always sets gc_builder_id: null alongside customer_id; on an
  // untouched GC picker both are pruned so a legacy builder link survives Save.
  { keys: ['customer_id', 'gc_builder_id'], dirty: (c, i) => c.gcCustomerId !== i.gcCustomerId },
  { keys: ['bid_number'], dirty: (c, i) => c.bidNumber !== i.bidNumber },
  { keys: ['project_name'], dirty: (c, i) => c.projectName !== i.projectName },
  { keys: ['project_id'], dirty: (c, i) => c.projectId !== i.projectId },
  { keys: ['address'], dirty: (c, i) => c.address !== i.address },
  { keys: ['gc_contact_name'], dirty: (c, i) => c.gcContactName !== i.gcContactName },
  { keys: ['gc_contact_phone'], dirty: (c, i) => c.gcContactPhone !== i.gcContactPhone },
  { keys: ['gc_contact_email'], dirty: (c, i) => c.gcContactEmail !== i.gcContactEmail },
  { keys: ['estimator_id'], dirty: (c, i) => c.estimatorId !== i.estimatorId },
  { keys: ['account_manager_id'], dirty: (c, i) => c.accountManagerId !== i.accountManagerId },
  { keys: ['bid_due_date', 'bid_due_time'], dirty: (c, i) => c.bidDueDate !== i.bidDueDate || c.bidDueTime !== i.bidDueTime },
  { keys: ['estimated_job_start_date'], dirty: (c, i) => c.estimatedJobStartDate !== i.estimatedJobStartDate },
  { keys: ['submitted_to'], dirty: (c, i) => c.submittedTo !== i.submittedTo },
  {
    keys: ['outcome', 'loss_reason', 'loss_category'],
    dirty: (c, i) => c.outcome !== i.outcome || c.lossReason !== i.lossReason || c.lossCategory !== i.lossCategory,
  },
  { keys: ['bid_value'], dirty: (c, i) => c.bidValue !== i.bidValue },
  { keys: ['agreed_value'], dirty: (c, i) => c.agreedValue !== i.agreedValue },
  { keys: ['profit'], dirty: (c, i) => c.profit !== i.profit },
  { keys: ['distance_from_office'], dirty: (c, i) => c.distanceFromOffice !== i.distanceFromOffice },
  { keys: ['notes'], dirty: (c, i) => c.notes !== i.notes },
  { keys: ['service_type_id'], dirty: (c, i) => c.formServiceTypeId !== i.formServiceTypeId },
]

export type BidUpdatePruneOptions = {
  current: BidEditFormValues
  /** Snapshot captured by loadFromBid when the modal opened; null disables pruning (full payload). */
  initial: BidEditFormValues | null
  /** Parent-owned sent date: the form input value and the value at modal open. */
  bidDateSent: { current: string; initial: string }
}

/**
 * Drop payload keys whose driving form fields are untouched since the modal
 * loaded. Keys with no mapped group (attestation columns, future additions)
 * are always kept — unmapped means "written as before", never silently lost.
 * Returns {} when nothing changed; callers skip the DB write entirely then.
 */
export function pruneUnchangedBidUpdateFields<T extends Record<string, unknown>>(
  payload: T,
  opts: BidUpdatePruneOptions,
): Partial<T> {
  if (!opts.initial) return { ...payload }
  const drop = new Set<string>()
  for (const group of FIELD_GROUPS) {
    if (!group.dirty(opts.current, opts.initial)) for (const k of group.keys) drop.add(k)
  }
  if (normalizeBidDateInput(opts.bidDateSent.current) === normalizeBidDateInput(opts.bidDateSent.initial)) {
    drop.add('bid_date_sent')
  }
  const pruned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (!drop.has(k)) pruned[k] = v
  }
  return pruned as Partial<T>
}
