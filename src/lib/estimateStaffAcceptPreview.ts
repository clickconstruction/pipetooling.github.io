import type { EstimateExperienceOverrideKey } from './estimateCustomerExperience'
import { parseEstimateExperienceOverrides } from './estimateCustomerExperience'
import type { CustomerAttachmentPayload } from './estimateCustomerAttachment'

/** localStorage key prefix — shared across tabs (same origin) for staff “Preview as customer” in a new window. */
export const STAFF_ACCEPT_PREVIEW_STORAGE_PREFIX = 'estimate_staff_accept_preview:'

/** Discard snapshots older than this so abandoned previews do not override DB after long idle. */
const STAFF_ACCEPT_PREVIEW_TTL_MS = 60 * 60 * 1000

export type StaffAcceptPreviewLineItem = { description: string; amount_cents: number }

export type StaffAcceptPreviewSnapshotV1 = {
  v: 1
  estimateId: string
  title: string
  terms: string
  valid_until: string | null
  line_items: StaffAcceptPreviewLineItem[]
  total_cents: number
  /** Effective For line (override or CRM); optional for snapshots written before this field existed */
  for_line?: string | null
  /** Resolved override strings for customer copy (snake_case keys). */
  overrides: Record<string, string> | null
  /** Acceptance page header logo; optional for snapshots written before this field existed */
  accept_header_brand?: 'elec' | 'plum' | null
  /** Supporting document for customer page preview; optional for older snapshots */
  customer_attachment?: CustomerAttachmentPayload | null
}

type StaffAcceptPreviewStorageEnvelopeV2 = {
  v: 2
  writtenAt: number
  payload: StaffAcceptPreviewSnapshotV1
}

export function staffAcceptPreviewStorageKey(estimateId: string): string {
  return `${STAFF_ACCEPT_PREVIEW_STORAGE_PREFIX}${estimateId}`
}

function clearPreviewStorageKey(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function parseSnapshotV1FromRecord(
  o: Record<string, unknown>,
  estimateId: string,
): StaffAcceptPreviewSnapshotV1 | null {
  if (o.v !== 1 || o.estimateId !== estimateId) return null
  if (typeof o.title !== 'string' || typeof o.terms !== 'string') return null
  if (o.valid_until !== null && typeof o.valid_until !== 'string') return null
  if (!Array.isArray(o.line_items)) return null
  if (typeof o.total_cents !== 'number' || !Number.isFinite(o.total_cents)) return null
  const line_items = (o.line_items as unknown[]).map((x) => {
    const r = x as Record<string, unknown>
    return {
      description: String(r.description ?? ''),
      amount_cents: Math.max(0, Math.round(Number(r.amount_cents ?? 0))),
    }
  })
  let overrides: Record<string, string> | null = null
  if (o.overrides != null) {
    const ov = parseEstimateExperienceOverrides(o.overrides)
    overrides = Object.keys(ov).length > 0 ? (ov as Record<string, string>) : null
  }
  let for_line: string | null | undefined = undefined
  if ('for_line' in o) {
    if (o.for_line === null) for_line = null
    else if (typeof o.for_line === 'string') for_line = o.for_line.trim() || null
  }
  let accept_header_brand: 'elec' | 'plum' | null | undefined = undefined
  if ('accept_header_brand' in o) {
    const ab = o.accept_header_brand
    if (ab === null) accept_header_brand = null
    else if (ab === 'elec' || ab === 'plum') accept_header_brand = ab
    else accept_header_brand = null
  }
  let customer_attachment: CustomerAttachmentPayload | null | undefined = undefined
  if ('customer_attachment' in o && o.customer_attachment != null) {
    const ca = o.customer_attachment as Record<string, unknown>
    const url = typeof ca.url === 'string' && ca.url.startsWith('https://') ? ca.url.trim() : ''
    if (url) {
      const label =
        ca.label === null ? null : typeof ca.label === 'string' ? ca.label.trim() || null : null
      customer_attachment = { url, label }
    } else {
      customer_attachment = null
    }
  } else if ('customer_attachment' in o && o.customer_attachment === null) {
    customer_attachment = null
  }
  return {
    v: 1,
    estimateId,
    title: o.title,
    terms: o.terms,
    valid_until: o.valid_until as string | null,
    line_items,
    total_cents: Math.max(0, Math.round(o.total_cents)),
    ...(for_line !== undefined ? { for_line } : {}),
    overrides,
    ...(accept_header_brand !== undefined ? { accept_header_brand } : {}),
    ...(customer_attachment !== undefined ? { customer_attachment } : {}),
  }
}

export function writeStaffAcceptPreviewSnapshot(snapshot: StaffAcceptPreviewSnapshotV1): void {
  try {
    if (typeof localStorage === 'undefined') return
    const key = staffAcceptPreviewStorageKey(snapshot.estimateId)
    const envelope: StaffAcceptPreviewStorageEnvelopeV2 = {
      v: 2,
      writtenAt: Date.now(),
      payload: snapshot,
    }
    localStorage.setItem(key, JSON.stringify(envelope))
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readAndConsumeStaffAcceptPreviewSnapshot(estimateId: string): StaffAcceptPreviewSnapshotV1 | null {
  const key = staffAcceptPreviewStorageKey(estimateId)
  let raw: string | null = null
  try {
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(key)
    }
    if (raw == null && typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(key)
    }
  } catch {
    return null
  }
  if (raw == null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearPreviewStorageKey(key)
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    clearPreviewStorageKey(key)
    return null
  }

  const top = parsed as Record<string, unknown>
  let inner: Record<string, unknown>

  if (top.v === 2 && top.payload != null && typeof top.payload === 'object' && !Array.isArray(top.payload)) {
    const writtenAt = top.writtenAt
    if (typeof writtenAt !== 'number' || !Number.isFinite(writtenAt)) {
      clearPreviewStorageKey(key)
      return null
    }
    if (Date.now() - writtenAt > STAFF_ACCEPT_PREVIEW_TTL_MS) {
      clearPreviewStorageKey(key)
      return null
    }
    inner = top.payload as Record<string, unknown>
  } else {
    inner = top
  }

  const result = parseSnapshotV1FromRecord(inner, estimateId)
  if (!result) {
    clearPreviewStorageKey(key)
    return null
  }

  clearPreviewStorageKey(key)
  return result
}

export function buildStaffAcceptPreviewSnapshot(input: {
  estimateId: string
  title: string
  terms: string
  validUntilTrimmed: string
  lines: StaffAcceptPreviewLineItem[]
  totalCents: number
  /** Effective For line for customer document (trimmed); empty → null */
  forLineEffective: string
  cxOverrideFields: Partial<Record<EstimateExperienceOverrideKey, string>>
  acceptHeaderBrand?: 'elec' | 'plum' | null
  customerAttachment?: CustomerAttachmentPayload | null
}): StaffAcceptPreviewSnapshotV1 {
  const parsed = parseEstimateExperienceOverrides(input.cxOverrideFields)
  const overridesKeys = Object.keys(parsed)
  const fl = input.forLineEffective.trim()
  return {
    v: 1,
    estimateId: input.estimateId,
    title: input.title,
    terms: input.terms,
    valid_until: input.validUntilTrimmed.trim() ? input.validUntilTrimmed.trim() : null,
    line_items: input.lines,
    total_cents: input.totalCents,
    for_line: fl || null,
    overrides: overridesKeys.length > 0 ? (parsed as Record<string, string>) : null,
    accept_header_brand: input.acceptHeaderBrand ?? null,
    ...(input.customerAttachment != null ? { customer_attachment: input.customerAttachment } : {}),
  }
}
