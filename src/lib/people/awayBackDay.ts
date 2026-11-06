import { awayAlertWords } from './awayNote'
import { longDate } from './bringBack'

/**
 * The day back (punch list #256 PR 9, v2.6590): the Needs you item the office asked for with *Tell me when the countdown
 * ends* on an Away note. On the day the countdown ends, and every day after until they are brought back, the card lists
 * the teammate with Bring back… on it. Pure: the rows come from `useAwayBackDay`, the words from the Away note's kernel.
 */

export type AwayBackDayRow = {
  userId: string
  displayName: string
  /** The day the countdown ran to. */
  countdownYmd: string
  /** The day they left (the roster row's end date, else the day the account was archived), for the sub line. */
  leftYmd: string | null
  /** Still archived: a returner's note comes down with the restore, but a row read before that is left out here too. */
  archived: boolean
}

export type AwayBackDayNeed = {
  count: number
  first: { userId: string; displayName: string }
  title: string
  detail: string
}

/** The rows whose day has come, oldest day first. */
export function awayBackDayDue(rows: readonly AwayBackDayRow[], todayYmd: string): AwayBackDayRow[] {
  return rows.filter((r) => r.archived && r.countdownYmd <= todayYmd).sort((a, b) => a.countdownYmd.localeCompare(b.countdownYmd) || a.displayName.localeCompare(b.displayName))
}

/** The item's words: one person by name, or the count; null when nobody's day has come. */
export function awayBackDayNeed(rows: readonly AwayBackDayRow[], todayYmd: string): AwayBackDayNeed | null {
  const due = awayBackDayDue(rows, todayYmd)
  const first = due[0]
  if (!first) return null
  if (due.length === 1) {
    const words = awayAlertWords(first.displayName, first.leftYmd)
    const late = first.countdownYmd < todayYmd ? ` The day was ${longDate(first.countdownYmd)}.` : ''
    return { count: 1, first: { userId: first.userId, displayName: first.displayName }, title: words.title, detail: `${words.sub ?? 'Their countdown has ended.'}${late} Bring them back, or leave the note up.` }
  }
  const names = due.map((r) => r.displayName.trim().split(/\s+/)[0] || r.displayName)
  return {
    count: due.length,
    first: { userId: first.userId, displayName: first.displayName },
    title: `${due.length} teammates' countdowns have ended.`,
    detail: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. Each is waiting on Bring back.`,
  }
}
