/**
 * GC mode design spike: start reminders, the Gantt's Phase 3 (G-114). A company whose first day
 * on a job is two weeks off hears so, and again three days before, with what must be in place
 * first: its submittals approved, its insurance current, its statement of work signed. The
 * office half is Starting soon on the Schedule tab; this is the trade's half, in its portal and
 * its language. Each is a message like any other: written, never sent, in the prototype.
 *
 * Its own file, out of the barrel: the portal's messages read it.
 */
import type { GcProject, GcState, Partner, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleLinesOf } from './gcBuildingSchedule'
import { firstOnSite } from './gcBuildingPromises'
import { submittalState } from './gcBuildingSubmittals'
import { partnerById } from './gcLookups'
import { pt, pWeekday, type PortalLang } from './gcPortalI18n'
import type { PortalMessage } from './gcPortal'
import { startGaps, type StartGapKind } from './gcNotReady'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { START_REMINDER_DAYS, firstStartOf } from '../gc/schedule/startReminders'
export { START_REMINDER_DAYS, firstStartOf } from '../gc/schedule/startReminders'

function awardedTo(pkg: TradePackage, partnerId: string): boolean {
  return pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === partnerId)
}

/**
 * Each of the office's gaps (G-77's `startGaps`) in the trade's words (G-139). A gap kind with no
 * sentence here fails the typecheck, so the office's list and the trade's never part. An award never
 * reaches a trade: a reminder goes only to the company awarded.
 */
const GAP_WORDS: Record<StartGapKind, (x: { partner: Partner | undefined; pkg: TradePackage; today: string; lang: PortalLang }) => string | null> = {
  award: () => null,
  msa: ({ partner, lang }) => pt(lang, partner?.msa === 'sent' ? 'mStartNeedMsaSign' : 'mStartNeedMsaComing'),
  insurance: ({ partner, today, lang }) =>
    !partner?.coiExpires ? pt(lang, 'mStartNeedCoiNone') : pt(lang, partner.coiExpires < today ? 'mStartNeedCoiRanOut' : 'mStartNeedCoi', { date: pWeekday(lang, partner.coiExpires) }),
  w9: ({ lang }) => pt(lang, 'mStartNeedW9'),
  sow: ({ pkg, lang }) => pt(lang, pkg.sow?.status === 'sent' ? 'mStartNeedSow' : pkg.sow?.status === 'signed' ? 'mStartNeedSowNew' : 'mStartNeedSowComing'),
}

/**
 * What must be in place before a company's first day, in its language. Empty: all set. Its
 * submittals not yet approved, then the office's own list of papers on that day, in Get started's
 * order (G-139): the same list the office's bar reads, so one side never has a paper the other lacks.
 */
export function startNeeds(state: GcState, partnerId: string, project: GcProject, pkg: TradePackage, firstStart: string, lang: PortalLang): string[] {
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const partner = partnerById(state, partnerId)
  const needs: string[] = []
  const lineIds = new Set(scheduleLinesOf(pkg).map((l) => l.lineId))
  for (const s of project.submittals ?? []) {
    if (s.packageId !== pkg.id || !s.lineIds.some((id) => lineIds.has(id))) continue
    const st = submittalState(s)
    if (st === 'approved') continue
    const words = st === 'trade' ? t('mSubNotSent') : st === 'us' ? t('mSubWithUs') : t('mSubWithArchitect')
    needs.push(t('mStartNeedSubmittal', { number: s.number, title: s.title, state: words }))
  }
  for (const gap of startGaps(state, project, pkg, firstStart)) {
    const words = GAP_WORDS[gap.kind]({ partner, pkg, today: state.today, lang })
    if (words) needs.push(words)
  }
  return needs
}

/**
 * The reminders due to a company on one job: one at 14 days and one at 3, each once its day has
 * come, while nobody of theirs has been on site and no work is reported. A start that passed
 * with nobody on site keeps the last reminder showing, in different words.
 */
export function startReminders(state: GcState, partnerId: string, project: GcProject, lang: PortalLang, hello: string): PortalMessage[] {
  if (project.stage !== 'building' || !project.startedOn) return []
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const out: PortalMessage[] = []
  for (const pkg of project.packages) {
    if (pkg.selfPerform || !pkg.sow || !awardedTo(pkg, partnerId)) continue
    if (firstOnSite(project, pkg.id) || pkg.sow.sov.some((l) => l.pctReported > 0)) continue
    const firstStart = firstStartOf(project, pkg)
    if (!firstStart) continue
    const work = scheduleLinesOf(pkg)
      .filter((l) => (project.schedule?.activities ?? []).some((a) => a.lineId === l.lineId && a.start === firstStart))
      .map((l) => l.label)
      .join(', ')
    const needs = startNeeds(state, partnerId, project, pkg, firstStart, lang)
    for (const days of START_REMINDER_DAYS) {
      const on = addDays(firstStart, -days)
      if (on > state.today) continue
      const left = daysBetween(state.today, firstStart)
      const intro = left > 0 ? t('mStartSoonIntro', { trade: pkg.trade, project: project.name, date: pWeekday(lang, firstStart), days: left, work }) : left === 0 ? t('mStartSoonToday', { trade: pkg.trade, project: project.name, work }) : t('mStartSoonPassed', { trade: pkg.trade, project: project.name, date: pWeekday(lang, firstStart), work })
      out.push({
        key: `${pkg.id}:startSoon:${days}`,
        on,
        kind: 'startSoon',
        projectId: project.id,
        subject: t('mStartSoonSubject', { project: project.name, date: pWeekday(lang, firstStart) }),
        lines: [hello, intro, ...(needs.length > 0 ? [t('mStartSoonNeeds'), ...needs] : [t('mStartSoonAllSet')]), t('mStartSoonAsk')],
      })
    }
  }
  return out
}
