/**
 * GC mode, the trade partner portal's presses (P2b-ii, to-dos/gc-mode/mockups/portal-p2b.md): one post to
 * `submit-gc-trade-portal` with the company's link, its kind and its fields. The function answers `{ ok }` or a
 * refusal key the page says in the company's words (`tradeErrorWords`). A staff session rides along only as a
 * "who is looking" hint, as on every outside page.
 */
import type { TradeSubmitKind } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export type TradeSubmitResult = { ok: true } | { ok: false; key: string }

export async function submitTradePortal(token: string, kind: TradeSubmitKind, fields: Record<string, unknown> = {}): Promise<TradeSubmitResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-gc-trade-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAwarePublicHeaders()) },
      body: JSON.stringify({ ...fields, token, kind }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null
    if (res.ok && body?.ok === true) return { ok: true }
    return { ok: false, key: typeof body?.error === 'string' ? body.error : 'failed' }
  } catch {
    return { ok: false, key: 'failed' }
  }
}
