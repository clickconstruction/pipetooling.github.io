/**
 * Undo-to-opened for the Edit Job modal (v2.1081).
 *
 * The modal snapshots every autosave-slice's form state when a job hydrates
 * (and re-bases whenever the job's invoice set changes, so Undo never crosses
 * an invoice-lifecycle event). Undo restores the snapshot into React state
 * and the autosave engine persists the revert like any other edit.
 */
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'
import {
  buildBillingSliceJson,
  buildIdentitySliceJson,
  buildMaterialsSliceJson,
  buildTeamSliceJson,
  type JobIdentityFormFields,
} from './jobFormAutosaveSlices'

export interface JobFormUndoSnapshot {
  identity: JobIdentityFormFields
  fixtures: FixtureRow[]
  payments: PaymentRow[]
  materials: MaterialRow[]
  teamMemberIds: string[]
  /** Slice JSONs at capture time — undo is available when any current slice JSON differs. */
  jsons: { billing: string; identity: string; materials: string; team: string }
}

export function buildJobFormUndoSnapshot(input: {
  identity: JobIdentityFormFields
  fixtures: FixtureRow[]
  payments: PaymentRow[]
  materials: MaterialRow[]
  teamMemberIds: string[]
}): JobFormUndoSnapshot {
  return {
    identity: { ...input.identity },
    fixtures: input.fixtures.map((r) => ({ ...r })),
    payments: input.payments.map((r) => ({ ...r })),
    materials: input.materials.map((r) => ({ ...r })),
    teamMemberIds: [...input.teamMemberIds],
    jsons: {
      billing: buildBillingSliceJson(input.fixtures, input.payments),
      identity: buildIdentitySliceJson(input.identity),
      materials: buildMaterialsSliceJson(input.materials),
      team: buildTeamSliceJson(input.teamMemberIds),
    },
  }
}

/** True when anything differs from the snapshot — i.e. Undo would change something. */
export function jobFormUndoAvailable(
  snapshot: JobFormUndoSnapshot | null,
  current: { billing: string; identity: string; materials: string; team: string },
): boolean {
  if (!snapshot) return false
  return (
    snapshot.jsons.billing !== current.billing ||
    snapshot.jsons.identity !== current.identity ||
    snapshot.jsons.materials !== current.materials ||
    snapshot.jsons.team !== current.team
  )
}

/**
 * Fixture rows restored from a snapshot may carry an `invoice_id` for an
 * invoice deleted since capture — reinserting that FK would 409. Clear any
 * link that no longer points at an existing invoice; valid links restore
 * as-is. Returns fresh row objects (never the snapshot's own references, so
 * a second Undo can't see mutated rows).
 */
export function sanitizeRestoredFixtureLinks(rows: FixtureRow[], validInvoiceIds: ReadonlySet<string>): FixtureRow[] {
  return rows.map((r) => ({
    ...r,
    invoice_id: r.invoice_id && validInvoiceIds.has(r.invoice_id) ? r.invoice_id : null,
  }))
}

/** Key for detecting invoice-lifecycle changes: sorted invoice ids. */
export function invoiceSetKey(invoiceIds: readonly string[]): string {
  return [...invoiceIds].sort().join(',')
}
