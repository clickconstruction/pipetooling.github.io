/**
 * The job form's save engine, the writes: what each edit-mode autosave slice sends to the
 * database and in which order, and the child rows a new job is born with. Each takes
 * `supabase`. Nothing here is transactional — a write that fails stops the sequence where it
 * is, and what ran before it stays written.
 *
 * TODO(billing): make transactional server-side (RPC) — see BILLING_FLOWS #9/#10.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { diffDiscountSnapshots, discountSnapshot, type DiscountSnapshotEntry } from './discountActivity'
import { diffTeamMemberIds, fixtureInsertRows, materialInsertRows, paymentInsertRows } from './jobFormAutosaveSlices'
import { jobFormRevenueDollars } from './jobFormMoneyTotals'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'
import { diffPaymentRows } from './paymentRowsDiff'

/**
 * The billing slice: the job's revenue → its payments, diffed against the ids the form last
 * knew were saved (the owned-and-gone deleted, the rest upserted) → its line items, deleted and
 * re-inserted one at a time → the discount trail, logged without waiting. Throws the first
 * failed write as it came.
 *
 * `onPaymentsWritten` runs the moment the payments are down — before the line items are
 * touched — so a failure further on still leaves the form knowing which payments are saved.
 * `onDiscountsWritten` runs once the line items are back, before the trail is logged.
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
): Promise<void> {
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
  if (upserts.length > 0) {
    const { error: upsertPayErr } = await supabase.from('jobs_ledger_payments').upsert(upserts, { onConflict: 'id' })
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

/**
 * The rows a new job is born with, once its `jobs_ledger` row exists: payments → materials →
 * line items → team, one insert at a time. Each insert is awaited and its answer is not read —
 * a refused row stops nothing and is not reported. That is how the form has always created a
 * job; checking these is a change of behavior, for a PR of its own.
 */
export async function writeNewJobChildRows(
  supabase: SupabaseClient,
  args: { jobId: string; payments: PaymentRow[]; materials: MaterialRow[]; fixtures: FixtureRow[]; teamMemberIds: string[] },
): Promise<void> {
  const { jobId } = args
  for (const row of paymentInsertRows(jobId, args.payments)) {
    await supabase.from('jobs_ledger_payments').insert(row)
  }
  for (const row of materialInsertRows(jobId, args.materials)) {
    await supabase.from('jobs_ledger_materials').insert(row)
  }
  for (const row of fixtureInsertRows(jobId, args.fixtures)) {
    await supabase.from('jobs_ledger_fixtures').insert(row)
  }
  for (const uid of args.teamMemberIds) {
    await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
  }
}

/** What the form says when a slice's save throws. */
export function autosaveFailureWords(err: unknown): string {
  return `Autosave failed: ${err instanceof Error ? err.message : String(err)}`
}
