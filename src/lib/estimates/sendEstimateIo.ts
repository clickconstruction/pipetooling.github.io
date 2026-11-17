/**
 * The one call to `send-estimate-to-customer` (punch list #46 row 3, the Estimates map's Stage-A row 1).
 *
 * The estimate page used to write this request three times, each reading the reply its own way: the first
 * send and the sheet's Send the link again, the panel's Resend link, and the letter again after a new
 * good-through date. This is the only path on the page that emails a customer, so the request is built
 * once here and the reply's meaning is a pure function with tests.
 *
 * The three callers still differ on purpose, and each keeps its own handling of the reply:
 * - the sheet's send passes `timeoutMs` and turns the reply into words with `sendEstimateAnswerFrom`;
 * - the panel's resend passes no timeout and needs `accept_url` in the reply;
 * - the letter again passes no timeout and throws when the reply is a no.
 */
import { canResendEstimateLink, estimateLinkResendBlockMessage } from '../../../supabase/functions/_shared/estimateLinkResend'
import { supabase } from '../supabase'
import type { TellSendEmailAnswer } from '../tellCustomer/tellCustomer'

/** `send` is the first send; `resend` mints a fresh link and kills the old one; `remail` mails the stored letter with the link they hold. */
export type SendEstimateMode = 'send' | 'resend' | 'remail'

/** The function's reply, every field optional: a refusal carries `error` and sometimes `code`. */
export interface SendEstimateReply {
  ok?: boolean
  accept_url?: string
  emailed?: boolean
  sent_to?: string
  email_error?: string
  warning?: string
  error?: string
  code?: string
  sent_at?: string | null
  estimate_status?: string
}

export interface SendEstimateRequest {
  estimateId: string
  mode: SendEstimateMode
  /** The address a first send goes to. A resend and the letter again use the address on the row. */
  customerEmail?: string
  /** Give up after this long and answer `slow`. Left out, the call waits as long as the browser does. */
  timeoutMs?: number
}

/** What the call came back with: nobody signed in, no answer in time, or the function's reply. */
export type SendEstimatePost =
  | { kind: 'no-session' }
  | { kind: 'slow' }
  | { kind: 'reply'; httpOk: boolean; json: SendEstimateReply }

/** What the call needs from the browser, so a test can stand in for each. */
export interface SendEstimateDoor {
  accessToken: () => Promise<string | null>
  fetch: (url: string, init: RequestInit) => Promise<Response>
  functionsUrl: string
  anonKey: string
  publicOrigin: string | undefined
  /** A signal that aborts after `ms`, or none where the browser has no `AbortSignal.timeout`. */
  timeoutSignal: (ms: number) => AbortSignal | undefined
}

/** The door the page uses: the signed-in session, the project's functions and this window's origin. */
export function browserSendEstimateDoor(): SendEstimateDoor {
  return {
    accessToken: async () => {
      const { data: sess } = await supabase.auth.getSession()
      return sess.session?.access_token ?? null
    },
    fetch: (url, init) => fetch(url, init),
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    publicOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
    timeoutSignal: (ms) => (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined),
  }
}

/** The JSON the function reads. A first send names the address; the other two name their mode. */
export function sendEstimateRequestBody(request: SendEstimateRequest, publicOrigin: string | undefined): Record<string, unknown> {
  return {
    estimate_id: request.estimateId,
    public_origin: publicOrigin,
    ...(request.mode === 'send' ? { customer_email: request.customerEmail } : { mode: request.mode }),
  }
}

/**
 * Posts the request as the signed-in person. Never throws for a missing session or a timeout; a network
 * failure or a reply that is not JSON still throws, as it did at each of the three sites.
 */
export async function postSendEstimate(request: SendEstimateRequest, door: SendEstimateDoor = browserSendEstimateDoor()): Promise<SendEstimatePost> {
  const jwt = await door.accessToken()
  if (!jwt) return { kind: 'no-session' }
  let res: Response
  try {
    res = await door.fetch(`${door.functionsUrl}/send-estimate-to-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: door.anonKey,
      },
      body: JSON.stringify(sendEstimateRequestBody(request, door.publicOrigin)),
      signal: request.timeoutMs != null ? door.timeoutSignal(request.timeoutMs) : undefined,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') return { kind: 'slow' }
    throw e
  }
  const json = (await res.json()) as SendEstimateReply
  return { kind: 'reply', httpOk: res.ok, json }
}

/**
 * The reply as the Tell the customer sheet hears it: ok with the accept link, or why not. A send that
 * already went says when; an estimate that is no longer a draft says why a fresh link cannot be made,
 * in the resend rule's own words; every other no carries the server's reason.
 */
export function sendEstimateAnswerFrom(httpOk: boolean, json: SendEstimateReply): TellSendEmailAnswer {
  if (!httpOk || !json.ok) {
    if (json.code === 'already_sent') {
      const sentAtMs = json.sent_at ? Date.parse(json.sent_at) : NaN
      return { ok: false, kind: 'already-went', why: json.error || 'This estimate already went to the customer.', sentAtMs: Number.isNaN(sentAtMs) ? null : sentAtMs }
    }
    if (json.code === 'not_draft' && json.estimate_status) {
      const verdict = canResendEstimateLink(json.estimate_status, null)
      return { ok: false, kind: 'refused', why: verdict.ok ? json.error || 'Send failed' : estimateLinkResendBlockMessage(verdict.reason) }
    }
    return { ok: false, kind: 'refused', why: json.error || 'Send failed' }
  }
  return { ok: true, acceptUrl: json.accept_url ?? null, emailed: Boolean(json.emailed), warning: json.warning || json.email_error || null }
}
