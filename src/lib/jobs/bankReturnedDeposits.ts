/**
 * Bank-returned deposits (v2.3795): the read side of v2.3784's bounced check.
 *
 * Mercury syncs a returned check as `status = 'failed'` with the bank's
 * reason in `raw.reasonForFailure`. Until now nothing read that until a
 * person opened the job's ③ Payments received table — so a check matched to
 * a job and then returned kept counting as paid (Pipeline "35% Paid", the
 * job's payments_made, the lien claim) and an unmatched one still sat in
 * Accounts Receivable's To match looking like money to apply. These rules
 * name the case once for the Dashboard's Needs You item and the AR list.
 *
 * The rule (prod, 2026-09-23): a deposit is a bank return only when it
 * POSTED and later went failed. A failed row with no posting date is a
 * processing failure (Mercury "There was an issue with this transaction" —
 * the check was simply re-deposited) and a failed internal transfer is an
 * account shuffle; neither is money a customer took back. Money in only.
 *
 * Pure; unit-tested in bankReturnedDeposits.test.ts. The rule and the job label are
 * shared with `mercury-webhook` (`supabase/functions/_shared/bankReturnedDeposits.ts`).
 */

import { asText, jobLabelForBankReturn, mercuryBankReturn, type BankReturnedJobRow, type MercuryBankReturn } from '../../../supabase/functions/_shared/bankReturnedDeposits'

// The rule itself lives beside the webhook (v2.3804) so the office's notice and these
// reads agree on what a bank return is; this file re-exports it for the app.
export { jobLabelForBankReturn, mercuryBankReturn, type BankReturnedJobRow, type MercuryBankReturn }

/** The same rule read off Mercury's raw payload (the AR list's RPC returns `raw`, not the status column). */
export function mercuryBankReturnFromRaw(
  raw: unknown,
  postedAt: string | null | undefined,
  amount: number | string | null | undefined,
): MercuryBankReturn | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  return mercuryBankReturn({
    status: o ? asText(o.status) : '',
    posted_at: postedAt,
    amount,
    failureReason: o ? asText(o.reasonForFailure) : '',
  })
}

/** "returned by the bank · Insufficient funds" — the AR row's chip. */
export function bankReturnedChipWords(r: MercuryBankReturn | null | undefined): string {
  const reason = asText(r?.reason)
  return reason ? `returned by the bank · ${reason}` : 'returned by the bank'
}

export type BankReturnedPayment = {
  paymentId: string
  jobId: string
  /** "J878 Take 5 – Seguin" */
  jobLabel: string
  amount: number
  reason: string
  /** YYYY-MM-DD the deposit posted, when known. */
  postedYmd: string | null
}

export type BankReturnedPayments = {
  count: number
  total: number
  /** Biggest first — the card opens this job. */
  first: BankReturnedPayment | null
  items: BankReturnedPayment[]
}

export type BankReturnedPaymentRow = { id: string; job_id: string; amount: number | string | null; mercury_transaction_id: string | null }
export type BankReturnedTxRow = { id: string; status: string | null; posted_at: string | null; amount: number | string | null; failure_reason?: string | null }


/** Recorded payments whose deposit the bank returned — the money still counted as paid on a job. */
export function summarizeBankReturnedPayments(
  payments: ReadonlyArray<BankReturnedPaymentRow>,
  txById: ReadonlyMap<string, BankReturnedTxRow>,
  jobsById: ReadonlyMap<string, BankReturnedJobRow>,
): BankReturnedPayments {
  const items: BankReturnedPayment[] = []
  for (const p of payments) {
    if (!p.mercury_transaction_id) continue
    const tx = txById.get(p.mercury_transaction_id)
    if (!tx) continue
    const ret = mercuryBankReturn({ status: tx.status, posted_at: tx.posted_at, amount: tx.amount, failureReason: tx.failure_reason })
    if (!ret) continue
    const amount = Math.abs(Number(p.amount) || 0)
    if (amount <= 0) continue
    items.push({
      paymentId: p.id,
      jobId: p.job_id,
      jobLabel: jobLabelForBankReturn(jobsById.get(p.job_id)),
      amount,
      reason: ret.reason,
      postedYmd: tx.posted_at ? String(tx.posted_at).slice(0, 10) : null,
    })
  }
  items.sort((a, b) => b.amount - a.amount || a.jobLabel.localeCompare(b.jobLabel))
  return {
    count: items.length,
    total: items.reduce((s, i) => s + i.amount, 0),
    first: items[0] ?? null,
    items,
  }
}

// ---- The Pipeline row (v2.3806, punch list #40 PR 3) ---------------------------------

/** What a job still counts as paid that the bank took back — one badge per row. */
export type BankReturnedOnJob = { count: number; total: number; reason: string }

/** The card's items folded per job, so a Pipeline row can ask "is this job one of them" in O(1). */
export function bankReturnedByJob(items: ReadonlyArray<BankReturnedPayment>): Map<string, BankReturnedOnJob> {
  const out = new Map<string, BankReturnedOnJob>()
  for (const i of items) {
    const cur = out.get(i.jobId)
    if (cur) {
      cur.count += 1
      cur.total += i.amount
      if (!cur.reason && i.reason) cur.reason = i.reason
    } else out.set(i.jobId, { count: 1, total: i.amount, reason: i.reason })
  }
  return out
}

const moneyShort = (n: number): string =>
  Math.round(Math.abs(n) * 100) % 100 === 0
    ? `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
    : `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "check returned · $13,680" — the badge beside the paid figure; "2 checks returned · $21,680" when two deposits bounced. */
export function bankReturnedBadgeWords(b: BankReturnedOnJob): string {
  return `${b.count > 1 ? `${b.count} checks` : 'check'} returned · ${moneyShort(b.total)}`
}

/** The badge's hover / the phone chip's title. */
export function bankReturnedBadgeTitle(b: BankReturnedOnJob): string {
  const reason = asText(b.reason)
  const what = b.count > 1 ? `${b.count} deposits the bank returned` : 'a deposit the bank returned'
  return `This job still counts ${what}${reason ? ` (${reason})` : ''} — ${moneyShort(b.total)} — as paid. Open ③ Payments received; Unlink and remove takes it off the job and marks the deposit returned in Accounts Receivable.`
}
