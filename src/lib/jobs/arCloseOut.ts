/**
 * Accounts Receivable — the reason-coded close-out (v2.3529, Money with no bill PR 2).
 *
 * Some money that lands in the bank is not a customer's payment at all: bank interest, a
 * vendor's refund, an owner putting money in. There is no bill and no job for it, so the
 * deposit would sit in To match forever — the only exits were a bill (there is none) or
 * Mark returned (a lie: the money did not bounce). This decides when to offer the third
 * exit: name the reason and the deposit leaves the pile with the reason on the record.
 *
 * The rule is the mirror of the tip offer (`arTipOffer.ts`): the tip strip appears once a
 * deposit HAS been matched and money is left over; this strip appears only while NOTHING
 * has been applied. Money that has touched a job is a customer's, and its leftover is a
 * tip, never a close-out. The RPC enforces the same line.
 *
 * Pure: no Supabase, no React. The write is `set_mercury_transaction_ar_closed`.
 */

/** Matches the list RPC's remainder rule and the modal's own `AR_BANK_REMAINING_EPS`. */
export const AR_CLOSE_OUT_EPS = 0.0005

export type ArCloseReason = 'bank_interest' | 'vendor_refund' | 'owner_deposit' | 'other'

export const AR_CLOSE_REASONS: ReadonlyArray<{ key: ArCloseReason; label: string; hint: string }> = [
  { key: 'bank_interest', label: 'Bank interest', hint: 'The bank paid it, nobody owed it' },
  { key: 'vendor_refund', label: 'Vendor refund', hint: 'A supply house or vendor sent money back' },
  { key: 'owner_deposit', label: 'Owner deposit', hint: 'Money put in by the owner, not earned on a job' },
  { key: 'other', label: 'Something else', hint: 'Say what it is in the note' },
]

export function arCloseReasonLabel(reason: string | null | undefined): string {
  const hit = AR_CLOSE_REASONS.find((r) => r.key === reason)
  return hit ? hit.label : 'Closed out'
}

export function isArCloseReason(v: string | null | undefined): v is ArCloseReason {
  return AR_CLOSE_REASONS.some((r) => r.key === v)
}

/** One sidecar row: the deposit was closed out with this reason. */
export type ArClosedRow = {
  mercury_transaction_id: string
  reason: string
  note: string | null
  closed_at: string
  closed_by: string | null
}

export type ArCloseOutInput = {
  /** `remaining_available` from the deposit row. */
  remaining: number | null | undefined
  /** `consumed`: what has already been applied to jobs. Anything above zero means a customer's money. */
  consumed: number | null | undefined
  /** Deposits flagged as bounced get no close-out — unmark first. */
  returned?: boolean
  /** v2.3791: the bank returned it (Mercury `failed` after posting) — nothing to close out, the money never arrived. */
  bankReturned?: boolean
  /** Already closed: the header shows the record instead of the offer. */
  closed?: boolean
  /** What the bank said, used only to suggest a reason. */
  counterpartyName?: string | null
  note?: string | null
  memo?: string | null
}

export type ArCloseOutOffer = {
  /** The whole remainder — the close-out takes the deposit off the pile as a unit. */
  amount: number
  /** "Not a customer's payment?" */
  headline: string
  sentence: string
  buttonLabel: string
  /** A reason guessed from the bank text, or null when nothing in it says. */
  suggestedReason: ArCloseReason | null
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Reads the bank's own words for a reason. Interest is unmistakable; "refund"/"return"/"credit"
 * on a deposit reads as a vendor sending money back; an owner's name is not knowable here.
 */
export function suggestArCloseReason(text: {
  counterpartyName?: string | null
  note?: string | null
  memo?: string | null
}): ArCloseReason | null {
  const hay = [text.counterpartyName, text.note, text.memo]
    .map((s) => (s ?? '').toLowerCase())
    .join(' ')
  if (/\binterest\b/.test(hay)) return 'bank_interest'
  if (/\b(refund|reimburse|reimbursement|credit memo|rtn|return)\b/.test(hay)) return 'vendor_refund'
  if (/\b(owner|capital contribution|shareholder|member contribution)\b/.test(hay)) return 'owner_deposit'
  return null
}

/** Returns the offer to show, or null when this deposit is not a close-out case. */
export function buildArCloseOutOffer(input: ArCloseOutInput): ArCloseOutOffer | null {
  if (input.returned === true || input.bankReturned === true) return null
  if (input.closed === true) return null

  const remaining = Number(input.remaining ?? 0)
  if (!Number.isFinite(remaining) || remaining <= AR_CLOSE_OUT_EPS) return null

  // Money already on a job: a customer paid. The leftover is a tip, not a close-out.
  const consumed = Number(input.consumed ?? 0)
  if (Number.isFinite(consumed) && consumed > AR_CLOSE_OUT_EPS) return null

  const amount = Math.round(remaining * 100) / 100
  if (amount <= 0) return null

  return {
    amount,
    headline: 'Not a customer’s payment?',
    sentence:
      'Bank interest, a vendor refund or an owner deposit has no job to land on. Name the reason and the deposit leaves To match; Banking’s label still books the money.',
    buttonLabel: `Close out ${money(amount)}`,
    suggestedReason: suggestArCloseReason(input),
  }
}

/** "Vendor refund · Sep 16, 2026" — the header's record of a closed deposit. */
export function describeArCloseOut(row: ArClosedRow, formatDate: (iso: string) => string): string {
  const when = row.closed_at ? formatDate(row.closed_at) : ''
  const base = arCloseReasonLabel(row.reason)
  const note = (row.note ?? '').trim()
  const head = note && row.reason === 'other' ? `${base} — ${note}` : base
  return when ? `${head} · ${when}` : head
}

/** Whether the confirm button may be pressed: a reason, and a note when the reason is Something else. */
export function arCloseOutReady(reason: string | null, note: string): boolean {
  if (!isArCloseReason(reason)) return false
  if (reason === 'other' && note.trim().length === 0) return false
  return true
}
