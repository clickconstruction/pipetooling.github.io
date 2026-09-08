import type { BidEditFormValues } from './useBidEditForm'
import type { BidLossCategoryKey } from '../bidLossCategories'
import { serializeItbLinks } from '../itbLinks'
import { fromDatetimeLocal } from '../../utils/datetimeLocal'

/**
 * The `bids` row the Edit / New Bid form writes, built from the form's values.
 *
 * One builder for every writer — Create bid, Create and open counts, and the
 * Edit tab's autosave (the two hand-written copies in Bids.tsx had already
 * drifted: one wrote `account_manager_id`, the other did not). Callers prune
 * to dirty fields (`pruneUnchangedBidUpdateFields`) and merge the sent-date
 * attestation columns on top; neither concern lives here.
 */
export type BidSavePayloadArgs = {
  values: BidEditFormValues
  /** Parent-owned Bid Date Sent input ('' = none). */
  bidDateSent: string
  /** Editing a saved bid (true) or creating one (false). */
  editing: boolean
  /** dev / master / assistant-like may edit the bid number on a saved bid. */
  canEditBidNumber: boolean
}

/** The columns the form writes (a typed subset of `bids` Insert / Update). */
export type BidSavePayload = {
  drive_link: string | null
  plans_link: string | null
  count_tooling_plans_link: string | null
  bid_submission_link: string | null
  itb_links: string[]
  design_drawing_plan_date: string | null
  customer_id: string | null
  gc_builder_id: null
  /** Present only on a saved bid for a role that may edit it. */
  bid_number?: string | null
  project_name: string | null
  project_id: string | null
  address: string | null
  gc_contact_name: string | null
  gc_contact_phone: string | null
  gc_contact_email: string | null
  estimator_id: string | null
  account_manager_id: string | null
  bid_due_date: string | null
  bid_due_time: string | null
  estimated_job_start_date: string | null
  bid_date_sent: string | null
  submitted_to: string | null
  outcome: 'won' | 'lost' | 'started_or_complete' | null
  loss_reason: string | null
  loss_category: BidLossCategoryKey | null
  bid_value: number | null
  agreed_value: number | null
  profit: number | null
  distance_from_office: string | null
  /** "Don't let robots shadow this bid" (v2.3142). */
  robot_opt_out: boolean
  /** Present only when creating: saved bids derive it from contact entries. */
  last_contact?: string | null
  notes: string | null
  service_type_id: string
}

function numberOrNull(raw: string): number | null {
  return raw !== '' && !isNaN(Number(raw)) ? Number(raw) : null
}

export function buildBidSavePayload({ values: v, bidDateSent, editing, canEditBidNumber }: BidSavePayloadArgs): BidSavePayload {
  const outcome = v.outcome === 'won' || v.outcome === 'lost' || v.outcome === 'started_or_complete' ? v.outcome : null
  return {
    drive_link: v.driveLink.trim() || null,
    plans_link: v.plansLink.trim() || null,
    count_tooling_plans_link: v.countToolingPlansLink.trim() || null,
    bid_submission_link: v.bidSubmissionLink.trim() || null,
    itb_links: serializeItbLinks(v.itbLinks),
    design_drawing_plan_date: v.designDrawingPlanDate.trim() ? v.designDrawingPlanDate : null,
    customer_id: v.gcCustomerId || null,
    gc_builder_id: null,
    ...(editing && canEditBidNumber ? { bid_number: v.bidNumber.trim() || null } : {}),
    project_name: v.projectName.trim() || null,
    project_id: v.projectId || null,
    address: v.address.trim() || null,
    gc_contact_name: v.gcContactName.trim() || null,
    gc_contact_phone: v.gcContactPhone.trim() || null,
    gc_contact_email: v.gcContactEmail.trim() || null,
    estimator_id: v.estimatorId || null,
    account_manager_id: v.accountManagerId || null,
    bid_due_date: v.bidDueDate || null,
    bid_due_time: v.bidDueDate && v.bidDueTime ? v.bidDueTime : null,
    estimated_job_start_date: v.estimatedJobStartDate.trim() ? v.estimatedJobStartDate : null,
    bid_date_sent: bidDateSent || null,
    submitted_to: v.submittedTo.trim() || null,
    outcome,
    loss_reason: v.outcome === 'lost' ? v.lossReason.trim() || null : null,
    // v2.2030: structured category rides along; un-losting clears it like the note.
    loss_category: v.outcome === 'lost' ? v.lossCategory : null,
    bid_value: numberOrNull(v.bidValue),
    agreed_value: numberOrNull(v.agreedValue),
    profit: numberOrNull(v.profit),
    distance_from_office: v.distanceFromOffice.trim() || null,
    // v2.3142: "Don't let robots shadow this bid" — the one opt-out; default is on.
    robot_opt_out: v.robotOptOut,
    // Per-GC Phase 1 cleanup: last_contact is trigger-derived from method entries on saved
    // bids (Edit Bid's field is a read-only display + Log contact) — only a NEW bid seeds it.
    ...(editing ? {} : { last_contact: fromDatetimeLocal(v.lastContact) }),
    notes: v.notes.trim() || null,
    service_type_id: v.formServiceTypeId,
  }
}
