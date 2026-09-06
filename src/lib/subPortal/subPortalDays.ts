/**
 * "Your days" on the sub portal (v2.2930): where the sub will be, day by day.
 * Bookings are the dates on their signed work orders (their pick, else the
 * office's span) plus office-set sheets with a date; off days are theirs.
 * The DAY is the unit — a sub can be on two or three jobs in one day — so a
 * cell says "two jobs" and the tap opens the day's list with addresses. Pure.
 */

export type SubPortalBooking = {
  start: string
  end: string
  /** "Rough-in · #1004" — the stage and job, or the sheet's number. */
  label: string
  address: string | null
  jobNumber: string | null
  source: 'pick' | 'office'
  commitmentId: string | null
  note: string | null
}

export type SubPortalDays = { bookings: SubPortalBooking[]; offDays: string[] }

export type SubPortalDayItem = { key: string; label: string; address: string | null; jobNumber: string | null; source: 'pick' | 'office'; span: { start: string; end: string }; note: string | null }

export type SubPortalDayCell = { day: string; inMonth: boolean; weekend: boolean; past: boolean; items: SubPortalDayItem[]; off: boolean }

const YMD = /^\d{4}-\d{2}-\d{2}$/
function dayOf(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
const ymdOf = (d: Date) => d.toISOString().slice(0, 10)
export function addDaysYmd(ymd: string, n: number): string {
  const d = dayOf(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return ymdOf(d)
}

/** Everything on one day, picks first then office-set, name order inside. */
export function subPortalDayItems(days: SubPortalDays, day: string): SubPortalDayItem[] {
  const items: SubPortalDayItem[] = []
  for (const b of days.bookings) {
    if (!YMD.test(b.start)) continue
    const end = YMD.test(b.end) && b.end >= b.start ? b.end : b.start
    if (day < b.start || day > end) continue
    items.push({ key: `${b.commitmentId ?? b.label}:${b.start}`, label: b.label, address: b.address, jobNumber: b.jobNumber, source: b.source, span: { start: b.start, end }, note: b.note })
  }
  return items.sort((a, b) => (a.source === b.source ? a.label.localeCompare(b.label) : a.source === 'pick' ? -1 : 1))
}

/**
 * Weekday cells (Mon–Fri) for the weeks from the Monday on/before `fromYmd`
 * through `weeks` weeks. Weekends are skipped on purpose — the office never
 * offers them; a booking that spills onto one is still listed on its weekdays.
 */
export function subPortalMonthCells(days: SubPortalDays, fromYmd: string, weeks: number, todayYmd: string): SubPortalDayCell[][] {
  const off = new Set(days.offDays.filter((d) => YMD.test(d)))
  let monday = fromYmd
  while (dayOf(monday).getUTCDay() !== 1) monday = addDaysYmd(monday, -1)
  const month = fromYmd.slice(0, 7)
  const rows: SubPortalDayCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: SubPortalDayCell[] = []
    for (let i = 0; i < 5; i++) {
      const day = addDaysYmd(monday, w * 7 + i)
      row.push({ day, inMonth: day.slice(0, 7) === month, weekend: false, past: day < todayYmd, items: subPortalDayItems(days, day), off: off.has(day) })
    }
    rows.push(row)
  }
  return rows
}

const WORDS_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six']
const WORDS_ES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis']

/** "one job" / "two jobs" — the cell's word, never a digit under six. */
export function subPortalDayCountWord(n: number, lang: 'en' | 'es'): string {
  if (n <= 0) return ''
  const w = (lang === 'es' ? WORDS_ES : WORDS_EN)[n] ?? String(n)
  if (lang === 'es') return `${w} trabajo${n === 1 ? '' : 's'}`
  return `${w} job${n === 1 ? '' : 's'}`
}

/** The picks a day-off would sit on — the office hears about these. */
export function subPortalOffDayCollisions(days: SubPortalDays, day: string): SubPortalDayItem[] {
  return subPortalDayItems(days, day).filter((i) => i.source === 'pick')
}

/** Apple / Google both open this. */
export function mapsUrlFor(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}
