/**
 * The customer's pay-by date on its way to the office ("Their Word" PR 2): one POST to
 * `submit-portal-request` as a `payment_promise`. Shared by the statement's ask
 * (`PortalPromiseAsk`) and the strip on the bill's row (`PortalPromiseStrip`, punch list #217,
 * outside-12), so the two send the same thing. The sample token never reaches here: the pages
 * short-circuit a sample send before it.
 */
import { portalFailureCause, portalFailureKind, type PortalFailureCause } from './portalFailure'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export type PortalPromiseSend = { ok: true } | { ok: false; failure: PortalFailureCause }

export async function postPortalPromise(args: { token: string; date: string; note?: string }): Promise<PortalPromiseSend> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: args.token, kind: 'payment_promise', date: args.date, note: args.note?.trim() || undefined }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: unknown } | null
    if (!res.ok || !json?.ok) return { ok: false, failure: portalFailureCause(res.status, json, 'send') }
    return { ok: true }
  } catch (e) {
    return { ok: false, failure: portalFailureKind(e) }
  }
}
