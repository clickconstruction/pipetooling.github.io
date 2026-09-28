import type { EstimateLineItemNormalized } from './estimateLineItemNormalize'

/**
 * Quick Estimate kernel (v2.2293) — the field wizard's pure logic. A master on
 * a job writes up a change order (or, through the side door, an estimate) in
 * five screens and hands it to Dispatch. This module owns everything testable:
 * ballpark parsing, the send rule, the ✓/— review rows, and the dispatch
 * request's title/summary — the component only renders and saves.
 *
 * Design contract (owner-approved mockup v4):
 * - Change-order-first: picking a job IS declaring the doc kind.
 * - Everything skippable except the work itself: a send needs a description
 *   or at least one photo.
 * - The ballpark is never a real price: it lands as a $0 placeholder line so
 *   the editor's step rail flags cost as unfinished and the document total
 *   stays 0 until the office prices it.
 */

export type QuickEstimateBranch = 'change_order' | 'estimate'

export type QuickEstimateStage = 'resume' | 'kind' | 'job' | 'customer' | 'work' | 'cost' | 'review' | 'done'

/** Flow v2 (v2.2314): where Back lands from each stage (null = no Back shown). */
export function quickEstimateBackTarget(
  stage: QuickEstimateStage,
  branch: QuickEstimateBranch,
): QuickEstimateStage | null {
  switch (stage) {
    case 'job':
    case 'customer':
      return 'kind'
    case 'work':
      return branch === 'change_order' ? 'job' : 'customer'
    case 'cost':
      return 'work'
    case 'review':
      return 'cost'
    default:
      return null
  }
}

export type QuickEstimateSummaryInput = {
  branch: QuickEstimateBranch
  /** "HCP 5124 — Herber Custom Homes" (CO branch) — null when skipped. */
  jobLabel: string | null
  /** Picked customer name or free-typed name (estimate branch) — null when skipped. */
  customerLabel: string | null
  description: string
  photoCount: number
  /** Parsed ballpark in cents — null when skipped. */
  ballparkCents: number | null
  /** Optional one-liner for dispatch. */
  dispatchNote: string
}

/** "$1,350" / "$250" — whole dollars unless the ballpark carried cents. */
export function formatBallparkUsd(cents: number): string {
  const dollars = cents / 100
  const hasCents = cents % 100 !== 0
  return (
    '$' +
    dollars.toLocaleString('en-US', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    })
  )
}

/**
 * "1,350", "$1350", " 1350.50 " → cents; garbage/empty/zero/negative → null
 * (a zero ballpark is a skip, not an answer).
 */
export function parseBallparkDollars(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}

/** The one hard rule: a send needs something for the office to work from. */
export function quickEstimateCanSend(input: { description: string; photoCount: number }): boolean {
  return input.description.trim().length > 0 || input.photoCount > 0
}

export type QuickEstimateReviewRow = {
  key: 'target' | 'work' | 'ballpark' | 'rest'
  label: string
  value: string
  filled: boolean
}

/** The ✓/— rows on the review screen; skips phrase the office's next move. */
export function quickEstimateReviewRows(input: QuickEstimateSummaryInput): QuickEstimateReviewRow[] {
  const isCO = input.branch === 'change_order'
  const target = isCO ? input.jobLabel : input.customerLabel
  const desc = input.description.trim()
  const workParts: string[] = []
  if (desc) workParts.push(desc.length > 64 ? desc.slice(0, 64).trimEnd() + '…' : desc)
  if (input.photoCount > 0) workParts.push(`${input.photoCount} photo${input.photoCount === 1 ? '' : 's'}`)
  return [
    {
      key: 'target',
      label: isCO ? 'Job' : 'For',
      value: target ?? 'Skipped — in the notes',
      filled: target != null,
    },
    {
      key: 'work',
      label: isCO ? 'Change' : 'Work',
      value: workParts.join(' · ') || 'Nothing yet',
      filled: quickEstimateCanSend(input),
    },
    {
      key: 'ballpark',
      label: 'Ballpark',
      value: input.ballparkCents != null ? formatBallparkUsd(input.ballparkCents) : 'Skipped — office prices it',
      filled: input.ballparkCents != null,
    },
    {
      key: 'rest',
      label: 'Rest',
      value: isCO
        ? 'Office prices it & sends the CO'
        : input.customerLabel
          ? 'Office finishes pricing & paperwork'
          : 'Office finds/creates the customer',
      filled: false,
    },
  ]
}

