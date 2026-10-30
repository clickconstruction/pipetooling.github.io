/**
 * Each Quickfill station's rhythm as a two-week strip (punch list #217, office-8). The Board
 * and the phone's round list read a grey line per station — *every 3 d · 2 d over · Rosa* — a
 * median and a subtraction over five marks the row never draws, so a steady every-third-day
 * station and a 1 · 1 · 7 · 1 · 3 one read the same. The strip draws the looks themselves:
 * one cell a day for the last two weeks, today, and a few days ahead so a due day that has
 * not come yet has somewhere to fall; a filled dot on each day with a look, a dashed line at
 * the day the next look falls due (the station's own rhythm, `sectionRhythmDays`; the flat
 * 30 h rule under three marks; day one for a station never marked), red past that line up to
 * today. The phone head's four counts become chips that filter the list. Pure: a row, its
 * marks and now in, cells and words out. The Mark history window draws eight weeks of the
 * same looks (`markHistory.ts`); this is that at row size.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { addDaysYmd, daysBetweenYmd, formatMarkTime } from './markHistory'
import { QUICKFILL_AFTERNOON_HOUR, ROUND_FLAT_DUE_HOURS, ROUND_RHYTHM_WINDOW, stationInRoundNow, type RoundEvent, type RoundRow, type RoundState } from './round'

/** Days before today on the strip. */
export const RHYTHM_STRIP_DAYS_BACK = 14
/** Days after today, so a due day up to four days out still falls on the strip. */
export const RHYTHM_STRIP_DAYS_AHEAD = 4
export const RHYTHM_STRIP_CELLS = RHYTHM_STRIP_DAYS_BACK + 1 + RHYTHM_STRIP_DAYS_AHEAD

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export type RhythmStripCell = {
  ymd: string
  /** Looks that landed on the day. */
  looks: number
  /** One of the station's last five looks, the ones its rhythm reads. */
  inRhythm: boolean
  today: boolean
  future: boolean
  /** After the due day and not after today: drawn red. */
  late: boolean
  /** The day the next look falls due: the dashed line sits at this cell's left edge. */
  due: boolean
}

export type RhythmStripTone = 'red' | 'amber' | 'green' | 'grey'

export type RhythmStrip = {
  cells: RhythmStripCell[]
  todayIndex: number
  /** The company day the next look falls due; null for a personal door. */
  dueYmd: string | null
  /** Where that day lies: on the strip, before its first day (long overdue), after its last (a while yet), or nowhere. */
  duePlace: 'in' | 'before' | 'after' | null
  /** The cell the dashed line sits on, when `duePlace` is `in`. */
  dueIndex: number | null
  /** The small chip beside the name: the state in two or three words. */
  chip: { words: string; tone: RhythmStripTone }
  /** The strip's own sentence, for the hover and the screen reader. */
  words: string
}

/** Each station's marks (`marked_at`) from the round's events, newest or oldest first as given. */
export function rhythmMarksBySection(events: ReadonlyArray<RoundEvent>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const e of events) {
    if (!e || typeof e.section_id !== 'string' || typeof e.marked_at !== 'string') continue
    const arr = out.get(e.section_id) ?? []
    arr.push(e.marked_at)
    out.set(e.section_id, arr)
  }
  return out
}

/** The company day for an instant in ms. */
function ymdOfMs(ms: number): string {
  return calendarYmdInAppTzFromIso(new Date(ms).toISOString())
}

/**
 * The company day the next look falls due: the last mark plus the station's rhythm in days;
 * under three marks the strip's flat 30 h rule; null with no mark.
 */
export function rhythmDueYmd(lastMarkedAt: string | null | undefined, rhythmDays: number | null): string | null {
  if (!lastMarkedAt) return null
  const ms = Date.parse(lastMarkedAt)
  if (!Number.isFinite(ms)) return null
  return ymdOfMs(rhythmDays != null ? ms + rhythmDays * DAY_MS : ms + ROUND_FLAT_DUE_HOURS * HOUR_MS)
}

