/**
 * The job form's save engine, the writes: what each edit-mode autosave slice sends to the
 * database and in which order, and the child rows a new job is born with. Each takes
 * `supabase`. Nothing here is transactional — a slice's write that fails stops the sequence
 * where it is, and what ran before it stays written; a new job's child rows go on past a
 * refused row and hand back what was refused.
 *
 * TODO(billing): make transactional server-side (RPC) — see BILLING_FLOWS #9/#10.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { diffDiscountSnapshots, discountSnapshot, type DiscountSnapshotEntry } from './discountActivity'
import { diffTeamMemberIds, fixtureInsertRows, materialInsertRows, paymentInsertRows } from './jobFormAutosaveSlices'
import { jobFormRevenueDollars } from './jobFormMoneyTotals'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'
import { diffPaymentRows, paymentUpsertStatements, unfinishedPaymentDateBoxes } from './paymentRowsDiff'

/**
 * The billing slice: the job's revenue → its payments, diffed against the ids the form last
 * knew were saved (the owned-and-gone deleted, the rest upserted) → its line items, deleted and
 * re-inserted one at a time → the discount trail, logged without waiting. Throws the first
 * failed write as it came.
 *
 * `onPaymentsWritten` runs the moment the payments are down — before the line items are
 * touched — so a failure further on still leaves the form knowing which payments are saved.
 * `onDiscountsWritten` runs once the line items are back, before the trail is logged.
 *
 * A payment date caught half typed is not written (`paymentUpsertStatements`); the rest of the
 * slice is, because the invoice actions flush this slice and then read the rows it wrote.
 * Answers with the date boxes it held, for the form to say.
 */
export async function writeBillingSlice(
  supabase: SupabaseClient,
  args: {
    jobId: string
    fixtures: FixtureRow[]
    payments: PaymentRow[]
    riderFeesDollars: number
    /** The payment ids the form last knew to be saved. */
    hydratedPaymentIds: readonly string[]
    /** The discount rows as last saved. */
    persistedDiscounts: DiscountSnapshotEntry[]
    onPaymentsWritten: (savedPaymentIds: string[]) => void
    onDiscountsWritten: (saved: DiscountSnapshotEntry[]) => void
  },
): Promise<{ heldPaymentDates: string[] }> {
  const { jobId, fixtures: fx, payments: pays } = args
  const revNum = jobFormRevenueDollars(fx, args.riderFeesDollars)
  // B4 (FRAGILITY_REMEDIATION_PLAN.md): payments_made is a DB-trigger-
  // maintained cache of SUM(jobs_ledger_payments.amount) since B3 — the
  // row rewrite below keeps it in sync; the client no longer writes it.
  const { error: updErr } = await supabase.from('jobs_ledger').update({ revenue: revNum }).eq('id', jobId)
  if (updErr) throw updErr
  // B5: diff instead of delete-all+reinsert — stable row ids (no
  // activity-event churn) and rows born mid-edit survive.
  const { deleteIds, upserts } = diffPaymentRows(jobId, args.hydratedPaymentIds, pays)
  if (deleteIds.length > 0) {
    const { error: delPayErr } = await supabase.from('jobs_ledger_payments').delete().in('id', deleteIds).eq('job_id', jobId)
    if (delPayErr) throw delPayErr
  }
  // One statement unless a date is half typed: those rows go apart, without that date.
  for (const rows of paymentUpsertStatements(upserts)) {
    const { error: upsertPayErr } = await supabase.from('jobs_ledger_payments').upsert(rows, { onConflict: 'id' })
    if (upsertPayErr) throw upsertPayErr
  }
  args.onPaymentsWritten(upserts.map((u) => u.id))
  const { error: delFixErr } = await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', jobId)
  if (delFixErr) throw delFixErr
  for (const row of fixtureInsertRows(jobId, fx)) {
    const { error: insFixErr } = await supabase.from('jobs_ledger_fixtures').insert(row)
    if (insFixErr) throw insFixErr
  }
  const nextDiscounts = discountSnapshot(fx)
  const discountEvents = diffDiscountSnapshots(args.persistedDiscounts, nextDiscounts)
  args.onDiscountsWritten(nextDiscounts)
  for (const ev of discountEvents) {
    void supabase.rpc('log_job_discount_event', { p_job_id: jobId, p_event_type: ev.event_type, p_summary: ev.summary, p_detail: ev.detail }).then(({ error }) => {
      if (error) console.warn('log_job_discount_event failed', error)
    })
  }
  return { heldPaymentDates: unfinishedPaymentDateBoxes(upserts) }
}