/** Dispatch inbox card headline. */
export function quickEstimateDispatchTitle(input: QuickEstimateSummaryInput): string {
  const kind = input.branch === 'change_order' ? 'change order' : 'estimate'
  const target =
    (input.branch === 'change_order' ? input.jobLabel : input.customerLabel)?.trim() || 'from the field'
  return `Review field ${kind} — ${target}`
}

/** One-line ✓/— summary for the dispatch card (mirrors the review screen). */
export function quickEstimateReferenceSummary(input: QuickEstimateSummaryInput): string {
  const isCO = input.branch === 'change_order'
  const parts: string[] = []
  const target = isCO ? input.jobLabel : input.customerLabel
  parts.push(`${isCO ? 'Job' : 'For'} ${target != null ? '✓' : '— skipped'}`)
  const photoBit = input.photoCount > 0 ? ` (${input.photoCount} photo${input.photoCount === 1 ? '' : 's'})` : ''
  parts.push(`Work ${quickEstimateCanSend(input) ? '✓' : '—'}${photoBit}`)
  parts.push(
    input.ballparkCents != null ? `Ballpark ${formatBallparkUsd(input.ballparkCents)}` : 'Ballpark — skipped',
  )
  const note = input.dispatchNote.trim()
  if (note) parts.push(`Note: ${note}`)
  return parts.join(' | ')
}

/**
 * The ballpark as a $0 placeholder line — clearly labeled, never a chargeable
 * price, keeps the rail's cost step unfinished until the office replaces it.
 */
export function quickEstimateBallparkLine(cents: number): EstimateLineItemNormalized {
  return {
    line_item: `Field ballpark: ~${formatBallparkUsd(cents)} — to be priced`,
    description: '',
    quantity: 1,
    unit_price_cents: 0,
    amount_cents: 0,
  }
}

/**
 * Estimate-branch work description as line one (plain estimates have no
 * "description of change" field; COs use change_order_fields instead).
 */
export function quickEstimateWorkLine(description: string): EstimateLineItemNormalized {
  return {
    line_item: 'Field write-up',
    description: description.trim(),
    quantity: 1,
    unit_price_cents: 0,
    amount_cents: 0,
  }
}

/** Draft title: COs stay untitled (list shows CO + customer); estimates carry the free-typed lead. */
export function quickEstimateDraftTitle(branch: QuickEstimateBranch, freeTypedCustomer: string): string {
  if (branch !== 'estimate') return ''
  const who = freeTypedCustomer.trim()
  return who ? `Field estimate — ${who}` : ''
}

/* ---------- resume a half-done write-up (v2.4063) ---------- */

/** The wizard-only marker on an `estimates` row (`field_write_up`); NULL on every office-made estimate. */
export type QuickEstimateFieldWriteUp = {
  started_at: string
  job: { id: string; hcp: string; name: string; address: string; customer_id: string | null } | null
  phone?: string
  free_customer?: string
  dismissed_at?: string | null
}

/** The columns the resume check reads off a draft. */
export type QuickEstimateDraftRow = {
  id: string
  estimate_number: number | null
  doc_kind: string | null
  customer_id: string | null
  change_order_fields: unknown
  line_items_snapshot: unknown
  field_write_up: unknown
  updated_at: string | null
  estimate_field_photos?: Array<{ id: string }> | null
}

/** A draft parsed back into the wizard's fields. */
export type QuickEstimateResumeState = {
  id: string
  estimateNumber: number | null
  branch: QuickEstimateBranch
  job: NonNullable<QuickEstimateFieldWriteUp['job']>
  customerId: string | null
  description: string
  coReason: string
  coImpact: string
  coResponseBy: string
  ballparkText: string
  phone: string
  freeTypedCustomer: string
  photoCount: number
  startedAt: string
  updatedAt: string | null
  /** Something was typed, priced or photographed — an empty draft is not worth a prompt. */
  hasContent: boolean
}

const JOB_LINE = /^Job: .*$/
const PHONE_LINE = /^Phone: (.*)$/
const BALLPARK_LINE = /^Field ballpark: ~\$([\d,]+(?:\.\d{1,2})?)/

