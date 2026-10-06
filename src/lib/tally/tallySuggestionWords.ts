import { formatDenverTimeOnly } from '../../utils/dateUtils'
import type { TallyChoice, TallyClockedJob, TallyDaySuggestion, TallySuggestion } from './tallySortSuggestion'

/**
 * The one place a Tally sort suggestion's facts become words (punch list #72). The office queue
 * and the holder's phone call this, so both say the same sentence. The words are a chip's reason,
 * short and plain (`src/lib/plainWords.ts`): no dashes, semicolons, parentheses or dot lists.
 * The store and the job labels are quoted as the app names them.
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

/** Mercury's category in words: "InternetAndTelephone" → "Internet and telephone". */
export function tallyCategoryWords(category: string): string {
  const words = category.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The reason under a chip, in a few words. Empty for the Office chip, which needs none. */
export function tallySuggestionWhy(s: TallySuggestion): string {
  const f = s.facts
  switch (s.rule) {
    case 'office-category':
      return `${tallyCategoryWords(f.category ?? '')} is an office cost`
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
      return 'across the jobs clocked that day'
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

/** A job's name on screen, from its id. */
export type TallyJobLabel = (jobId: string) => string

/** A chip's title: the job's name, or the split it makes. */
export function tallyChoiceWords(choice: TallyChoice, label: TallyJobLabel): string {
  if (choice.kind === 'job') return label(choice.jobId)
  return choice.how === 'even' ? 'Split evenly' : 'Split by hours'
}

const timeWords = (iso: string) => formatDenverTimeOnly(Date.parse(iso))

/** "A", "A and B", or "A, B and 2 more". */
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items[0]}, ${items[1]} and ${items.length - 2} more`
}

/** One clocked job's sentence: from its first clock-in to its last clock-out. */
function clockedSentence(job: TallyClockedJob, label: TallyJobLabel, first: boolean): string {
  const lead = first ? 'Clocked on' : 'Then on'
  const start = job.spans[0]?.clockedInAt
  const open = job.spans.some((s) => s.clockedOutAt == null)
  const end = job.spans.reduce<string | null>((latest, s) => {
    if (!s.clockedOutAt) return latest
    return latest == null || Date.parse(s.clockedOutAt) > Date.parse(latest) ? s.clockedOutAt : latest
  }, null)
  if (!start) return `${lead} ${label(job.jobId)}.`
  if (open) {
    return job.hours == null
      ? `${lead} ${label(job.jobId)} from ${timeWords(start)} with no clock out.`
      : `${lead} ${label(job.jobId)} from ${timeWords(start)}, still clocked in.`
  }
  return `${lead} ${label(job.jobId)} from ${timeWords(start)} to ${timeWords(end ?? start)}.`
}

/**
 * The holder's day in a few short sentences, for the top of a day card: when they clocked and
 * where, what was on their schedule, and, on a day with neither, where they worked either side.
 */
export function tallyDayEvidenceWords(day: TallyDaySuggestion, jobLabel: TallyJobLabel): string {
  // A job's short line is "JP101 · Hill Street". Inside a sentence the dot (or a dash) would
  // glue two ideas together, so the name is quoted with a plain space instead.
  const label: TallyJobLabel = (id) => jobLabel(id).replace(/\s*[·—;]\s*/g, ' ').trim()
  const sentences: string[] = []
  const clocked = day.clockedJobs
  const clockedIds = new Set(clocked.map((j) => j.jobId))
  const scheduledOnly = day.scheduledJobs.filter((id) => !clockedIds.has(id))
  if (clocked.length > 0) {
    clocked.forEach((job, i) => sentences.push(clockedSentence(job, label, i === 0)))
    if (day.otherTime) sentences.push('Also some time on a bid or with no job.')
    if (scheduledOnly.length > 0) sentences.push(`Also scheduled on ${listWords(scheduledOnly.map(label))}.`)
    if (clocked.length === 1 && !day.otherTime && scheduledOnly.length === 0) sentences.push('Nothing else that day.')
    return sentences.join(' ')
  }
  sentences.push(day.otherTime ? 'Clocked only on a bid or with no job.' : 'No clock that day.')
  if (day.scheduledJobs.length > 0) {
    sentences.push(`Scheduled on ${listWords(day.scheduledJobs.map(label))}.`)
    return sentences.join(' ')
  }
  sentences.push('Nothing scheduled.')
  for (const n of day.neighbours.slice(0, 2)) {
    sentences.push(`Worked on ${label(n.jobId)} ${n.days.map(weekdayOfYmd).join(' and ')}.`)
  }
  return sentences.join(' ')
}
