/**
 * GC mode design spike: start reminders, the Gantt's Phase 3 (G-114). A company whose first day
 * on a job is two weeks off hears so, and again three days before, with what must be in place
 * first: its submittals approved, its insurance current, its statement of work signed. The
 * office half is Starting soon on the Schedule tab; this is the trade's half, in its portal and
 * its language. Each is a message like any other: written, never sent, in the prototype.
 *
 * Its own file, out of the barrel: the portal's messages read it.
 */
import type { GcProject, GcState, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleLinesOf } from './gcBuildingSchedule'
import { firstOnSite } from './gcBuildingPromises'
import { submittalState } from './gcBuildingSubmittals'
import { partnerById } from './gcLookups'
import { pt, pWeekday, type PortalLang } from './gcPortalI18n'
import type { PortalMessage } from './gcPortal'

/** Days before the first day the two reminders go: two weeks, then three days. */
export const START_REMINDER_DAYS = [14, 3] as const

function awardedTo(pkg: TradePackage, partnerId: string): boolean {
  return pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === partnerId)
}

/** A company's first planned day on a job, by its lines on the schedule. Null: nothing of theirs drawn. */
export function firstStartOf(project: GcProject, pkg: TradePackage): string | null {
  const ids = new Set(scheduleLinesOf(pkg).map((l) => l.lineId))
  const starts = (project.schedule?.activities ?? []).filter((a) => ids.has(a.lineId) && !a.inspection).map((a) => a.start)
  return starts.length === 0 ? null : starts.reduce((m, d) => (d < m ? d : m))
}

/** What must be in place before a company's first day, in its language. Empty: all set. */
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
  if (!partner?.coiExpires) needs.push(t('mStartNeedCoiNone'))
  else if (partner.coiExpires < firstStart) needs.push(t('mStartNeedCoi', { date: pWeekday(lang, partner.coiExpires) }))
  if (pkg.sow?.status !== 'signed') needs.push(t('mStartNeedSow'))
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
