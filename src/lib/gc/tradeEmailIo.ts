/**
 * GC mode, every email to a trade partner (P3-a): the one call the office screens make to `gc-trade-email`. It never
 * throws for a refusal: the answer carries the key, and the screen says it with `gcTradeEmailRefusal`.
 */
import { supabase } from '../supabase'
import { addAnswerSentTo } from './gcIo'
import type { PortalLang } from './portalI18n'
import { answerEmailKey, readTradeEmailAnswer, readTradeEmailTestAnswer, type TradeEmailAnswer, type TradeEmailErrorKey, type TradeEmailLine, type TradeEmailRequest, type TradeEmailTestAnswer } from './tradeEmail'
import { formatErrorMessage } from '../../utils/errorHandling'

export async function sendGcTradeEmail(req: Omit<TradeEmailRequest, 'group'> & { group?: TradeEmailRequest['group'] }): Promise<TradeEmailAnswer> {
  try {
    const r = await supabase.functions.invoke('gc-trade-email', { body: req })
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    return readTradeEmailAnswer(r.data, errorBody)
  } catch (e) {
    return { ok: false, key: 'failed', detail: formatErrorMessage(e) }
  }
}

/**
 * A test copy of any trade email (the Board's B2b-viii-b): the same gate and the same email, to the signed-in reader's
 * own address only, `[TEST]` before the subject, with nothing recorded. It never throws for a refusal.
 */
export async function sendGcTradeEmailTest(req: Omit<TradeEmailRequest, 'group' | 'test'> & { group?: TradeEmailRequest['group'] }): Promise<TradeEmailTestAnswer | Extract<TradeEmailAnswer, { ok: false }>> {
  try {
    const r = await supabase.functions.invoke('gc-trade-email', { body: { ...req, test: true } })
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    return readTradeEmailTestAnswer(r.data, errorBody)
  } catch (e) {
    return { ok: false, key: 'failed', detail: formatErrorMessage(e) }
  }
}

/**
 * An answer about the plans to each company the office ticked (P3-b), one at a time, in each one's language. Every
 * company it reached is added to the question's `answer_sent_to`; one that was refused is named with its key. The key is
 * the question's, so a company that already has it is sent nothing again.
 */
export async function emailTheAnswer(args: {
  projectId: string
  questionId: string
  to: { companyId: string; company: string; lang: PortalLang }[]
  email: (lang: PortalLang) => { subject: string; lines: TradeEmailLine[] }
}): Promise<{ sent: { companyId: string; company: string }[]; refused: { company: string; key: TradeEmailErrorKey }[] }> {
  const sent: { companyId: string; company: string }[] = []
  const refused: { company: string; key: TradeEmailErrorKey }[] = []
  for (const r of args.to) {
    const { subject, lines } = args.email(r.lang)
    const a = await sendGcTradeEmail({ companyId: r.companyId, kind: 'answer', key: answerEmailKey(args.questionId), projectId: args.projectId, lang: r.lang, subject, lines })
    if (a.ok) sent.push({ companyId: r.companyId, company: r.company })
    else refused.push({ company: r.company, key: a.key })
  }
  await addAnswerSentTo(args.questionId, sent.map((s) => s.companyId))
  return { sent, refused }
}
