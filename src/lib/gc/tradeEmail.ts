/**
 * GC mode, every email to a trade partner (P3-a, plan `to-dos/gc-mode/mockups/portal-p3.md` on spike/gc-mode): what the
 * office screens need to call `gc-trade-email` and say its answer. The rules the function reads live in
 * `supabase/functions/_shared/gcTradeEmail.ts`; this is the office's side. Pure, so the Ask window, a new set's step and
 * the questions window read one copy (`gcTradeEmail.test.ts`).
 */
import type { TradeEmailErrorKey, TradeEmailLine } from '../../../supabase/functions/_shared/gcTradeEmail'
import { portalShownLang, pt, type PortalLang } from './portalI18n'
import type { PortalMessage } from './portal'
import type { GcState } from './types'

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

/** A company that hears an answer about the plans: one with an ask on the question's trade. */
export interface AnswerRecipient {
  companyId: string
  company: string
}

/**
 * Who hears an answer (P3-b, the prototype's `questionRecipients`): every company with an ask on the question's trade
 * while we bid, never one that passed, and once the job is ours only the company we awarded it. A question about the
 * job as a whole, or a bid we lost, goes to nobody.
 */
export function answerRecipients(state: GcState | null, projectId: string, packageId: string | null): AnswerRecipient[] {
  if (!state || !packageId) return []
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  if (!project || !pkg || project.lostOn) return []
  const out: AnswerRecipient[] = []
  for (const invite of pkg.invites) {
    if (invite.status === 'declined') continue
    if (project.stage !== 'pursuing' && invite.id !== pkg.awardedInviteId) continue
    const partner = state.partners.find((p) => p.id === invite.partnerId)
    if (!partner || out.some((r) => r.companyId === partner.id)) continue
    out.push({ companyId: partner.id, company: partner.company })
  }
  return out
}

/** An answer's email in a company's language: what it is about, the question, the answer, and the set that carried it. */
export function answerEmail(a: { project: string; trade: string; question: string; answer: string; setLabel: string | null }, lang: PortalLang): { subject: string; lines: TradeEmailLine[] } {
  return {
    subject: pt(lang, 'mAnswerSubject', { trade: a.trade, project: a.project }),
    lines: [
      pt(lang, 'mAnswerWhat', { trade: a.trade, project: a.project }),
      pt(lang, 'mAnswerQ', { text: a.question.trim() }),
      pt(lang, 'mAnswerA', { text: a.answer.trim() }),
      ...(a.setLabel ? [pt(lang, 'mAnswerSet', { set: a.setLabel })] : []),
    ],
  }
}

/** The key an answer is sent once by, per company. */
export const answerEmailKey = (questionId: string): string => `${questionId}:answer`

/** "A and B", "A, B and C". */
function andWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** What the office reads after a send: who has it now, then each company it did not reach and why. */
export function answerSentWords(sent: string[], refused: { company: string; key: TradeEmailErrorKey }[]): { done: string | null; problem: string | null } {
  return {
    done: sent.length > 0 ? `The answer went to ${andWords(sent)}`.replace(/\.?$/, '.') : null,
    problem: refused.length > 0 ? refused.map((r) => `${r.company}: ${gcTradeEmailRefusal(r.key)}`).join(' ') : null,
  }
}
