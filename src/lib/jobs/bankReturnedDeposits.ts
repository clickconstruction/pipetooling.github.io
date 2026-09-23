/**
 * Bank-returned deposits (v2.3791): the read side of v2.3784's bounced check.
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
 * Pure; unit-tested in bankReturnedDeposits.test.ts.
 */

export type MercuryBankReturn = { reason: string }

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** What the bank said — null unless the deposit posted, then failed. */
export function mercuryBankReturn(tx: {
  status: string | null | undefined
  posted_at: string | null | undefined
  amount: number | string | null | undefined
  failureReason?: string | null | undefined
}): MercuryBankReturn | null {
  if (asText(tx.status) !== 'failed') return null
  if (!tx.posted_at) return null
  if (!((Number(tx.amount) || 0) > 0)) return null
  return { reason: asText(tx.failureReason) }
}

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
export type BankReturnedJobRow = { id: string; hcp_number: string | null; job_name: string | null; customer_name?: string | null }

export function jobLabelForBankReturn(j: BankReturnedJobRow | null | undefined): string {
  const n = asText(j?.hcp_number)
  const name = asText(j?.job_name) || asText(j?.customer_name)
  return [n ? `J${n}` : null, name].filter(Boolean).join(' ') || 'a job'
}

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