/** The materials slice: every row deleted, then re-inserted one at a time. Throws the first failed write. */
export async function writeMaterialsSlice(supabase: SupabaseClient, args: { jobId: string; materials: MaterialRow[] }): Promise<void> {
  const { jobId } = args
  const { error: delMatErr } = await supabase.from('jobs_ledger_materials').delete().eq('job_id', jobId)
  if (delMatErr) throw delMatErr
  for (const row of materialInsertRows(jobId, args.materials)) {
    const { error: insMatErr } = await supabase.from('jobs_ledger_materials').insert(row)
    if (insMatErr) throw insMatErr
  }
}

/** The team slice: read who is on the job, add the missing, then remove the dropped. Throws the first failed call. */
export async function writeTeamSlice(supabase: SupabaseClient, args: { jobId: string; teamMemberIds: string[] }): Promise<void> {
  const { jobId } = args
  const { data: existingTeam, error: teamReadErr } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', jobId)
  if (teamReadErr) throw teamReadErr
  const { toAdd, toRemove } = diffTeamMemberIds(
    args.teamMemberIds,
    (existingTeam ?? []).map((t: { user_id: string }) => t.user_id),
  )
  for (const uid of toAdd) {
    const { error: insErr } = await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
    if (insErr) throw insErr
  }
  for (const uid of toRemove) {
    const { error: delErr } = await supabase.from('jobs_ledger_team_members').delete().eq('job_id', jobId).eq('user_id', uid)
    if (delErr) throw delErr
  }
}

export type NewJobChildRowKind = 'payment' | 'material' | 'line item' | 'team member'
/** One row a new job was to be born with that the database did not take. */
export type NewJobChildRowFailure = { kind: NewJobChildRowKind; message: string }

/**
 * The rows a new job is born with, once its `jobs_ledger` row exists: payments → materials →
 * line items → team, one insert at a time. A refused row — or one whose call fails outright —
 * does not stop the rest: the job exists by now, and every row that lands is one less to type
 * again. Never throws; hands back the rows that did not land, in the order they were tried.
 */
export async function writeNewJobChildRows(
  supabase: SupabaseClient,
  args: { jobId: string; payments: PaymentRow[]; materials: MaterialRow[]; fixtures: FixtureRow[]; teamMemberIds: string[] },
): Promise<NewJobChildRowFailure[]> {
  const { jobId } = args
  const failures: NewJobChildRowFailure[] = []
  const insertRow = async (kind: NewJobChildRowKind, table: string, row: Record<string, unknown>) => {
    try {
      const { error } = await supabase.from(table).insert(row)
      if (error) failures.push({ kind, message: error.message })
    } catch (thrown) {
      failures.push({ kind, message: thrown instanceof Error ? thrown.message : String(thrown) })
    }
  }
  for (const row of paymentInsertRows(jobId, args.payments)) await insertRow('payment', 'jobs_ledger_payments', row)
  for (const row of materialInsertRows(jobId, args.materials)) await insertRow('material', 'jobs_ledger_materials', row)
  for (const row of fixtureInsertRows(jobId, args.fixtures)) await insertRow('line item', 'jobs_ledger_fixtures', row)
  for (const uid of args.teamMemberIds) await insertRow('team member', 'jobs_ledger_team_members', { job_id: jobId, user_id: uid })
  return failures
}

/** How long the note stays up — the form has closed by then, and it names what to type again. */
export const NEW_JOB_CHILD_ROW_FAILURE_TOAST_MS = 15_000

const NEW_JOB_CHILD_ROW_KINDS: NewJobChildRowKind[] = ['payment', 'material', 'line item', 'team member']

/**
 * What the form says when a new job's rows did not all land; null when they did. Counts by
 * kind, in the order they are written, and gives the first reason the database gave.
 */
export function newJobChildRowFailureWords(failures: readonly NewJobChildRowFailure[]): string | null {
  const first = failures[0]
  if (!first) return null
  const counted = NEW_JOB_CHILD_ROW_KINDS.map((kind) => ({ kind, n: failures.filter((f) => f.kind === kind).length }))
    .filter((c) => c.n > 0)
    .map((c) => `${c.n} ${c.kind}${c.n === 1 ? '' : 's'}`)
  const list = counted.length > 1 ? `${counted.slice(0, -1).join(', ')} and ${counted[counted.length - 1]}` : counted[0]
  const reason = first.message.trim().replace(/[.\s]+$/, '')
  return `Job saved, but ${list} did not save${reason ? ` (${reason})` : ''}. Open the job and add ${failures.length === 1 ? 'it' : 'them'} again.`
}

/** What the form says when a slice's save throws. */
export function autosaveFailureWords(err: unknown): string {
  return `Autosave failed: ${err instanceof Error ? err.message : String(err)}`
}