/**
 * The change description as the wizard stores it is "Job: …" and "Phone: …" paragraphs ahead of
 * what the person typed; this hands back the typed part and the phone.
 */
export function quickEstimateSplitChangeDescription(text: string): { phone: string; description: string } {
  const parts = (text ?? '').split(/\n\n/)
  let phone = ''
  const rest: string[] = []
  for (const part of parts) {
    const t = part.trim()
    if (JOB_LINE.test(t)) continue
    const m = PHONE_LINE.exec(t)
    if (m && !phone) {
      phone = (m[1] ?? '').trim()
      continue
    }
    if (t) rest.push(t)
  }
  return { phone, description: rest.join('\n\n') }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * The wizard's fields, read back off one of its own drafts — null for a row the wizard did not
 * start (no marker) or one the person already left to the office (`dismissed_at`).
 */
export function quickEstimateResumeFromDraft(row: QuickEstimateDraftRow): QuickEstimateResumeState | null {
  const marker = asRecord(row.field_write_up)
  if (!marker || typeof marker.started_at !== 'string') return null
  if (typeof marker.dismissed_at === 'string' && marker.dismissed_at) return null
  const branch: QuickEstimateBranch = row.doc_kind === 'change_order' ? 'change_order' : 'estimate'
  const jobRaw = asRecord(marker.job)
  const job = jobRaw && typeof jobRaw.id === 'string'
    ? { id: jobRaw.id, hcp: str(jobRaw.hcp), name: str(jobRaw.name), address: str(jobRaw.address), customer_id: typeof jobRaw.customer_id === 'string' ? jobRaw.customer_id : null }
    : null
  const co = asRecord(row.change_order_fields)
  const lines = Array.isArray(row.line_items_snapshot) ? (row.line_items_snapshot as unknown[]) : []
  let description = ''
  let phone = str(marker.phone)
  let ballparkText = ''
  if (branch === 'change_order') {
    const split = quickEstimateSplitChangeDescription(str(co?.description_of_change))
    description = split.description
    if (!phone) phone = split.phone
  }
  for (const l of lines) {
    const line = asRecord(l)
    if (!line) continue
    const item = str(line.line_item)
    if (item === 'Field write-up' && branch === 'estimate') description = str(line.description).trim()
    const bp = BALLPARK_LINE.exec(item)
    if (bp && bp[1]) ballparkText = bp[1].replace(/,/g, '')
  }
  const coReason = str(co?.reason_for_change).trim()
  const coImpact = str(co?.impact_on_schedule).trim()
  const coResponseBy = str(co?.response_requested_by).trim()
  const photoCount = Array.isArray(row.estimate_field_photos) ? row.estimate_field_photos.length : 0
  return {
    id: row.id,
    estimateNumber: row.estimate_number ?? null,
    branch,
    job: job ?? { id: '', hcp: '', name: '', address: '', customer_id: null },
    customerId: row.customer_id ?? null,
    description,
    coReason,
    coImpact,
    coResponseBy,
    ballparkText,
    phone,
    freeTypedCustomer: str(marker.free_customer),
    photoCount,
    startedAt: marker.started_at,
    updatedAt: row.updated_at ?? null,
    hasContent: Boolean(description || coReason || coImpact || ballparkText || photoCount > 0),
  }
}

/** The first draft worth a prompt: newest first, wizard-started, not left to the office, with something in it. */
export function quickEstimateResumeCandidate(rows: QuickEstimateDraftRow[]): QuickEstimateResumeState | null {
  for (const row of rows) {
    const state = quickEstimateResumeFromDraft(row)
    if (state?.hasContent) return state
  }
  return null
}

/** "started 2 h ago" / "started Mon 2:10 pm" — what the prompt says under the job line. */
export function quickEstimateResumeAge(startedAtIso: string, nowIso: string): string {
  const started = Date.parse(startedAtIso)
  const now = Date.parse(nowIso)
  if (!Number.isFinite(started) || !Number.isFinite(now)) return ''
  const mins = Math.max(0, Math.round((now - started) / 60000))
  if (mins < 60) return `started ${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `started ${hours} h ago`
  const days = Math.round(hours / 24)
  return `started ${days} day${days === 1 ? '' : 's'} ago`
}

