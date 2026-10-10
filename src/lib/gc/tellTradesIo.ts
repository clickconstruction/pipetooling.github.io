/**
 * GC mode, the real build, the schedule's PR 13b: Tell the trades (to-dos/gc-mode/mockups/schedule-pr13.md on branch
 * spike/gc-mode). Each company whose days changed gets one email through the one sender, `gc-trade-email`, kind
 * `dates`, in its language, with `datesMessage`'s words (call 1). Once it went, or went before under the same key, its
 * tells are recorded with the send's log row (call 2). A company refused stays untold, and the next press reaches it
 * alone (call 3). It never throws: each company is told or named with why.
 */
import { recordScheduleTells } from './scheduleIo'
import { datesMessage, type CompanyToTell } from './schedule/tellTrades'
import { datesEmailKey, tellShown } from './schedule/tellWindow'
import { gcTradeEmailRefusal, tradeMailLang } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import type { GcProject, GcState } from './types'

export interface TellTheTrades {
  told: { companyId: string; company: string }[]
  /** Each company not told, with the office's words for why. */
  refused: { companyId: string; company: string; words: string }[]
}

/** The words when the email went but the record of it did not save: the next press sends nothing and saves it. */
export const TOLD_NOT_RECORDED = 'The email went, but who was told was not saved. Press Tell again. It sends nothing and saves it.'

export async function tellTheTrades(state: GcState, project: GcProject, companies: CompanyToTell[]): Promise<TellTheTrades> {
  const told: TellTheTrades['told'] = []
  const refused: TellTheTrades['refused'] = []
  for (const c of companies) {
    const who = { companyId: c.partner.id, company: c.partner.company }
    const lang = tradeMailLang(c.partner.lang)
    const { subject, lines } = datesMessage(project, c.partner, c, lang)
    const key = await datesEmailKey(c.moves.map((m) => m.id))
    const sent = await sendGcTradeEmail({ companyId: c.partner.id, kind: 'dates', key, projectId: project.id, lang, subject, lines })
    if (!sent.ok) {
      refused.push({ ...who, words: gcTradeEmailRefusal(sent.key) })
      continue
    }
    try {
      await recordScheduleTells(
        project.id,
        c.partner.id,
        sent.emailSendLogId,
        c.moves.map((m) => ({ moveId: m.id, shown: tellShown(state, project, m, c.partner.id) })),
      )
      told.push(who)
    } catch {
      refused.push({ ...who, words: TOLD_NOT_RECORDED })
    }
  }
  return { told, refused }
}
