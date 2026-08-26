/**
 * Autosave slices for the Edit Job form (JobFormModal).
 *
 * The form persists in independent "slices", each with its own baseline
 * snapshot and debounce in the component's autosave engine:
 *   - billing:   line items (fixtures) + payments + derived revenue/payments_made
 *   - identity:  the scalar jobs_ledger columns (numbers, name, address,
 *                customer contact, links, project/bid/service-type, master)
 *   - materials: "Other job charges" rows
 *   - team:      jobs_ledger_team_members (diffed, not delete+reinserted)
 *
 * This kernel owns the pure parts: slice JSON builders (a slice is dirty when
 * its JSON differs from the persisted baseline), insert/update payload
 * builders shared by autosave and the explicit save path, the identity-slice
 * validation gate, the team diff, and the paid→billed demote condition.
 */
import {
  resolveCustomerIdForJobPayload,
  resolveGcCustomerIdForJobPayload,
  type JobPayloadCustomerRow,
} from '../jobLedgerCustomer'
import { resolveDevelopmentIdForJobPayload, type JobFormDevelopmentRow } from './jobDevelopments'
import { titleCaseAddress } from '../addressTitleCase'
import { resolveEditJobMasterUserId } from '../resolveEditJobMasterUserId'
import { normalizeFixtureDisplayName } from './jobFormRows'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

// ---------------------------------------------------------------------------
// Slice JSON builders (dirty = JSON !== baseline JSON)
// ---------------------------------------------------------------------------

/** Money slice snapshot — byte-identical to the pre-extraction inline memo. */
export function buildBillingSliceJson(fixtures: FixtureRow[], payments: PaymentRow[]): string {
  return JSON.stringify({
    f: fixtures.map((f) => ({ n: f.name, c: f.count, p: f.line_unit_price, d: f.line_description, i: f.invoice_id })),
    p: payments.map((p) => ({
      a: p.amount,
      o: p.paid_on,
      n: p.note,
      t: p.payment_type,
      r: p.reference_number,
      i: p.invoice_id,
      m: p.mercury_transaction_id,
    })),
  })
}

/** The scalar jobs_ledger fields the identity slice owns, as form state. */
export interface JobIdentityFormFields {
  hcpNumber: string
  clickNumber: string
  jobName: string
  jobAddress: string
  customerId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  /** Optional GC (General Contractor) — a customers row id, like bids' GC/Builder (v2.1176). */
  gcCustomerId: string | null
  /** Optional development (group of jobs) — a developments row id (v2.1199). */
  developmentId: string | null
  googleDriveLink: string
  jobPicturesLink: string
  jobPlansLink: string
  projectId: string
  bidId: string
  serviceTypeId: string
  /** Account Man (v2.1466) — a users row id; must be one of the job's team members. */
  accountManagerUserId: string | null
  /** primary | preferred | only; only meaningful while accountManagerUserId is set. */
  accountManagerRelationship: string | null
}

export function buildIdentitySliceJson(fields: JobIdentityFormFields): string {
  return JSON.stringify({
    h: fields.hcpNumber.trim(),
    ck: fields.clickNumber.trim(),
    jn: fields.jobName.trim(),
    ja: fields.jobAddress.trim(),
    ci: fields.customerId,
    cn: fields.customerName.trim(),
    ce: fields.customerEmail.trim(),
    cp: fields.customerPhone.trim(),
    gc: fields.gcCustomerId,
    dv: fields.developmentId,
    gd: fields.googleDriveLink.trim(),
    jp: fields.jobPicturesLink.trim(),
    pl: fields.jobPlansLink.trim(),
    pr: fields.projectId,
    bi: fields.bidId,
    st: fields.serviceTypeId.trim(),
    am: fields.accountManagerUserId,
    ar: fields.accountManagerUserId ? fields.accountManagerRelationship : null,
  })
}

export function buildMaterialsSliceJson(materials: MaterialRow[]): string {
  return JSON.stringify(materials.map((m) => ({ d: m.description, a: m.amount })))
}

/** Order-insensitive: membership is a set, ▲▼ of the picker is presentation. */
export function buildTeamSliceJson(teamMemberIds: string[]): string {
  return JSON.stringify([...teamMemberIds].sort())
}

// ---------------------------------------------------------------------------
// Payload builders (shared by autosave and the explicit save path)
// ---------------------------------------------------------------------------

/**
 * Payment rows worth persisting, with their insert payloads, in form order.
 * Since B3/B4 (FRAGILITY_REMEDIATION_PLAN.md) the rows ARE the truth —
 * jobs_ledger.payments_made is trigger-derived from them, so this filter
 * (dropping empty/zero rows) defines the total; there is no separate client
 * sum to disagree with anymore.
 */
export function paymentInsertRows(jobId: string, payments: PaymentRow[]) {
  return payments
    .filter((p) => (Number(p.amount) || 0) > 0)
    .map((p, i) => ({
      job_id: jobId,
      amount: Number(p.amount) || 0,
      sequence_order: i,
      paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
      note: p.note?.trim() ? p.note.trim() : null,
      payment_type: p.payment_type?.trim() ? p.payment_type.trim() : null,
      reference_number: p.reference_number?.trim() ? p.reference_number.trim() : null,
      invoice_id: p.invoice_id,
      mercury_transaction_id: p.mercury_transaction_id,
    }))
}

