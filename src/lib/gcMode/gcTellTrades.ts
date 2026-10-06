/**
 * GC mode design spike: telling the trades their dates moved, the Gantt's Phase 3
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-112, G-113). A move on the schedule changes some companies'
 * days. Each of those companies gets one message naming its old and new days and why, in its own
 * language, and answers from its portal: the dates work, or it needs another day. Nothing leaves
 * the app in the prototype; the message is written and kept.
 *
 * Its own file, out of the barrel: the reducer and the portal read it.
 */
import type { GcProject, GcState, Partner, ScheduleMove } from './gcTypes'
import { partnerById } from './gcLookups'
import { shortDate, weekdayDate } from './gcWords'
import { pt, type PortalLang } from './gcPortalI18n'
import { moveActivityName, moveReasonLabel, spanWords } from './gcScheduleMoves'

/** One company's line in a move: the work, and its days before and after. */
export interface MovedLine {
  lineId: string
  /** The line's own name, without the trade: "Sheet metal and flashing". */
  work: string
  from: { start: string; finish: string }
  to: { start: string; finish: string }
}

/** The company doing a line, if a hired trade: never our own crew, never an inspection. */
function partnerOfLine(state: GcState, project: GcProject, lineId: string): Partner | undefined {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  if (!a || a.inspection) return undefined
  const pkg = project.packages.find((k) => k.id === a.packageId)
  if (!pkg || pkg.selfPerform) return undefined
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

function lineWork(project: GcProject, lineId: string): string {
  const name = moveActivityName(project, lineId)
  return name.includes(' · ') ? name.slice(name.indexOf(' · ') + 3) : name
}

/** Every line a move changed, the moved one first, each with the company it belongs to. */
export function movedLines(state: GcState, project: GcProject, move: ScheduleMove): { line: MovedLine; partner: Partner | undefined }[] {
  const all = [{ lineId: move.lineId, from: move.from, to: move.to }, ...move.pushed]
  return all
    .filter((l) => l.from.start !== l.to.start || l.from.finish !== l.to.finish)
    .map((l) => ({ line: { lineId: l.lineId, work: lineWork(project, l.lineId), from: l.from, to: l.to }, partner: partnerOfLine(state, project, l.lineId) }))
}

/** The companies a set of moves changed days for, each with its lines, for Tell the trades. */
export interface CompanyToTell {
  partner: Partner
  moves: ScheduleMove[]
  lines: MovedLine[]
}

export function companiesToTell(state: GcState, project: GcProject, moves: ScheduleMove[]): CompanyToTell[] {
  const byPartner = new Map<string, CompanyToTell>()
  for (const move of moves) {
    for (const { line, partner } of movedLines(state, project, move)) {
      if (!partner) continue
      const entry = byPartner.get(partner.id) ?? { partner, moves: [], lines: [] }
      if (!entry.moves.includes(move)) entry.moves.push(move)
      if (!entry.lines.some((l) => l.lineId === line.lineId)) entry.lines.push(line)
      byPartner.set(partner.id, entry)
    }
  }
  return [...byPartner.values()]
}

/** The standing moves nobody has been told about yet. */
export function untoldMoves(project: GcProject): ScheduleMove[] {
  return (project.schedule?.moves ?? []).filter((m) => !m.undoneOn && !m.toldOn)
}

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

/** A dates message waiting on a company's answer in its portal. */
export interface DatesNotice {
  project: GcProject
  move: ScheduleMove
  lines: MovedLine[]
  /** The message as it went, in the portal's language. */
  message: { subject: string; lines: string[] }
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

/** What each told company said about a move, for the office's record: "Summit Roofing: the dates work." */
export function moveAnswerWords(state: GcState, move: ScheduleMove): string[] {
  const told = move.toldTo ?? []
  return told.map((pid) => {
    const name = partnerById(state, pid)?.company ?? 'A company'
    const a = move.answers?.find((x) => x.partnerId === pid)
    if (!a) return `${name}: told ${shortDate(move.toldOn ?? '')}, no answer yet.`
    if (a.ok) return `${name}: the dates work.`
    return `${name} asked for ${a.day ? weekdayDate(a.day) : 'another day'}${a.note ? `: “${a.note}”` : '.'}`
  })
}

/** The companies' answers that need the office: a day asked for that nobody has acted on. */
export function datesAsksForOffice(state: GcState, project: GcProject): { move: ScheduleMove; partner: Partner; day: string | null; note: string | null }[] {
  return (project.schedule?.moves ?? []).flatMap((move) =>
    (move.answers ?? [])
      .filter((a) => !a.ok)
      .flatMap((a) => {
        const partner = partnerById(state, a.partnerId)
        return partner ? [{ move, partner, day: a.day ?? null, note: a.note ?? null }] : []
      }),
  )
}
