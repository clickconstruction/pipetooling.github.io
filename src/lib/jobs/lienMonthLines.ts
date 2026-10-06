import type { LienTimeline, LienTimelineStep } from './lienTimeline'

/**
 * The lien line under each month of Days on the job (v2.4707): on a sub job
 * every work month is a § 53.056 month, so the crew calendar's month header
 * carries that month's notice state in the lien strip's own words — the two
 * pictures on the History tab read as one. Pure: one line per notice step the
 * timeline already built (the folded closed months included); a month with no
 * notice step has no line. Drawn only while the lien box above is drawn.
 */

export type LienMonthLineTone = 'red' | 'amber' | 'green' | 'muted'

export type LienMonthLine = { words: string; tone: LienMonthLineTone }

const CITE = '§ 53.056'

function lineFor(s: LienTimelineStep): LienMonthLine | null {
  if (s.kind !== 'notice' || !s.monthKey) return null
  const words = s.words.replace(/ · dated from creation$/, '')
  if (s.state === 'done') return { words: `${CITE} notice ${words || 'sent'}`, tone: 'green' }
  if (s.state === 'missed') {
    if (/skipped/.test(words)) return { words: `${CITE} skipped on purpose`, tone: 'muted' }
    if (/not noted/.test(words)) return { words: `${CITE} window closed · not noted`, tone: 'red' }
    if (/noted/.test(words)) return { words: `${CITE} window closed · noted`, tone: 'muted' }
    return { words: `${CITE} window closed`, tone: 'muted' }
  }
  if (s.state === 'due') {
    const opens = s.opensWords ?? ''
    if (/^opens /.test(opens)) return { words: `${CITE} ${opens}`, tone: 'green' }
    const tone: LienMonthLineTone = (s.daysLeft ?? 99) <= 7 ? 'red' : 'amber'
    return { words: `${CITE} ${opens || 'open'} · mail by ${s.dateWords}`, tone }
  }
  return null
}

/** `{ '2026-07': { words: '§ 53.056 window closed · not noted', tone: 'red' }, … }` */
export function lienMonthLines(timeline: LienTimeline): Record<string, LienMonthLine> {
  const out: Record<string, LienMonthLine> = {}
  for (const s of timeline.steps) {
    const steps = s.fold ? s.fold.steps : [s]
    for (const f of steps) {
      const line = lineFor(f)
      if (line && f.monthKey) out[f.monthKey] = line
    }
  }
  return out
}
