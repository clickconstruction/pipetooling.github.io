import { awayBackOnWords } from './awayNote'
import { longDate } from './bringBack'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * The Away section on People → Users (punch list #256, PR 10): a teammate who left with an Away note on is
 * archived and can still sign in, to the one screen the office wrote. Listing them under Archived said gone and
 * banned, with the day the office pressed the button and nothing about the day back, so the owner's first
 * sabbatical (2026-11-08) could not be told from the thirty-seven who left for good. This kernel splits the
 * Archived lists: an archived login with a note row is an Away row, its roster row folded in, with the day they
 * left, the day back and the door the Archived lists already offered. Pure; the tab reads `away_notes` under RLS,
 * so a viewer who may not read the notes sees every row under Archived as before.
 */

export type AwaySectionLogin = { id: string; name: string | null; email: string | null; role: string; archived_at: string; end_date?: string | null; /** `users.login_attached_at`; left out, the login is taken as attached. */ login_attached_at?: string | null }
export type AwaySectionRosterRow = { id: string; name: string; email: string | null; archived_at: string | null; end_date?: string | null; account_user_id: string | null }
export type AwaySectionNote = { user_id: string; countdown_ymd: string | null; alert_on_day?: boolean | null }

export type AwayRow = {
  userId: string
  /** The folded roster row, when the login has one. */
  personId: string | null
  displayName: string
  /** The login's own name, which `my_away_note()` greets by its first word. The roster name never stands in there. */
  loginName: string | null
  email: string | null
  role: string
  /** The roster row's end date (End employment), else the day the account was archived, in the app's zone. */
  leftYmd: string
  /** *Left Nov 3, 2026*, or *Archived Nov 8, 2026* when the roster row has no end date. */
  leftWords: string
  backYmd: string | null
  /** *Back Thursday, Nov 8, 2029 · 1,095 days*, *Back today*, *Due back Nov 8, 2029 · 3 days ago*, or *No day back set*. */
  backWords: string
  /** The day back is today or has passed: the row reads amber, as the Needs you line does. */
  due: boolean
  alertOn: boolean
  /** Bring back… when the roster row ended, Restore otherwise, the doors the Archived lists offer. */
  door: 'bring_back' | 'restore'
  /** A login stands behind the account, so the note window's footer says the sign-in opens to it. */
  hasLogin: boolean
}

export type AwaySplit<L, R> = { away: AwayRow[]; logins: L[]; rosterRows: R[] }

export const AWAY_SECTION_WORDS = {
  /** Under the title. */
  sub: 'Their sign-in opens to the note you left. Bring back when they return.',
  noDay: 'No day back set',
  today: 'Back today',
  editNote: 'Edit the note…',
  editNoteTitle: 'The one screen they see while they are away: a note, a countdown to the day back, where we are and the office line.',
  bringBack: 'Bring back…',
  bringBackTitle: 'Their employment ended. One window brings back the login and the roster row together, with a new stint. It takes the note down.',
  restore: 'Restore',
  restoreTitle: 'They can sign in again with the same email and history. It takes the note down.',
} as const

const DAY_MS = 86_400_000

function utcDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole calendar days from one day to another, negative when the second is earlier; null when either is not a date. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = utcDay(fromYmd)
  const b = utcDay(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / DAY_MS)
}

function dayWords(n: number): string {
  return `${n.toLocaleString('en-US')} day${n === 1 ? '' : 's'}`
}

/** *Back Thursday, Nov 8, 2029 · 1,095 days*; *Back today* on the day; *Due back Nov 8, 2029 · 3 days ago* after it; *No day back set* without one. */
export function awayBackWords(backYmd: string | null, todayYmd: string): string {
  if (!backYmd) return AWAY_SECTION_WORDS.noDay
  const days = daysBetweenYmd(todayYmd, backYmd)
  if (days == null) return AWAY_SECTION_WORDS.noDay
  if (days === 0) return AWAY_SECTION_WORDS.today
  if (days < 0) return `Due back ${longDate(backYmd)} · ${dayWords(-days)} ago`
  return `${awayBackOnWords(backYmd)} · ${dayWords(days)}`
}

/** *Left Nov 3, 2026* from an end date; *Archived Nov 8, 2026* when the roster row never ended. */
export function awayLeftWords(endYmd: string | null, archivedYmd: string): string {
  return endYmd ? `Left ${longDate(endYmd)}` : `Archived ${longDate(archivedYmd)}`
}

/** *Away (1)*. */
export function awaySectionTitle(n: number): string {
  return `Away (${n})`
}

function compareAway(a: AwayRow, b: AwayRow): number {
  // Due first, the oldest day back first; then the soonest day back; the rows with no day last; ties by name.
  if (a.due !== b.due) return a.due ? -1 : 1
  if (a.backYmd && b.backYmd && a.backYmd !== b.backYmd) return a.backYmd.localeCompare(b.backYmd)
  if (Boolean(a.backYmd) !== Boolean(b.backYmd)) return a.backYmd ? -1 : 1
  return a.displayName.localeCompare(b.displayName)
}

/**
 * The Archived lists split: every archived login with a note row becomes an Away row and leaves the logins, and
 * its roster row (by `account_user_id`) leaves the roster rows and folds in. A note on a login that is not in the
 * archived list (an active account, the note waiting for the day) makes no row.
 */
export function splitAwayFromArchived<L extends AwaySectionLogin, R extends AwaySectionRosterRow>(args: { logins: readonly L[]; rosterRows: readonly R[]; notes: readonly AwaySectionNote[]; todayYmd: string }): AwaySplit<L, R> {
  const noteBy = new Map<string, AwaySectionNote>()
  for (const n of args.notes) noteBy.set(n.user_id, n)
  const rowByUser = new Map<string, R>()
  for (const r of args.rosterRows) if (r.account_user_id) rowByUser.set(r.account_user_id, r)
  const away: AwayRow[] = []
  const logins: L[] = []
  const folded = new Set<string>()
  for (const u of args.logins) {
    const note = noteBy.get(u.id)
    if (!note) {
      logins.push(u)
      continue
    }
    const row = rowByUser.get(u.id) ?? null
    if (row) folded.add(row.id)
    const endYmd = row?.end_date?.slice(0, 10) ?? u.end_date?.slice(0, 10) ?? null
    const archivedYmd = calendarYmdInAppTzFromIso(u.archived_at)
    const backYmd = note.countdown_ymd ? note.countdown_ymd.slice(0, 10) : null
    const days = backYmd ? daysBetweenYmd(args.todayYmd, backYmd) : null
    away.push({
      userId: u.id,
      personId: row?.id ?? null,
      displayName: u.name?.trim() || row?.name?.trim() || u.email || 'A teammate',
      loginName: u.name ?? null,
      email: u.email ?? row?.email ?? null,
      role: u.role,
      leftYmd: endYmd ?? archivedYmd,
      leftWords: awayLeftWords(endYmd, archivedYmd),
      backYmd,
      backWords: awayBackWords(backYmd, args.todayYmd),
      due: days != null && days <= 0,
      alertOn: note.alert_on_day === true,
      door: endYmd ? 'bring_back' : 'restore',
      hasLogin: u.login_attached_at === undefined ? true : u.login_attached_at != null,
    })
  }
  away.sort(compareAway)
  return { away, logins, rosterRows: args.rosterRows.filter((r) => !folded.has(r.id)) }
}