/** The chip beside the name: the state in a few words, and its colour. */
export function rhythmStripChip(row: Pick<RoundRow, 'personal' | 'sectionId' | 'state' | 'overDays' | 'dueAtMs' | 'lastMarkedAt'>, now: Date, hourNow?: number | null): { words: string; tone: RhythmStripTone } {
  if (row.personal) return { words: 'opens the page', tone: 'grey' }
  if (!stationInRoundNow(row.sectionId, hourNow)) return { words: `after ${QUICKFILL_AFTERNOON_HOUR - 12} p.m.`, tone: 'grey' }
  switch (row.state) {
    case 'never':
      return { words: 'never marked', tone: 'red' }
    case 'due':
      return { words: row.overDays != null && row.overDays > 0 ? `${row.overDays} d over` : 'due', tone: 'red' }
    case 'due_today':
      return { words: 'due today', tone: 'amber' }
    case 'not_yet': {
      if (row.dueAtMs == null) return { words: 'not yet', tone: 'grey' }
      const days = (row.dueAtMs - now.getTime()) / DAY_MS
      return { words: days < 1 ? 'due tomorrow' : `due ${new Date(row.dueAtMs).toLocaleDateString('en-US', { weekday: 'short' })}`, tone: 'grey' }
    }
    case 'fresh':
      return { words: row.lastMarkedAt ? `fresh · ${formatMarkTime(row.lastMarkedAt)}` : 'fresh', tone: 'green' }
  }
}

/** "Tue, Oct 28" for a company day. */
function dayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * One station's strip: a cell a day from fourteen days back to four days ahead, today among
 * them; the looks that landed on each day (the last five flagged as the ones the rhythm
 * reads); the due day and the red run after it. A never-marked station draws no dots and its
 * due line at day one, which is what the empty state means here.
 */
export function stationRhythmStrip(row: RoundRow, markedAts: ReadonlyArray<string>, now: Date, hourNow?: number | null): RhythmStrip {
  const todayYmd = ymdOfMs(now.getTime())
  const firstYmd = addDaysYmd(todayYmd, -RHYTHM_STRIP_DAYS_BACK)
  const marksMs = markedAts
    .map((s) => Date.parse(s))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
  const rhythmDays = new Set(marksMs.slice(0, ROUND_RHYTHM_WINDOW).map(ymdOfMs))
  const looksByDay = new Map<string, number>()
  for (const ms of marksMs) {
    const ymd = ymdOfMs(ms)
    looksByDay.set(ymd, (looksByDay.get(ymd) ?? 0) + 1)
  }

  const dueYmd = row.personal ? null : row.state === 'never' ? firstYmd : rhythmDueYmd(row.lastMarkedAt, row.rhythmDays)
  let duePlace: RhythmStrip['duePlace'] = null
  let dueIndex: number | null = null
  if (dueYmd != null) {
    const offset = daysBetweenYmd(firstYmd, dueYmd)
    if (offset < 0) duePlace = 'before'
    else if (offset >= RHYTHM_STRIP_CELLS) duePlace = 'after'
    else {
      duePlace = 'in'
      dueIndex = offset
    }
  }
  const red = !row.personal && (row.state === 'due' || row.state === 'never')

  const cells: RhythmStripCell[] = []
  for (let i = 0; i < RHYTHM_STRIP_CELLS; i++) {
    const ymd = addDaysYmd(firstYmd, i)
    const future = ymd > todayYmd
    cells.push({
      ymd,
      looks: looksByDay.get(ymd) ?? 0,
      inRhythm: rhythmDays.has(ymd),
      today: ymd === todayYmd,
      future,
      late: red && dueYmd != null && ymd > dueYmd && !future,
      due: dueIndex === i,
    })
  }

  const chip = rhythmStripChip(row, now, hourNow)
  const looksOnStrip = cells.reduce((n, c) => n + c.looks, 0)
  const parts: string[] = []
  if (row.personal) parts.push('no mark · opens the page')
  else {
    parts.push(looksOnStrip === 0 ? 'no look in two weeks' : looksOnStrip === 1 ? '1 look in two weeks' : `${looksOnStrip} looks in two weeks`)
    if (row.rhythmDays != null) parts.push(row.rhythmDays === 1 ? 'every day' : `every ${row.rhythmDays} d`)
    if (row.state === 'never') parts.push('never marked')
    else if (dueYmd != null) parts.push(`due ${dayWords(dueYmd)}`)
    // The chip's words, unless they only repeat the due day (*due Tue*).
    if (row.state !== 'never' && row.state !== 'not_yet') parts.push(chip.words)
    if (row.lastMarkedByName) parts.push(row.lastMarkedByName)
  }
  return { cells, todayIndex: RHYTHM_STRIP_DAYS_BACK, dueYmd, duePlace, dueIndex, chip, words: parts.join(' · ') }
}