/** Fixture rows worth persisting (named), with their insert payloads, in form order. */
export function fixtureInsertRows(jobId: string, fixtures: FixtureRow[]) {
  return fixtures
    .filter((f) => normalizeFixtureDisplayName(f.name ?? '').length > 0)
    .map((f, i) => ({
      job_id: jobId,
      name: normalizeFixtureDisplayName(f.name ?? ''),
      count: f.count,
      sequence_order: i,
      line_unit_price: f.line_unit_price != null && f.line_unit_price > 0 ? f.line_unit_price : null,
      line_description: (f.line_description ?? '').trim() ? (f.line_description ?? '').trim() : null,
      invoice_id: f.invoice_id,
    }))
}

/** Material rows worth persisting, with their insert payloads, in form order. */
export function materialInsertRows(jobId: string, materials: MaterialRow[]) {
  return materials
    .filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    .map((m, i) => ({
      job_id: jobId,
      description: m.description.trim(),
      amount: m.amount,
      sequence_order: i,
    }))
}

/**
 * The jobs_ledger UPDATE payload the identity slice owns. Money columns
 * (revenue/payments_made) belong to the billing slice and are deliberately
 * absent. Master/customer resolution mirrors the explicit save path: the job
 * keeps its owner (or follows a linked project's owner), and the customer id
 * re-resolves under that master so a cross-master link can never persist.
 */
export function buildEditJobIdentityUpdatePayload(params: {
  fields: JobIdentityFormFields
  existingJobMasterUserId: string
  /** master_user_id of the linked project when fields.projectId is set and loaded. */
  projectMasterUserId: string | null
  customers: JobPayloadCustomerRow[]
  developments: JobFormDevelopmentRow[]
}) {
  const { fields, existingJobMasterUserId, projectMasterUserId, customers, developments } = params
  const masterUserId = resolveEditJobMasterUserId({
    projectId: fields.projectId || null,
    projectMasterUserId,
    existingJobMasterUserId,
  })
  const resolvedCustomerId = resolveCustomerIdForJobPayload(
    fields.customerId,
    masterUserId,
    fields.customerName.trim(),
    customers,
  )
  const resolvedGcCustomerId = resolveGcCustomerIdForJobPayload(fields.gcCustomerId, masterUserId, customers)
  const resolvedDevelopmentId = resolveDevelopmentIdForJobPayload(fields.developmentId, masterUserId, developments)
  return {
    hcp_number: fields.hcpNumber.trim(),
    click_number: fields.clickNumber.trim(),
    job_name: fields.jobName.trim(),
    // Casing policy (v2.2328): addresses store Title Case no matter how they
    // were typed — same kernel the sweep used on the backlog.
    job_address: titleCaseAddress(fields.jobAddress.trim()),
    customer_id: resolvedCustomerId,
    gc_customer_id: resolvedGcCustomerId,
    development_id: resolvedDevelopmentId,
    customer_name: fields.customerName.trim() || null,
    customer_email: fields.customerEmail.trim() || null,
    customer_phone: fields.customerPhone.trim() || null,
    google_drive_link: fields.googleDriveLink.trim() || null,
    job_pictures_link: fields.jobPicturesLink.trim() || null,
    job_plans_link: fields.jobPlansLink.trim() || null,
    project_id: fields.projectId || null,
    bid_id: fields.bidId || null,
    service_type_id: fields.serviceTypeId.trim(),
    master_user_id: masterUserId,
    account_manager_user_id: fields.accountManagerUserId || null,
    // Relationship defaults to primary while a manager is set; both clear together.
    account_manager_relationship: fields.accountManagerUserId ? fields.accountManagerRelationship || 'primary' : null,
  }
}

/**
 * Identity autosave gate — the same required fields that enable the explicit
 * Save button. While any is blank the slice stays dirty and unsaved (a
 * half-cleared field mid-retype must never persist as empty).
 */
export function identitySliceReadyToSave(fields: JobIdentityFormFields): boolean {
  return fields.jobName.trim() !== '' && fields.jobAddress.trim() !== '' && fields.serviceTypeId.trim() !== ''
}

// ---------------------------------------------------------------------------
// Team diff + demote condition
// ---------------------------------------------------------------------------

export function diffTeamMemberIds(
  currentIds: string[],
  persistedIds: Iterable<string>,
): { toAdd: string[]; toRemove: string[] } {
  const persisted = new Set(persistedIds)
  const current = new Set(currentIds)
  return {
    toAdd: [...current].filter((id) => !persisted.has(id)),
    toRemove: [...persisted].filter((id) => !current.has(id)),
  }
}

/**
 * A paid job whose revenue now exceeds its payments (beyond a cent of float
 * slack) has a balance due again and must move back to Billed. Takes the
 * NORMALIZED status (normalizeJobsLedgerStatus).
 */
export function shouldDemotePaidJobToBilled(
  normalizedStatus: string,
  revenueDollars: number,
  paymentsMadeDollars: number,
): boolean {
  return normalizedStatus === 'paid' && revenueDollars > paymentsMadeDollars + 0.01
}
