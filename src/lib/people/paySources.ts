/**
 * Where a pay send came from (v2.3578). One definition shared by the client and the SQL side —
 * `pay_stub_payments.source_kind` / `source_id` and the `record_pay_send` / `link_pay_send`
 * functions use the same kinds and write the same memo (`pay_send_memo` in the migration).
 *
 * - `cashapp`       — the Cash App transaction id (`#D-…`); the memo keeps it so the reconcile
 *                     matcher's rule (a) still reads it back.
 * - `mercury`       — the app's `mercury_transactions.id`.
 * - `client_direct` — a client paid the person straight; no bank row on our side.
 * - `other`         — cash, a cheque, anything else.
 */

export const PAY_SOURCE_KINDS = ['cashapp', 'mercury', 'client_direct', 'other'] as const
export type PaySourceKind = (typeof PAY_SOURCE_KINDS)[number]

/** A recorded amount within this many dollars of the send it matches is corrected to the send (the owner, 2026-09-17: "go with $5"). Beyond it, the row goes to Review. */
export const PAY_SEND_AUTOCORRECT_USD = 5

export function isPaySourceKind(value: unknown): value is PaySourceKind {
  return typeof value === 'string' && (PAY_SOURCE_KINDS as readonly string[]).includes(value)
}

export function paySourceLabel(kind: PaySourceKind | null | undefined): string {
  switch (kind) {
    case 'cashapp':
      return 'Cash App'
    case 'mercury':
      return 'Mercury'
    case 'client_direct':
      return 'Client direct'
    case 'other':
      return 'Other'
    default:
      return ''
  }
}

/**
 * The memo a recorded send wears — the same string `pay_send_memo` builds in SQL:
 * `Cash App #D-… "note"`, `Mercury "note"`, `Client direct "note"`, `Payment "note"`; the quoted
 * note is dropped when empty.
 */
export function paySendMemo(kind: PaySourceKind, sourceId: string | null | undefined, note: string | null | undefined): string {
  const head =
    kind === 'cashapp' ? `Cash App ${sourceId ?? ''}` : kind === 'mercury' ? 'Mercury' : kind === 'client_direct' ? 'Client direct' : 'Payment'
  const n = (note ?? '').trim()
  return n ? `${head} "${n}"` : head
}

/** Whether a recorded amount is close enough to the send to be corrected to it without a person looking. */
export function withinPaySendAutocorrect(recorded: number, sent: number): boolean {
  return Math.abs(Math.round((recorded - sent) * 100) / 100) <= PAY_SEND_AUTOCORRECT_USD
}
