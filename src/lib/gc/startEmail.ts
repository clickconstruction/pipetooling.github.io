/**
 * GC mode, the Board's B6-c-ii: Start's email, to each company awarded a trade on the job, through the Portal lane's P3
 * sender (`gc-trade-email`, kind `start`, group `job`, key `<project id>:start`, so a second press sends nothing). The
 * words are the Portal's own: the prototype's `portalMessages` start block (spike `gcPortal.ts`) word for word,
 * without the greeting the sender adds, as `sowEmail.ts` was. A company carried but not awarded is not told. Pure: the
 * press is the page's, after `gc_start_project` returns.
 */
import { partnerById } from './lookups'
import { pt, pWeekday, type PortalLang } from './portalI18n'
import type { TradeEmailRequest } from './tradeEmail'
import type { GcState } from './types'

export type StartEmail = Omit<TradeEmailRequest, 'group'>

/** One company awarded a trade on the job, and the trades it won there, in the job's order. */
export interface StartRecipient {
  companyId: string
  company: string
  trades: string[]
}

/** Every company awarded a trade on the job, each once. */
export function startRecipients(state: GcState, projectId: string): StartRecipient[] {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return []
  const out = new Map<string, StartRecipient>()
  for (const pkg of project.packages) {
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    if (!invite) continue
    const partner = partnerById(state, invite.partnerId)
    if (!partner) continue
    const row = out.get(partner.id) ?? { companyId: partner.id, company: partner.company, trades: [] }
    row.trades.push(pkg.trade)
    out.set(partner.id, row)
  }
  return [...out.values()]
}

/**
 * The email one company gets once the job is started, in its language: the day work begins when one is set, its part,
 * and how it reports its work. Null when it won nothing on the job.
 */
export function startEmailRequest(state: GcState, projectId: string, companyId: string, lang: PortalLang): StartEmail | null {
  const project = state.projects.find((p) => p.id === projectId)
  const won = startRecipients(state, projectId).find((r) => r.companyId === companyId)
  if (!project || !won) return null
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const name = project.name
  const begins = project.startDate ? pWeekday(lang, project.startDate) : null
  return {
    companyId,
    kind: 'start',
    key: `${project.id}:start`,
    projectId: project.id,
    lang,
    subject: begins ? t('mStartSubject', { project: name, date: begins }) : t('mStartSubjectNoDate', { project: name }),
    lines: [
      begins ? t('mStartBegins', { project: name, date: begins }) : t('mStartNoDate', { project: name }),
      t('mStartPart', { trades: won.trades.join(t('and')) }),
      t('mStartReport'),
    ],
  }
}
