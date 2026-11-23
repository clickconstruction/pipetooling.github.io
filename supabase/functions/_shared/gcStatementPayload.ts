/**
 * The GC statement payload (`get_gc_statement_email_payload`) and the one payment rule on it.
 * Moved here from `gc-statement-email-dispatch/render.ts` (v2.5022) so the scheduled dispatcher and
 * send-gc-statement-email build a GC's group the same way: the dispatcher to render it, the send
 * function to hold an unchecked statement (`gcStatementGate.ts`). `render.ts` re-exports all of it.
 */
import type { PaidByBill, PaidByPayment } from './billPaidBy.ts'
import { addInKindApart, noInKindApart, splitInKind, type InKindApart } from './inKindApart.ts'
import { attributeJobPayments } from './paymentAttribution.ts'

export type GcStatementPayloadRow = {
  job_id: string
  /** The bill's id, or the job's for a balance with no bill behind it. */
  row_key?: string | null
  display_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  ref_date: string | null
  ref_is_estimate: boolean
  age_days: number | null
  remaining: number
  in_collections: boolean
  /** What paid the bill (v2.4100) — absent from a payload older than the RPC change, and then no line prints. */
  invoice_id?: string | null
  invoice_amount?: number | null
  retainage_held?: number | null
  job_bills?: PaidByBill[] | null
  job_payments?: PaidByPayment[] | null
  /**
   * The job's total price (v2.4536). Not in the RPC's rows: the dispatcher reads it beside the
   * payload and `attachJobTotals` sets it. With it, money that paid the part of the job on no
   * bill is not worded as paying this bill (`_shared/paymentAttribution.ts`, v2.4534).
   */
  job_total?: number | null
}

export type GcStatementPayloadGroup = {
  entity_id: string | null
  entity_name: string
  is_no_entity: boolean
  job_count: number
  subtotal: number
  oldest_age_days: number | null
  rows: GcStatementPayloadRow[]
  /**
   * The bills an in kind deal pays (v2.8309, punch list #301): the same shape as `rows`, and on no sum of
   * the group. Absent from a payload older than migration 20261123010000, and then nothing is set apart.
   */
  in_kind_rows?: GcStatementPayloadRow[] | null
  /** How many of those bills a credit still has to pay, and their dollars. `setInKindApart` counts it by the payment rule. */
  in_kind?: InKindApart | null
}

export type GcStatementPayload = {
  generated_at: string
  group_by: 'gc' | 'development'
  include_collections: boolean
  grand_total: number
  groups: GcStatementPayloadGroup[]
  /** Every group's bills a deal pays, as one count (v2.8309). */
  in_kind?: InKindApart | null
}

/** A group's rows of both kinds: the money bills, then the bills a deal pays. */
const everyRow = (g: GcStatementPayloadGroup): GcStatementPayloadRow[] => [...g.rows, ...(g.in_kind_rows ?? [])]

/** The job ids a payload's rows name, once each — what the dispatcher reads totals for. A deal's bills are netted too, so their jobs are named. */
export function payloadJobIds(payload: Pick<GcStatementPayload, 'groups'>): string[] {
  return [...new Set(payload.groups.flatMap((g) => everyRow(g).map((r) => r.job_id)).filter(Boolean))]
}

/** Sets each row's `job_total` from the jobs read beside the payload; a job with no total read stays without one. */
export function attachJobTotals(payload: Pick<GcStatementPayload, 'groups'>, totals: Readonly<Record<string, number | string | null | undefined>>): void {
  for (const g of payload.groups) {
    for (const r of everyRow(g)) {
      const t = totals[r.job_id]
      const n = t == null || t === '' ? NaN : Number(t)
      if (Number.isFinite(n)) r.job_total = n
    }
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * The one payment rule on the payload (v2.5006; the owner's call of 2026-10-09). The RPC nets each
 * bill against its linked payments only; this nets it as the board, GC Review and the portal do —
 * linked money in full, then the job's unlinked money to the part of the job on no bill and to the
 * sent bills oldest first (`attributeJobPayments` over the row's `job_bills` and `job_payments`).
 * Only rows whose job total was read (`attachJobTotals`) move: without the total, money that paid
 * work on no bill would land on the bills. Every row stays (membership is by status, as on the
 * board); the subtotals and the grand total are summed again from the rows.
 */
export function applyPaymentRule(payload: Pick<GcStatementPayload, 'groups' | 'grand_total'>): void {
  let grand = 0
  for (const g of payload.groups) {
    let sub = 0
    for (const r of g.rows) {
      netByRule(r)
      sub = round2(sub + Number(r.remaining ?? 0))
    }
    g.subtotal = sub
    grand = round2(grand + sub)
  }
  payload.grand_total = grand
}

/** One row's `remaining` by the rule. A row whose job total was not read keeps what the RPC gave it. */
function netByRule(r: GcStatementPayloadRow): void {
  if (r.invoice_id && r.job_total != null && (r.job_bills || r.job_payments)) {
    const applied = attributeJobPayments(r.job_bills ?? [], r.job_payments ?? [], r.job_total).byBill.get(r.invoice_id)?.applied ?? 0
    r.remaining = round2(Math.max(0, Number(r.invoice_amount ?? 0) - applied))
  }
}

/**
 * The bills an in kind deal pays, counted (v2.8309, punch list #301; the owner's call of 2026-11-22). The
 * RPC keeps them off `rows` and off every sum, in `in_kind_rows`. This nets each by the same payment rule,
 * sets each group's `in_kind` and the payload's, and drops a group left with no money bill: nothing is
 * owed on it, so no statement goes and no section prints. A bill with a cent or less open is settled and is
 * not counted. Run it after `applyPaymentRule`. A payload from before the migration has no such rows, and
 * nothing changes.
 */
export function setInKindApart(payload: Pick<GcStatementPayload, 'groups' | 'in_kind'>): void {
  let all = noInKindApart()
  for (const g of payload.groups) {
    const rows = g.in_kind_rows ?? []
    for (const r of rows) netByRule(r)
    g.in_kind = splitInKind(rows, () => true, (r) => Number(r.remaining ?? 0)).inKind
    all = addInKindApart(all, g.in_kind)
  }
  payload.groups = payload.groups.filter((g) => g.rows.length > 0)
  payload.in_kind = all
}
