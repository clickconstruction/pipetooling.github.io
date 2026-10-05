import { formatDenverTimeOnly } from '../../utils/dateUtils'
import type { TallySuggestion } from './tallySortSuggestion'

/**
 * The one place a Tally sort suggestion's facts become words (punch list #72). The office queue
 * and the holder's phone call this, so both say the same sentence. The words are a chip's reason,
 * short and plain (`src/lib/plainWords.ts`): no dashes, semicolons, parentheses or dot lists.
 * The store is quoted as Mercury names it.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function hoursWords(h: number): string {
  return `${(Math.round(h * 10) / 10).toFixed(1)} h`
}

/** Short weekday of a company day, from the date alone. */
function weekdayOfYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()]!
}

/** "InternetAndTelephone" → "Internet and telephone". */
function categoryWords(category: string): string {
  const words = category.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The reason under a chip, in a few words. Empty for the Office chip, which needs none. */
export function tallySuggestionWhy(s: TallySuggestion): string {
  const f = s.facts
  switch (s.rule) {
    case 'office-category':
      return `${categoryWords(f.category ?? '')} is an office cost`
    case 'store-streak':
    case 'store-last':
      return f.count === 1 ? `${f.store}, last time` : `${f.store}, last ${f.count} times`
    case 'clock-one-job':
      return 'only job clocked that day'
    case 'clock-one-job-mixed':
      return 'only job clocked that day, plus other time'
    case 'clock-office':
      return 'only Office clocked that day'
    case 'clock-job': {
      const h = f.hours?.[0]
      return h != null ? `${hoursWords(h)} clocked` : 'clocked that day'
    }
    case 'split-even':
      return 'even split'
    case 'split-by-hours':
      return (f.hours ?? []).map((h) => (h != null ? hoursWords(h) : '?')).join(' / ')
    case 'schedule-one-job':
      return 'only job scheduled that day'
    case 'schedule-job':
      return 'scheduled that day'
    case 'same-day-sorted': {
      const posted = f.postedAt ?? []
      return posted.length === 1
        ? `where the ${formatDenverTimeOnly(Date.parse(posted[0]!))} charge went`
        : `where ${posted.length} other charges that day went`
    }
    case 'neighbour-day':
      return `worked ${(f.days ?? []).map(weekdayOfYmd).join(' and ')}`
    case 'office':
      return ''
  }
}