export type RhythmStripAxis = { first: string; today: string; last: string; todayIndex: number; cells: number }

/** The labels under a list of strips, shared since every row runs the same days: the first day, *today*, the last. */
export function rhythmStripAxis(now: Date): RhythmStripAxis {
  const todayYmd = ymdOfMs(now.getTime())
  const firstYmd = addDaysYmd(todayYmd, -RHYTHM_STRIP_DAYS_BACK)
  const lastYmd = addDaysYmd(todayYmd, RHYTHM_STRIP_DAYS_AHEAD)
  const md = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { first: md(firstYmd), today: 'today', last: md(lastYmd), todayIndex: RHYTHM_STRIP_DAYS_BACK, cells: RHYTHM_STRIP_CELLS }
}

// ---------------------------------------------------------------------------
// The phone head's counts as chips that filter the list.
// ---------------------------------------------------------------------------

export type RoundHeadFilter = 'due' | 'due_today' | 'not_yet' | 'fresh'

export type RoundHeadChip = { filter: RoundHeadFilter; label: string; n: number; tone: RhythmStripTone }

const HEAD_CHIPS: ReadonlyArray<{ filter: RoundHeadFilter; label: string; tone: RhythmStripTone; states: ReadonlyArray<RoundState> }> = [
  { filter: 'due', label: 'due', tone: 'red', states: ['due', 'never'] },
  { filter: 'due_today', label: 'due today', tone: 'amber', states: ['due_today'] },
  { filter: 'not_yet', label: 'not yet', tone: 'grey', states: ['not_yet'] },
  { filter: 'fresh', label: 'fresh', tone: 'green', states: ['fresh'] },
]

/** The head's four counts as chips, in the headline's order; *due* always, the rest only above zero, as `roundHeadline` prints them. */
export function roundHeadChips(rows: ReadonlyArray<Pick<RoundRow, 'personal' | 'state'>>): RoundHeadChip[] {
  const tracked = rows.filter((r) => !r.personal)
  return HEAD_CHIPS.map((c) => ({ filter: c.filter, label: c.label, tone: c.tone, n: tracked.filter((r) => c.states.includes(r.state)).length })).filter((c) => c.filter === 'due' || c.n > 0)
}

/** The rows a pressed chip leaves: the stations in that state; the personal doors only with no chip pressed. */
export function filterRoundRows<T extends Pick<RoundRow, 'personal' | 'state'>>(rows: ReadonlyArray<T>, filter: RoundHeadFilter | null): T[] {
  if (filter == null) return [...rows]
  const states = HEAD_CHIPS.find((c) => c.filter === filter)?.states ?? []
  return rows.filter((r) => !r.personal && states.includes(r.state))
}

/** "due · 4" for a chip's accessible name and its words. */
export function roundHeadChipWords(chip: RoundHeadChip, pressed: boolean): string {
  return `${chip.label} · ${chip.n}${pressed ? ' · showing only these' : ''}`
}

/** The per-person switch the Board and the phone's round list share (`useShapeView`). */
export const QUICKFILL_RHYTHM_STRIP_KEY = 'quickfill-rhythm-strip'

/**
 * A Quickfill address with the page's `?sbs=1` kept (punch list #217): the Roller's redirect to
 * the first station and every station press navigate to `/quickfill#<station>`, which would
 * drop the dev's side-by-side flag; any other search string is left behind, as before.
 */
export function keepSideBySide(href: string, search: string): string {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('sbs') !== '1') return href
  const hash = href.indexOf('#')
  const path = hash >= 0 ? href.slice(0, hash) : href
  const rest = hash >= 0 ? href.slice(hash) : ''
  return `${path}${path.includes('?') ? '&' : '?'}sbs=1${rest}`
}
