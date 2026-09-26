import type { EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import type { EstimateAcceptHeaderBrand } from '../estimateAcceptHeaderBrand'
import type { EstimateChangeOrderFields } from '../estimateChangeOrder'
import { estimateOptionsDraftPersistFields, type EstimateOption } from './estimateOptions'

/**
 * The exact draft UPDATE payload (pure) — one builder shared by saveDraft and the autosave
 * dirty check (v2.2592), so "dirty" can never disagree with what a save would write. Lifted
 * out of `src/pages/Estimates.tsx` (Stage A of the Estimates map, v2.3867): it is the one
 * write that carries `total_cents`, and it had no test.
 *
 * Rules kept from the page:
 * - The title falls back by kind: a blank title saves as "Change order" on a change order,
 *   "Estimate" otherwise; a typed title is trimmed.
 * - Options (v2.2457): with options the legacy fields mirror the RECOMMENDED option (owner
 *   decision 3 — the Pipeline and the list show the number you'd forecast) and
 *   `options_snapshot` carries them all; without options the lines and the total write
 *   exactly as before and `options_snapshot` clears.
 * - Blanks save as null: valid-until, for-address, the linked project, internal notes.
 * - Notify ids are de-duplicated and only non-empty strings survive.
 * - `change_order_fields` is written on a change order only — an estimate's payload has no
 *   such key, so it never clears a column it does not own.
 */

export type EstimateDraftAttachmentDb = { url: string | null; label: string | null }

export type EstimateDraftPersistFields = {
  isChangeOrder: boolean
  title: string
  terms: string
  /** The lines on screen — the viewed option's when options exist. */
  lines: EstimateLineItemNormalized[]
  /** The sum of `lines` in cents (the legacy total). */
  totalCents: number
  options: EstimateOption[]
  viewedOptionKey: string | null
  validUntil: string
  forAddress: string
  linkedProjectId: string
  internalNotes: string
  customerId: string | null
  /** Resolved by the page: the CRM contact's email, else the send override, else null. */
  customerEmail: string | null
  /** Resolved by the page from the customer-experience picker; null when nothing is overridden. */
  customerExperienceOverrides: Record<string, string> | null
  acceptHeaderBrand: EstimateAcceptHeaderBrand | null
  acceptNotifyUserIds: ReadonlyArray<unknown>
  changeOrderFields: EstimateChangeOrderFields
}

export type EstimateDraftPersistPayload = {
  title: string
  terms_snapshot: string
  line_items_snapshot: EstimateLineItemNormalized[]
  total_cents: number
  options_snapshot: EstimateOption[] | null
  valid_until: string | null
  for_address: string | null
  project_id: string | null
  internal_notes: string | null
  customer_id: string | null
  customer_email: string | null
  customer_experience_overrides: Record<string, string> | null
  accept_header_brand: EstimateAcceptHeaderBrand | null
  customer_attachment_url: string | null
  customer_attachment_label: string | null
  accept_notify_user_ids: string[]
  change_order_fields?: EstimateChangeOrderFields
}

const blankToNull = (s: string): string | null => (s.trim() ? s.trim() : null)

export function buildEstimateDraftPersistPayload(f: EstimateDraftPersistFields, attDb: EstimateDraftAttachmentDb): EstimateDraftPersistPayload {
  const optionsPersist = estimateOptionsDraftPersistFields(f.options, f.viewedOptionKey, f.lines)
  return {
    title: f.title.trim() || (f.isChangeOrder ? 'Change order' : 'Estimate'),
    terms_snapshot: f.terms,
    line_items_snapshot: optionsPersist.line_items_snapshot ?? f.lines,
    total_cents: optionsPersist.total_cents ?? f.totalCents,
    options_snapshot: optionsPersist.options_snapshot,
    valid_until: blankToNull(f.validUntil),
    for_address: blankToNull(f.forAddress),
    project_id: f.linkedProjectId || null,
    internal_notes: blankToNull(f.internalNotes),
    customer_id: f.customerId,
    customer_email: f.customerEmail,
    customer_experience_overrides: f.customerExperienceOverrides,
    accept_header_brand: f.acceptHeaderBrand,
    customer_attachment_url: attDb.url,
    customer_attachment_label: attDb.label,
    accept_notify_user_ids: [...new Set(f.acceptNotifyUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0))],
    ...(f.isChangeOrder ? { change_order_fields: f.changeOrderFields } : {}),
  }
}
