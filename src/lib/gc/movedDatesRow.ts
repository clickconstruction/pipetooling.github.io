/**
 * The trade's moved dates drawn on its own schedule row (punch list #217, outside-13, a prototype).
 * Today the portal reprints the email under the bars: *Your dates moved on Sample Dental Office · The
 * schedule moved… Trim and fixtures: Wed Nov 11 to Tue Nov 17, not Sun Nov 8 to Sat Nov 14. Why:
 * weather… In your portal, tell us the dates work, or give us another day.* The page tells, in an
 * email's voice, a move the bars right above it could draw. With the shape, the trade's own bar sits
 * beside a ghost of its old days, the reason is a chip under the row, and the two answers are on that
 * row; the email keeps its words. Pure: from a told move's lines (`WorkDates.moves`, the function's
 * since v2.6150) to what the row draws. The portal's language, since the row reads beside the chart.
 */
import type { ScheduleWork, WorkDates, WorkMovedLine } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { daysBetween } from './schedule/network'
import { pDate, type PortalLang } from './portalI18n'

export type MovedRowDirection = 'later' | 'earlier' | 'none'

export type MovedRow = {
  moveId: string
  lineId: string
  work: string
  direction: MovedRowDirection
  /** Whole days the start moved, or the finish when the start stayed; never negative. */
  days: number
  /** The old days, drawn as a ghost behind the bar; null when the days did not change. */
  ghost: { start: string; finish: string } | null
  /** The ghost's label: *was Nov 8 – Nov 14*; '' with no ghost. */
  wasLabel: string
  /** The chip under the row: *moved 3 days later · weather · Two days of rain held the drywall.* */
  chip: string
  reason: string | null
  note: string | null
}

const WORDS = {
  en: { was: 'was', later: 'moved {days} days later', oneLater: 'moved 1 day later', earlier: 'moved {days} days earlier', oneEarlier: 'moved 1 day earlier' },
  es: { was: 'era', later: 'movido {days} días después', oneLater: 'movido 1 día después', earlier: 'movido {days} días antes', oneEarlier: 'movido 1 día antes' },
} as const

/** The office's reasons (`ScheduleMoveReason`) in Spanish; English keeps the office's word. */
const REASON_ES: Readonly<Record<string, string>> = {
  weather: 'clima',
  'trade before': 'el oficio anterior',
  materials: 'materiales',
  crew: 'cuadrilla',
  customer: 'cliente',
  plans: 'planos',
  inspection: 'inspección',
  us: 'nosotros',
  'change order': 'orden de cambio',
  other: 'otro',
  early: 'antes de tiempo',
  recovery: 'recuperación',
}

export function movedRowReason(reason: string | null | undefined, lang: PortalLang): string | null {
  const r = (reason ?? '').trim()
  if (!r) return null
  return lang === 'es' ? (REASON_ES[r] ?? r) : r
}

/** The words of the move's size and way: *moved 3 days later*; '' when the days did not change. */
export function movedRowWords(direction: MovedRowDirection, days: number, lang: PortalLang): string {
  const w = WORDS[lang]
  if (direction === 'none') return ''
  if (days === 1) return direction === 'later' ? w.oneLater : w.oneEarlier
  return (direction === 'later' ? w.later : w.earlier).replace('{days}', String(days))
}

/** One moved line as its row draws it. */
export function movedRow(dates: Pick<WorkDates, 'moveId' | 'reason' | 'note'>, line: WorkMovedLine, lang: PortalLang): MovedRow {
  const startDelta = daysBetween(line.from.start, line.to.start)
  const delta = startDelta !== 0 ? startDelta : daysBetween(line.from.finish, line.to.finish)
  const direction: MovedRowDirection = delta > 0 ? 'later' : delta < 0 ? 'earlier' : 'none'
  const days = Math.abs(delta)
  const ghost = direction === 'none' ? null : { start: line.from.start, finish: line.from.finish }
  const reason = movedRowReason(dates.reason, lang)
  const note = (dates.note ?? '').trim() || null
  return {
    moveId: dates.moveId,
    lineId: line.lineId,
    work: line.work,
    direction,
    days,
    ghost,
    wasLabel: ghost ? `${WORDS[lang].was} ${pDate(lang, ghost.start)} – ${pDate(lang, ghost.finish)}` : '',
    chip: [movedRowWords(direction, days, lang), reason, note].filter((s): s is string => Boolean(s)).join(' · '),
    reason,
    note,
  }
}

/** Each line's row, by line id; the told moves come newest first, and a line keeps its newest. */
export function movedRowsByLine(dates: ReadonlyArray<WorkDates>, lang: PortalLang): Map<string, MovedRow> {
  const out = new Map<string, MovedRow>()
  for (const d of dates) for (const line of d.moves ?? []) if (!out.has(line.lineId)) out.set(line.lineId, movedRow(d, line, lang))
  return out
}

/**
 * The told moves the block still has to say: those with no line on one of the company's own bars (a function deployed
 * before the fields sends none by line, so every move stays in the block, as today).
 */
export function datesLeftForBlock(dates: ReadonlyArray<WorkDates>, mineLineIds: ReadonlySet<string>): WorkDates[] {
  return dates.filter((d) => !(d.moves ?? []).some((m) => mineLineIds.has(m.lineId)))
}

/**
 * The sample's answer from a function deployed before the fields: the fixture's moves by line laid over it, by move
 * id, so the page draws the row on the sample before the function is deployed. A date that has them keeps its own.
 */
export function withSampleMoves(work: Record<string, ScheduleWork>, sample: Record<string, ScheduleWork>): Record<string, ScheduleWork> {
  const out: Record<string, ScheduleWork> = {}
  for (const [projectId, w] of Object.entries(work)) {
    const theirs = new Map((sample[projectId]?.dates ?? []).map((d) => [d.moveId, d]))
    out[projectId] = {
      ...w,
      dates: w.dates.map((d) => {
        if (d.moves) return d
        const s = theirs.get(d.moveId)
        return s?.moves ? { ...d, moves: s.moves, reason: s.reason, note: s.note } : d
      }),
    }
  }
  return out
}
