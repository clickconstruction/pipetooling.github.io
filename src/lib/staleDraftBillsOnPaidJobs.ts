/**
 * Settings → Data & recovery → "Draft bills on paid jobs (dev)" — pure kernel.
 *
 * The one-time sweep behind the J3-1 fix: `jobs_ledger_invoices` rows still in
 * `ready_to_bill` whose job is already `paid`. Once the Dashboard stops listing
 * them (v2.2846) their "Delete draft bill" button is gone too, and Edit Job hides
 * the ✕ on an auto-maintained remainder draft — so the office needs a door of its
 * own to retire them through the existing, audited `delete_ready_to_bill_invoice`
 * RPC. A migration was the wrong tool: this is user data, deleted by a person.
 */
import { isPaidJobStatus } from '../../supabase/functions/_shared/paidJobBillGuard'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

/** PostgREST select: RTB drafts with the parent job embedded; the caller adds `.eq('jobs_ledger.status', 'paid')`. */
export const STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT =
  'id, job_id, amount, created_at, is_primary_rtb_bundle, jobs_ledger!inner(hcp_number, click_number, job_name, status)'

export type StaleDraftBillJoinRow = {
  id: string
  job_id: string
  amount: number | string | null
  created_at: string | null
  is_primary_rtb_bundle: boolean | null
  jobs_ledger: {
    hcp_number: string | null
    click_number: string | null
    job_name: string | null
    status: string | null
  } | null
}

export type StaleDraftBillRow = {
  invoiceId: string
  jobId: string
  /** Displayed job number (HCP, else Click) or '—'. */
  jobNumber: string
  jobName: string
  amount: number
  createdAt: string | null
  isPrimaryRemainder: boolean
}

/** Maps join rows to display rows, keeping only drafts whose job really is `paid` (defensive re-check of the server filter). */
export function mapStaleDraftBillRows(rows: StaleDraftBillJoinRow[]): StaleDraftBillRow[] {
  const out: StaleDraftBillRow[] = []
  for (const r of rows) {
    const jl = r.jobs_ledger
    if (!jl || !isPaidJobStatus(jl.status)) continue
    out.push({
      invoiceId: r.id,
      jobId: r.job_id,
      jobNumber: effectiveJobLedgerNumber(jl.hcp_number, jl.click_number) || '—',
      jobName: (jl.job_name ?? '').trim() || '—',
      amount: Number(r.amount ?? 0),
      createdAt: r.created_at,
      isPrimaryRemainder: r.is_primary_rtb_bundle === true,
    })
  }
  return out
}

export function summarizeStaleDraftBills(rows: StaleDraftBillRow[]): { count: number; totalDollars: number } {
  let total = 0
  for (const r of rows) total += r.amount
  return { count: rows.length, totalDollars: Math.round(total * 100) / 100 }
}

export function formatStaleDraftBillAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
