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
      ? ['Cash App', (sourceId ?? '').trim()].filter(Boolean).join(' ')
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

// ── The app's own Record payment doors (v2.3717) ─────────────────────────────────────────────
// Until v2.3717 only `record_pay_send` and the backfill wrote `source_kind`; the pay-run row's
// Record payment, Balances' split modal and the Cash App reconcile wrote a memo alone, so the
// Payments view had to guess the method from the memo's first words. Now every door takes a
// method and writes the same columns and the same memo the function does.

/** A Cash App transaction id as typed — trimmed, upper-cased, wearing its `#` (the matcher's rule (a) reads `#D-…`, so `d-3v3mvpkvp` → `#D-3V3MVPKVP`); blank → null. */
export function normalizeCashAppId(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toUpperCase()
  if (!s) return null
  return s.startsWith('#') ? s : `#${s}`
}

export type PaySourceWrite = { source_kind: PaySourceKind | null; source_id: string | null; memo: string | null }

/**
 * What a Record payment door writes for the method it was given: the two columns and the memo
 * `paySendMemo` builds (`Cash App #D-… "note"`, `Mercury "note"`, …). Only Cash App carries an id
 * a person can type; the other kinds' ids are the app's own rows and stay null here. No method →
 * the note alone and both columns null, the row exactly as the door wrote it before.
 */
export function paySourceWrite(kind: PaySourceKind | null, cashAppId: string | null | undefined, note: string | null | undefined): PaySourceWrite {
  const n = (note ?? '').trim()
  if (!kind) return { source_kind: null, source_id: null, memo: n || null }
  const id = kind === 'cashapp' ? normalizeCashAppId(cashAppId) : null
  return { source_kind: kind, source_id: id, memo: paySendMemo(kind, id, n) }
}

/** The partial unique index `pay_stub_payments_source_per_report_uidx` refused the row: that send is already recorded on that report. */
export function isPaySourceDuplicateError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ((e as { message?: unknown } | null)?.message as string | undefined) ?? ''
  return /pay_stub_payments_source_per_report_uidx/.test(String(msg))
}

/** The sentence a door shows for `isPaySourceDuplicateError` — a person's words for a unique-index name. */
export const PAY_SOURCE_DUPLICATE_MESSAGE = 'That Cash App send is already recorded on this week — one of its payments carries the same transaction id.'

/**
 * A method read off a memo written before the column existed (rows before v2.3578's backfill,
 * and hand-recorded rows before v2.3717): the memo's first words — *Cash App* in its spellings,
 * *Apple Pay* / *Apple Cash*, *Mercury*, *client …* / *paid via client …*. Deliberately a
 * whole-word test at the start, so a note that merely mentions a client's balance is not a
 * method. Anything else is null: a memo like "Check 1044" stays readable in the memo cell, and
 * a real *Other* is only what a door recorded as one.
 */
export function paySourceKindFromMemo(memo: string | null | undefined): PaySourceKind | null {
  const m = (memo ?? '').trim().toLowerCase()
  if (!m) return null
  if (/^cash\s?app\b/.test(m)) return 'cashapp'
  if (/^apple\s?(pay|cash|wallet)\b/.test(m)) return 'apple_pay'
  if (/^mercury\b/.test(m)) return 'mercury'
  if (/^(paid\s+)?(via|by|from)\s+client\b/.test(m) || /^client\b/.test(m)) return 'client_direct'
  return null
}
