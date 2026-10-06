/**
 * GC mode design spike: the counts (the lead's go, 2026-10-06; `to-dos/gc-mode/mockups/counts.md`).
 * The schedule's reasons on the board row, Follow up and Needs you, each from its own kernel's read.
 *
 * This first part is lifted out of the call list (G-115) as it was, so the counts and By company say
 * the same words: new dates told and not answered (G-113), a first day nobody confirmed (G-114),
 * and a short crew that alone moves the finish (G-57). The call list calls these.
 *
 * Its own file, out of the barrel. Nothing imported here is read when the module loads: the people
 * kernel reaches it through an import loop that works only at call time.
 */
import type { GcProject, GcState, Partner, TradePackage } from './gcTypes'
import type { PeopleTone, PersonReason } from './gcProjectPeople'
import { daysUntil, weekdayDate } from './gcWords'
import { partnerById } from './gcLookups'
import { mondayOf, scheduleMeasures, type ScheduleItem } from './gcBuildingSchedule'
import { companiesToTell } from './gcTellTrades'
import { startsToPromise } from './gcBuildingPromises'
import { tradePromisesOf } from './gcPromises'
import { pDate, pWeekday, type PortalLang } from './gcPortalI18n'
import { finishOutlook, shortCrewDetail, shortCrewReason } from './gcFinishOutlook'

/** A company has this many days to answer its new dates before a call is due. The new start this close, it is late. */
export const CONFIRM_WITHIN_DAYS = 3

/** What a lifted line is about, in the call list's own shape (its `CallRef`). */
export interface DatesRef {
  kind: 'dates' | 'start' | 'crew'
  moveId?: string
  packageId?: string
  lineId?: string
  label?: string
}

/** A line about a company's dates or its crew, as the call list says it, with the words a message uses. */
export interface DatesLine {
  partner: Partner
  trade: string
  reason: PersonReason & { call: DatesRef; words: Record<PortalLang, { about: string; detail: string; ask: string }> }
}

function line(partner: Partner, trade: string, reason: DatesLine['reason']): DatesLine {
  return { partner, trade, reason }
}

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The hired company on a trade. Never our own crew. */
function hiredPartner(state: GcState, pkg: TradePackage | null | undefined): Partner | undefined {
  if (!pkg || pkg.selfPerform) return undefined
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

function tradeOfLine(project: GcProject, lineId: string | undefined): string {
  const a = lineId ? project.schedule?.activities.find((x) => x.lineId === lineId) : undefined
  return project.packages.find((k) => k.id === a?.packageId)?.trade ?? 'trade'
}

/** New dates told and not answered (G-113), one line per company and move. */
export function unconfirmedDates(state: GcState, project: GcProject): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const move of project.schedule?.moves ?? []) {
    if (move.undoneOn || !move.toldOn) continue
    for (const company of companiesToTell(state, project, [move])) {
      if (!move.toldTo?.includes(company.partner.id) || move.answers?.some((x) => x.partnerId === company.partner.id)) continue
      const works = company.lines.map((l) => l.work)
      const said3 = works.length > 2 ? `${works[0]} and ${works.length - 1} more` : andList(works)
      const start = company.lines.reduce((min, l) => (l.to.start < min ? l.to.start : min), company.lines[0]?.to.start ?? today)
      const toldDays = -daysUntil(move.toldOn, today)
      const tone: PeopleTone = daysUntil(start, today) <= CONFIRM_WITHIN_DAYS ? 'red' : toldDays >= CONFIRM_WITHIN_DAYS ? 'amber' : 'grey'
      const first = company.lines[0]
      out.push(line(company.partner, tradeOfLine(project, first?.lineId), {
        text: `New dates for ${said3} went out ${weekdayDate(move.toldOn)}. No answer yet.`,
        tone,
        ...(first ? { lineId: first.lineId } : {}),
        code: 'schedule',
        call: { kind: 'dates', moveId: move.id, ...(first ? { lineId: first.lineId } : {}) },
        words: {
          en: { about: `your new dates on ${name}`, detail: `We sent them ${weekdayDate(move.toldOn)}. ${company.lines.map((l) => `${l.work} is now ${weekdayDate(l.to.start)} to ${weekdayDate(l.to.finish)}`).join('. ')}`, ask: 'Do they work? You can answer in your portal.' },
          es: { about: `sus nuevas fechas en ${name}`, detail: `Se las enviamos el ${pWeekday('es', move.toldOn)}. ${company.lines.map((l) => `${l.work} ahora es del ${pWeekday('es', l.to.start)} al ${pWeekday('es', l.to.finish)}`).join('. ')}`, ask: '¿Le funcionan? Puede contestar en su portal.' },
        },
      }))
    }
  }
  return out
}

/** A first day on site within two weeks, or passed, that nobody confirmed (G-114). `items`: the schedule's, when the caller has them. */
export function unconfirmedStarts(state: GcState, project: GcProject, items: ScheduleItem[] = scheduleMeasures(state, project).items): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const s of startsToPromise(project, today, tradePromisesOf(state))) {
    if (s.promisedBy) continue
    const partner = partnerById(state, s.partnerId)
    if (!partner) continue
    const lineId = items.find((i) => i.pkg?.id === s.pkg.id && i.activity.start === s.start)?.activity.lineId
    const left = daysUntil(s.start, today)
    out.push(line(partner, s.pkg.trade, {
      text:
        left > 0
          ? `Their first day on site is ${weekdayDate(s.start)}. They have not said their crew will be there.`
          : left === 0
            ? 'Their first day on site is today. Nobody from them is on the daily log yet.'
            : `Their first day on site was ${weekdayDate(s.start)}. Nobody from them is on the daily log yet.`,
      tone: left < 0 ? 'red' : 'amber',
      ...(lineId ? { lineId } : {}),
      code: 'schedule',
      call: { kind: 'start', packageId: s.pkg.id, ...(lineId ? { lineId } : {}) },
      words: {
        en: { about: `your start on ${name}`, detail: `Your first day on our schedule is ${weekdayDate(s.start)}`, ask: 'Will your crew be there?' },
        es: { about: `su inicio en ${name}`, detail: `Su primer día en nuestro cronograma es el ${pWeekday('es', s.start)}`, ask: '¿Estará su cuadrilla ahí?' },
      },
    }))
  }
  return out
}

/** A short crew that alone moves the finish (G-57's pick 2), one line per trade. */
export function crewCalls(state: GcState, project: GcProject): DatesLine[] {
  const today = state.today
  const name = project.name
  const out: DatesLine[] = []
  for (const c of finishOutlook(state, project)?.crews.short ?? []) {
    const pkg = project.packages.find((k) => k.id === c.packageId)
    const partner = hiredPartner(state, pkg)
    if (c.days <= 0 || !partner || !pkg) continue
    const ahora = c.said === null ? `Tiene ${c.now} en la obra esta semana` : `Nos dijo ${c.now} al día ${c.said === mondayOf(today) ? 'esta semana' : `la semana del ${pDate('es', c.said)}`}`
    out.push(line(partner, pkg.trade, {
      text: shortCrewReason(c, today),
      tone: 'amber',
      lineId: c.lineId,
      code: 'schedule',
      call: { kind: 'crew', lineId: c.lineId, packageId: c.packageId, label: 'Crew on site' },
      words: {
        en: { about: `your crew on ${name}`, detail: shortCrewDetail(c, today), ask: 'Can you bring it back up to size?' },
        es: { about: `su cuadrilla en ${name}`, detail: `${ahora}, frente a ${c.soFar} al día hasta ahora`, ask: '¿Puede volver a completarla?' },
      },
    }))
  }
  return out
}
