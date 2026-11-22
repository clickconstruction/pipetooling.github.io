/**
 * The Job updates row of the Job Mode card under the new phone layout (`jobCard.ts`): what its second line reads,
 * and whether the row is marked **New**.
 *
 * On the old card a helper who scrolls reads the office's newest note without pressing anything. On the new card
 * Job updates is a row, shut until pressed, and its count reads the same whether or not something came in. So the
 * row says the newest note itself, who wrote it, its day and its first words, and it is marked New while that note
 * is another person's and newer than this person's last look at the job's updates.
 *
 * - **The newest note** is the newest entry the thread's own Notes filter lists (`activityItemMatchesFilter`): a
 *   person's note or answer, never a line the app wrote such as a status change.
 * - **A look** is recorded when the row is pressed, kept in browser storage per person and per job. With no look
 *   recorded yet, another person's note written today counts as new, and an older one does not: the first time a
 *   phone draws the card it does not call a week of old notes new.
 *
 * Pure: the storage is handed in, and so is today's day.
 */
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { activityItemMatchesFilter } from '../jobActivityFilter'

export type NewestNote = {
  /** Who wrote it, as the thread names them. */
  authorName: string | null
  /** Who wrote it, by account. Null on a row read before the read carried it. */
  authorUserId: string | null
  createdAt: string
  body: string
}

/** The newest entry the thread's Notes filter lists, or null when it lists none. Of two written at one instant, the later in the list. */
export function newestNote(items: readonly JobThreadActivityItem[]): NewestNote | null {
  let best: NewestNote | null = null
  let bestAt = Number.NEGATIVE_INFINITY
  for (const item of items) {
    if (item.kind !== 'note' || !activityItemMatchesFilter(item, 'notes')) continue
    const at = Date.parse(item.note.created_at)
    if (Number.isNaN(at) || at < bestAt) continue
    bestAt = at
    best = { authorName: item.note.author?.name ?? null, authorUserId: item.note.author_user_id ?? null, createdAt: item.note.created_at, body: item.note.body }
  }
  return best
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A calendar day as a count of days, so two days can be told apart by a subtraction. Null for a day that is not one. */
function dayNumber(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

/**
 * The note's day in a word or two, by the app's own calendar: *today*, the weekday for the six days before
 * (*Thu*), the month and day before that (*Nov 8*), with the year when it is not this one.
 */
export function noteDayWords(createdIso: string, todayYmd: string): string {
  const ymd = calendarYmdInAppTzFromIso(createdIso)
  const day = ymd ? dayNumber(ymd) : null
  const today = dayNumber(todayYmd)
  if (!ymd || day == null) return ''
  const ago = today == null ? null : today - day
  if (ago === 0) return 'today'
  if (ago != null && ago > 0 && ago <= 6) return WEEKDAYS[new Date(day * 86_400_000).getUTCDay()]!
  const [year, month, date] = ymd.split('-').map(Number) as [number, number, number]
  const words = `${MONTHS[month - 1]} ${date}`
  return todayYmd.startsWith(`${year}-`) ? words : `${words}, ${year}`
}

/** The most of a note the row keeps to draw: the screen cuts the line where it runs out of room. */
const FIRST_WORDS_MAX = 140

/** A note's first words: its first line with words on it, the spaces between them single. */
export function noteFirstWords(body: string): string {
  const line = (body ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).find((l) => l.length > 0) ?? ''
  return line.length > FIRST_WORDS_MAX ? `${line.slice(0, FIRST_WORDS_MAX).trimEnd()}…` : line
}

/**
 * *Robert, Thu: Is 25% right?* The row's second line. A note whose writer the reader cannot be shown (the thread
 * names them Unknown) leaves the name out and opens on the day: the line has no room for a word that says nothing.
 */
export function newestNoteLine(note: NewestNote, todayYmd: string): string {
  const who = (note.authorName ?? '').trim()
  const day = noteDayWords(note.createdAt, todayYmd)
  const words = noteFirstWords(note.body)
  const lead = [who, day].filter(Boolean).join(', ')
  return [lead, words].filter(Boolean).join(': ')
}

/** The person looking at the card. */
export type UpdatesViewer = { userId: string | null | undefined; name: string | null | undefined }

/**
 * Whether the note is the viewer's own. By account where the note carries one, and by name where it does not (a note
 * still on its way out of the phone is drawn before the app has its row).
 */
export function noteIsViewers(note: NewestNote, viewer: UpdatesViewer): boolean {
  if (note.authorUserId && viewer.userId) return note.authorUserId === viewer.userId
  const theirs = (note.authorName ?? '').trim().toLowerCase()
  const mine = (viewer.name ?? '').trim().toLowerCase()
  return theirs !== '' && theirs === mine
}

/**
 * Whether the row is marked New: the newest note is another person's and newer than the viewer's last look. With
 * no look recorded yet, only a note written today.
 */
export function newestNoteIsNew(input: { note: NewestNote | null; viewer: UpdatesViewer; lastLookIso: string | null; todayYmd: string }): boolean {
  const { note, viewer, lastLookIso, todayYmd } = input
  if (!note || noteIsViewers(note, viewer)) return false
  const written = Date.parse(note.createdAt)
  if (Number.isNaN(written)) return false
  const looked = lastLookIso ? Date.parse(lastLookIso) : Number.NaN
  if (!Number.isNaN(looked)) return written > looked
  return calendarYmdInAppTzFromIso(note.createdAt) === todayYmd
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Where a person's last look at a job's updates is kept on the device. */
export function jobUpdatesLookKey(userId: string, jobId: string): string {
  return `pt_job_updates_look_${userId}_${jobId}`
}

/** The last look, or null when none is kept or storage cannot be read. */
export function readJobUpdatesLook(storage: StorageLike | null | undefined, userId: string | null | undefined, jobId: string): string | null {
  if (!userId || !jobId) return null
  try {
    const kept = storage?.getItem(jobUpdatesLookKey(userId, jobId)) ?? null
    return kept && !Number.isNaN(Date.parse(kept)) ? kept : null
  } catch {
    return null
  }
}

/** Keep a look. A phone with storage switched off keeps none, and marks a note of today new each time. */
export function writeJobUpdatesLook(storage: StorageLike | null | undefined, userId: string | null | undefined, jobId: string, iso: string): void {
  if (!userId || !jobId) return
  try {
    storage?.setItem(jobUpdatesLookKey(userId, jobId), iso)
  } catch {
    // Nothing is kept: the row still opens.
  }
}

/** The word on a row with something new, and what a screen reader says after the row's name. */
export const JOB_UPDATES_NEW_WORD = 'New'
