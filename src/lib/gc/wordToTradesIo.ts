/**
 * Punch list #205, PR 6: the press behind Word to every trade. One email per awarded company through the one sender,
 * `gc-trade-email`, kind `nudge` to the people who get the job's emails, in the company's language, under one key for the
 * words (`wordEmailKey`), so a second press of the same words sends nothing. It keeps going past a refusal and names each
 * company with why afterwards, as every batch does. It never throws.
 */
import { gcTradeEmailRefusal, tradeMailLang } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import type { GcProject } from './types'
import { wordEmailKey, wordLines, type WordRecipient } from './wordToTrades'

export interface WordToTrades {
  /** Each company the email reached now. */
  sent: { companyId: string; company: string }[]
  /** Each company that had these words already: nothing was sent again. */
  already: { companyId: string; company: string }[]
  /** Each company not reached, with the office's words for why. */
  refused: { companyId: string; company: string; words: string }[]
}

export type SendWordToTrades = (project: GcProject, recipients: WordRecipient[], subject: string, text: string) => Promise<WordToTrades>

export const sendWordToTrades: SendWordToTrades = async (project, recipients, subject, text) => {
  const out: WordToTrades = { sent: [], already: [], refused: [] }
  const lines = wordLines(text)
  const key = await wordEmailKey(project.id, subject, text)
  for (const r of recipients) {
    const who = { companyId: r.partner.id, company: r.partner.company }
    const answer = await sendGcTradeEmail({ companyId: r.partner.id, kind: 'nudge', groups: ['job'], key, projectId: project.id, lang: tradeMailLang(r.partner.lang), subject: subject.trim(), lines })
    if (!answer.ok) out.refused.push({ ...who, words: gcTradeEmailRefusal(answer.key) })
    else if (answer.already) out.already.push(who)
    else out.sent.push(who)
  }
  return out
}
