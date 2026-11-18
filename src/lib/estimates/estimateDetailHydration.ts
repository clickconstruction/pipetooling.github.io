/**
 * What an estimate row opens as (punch list #46 row 3, the Estimates map's Stage-A row 4).
 *
 * The detail page's `load()` read a row and seeded some twenty pieces of form state inline. The
 * rules in that seeding — which lines a draft opens on, the good-through date a new draft gets,
 * the live attachment against the frozen one, who is told on acceptance — are pure, and they are
 * what the autosave's baseline is taken from. They live here with tests; `load()` keeps the reads,
 * the redirect and the order it sets things in.
 */
import type { Tables } from '../../types/database'
import { addCalendarDaysYmd, presetMatchingTodayOffset, type ValidUntilPresetDays } from '../addCalendarDaysYmd'
import { extractContactFromCustomer, getCustomerDisplay, type CustomerRow } from '../customerContactDisplay'
import { parseAcceptHeaderBrand, type EstimateAcceptHeaderBrand } from '../estimateAcceptHeaderBrand'
import { isChangeOrderDocKind, parseEstimateChangeOrderFields, type EstimateChangeOrderFields } from '../estimateChangeOrder'
import { parseCustomerAttachmentSent } from '../estimateCustomerAttachment'
import { normalizeEstimateLineItemsFromJson, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { defaultDraftFirstLine } from './estimateDraftLines'
import { defaultEstimateSelection, normalizeEstimateOptionsFromJson, recommendedEstimateOption, type EstimateOption } from './estimateOptions'
import { defaultEstimateTitle, isGenericEstimateTitle } from './estimateTitle'

type EstimateRowForForm = Pick<
  Tables<'estimates'>,
  | 'status'
  | 'doc_kind'
  | 'accept_header_brand'
  | 'terms_snapshot'
  | 'line_items_snapshot'
  | 'options_snapshot'
  | 'change_order_fields'
  | 'customer_id'
  | 'valid_until'
  | 'for_address'
  | 'project_id'
  | 'internal_notes'
  | 'accept_notify_user_ids'
  | 'customer_attachment_url'
  | 'customer_attachment_label'
  | 'customer_attachment_sent'
>

export interface EstimateFormFromRow {
  acceptHeaderBrand: EstimateAcceptHeaderBrand | null
  terms: string
  /** None on a change order, whatever the row holds. */
  options: EstimateOption[]
  viewedOptionKey: string | null
  previewSelectedOptionKeys: string[]
  lines: EstimateLineItemNormalized[]
  coFields: EstimateChangeOrderFields
  customerId: string | null
  validUntil: string
  validUntilPreset: ValidUntilPresetDays | null
  forAddress: string
  linkedProjectId: string
  internalNotes: string
  /**
   * Who is emailed when the customer accepts: the saved ids, or `'draft-default'` for a draft that
   * has never had a list — the page then reads the master technicians and adds the person editing.
   */
  acceptNotifyIds: string[] | 'draft-default'
  /** The ids whose names a sent row shows on its locked list; none on a draft. */
  acceptNotifyDisplayIds: string[]
  attachmentUrl: string
  attachmentLabel: string
}

function stringIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
}

export function estimateFormFromRow(row: EstimateRowForForm, today: Date = new Date()): EstimateFormFromRow {
  const isDraft = row.status === 'draft'
  const isCO = isChangeOrderDocKind(row.doc_kind)
  const parsedLines = normalizeEstimateLineItemsFromJson(row.line_items_snapshot, { allowNegative: isCO })
  const options = isCO ? [] : normalizeEstimateOptionsFromJson(row.options_snapshot)
  const viewed = recommendedEstimateOption(options)

  // With options, the editor shows the recommended option's lines; otherwise the legacy snapshot.
  // An empty estimate draft opens on the stub line; an empty change-order draft stays empty, so
  // Impact on cost opens with the guided prompt.
  const lines = viewed ? viewed.line_items : isDraft && parsedLines.length === 0 && !isCO ? [defaultDraftFirstLine()] : parsedLines

  const vu = (row.valid_until ?? '').trim()
  const validUntil = isDraft ? (vu ? vu : addCalendarDaysYmd(30, today)) : (row.valid_until ?? '')
  const validUntilPreset = isDraft ? (vu ? presetMatchingTodayOffset(vu, today) : 30) : null

  const rawNotify = row.accept_notify_user_ids
  const neverSet = rawNotify === null || rawNotify === undefined
  const attachmentFrozen = isDraft ? null : parseCustomerAttachmentSent(row.customer_attachment_sent)

  return {
    acceptHeaderBrand: parseAcceptHeaderBrand(row.accept_header_brand),
    terms: row.terms_snapshot ?? '',
    options,
    viewedOptionKey: viewed?.key ?? null,
    previewSelectedOptionKeys: defaultEstimateSelection(options),
    lines,
    coFields: parseEstimateChangeOrderFields(row.change_order_fields),
    customerId: row.customer_id ?? null,
    validUntil,
    validUntilPreset,
    forAddress: row.for_address ?? '',
    linkedProjectId: row.project_id ?? '',
    internalNotes: row.internal_notes ?? '',
    acceptNotifyIds: neverSet ? (isDraft ? 'draft-default' : []) : stringIds(rawNotify),
    acceptNotifyDisplayIds: isDraft ? [] : stringIds(rawNotify),
    attachmentUrl: isDraft ? (row.customer_attachment_url ?? '') : (attachmentFrozen?.url ?? ''),
    attachmentLabel: isDraft ? (row.customer_attachment_label ?? '') : (attachmentFrozen?.label ?? ''),
  }
}

/** A never-set draft's list: the person editing, then every master technician, no one twice. */
export function defaultAcceptNotifyIds(userId: string, masterTechnicianIds: readonly unknown[]): string[] {
  return [...new Set([userId, ...stringIds(masterTechnicianIds)])]
}

/**
 * The customer box and the Send to box as a row opens: the customer's display name when they are
 * in the list, and the row's saved address only when the customer has no email of their own.
 */
export function customerFieldsFromEstimate(
  row: Pick<Tables<'estimates'>, 'customer_id' | 'customer_email'>,
  customers: ReadonlyArray<Pick<CustomerRow, 'id' | 'name' | 'address' | 'contact_info'>>,
): { customerSearch: string; sendEmailOverride: string } {
  if (!row.customer_id) return { customerSearch: '', sendEmailOverride: '' }
  const c = customers.find((x) => x.id === row.customer_id)
  if (!c) return { customerSearch: '', sendEmailOverride: row.customer_email ?? '' }
  const crm = extractContactFromCustomer(c).email.trim()
  return { customerSearch: getCustomerDisplay(c), sendEmailOverride: crm ? '' : (row.customer_email ?? '') }
}

/**
 * The title a row opens with: its own, except a draft with a customer and a generic title, which
 * takes the customer's default (the same rule a customer pick applies).
 */
export function estimateInitialTitle(
  row: Pick<Tables<'estimates'>, 'status' | 'customer_id' | 'title' | 'doc_kind'>,
  customers: ReadonlyArray<Pick<CustomerRow, 'id' | 'name'>>,
): string {
  const title = row.title ?? ''
  if (row.status !== 'draft' || !row.customer_id || !isGenericEstimateTitle(title)) return title
  const name = customers.find((x) => x.id === row.customer_id)?.name
  return name?.trim() ? defaultEstimateTitle(name, isChangeOrderDocKind(row.doc_kind)) : title
}
