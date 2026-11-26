/**
 * Punch list #205, PR 6: the press behind Word to every trade. One call per awarded company through the one sender,
 * `gc-trade-email`, kind `nudge` to the people who get the job's emails, in the company's language, under one key for the
 * words (`wordEmailKey`), so a second press of the same words sends nothing to a person who has them. It keeps going past
 * a refusal and names each company with why afterwards, as every batch does. It never throws.
 *
 * One email a person (v2.8608): the call asks for `eachAlone`. When the mail service refuses a company's one message,
 * the function sends each person the email alone. The company counts as sent to, and each person the service refused is
 * `held`, by name, with the service's reason. A second press of the same words reaches a person who was held once the
 * address is mended, and nobody twice.
 */
import { gcTradeEmailRefusalWords, tradeEmailsSent, tradeMailLang } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import type { GcProject } from './types'
import { wordEmailKey, wordLines, type WordRecipient } from './wordToTrades'

export interface WordToTrades {
  /** Each company an email reached on this press. */
  sent: { companyId: string; company: string }[]
  /** Each company whose people had these words already: nothing was sent to it again. */
  already: { companyId: string; company: string }[]
  /** Each company not reached, with the office's words for why. */
  refused: { companyId: string; company: string; words: string }[]
  /** Each person the mail service refused at a company the word did reach, with the office's words for why. */
  held: { companyId: string; company: string; name: string; words: string }[]
  /** How many emails went on this press. */
  emails: number
}

export type SendWordToTrades = (project: GcProject, recipients: WordRecipient[], subject: string, text: string) => Promise<WordToTrades>

export const sendWordToTrades: SendWordToTrades = async (project, recipients, subject, text) => {
  const out: WordToTrades = { sent: [], already: [], refused: [], held: [], emails: 0 }
  const lines = wordLines(text)
  const key = await wordEmailKey(project.id, subject, text)
  for (const r of recipients) {
    const who = { companyId: r.partner.id, company: r.partner.company }
    const answer = await sendGcTradeEmail({ companyId: r.partner.id, kind: 'nudge', groups: ['job'], key, projectId: project.id, lang: tradeMailLang(r.partner.lang), subject: subject.trim(), lines, eachAlone: true })
    if (!answer.ok) {
      out.refused.push({ ...who, words: gcTradeEmailRefusalWords(answer) })
      continue
    }
    const emails = tradeEmailsSent(answer)
    out.emails += emails
    if (emails > 0) out.sent.push(who)
    else out.already.push(who)
    for (const h of answer.held ?? []) out.held.push({ ...who, name: h.name, words: gcTradeEmailRefusalWords({ key: 'sendFailed', detail: h.reason }) })
  }
  return out
}
