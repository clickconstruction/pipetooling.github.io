/**
 * Interpret the jsonb envelope returned by the
 * `ensure_single_ready_to_bill_invoice_for_job` RPC for callers that run it as
 * a POST-INVOICE-MUTATION RESYNC (segment/partial/fee-split creates, draft
 * deletes). For those callers "the remainder is fully allocated" is a SUCCESS
 * state — the invoice they just wrote exists; there is simply nothing left for
 * the elastic primary bundle to carry.
 *
 * Shapes handled:
 *  - `{ ok: true, ... }` — resized/created/deleted the primary; success.
 *    (Since the zero-remainder fix the RPC returns `ok: true,
 *    fully_allocated: true` after DELETING an empty never-sent primary.)
 *  - `{ error: 'Nothing left to bill…' | 'No remainder to bill…' }` — the
 *    pre-fix RPC's fully-allocated envelopes. Benign here: treat as success so
 *    a client deployed ahead of the migration doesn't report a phantom
 *    failure (the v2.2444-era bug: the invoice was created, the user saw
 *    "Nothing left to bill; invoice amount would be zero").
 *  - any other `{ error: string }` — a real failure; surface it.
 *
 * Bill Customer's `kind:'job'` ensure-on-open is NOT a resync — "nothing left
 * to bill" genuinely blocks it there — so it does not use this helper.
 */
export type EnsureRemainderResyncOutcome = { ok: true } | { ok: false; error: string }

const FULLY_ALLOCATED_ERROR_RE = /nothing left to bill|no remainder to bill/i

export function ensureRemainderResyncOutcome(raw: unknown): EnsureRemainderResyncOutcome {
  const obj = raw as Record<string, unknown> | null
  const error = obj && typeof obj.error === 'string' && obj.error.length > 0 ? obj.error : null
  if (error === null) return { ok: true }
  if (FULLY_ALLOCATED_ERROR_RE.test(error)) return { ok: true }
  return { ok: false, error }
}
