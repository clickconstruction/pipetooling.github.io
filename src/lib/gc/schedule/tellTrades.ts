/**
 * GC mode, the real build, the schedule's PR 1b: tell the trades their new dates, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcTellTrades.ts`). The message in the trade's own language (`datesMessage`, `datesNotices`) reads the portal's words and waits for them.
 */
import { partnerById } from '../lookups'
import { moveActivityName } from './moves'
import { partMoveSpans } from './splitBars'
import type { ScheduleMove } from './types'
import type { GcProject, GcState, Partner } from '../types'
import { shortDate, weekdayDate } from '../words'

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
    // A pull's finished lines are done work (G-37): only the companies whose dates came in are told.
    .filter((l) => !move.pull?.finished.includes(l.lineId))
    .map((l) => ({ line: { lineId: l.lineId, work: lineWork(project, l.lineId), from: l.from, to: l.to }, partner: partnerOfLine(state, project, l.lineId) }))
    // A part's move (G-39) names the part, with its own days: the trade's crew for it is the one to move.
    .map((x) => (move.parts && x.line.lineId === move.lineId ? { ...x, line: { ...x.line, ...partDays(project, move, x.line) } } : x))
}

/** A moved part's name and dates for its line in the message (G-39): "Lighting, Back of house: Oct 17 to Oct 30, not Oct 10 to Oct 23." */
function partDays(project: GcProject, move: ScheduleMove, line: MovedLine): Partial<MovedLine> {
  const spans = partMoveSpans(move)
  const part = project.schedule?.activities.find((a) => a.lineId === move.lineId)?.parts?.find((p) => p.id === move.parts?.id)
  return spans && part ? { work: `${line.work}, ${part.name}`, from: spans.from, to: spans.to } : {}
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

/** A dates message waiting on a company's answer in its portal. */
export interface DatesNotice {
  project: GcProject
  move: ScheduleMove
  lines: MovedLine[]
  /** The message as it went, in the portal's language. */
  message: { subject: string; lines: string[] }
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

/** A company's open ask for another day, for Follow up (G-113; the owner's OK 2026-10-06). */
export interface DatesAsk {
  move: ScheduleMove
  partner: Partner
  /** The trade the moved line belongs to. */
  trade: string
  day: string | null
  note: string | null
  /** The day they asked. */
  on: string
  /** "Asked for Mon Oct 19 on TPO membrane after we moved it: “Rain all week.”" */
  words: string
}

/**
 * The asks still open: on a standing move, from a company that was told, with no newer standing
 * move on the same line since the ask. Moving the bar again, or undoing the move, answers it.
 */
export function datesAsksOpen(state: GcState, project: GcProject): DatesAsk[] {
  const moves = (project.schedule?.moves ?? []).filter((m) => !m.undoneOn)
  return moves.flatMap((move) =>
    (move.answers ?? [])
      .filter((a) => !a.ok)
      .flatMap((a) => {
        const partner = partnerById(state, a.partnerId)
        if (!partner) return []
        const answered = moves.some((m) => m.lineId === move.lineId && m.id !== move.id && m.on > a.on)
        if (answered) return []
        const activity = project.schedule?.activities.find((x) => x.lineId === move.lineId)
        const trade = project.packages.find((k) => k.id === activity?.packageId)?.trade ?? partner.trades[0] ?? 'trade'
        const work = lineWork(project, move.lineId)
        const words = `Asked for ${a.day ? weekdayDate(a.day) : 'another day'} on ${work} after we moved it${a.note ? `: “${a.note}”` : '.'}`
        return [{ move, partner, trade, day: a.day ?? null, note: a.note ?? null, on: a.on, words }]
      }),
  )
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
