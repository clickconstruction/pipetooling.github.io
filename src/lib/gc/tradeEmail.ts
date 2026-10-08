/**
 * GC mode, every email to a trade partner (P3-a, plan `to-dos/gc-mode/mockups/portal-p3.md` on spike/gc-mode): what the
 * office screens need to call `gc-trade-email` and say its answer. The rules the function reads live in
 * `supabase/functions/_shared/gcTradeEmail.ts`; this is the office's side. Pure, so the Ask window, a new set's step and
 * the questions window read one copy (`gcTradeEmail.test.ts`).
 */
import type { TradeEmailErrorKey, TradeEmailLine } from '../../../supabase/functions/_shared/gcTradeEmail'
import { portalShownLang, pt, type PortalLang } from './portalI18n'
import type { PortalMessage } from './portal'

export type { TradeEmailErrorKey, TradeEmailKind, TradeEmailLine, TradeEmailRequest, TradeMailGroup } from '../../../supabase/functions/_shared/gcTradeEmail'

/** The language an email goes out in, from the company's record: its own once Spanish is on, English until then. */
export function tradeMailLang(lang: unknown): PortalLang {
  return lang === 'es' ? portalShownLang('es') : 'en'
}

/** The office's words for each refusal. `failed` also covers an answer the screen cannot read. */
export const GC_TRADE_EMAIL_REFUSALS: Record<TradeEmailErrorKey, string> = {
  badRequest: 'The email could not be read. Nothing was sent.',
  spanishHeld: 'Spanish emails wait until a native speaker reads them. Send it in English.',
  signIn: 'Sign in again, then send it.',
  officeOnly: 'Only a dev can email a trade partner while GC mode is built.',
  readOnly: 'A training account cannot send email.',
  notFound: 'That company is not on record.',
  notOnProject: 'The company has no ask on this project. Ask it to quote first.',
  noEmail: 'No one at the company has an email for this kind of message. Call them.',
  sendFailed: 'The email did not go out. Try again in a minute.',
  failed: 'The email did not go out. Try again.',
}

/** The office's words for a refusal key; an unknown key reads as `failed`. */
export function gcTradeEmailRefusal(key: string): string {
  return GC_TRADE_EMAIL_REFUSALS[key as TradeEmailErrorKey] ?? GC_TRADE_EMAIL_REFUSALS.failed
}

/**
 * An invitation's lines as the email carries them (`inviteMessage`): its words without the greeting, the lines the quote
 * should cover as a list, then what it leaves out under its title. The Ask window sends these; the sample shows them.
 */
export function inviteEmailLines(m: PortalMessage, lang: PortalLang): TradeEmailLine[] {
  return [
    ...m.lines.slice(1),
    ...((m.scope ?? []).length > 0 ? [{ items: m.scope ?? [] }] : []),
    ...((m.leavesOut ?? []).length > 0 ? [{ title: pt(lang, 'mInviteLeavesOut'), items: m.leavesOut ?? [] }] : []),
  ]
}

/** What `gc-trade-email` answered: sent (or sent before, `already`), or refused with its key. */
export type TradeEmailAnswer =
  | { ok: true; companyId: string; messageId: string; emailSendLogId: string | null; to: string[]; already: boolean }
  | { ok: false; key: TradeEmailErrorKey; detail: string | null }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The function's answer from what came back: the body of a success, or the body of a refusal. */
export function readTradeEmailAnswer(data: unknown, errorBody: unknown): TradeEmailAnswer {
  const refusal = isObject(errorBody) ? errorBody : isObject(data) && typeof data.error === 'string' ? data : null
  if (refusal) {
    const key = typeof refusal.error === 'string' && refusal.error in GC_TRADE_EMAIL_REFUSALS ? (refusal.error as TradeEmailErrorKey) : 'failed'
    return { ok: false, key, detail: typeof refusal.detail === 'string' ? refusal.detail : null }
  }
  if (!isObject(data) || typeof data.messageId !== 'string' || typeof data.companyId !== 'string') return { ok: false, key: 'failed', detail: null }
  return {
    ok: true,
    companyId: data.companyId,
    messageId: data.messageId,
    emailSendLogId: typeof data.emailSendLogId === 'string' ? data.emailSendLogId : null,
    to: Array.isArray(data.to) ? data.to.filter((n): n is string => typeof n === 'string') : [],
    already: data.already === true,
  }
}
