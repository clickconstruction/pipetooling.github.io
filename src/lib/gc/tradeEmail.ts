/**
 * GC mode, every email to a trade partner (P3-a, plan `to-dos/gc-mode/mockups/portal-p3.md` on spike/gc-mode): what the
 * office screens need to call `gc-trade-email` and say its answer. The rules the function reads live in
 * `supabase/functions/_shared/gcTradeEmail.ts`; this is the office's side. Pure, so the Ask window, a new set's step and
 * the questions window read one copy (`gcTradeEmail.test.ts`).
 */
import type { TradeEmailErrorKey, TradeEmailLine } from '../../../supabase/functions/_shared/gcTradeEmail'
import { portalShownLang, pt, pWeekday, type PortalLang } from './portalI18n'
import type { PortalMessage } from './portal'
import type { BackCharge, GcState, TradeChangeRequest } from './types'
import { money } from './words'

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

/** A note as a sentence: it ends with a stop, so the words after it read (`portal.ts`' asSentence, which stays private there). */
function asSentence(text: string): string {
  const t = text.trim()
  return t === '' || /[.!?]$/.test(t) ? t : `${t}.`
}

/** The emails a back-charge can send (P4b-iii): when it goes, when the office keeps or drops it, and when it comes off a draw. */
export type BackChargeEmailStage = 'sent' | 'settled' | 'taken'

/**
 * A back-charge's email in a company's language (kind `backCharge`, to the people who get pay emails), from the prototype's
 * `portalMessages` word for word, without the greeting the function writes. `sent` is Building's charge, `settled` its keep
 * or drop, `taken` U6's draw. Null when the charge is not at that stage.
 */
export function backChargeEmail(
  stage: BackChargeEmailStage,
  a: { project: string; trade: string; charge: BackCharge; drawNumber?: number | null },
  lang: PortalLang,
): { subject: string; lines: TradeEmailLine[] } | null {
  const c = a.charge
  const amount = money(c.amount)
  if (stage === 'sent') {
    return {
      subject: pt(lang, 'mBcSubject', { project: a.project, amount }),
      lines: [pt(lang, 'mBcWhat', { amount, trade: a.trade, reason: asSentence(c.reason) }), pt(lang, 'mBcAnswer', { date: pWeekday(lang, c.answerBy) }), pt(lang, 'mBcOpen')],
    }
  }
  if (stage === 'settled') {
    if (!c.settled || (c.status !== 'kept' && c.status !== 'dropped')) return null
    const kept = c.status === 'kept'
    return {
      subject: pt(lang, kept ? 'mBcKeptSubject' : 'mBcDroppedSubject', { project: a.project }),
      lines: [pt(lang, kept ? 'mBcKept' : 'mBcDropped', { amount, note: asSentence(c.settled.note) }), pt(lang, 'mBcOpen')],
    }
  }
  if (!c.taken || a.drawNumber === null || a.drawNumber === undefined) return null
  return {
    subject: pt(lang, 'mBcTakenSubject', { n: a.drawNumber, project: a.project, amount }),
    lines: [pt(lang, 'mBcTaken', { amount, n: a.drawNumber, reason: asSentence(c.reason) }), pt(lang, 'mBcOpen')],
  }
}

/** The key each back-charge email is sent once by, per company. */
export const backChargeEmailKey = (chargeId: string, stage: BackChargeEmailStage): string => `${chargeId}:${stage}`

/** The emails a change request can send (P4b-iii): turned down, sent to the customer, or the customer said no. */
export type ChangeAskEmailStage = 'down' | 'sent' | 'no'

/**
 * The office's answer to a change a company asked for, in its language (kind `changeAsk`, to the people who get contract
 * emails), from the prototype's `portalMessages` word for word, without the greeting. `down` and `sent` are Owner Billing's
 * answers, `no` the customer's. Its part of a change order is the cost, never our price to the customer. Null when the
 * request is not at that stage.
 */
export function changeAskEmail(
  stage: ChangeAskEmailStage,
  a: { project: string; trade: string; request: TradeChangeRequest; changeOrder?: { number: number; cost: number } | null },
  lang: PortalLang,
): { subject: string; lines: TradeEmailLine[] } | null {
  const r = a.request
  const youAsked = pt(lang, 'mCrYouAsked', { trade: a.trade, what: r.description.replace(/\.$/, ''), amount: money(r.amount) })
  if (stage === 'down') {
    if (!r.turnedDown) return null
    return { subject: pt(lang, 'mCrDownSubject', { project: a.project }), lines: [youAsked, pt(lang, 'mCrDown', { note: r.turnedDown.note }), pt(lang, 'mCrOpen')] }
  }
  const co = a.changeOrder
  if (!co) return null
  if (stage === 'sent') return { subject: pt(lang, 'mCrSentSubject', { project: a.project }), lines: [youAsked, pt(lang, 'mCrSent', { n: co.number, part: money(co.cost) }), pt(lang, 'mCrOpen')] }
  return { subject: pt(lang, 'mCrNoSubject', { n: co.number }), lines: [pt(lang, 'mCrNo', { n: co.number, project: a.project }), pt(lang, 'mCrOpen')] }
}

/** The key each change request email is sent once by, per company. */
export const changeAskEmailKey = (requestId: string, stage: ChangeAskEmailStage): string => `${requestId}:${stage}`
