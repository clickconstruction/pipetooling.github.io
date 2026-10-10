/**
 * GC mode, the trade partner portal's presses (P2b-ii, to-dos/gc-mode/mockups/portal-p2b.md): one post to
 * `submit-gc-trade-portal` with the company's link, its kind and its fields. The function answers `{ ok, value? }` or
 * a refusal key the page says in the company's words (`tradeErrorWords`); a file's answer (P5a-1) is its link, in
 * `value`. A staff session rides along only as a "who is looking" hint, as on every outside page.
 */
import type { TradeSubmitKind } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export type TradeSubmitResult = { ok: true; value?: unknown } | { ok: false; key: string }

/** A file placed in the job's Drive folder (P5a-1): its row, its name as the trade gave it, and the link the next kind stores. */
export interface TradeFilePlaced {
  id: string | null
  name: string
  url: string
}

/** The function's answer to a file, or null when it carried none (the sample answers ok and places nothing). */
export function tradeFilePlaced(value: unknown): TradeFilePlaced | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.url !== 'string' || !/^https:\/\/\S+$/.test(v.url) || typeof v.name !== 'string') return null
  return { id: typeof v.id === 'string' ? v.id : null, name: v.name, url: v.url }
}

export async function submitTradePortal(token: string, kind: TradeSubmitKind, fields: Record<string, unknown> = {}): Promise<TradeSubmitResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-gc-trade-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAwarePublicHeaders()) },
      body: JSON.stringify({ ...fields, token, kind }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; value?: unknown } | null
    if (res.ok && body?.ok === true) return body.value === undefined ? { ok: true } : { ok: true, value: body.value }
    return { ok: false, key: typeof body?.error === 'string' ? body.error : 'failed' }
  } catch {
    return { ok: false, key: 'failed' }
  }
}
