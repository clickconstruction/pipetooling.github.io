/**
 * Where a pay send came from (v2.3578; Apple Pay and the part memo v2.3580). One definition
 * shared by the client and the SQL side — `pay_stub_payments.source_kind` / `source_id` and the
 * `record_pay_send` / `link_pay_send` functions use the same kinds and write the same memo
 * (`pay_send_memo`, `pay_send_part_memo` in the migrations).
 *
 * - `cashapp`       — the Cash App transaction id (`#D-…`); the memo keeps it so the reconcile
 *                     matcher's rule (a) still reads it back.
 * - `mercury`       — an outgoing payment; source_id = the app's `mercury_transactions.id`.
 * - `apple_pay`     — an Apple Pay / Apple Cash send; source_id = its Mercury card row, the same
 *                     shape as Cash App's card rows. May be recorded before the row posts.
 * - `client_direct` — a client paid the person straight; no bank row on our side.
 * - `other`         — cash, a cheque, anything else.
 *
 * The part memo: when one send lands on several report rows, every row says which part it is
 * and what the whole send was — `Apple Pay "Tristen" · 2 of 2 from $1,067.23`. The function
 * writes it; a robot groups rows by source instead of parsing it.
 */

export const PAY_SOURCE_KINDS = ['cashapp', 'mercury', 'apple_pay', 'client_direct', 'other'] as const
export type PaySourceKind = (typeof PAY_SOURCE_KINDS)[number]

/** A recorded amount within this many dollars of the send it matches is corrected to the send (the owner, 2026-09-17: "go with $5"). Beyond it, the row goes to Review. */
export const PAY_SEND_AUTOCORRECT_USD = 5

/** Tracking starts here (the owner, 2026-09-18: "we should not go all the way back because we weren't tracking back then … only go back to April first"). The backfill files earlier sends as before records and leaves earlier payments alone. */
export const PAY_BACKFILL_SINCE = '2026-04-01'

export function isPaySourceKind(value: unknown): value is PaySourceKind {
  return typeof value === 'string' && (PAY_SOURCE_KINDS as readonly string[]).includes(value)
}

export function paySourceLabel(kind: PaySourceKind | null | undefined): string {
  switch (kind) {
    case 'cashapp':
      return 'Cash App'
    case 'mercury':
      return 'Mercury'
    case 'apple_pay':
      return 'Apple Pay'
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
 * `Cash App #D-… "note"`, `Mercury "note"`, `Apple Pay "note"`, `Client direct "note"`,
 * `Payment "note"`; the quoted note is dropped when empty.
 */
export function paySendMemo(kind: PaySourceKind, sourceId: string | null | undefined, note: string | null | undefined): string {
  const head =
    kind === 'cashapp'
      ? `Cash App ${sourceId ?? ''}`
      : kind === 'mercury'
        ? 'Mercury'
        : kind === 'apple_pay'
          ? 'Apple Pay'
          : kind === 'client_direct'
            ? 'Client direct'
            : 'Payment'
  const n = (note ?? '').trim()
  return n ? `${head} "${n}"` : head
}

/** ` · 2 of 2 from $1,067.23` at the end of a memo — the part suffix `pay_send_part_memo` writes. */
export const PAY_SEND_PART_RE = / · (\d+) of (\d+) from \$([\d,]+\.\d{2})$/

const usd = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The memo without its part suffix (SQL `pay_send_strip_part`). */
export function stripPaySendPart(memo: string | null | undefined): string {
  return (memo ?? '').replace(PAY_SEND_PART_RE, '')
}

/** `base · part of of from $total` (SQL `pay_send_part_memo`); a stale suffix on `base` is replaced. */
export function paySendPartMemo(base: string, part: number, of: number, total: number): string {
  return `${stripPaySendPart(base)} · ${part} of ${of} from $${usd(total)}`
}

/** Reads the part suffix back: `{ part, of, total }`, or null when the memo has none. */
export function parsePaySendPart(memo: string | null | undefined): { part: number; of: number; total: number } | null {
  const m = PAY_SEND_PART_RE.exec(memo ?? '')
  if (!m) return null
  return { part: Number(m[1]), of: Number(m[2]), total: Number(m[3]!.replace(/,/g, '')) }
}

/** Whether a recorded amount is close enough to the send to be corrected to it without a person looking. */
export function withinPaySendAutocorrect(recorded: number, sent: number): boolean {
  return Math.abs(Math.round((recorded - sent) * 100) / 100) <= PAY_SEND_AUTOCORRECT_USD
}
