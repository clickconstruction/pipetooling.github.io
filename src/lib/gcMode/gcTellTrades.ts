/**
 * GC mode design spike: telling the trades their dates moved, the Gantt's Phase 3
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-112, G-113). A move on the schedule changes some companies'
 * days. Each of those companies gets one message naming its old and new days and why, in its own
 * language, and answers from its portal: the dates work, or it needs another day. Nothing leaves
 * the app in the prototype; the message is written and kept.
 *
 * Its own file, out of the barrel: the reducer and the portal read it.
 */
import type { GcProject, GcState, Partner } from './gcTypes'
import { partnerById } from './gcLookups'
import { pt, type PortalLang } from './gcPortalI18n'
import { moveReasonLabel, spanWords } from './gcScheduleMoves'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { CompanyToTell, DatesNotice } from '../gc/schedule/tellTrades'
import { companiesToTell } from '../gc/schedule/tellTrades'
export type { CompanyToTell, DatesAsk, DatesNotice, MovedLine } from '../gc/schedule/tellTrades'
export { companiesToTell, datesAsksForOffice, datesAsksOpen, moveAnswerWords, movedLines, untoldMoves } from '../gc/schedule/tellTrades'

/** The message one company gets, in its language: subject and lines. */
export function datesMessage(project: GcProject, partner: Partner, company: CompanyToTell, lang: PortalLang = partner.lang ?? 'en'): { subject: string; lines: string[] } {
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const first = partner.contact.split(' ')[0] ?? partner.contact
  const whys = [...new Set(company.moves.map((m) => `${moveReasonLabel(m.reason).toLowerCase()}: ${m.note}`))]
  return {
    subject: t('mDatesSubject', { project: project.name }),
    lines: [
      t('mHello', { first }),
      t('mDatesIntro', { project: project.name }),
      ...company.lines.map((l) => t('mDatesLine', { work: l.work, to: spanWords(l.to), from: spanWords(l.from) })),
      ...whys.map((why) => t('mDatesWhy', { why })),
      t('mDatesAsk'),
    ],
  }
}

/** The moves a company was told of and has not answered, newest first. */
export function datesNotices(state: GcState, partnerId: string, lang?: PortalLang): DatesNotice[] {
  const partner = partnerById(state, partnerId)
  if (!partner) return []
  const out: DatesNotice[] = []
  for (const project of state.projects) {
    for (const move of project.schedule?.moves ?? []) {
      if (!move.toldOn || move.undoneOn || !move.toldTo?.includes(partnerId)) continue
      if (move.answers?.some((a) => a.partnerId === partnerId)) continue
      const company = companiesToTell(state, project, [move]).find((c) => c.partner.id === partnerId)
      if (!company) continue
      out.push({ project, move, lines: company.lines, message: datesMessage(project, partner, company, lang) })
    }
  }
  return out
}
