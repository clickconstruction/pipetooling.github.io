import type { YourRecordItem, YourRecordSession } from './dashboardYourRecord'

/**
 * A Your record item as a week strip (punch list #217, field-8; a prototype behind the card's *Week
 * strip* switch). Today the item's second line sums sessions the card never draws — *You worked it
 * Thursday (8.5h this week)* — and leaves today's open session out without saying so, because an open
 * session counts 0 h. The strip draws the pay week, Sunday to Saturday: a bar on each day the person
 * clocked on the item's job with its hours, today's open session a hatched bar with its hours so far,
 * a dot on any day a field report from them landed on the job, today's column tinted, the hours
 * under each worked day and the day letters under all seven. The week rule
 * (*no report from you this pay week*) is the line under it. Pure: the card gathers the person's
 * sessions and report days and draws what comes back.
 */

export type WeekStripDay = {
  ymd: string
  /** 0 Sunday … 6 Saturday. */
  dow: number
  /** `Sun` … `Sat`. */
  short: string
  /** Closed hours on the item's job that day. */
  hours: number
  /** Today's open session, hours so far; 0 on any other day. */
  openHours: number
  /** A session on the day with no clock-out. */
  open: boolean
  today: boolean
  /** After today: nothing can be on it yet. */
  future: boolean
  /** A field report from this person on the job landed that day. */
  report: boolean
  /** The bar's height as a share of the week's tallest day, 0 with nothing; never under `MIN_BAR_PCT` when there is something. */
  barPct: number
  /** The hours label under a worked day (`8.5h`), '' otherwise; the day's letter is the axis under every column. */
  label: string
  /** The day in words, for the hover and the screen reader. */
  words: string
}

export type YourRecordWeekStrip = {
  weekStart: string
  weekEnd: string
  days: WeekStripDay[]
  /** Closed hours on the job this pay week. */
  closedHours: number
  /** Today's open session, hours so far. */
  openHours: number
  reportDays: number
  /** The week rule under the strip, in a few words. */
  line: string
  /** The whole strip in one sentence. */
  words: string
}

export const MIN_BAR_PCT = 8

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(ymd: string, n: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function dowOf(ymd: string): number {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay()
}

/** `Thu, Oct 29`. */
function dayWords(ymd: string): string {
  return `${SHORT[dowOf(ymd)]}, ${MONTH[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** `8.5 h`, `12 h`; tenths under ten hours, whole hours from ten. */
export function hoursWords(h: number): string {
  const r = Math.round(h * 10) / 10
  return `${r < 10 ? r.toFixed(1) : String(Math.round(r))} h`
}

const r1 = (n: number): number => Math.round(n * 10) / 10

/** The sessions the strip is about: the item's job, or the open session the clock-open item names. */
function sessionsOf(item: YourRecordItem, sessions: ReadonlyArray<YourRecordSession>): YourRecordSession[] {
  if (item.key === 'clock-open') return sessions.filter((s) => s.id === item.sessionId || (item.jobId != null && s.jobId === item.jobId))
  return sessions.filter((s) => s.jobId === item.jobId)
}

/** The label under a day: a worked day's closed hours, compact (`8.5h`, `12h`); '' otherwise. Today's open hours stay in the hover. */
function labelOf(day: Pick<WeekStripDay, 'hours'>): string {
  if (day.hours <= 0) return ''
  const r = Math.round(day.hours * 10) / 10
  return `${r < 10 ? r.toFixed(1) : String(Math.round(r))}h`
}

export function buildYourRecordWeekStrip(input: {
  item: YourRecordItem
  todayYmd: string
  weekStart: string
  /** The instant, for today's open session's hours so far. */
  nowMs: number
  /** Every session of the person in the window; the strip keeps the item's own. */
  sessions: ReadonlyArray<YourRecordSession>
  /** The days (YYYY-MM-DD) a field report from this person landed on the item's job. */
  reportDays: ReadonlySet<string>
}): YourRecordWeekStrip {
  const { item, todayYmd, weekStart, nowMs } = input
  const mine = sessionsOf(item, input.sessions)
  const weekEnd = addDays(weekStart, 6)

  const raw = Array.from({ length: 7 }, (_, i) => {
    const ymd = addDays(weekStart, i)
    const today = ymd === todayYmd
    let hours = 0
    let openHours = 0
    let open = false
    for (const s of mine) {
      if (s.workDate !== ymd) continue
      if (s.clockedOutAt) {
        hours += Math.max(0, s.hours)
        continue
      }
      open = true
      if (today && s.clockedInAt) {
        const soFar = (nowMs - Date.parse(s.clockedInAt)) / 3_600_000
        if (Number.isFinite(soFar) && soFar > 0) openHours += soFar
      }
    }
    return { ymd, dow: dowOf(ymd), short: SHORT[dowOf(ymd)]!, hours: r1(hours), openHours: r1(openHours), open, today, future: ymd > todayYmd, report: input.reportDays.has(ymd) }
  })

  const tallest = Math.max(0, ...raw.map((d) => d.hours + d.openHours))
  const days: WeekStripDay[] = raw.map((d) => {
    const total = d.hours + d.openHours
    const barPct = total <= 0 ? 0 : tallest > 0 ? Math.max(MIN_BAR_PCT, Math.round((100 * total) / tallest)) : MIN_BAR_PCT
    const label = labelOf(d)
    const parts: string[] = [d.today ? 'Today' : dayWords(d.ymd)]
    if (d.hours > 0) parts.push(`${hoursWords(d.hours)} on this job`)
    if (d.open && d.today) parts.push(d.openHours > 0 ? `${hoursWords(d.openHours)} so far, still on the clock` : 'still on the clock')
    else if (d.open) parts.push('clocked in, never clocked out')
    if (d.hours === 0 && !d.open) parts.push(d.future ? 'not yet' : 'nothing on this job')
    if (d.report) parts.push('a report landed')
    return { ...d, barPct, label, words: parts.join(' · ') }
  })

  const closedHours = r1(days.reduce((n, d) => n + d.hours, 0))
  const openHours = r1(days.reduce((n, d) => n + d.openHours, 0))
  const reportDays = days.filter((d) => d.report).length
  const line = lineOf(item)

  const said: string[] = []
  const worked = days.filter((d) => d.hours > 0)
  if (worked.length) said.push(worked.map((d) => `${hoursWords(d.hours)} ${LONG[d.dow]}`).join(', '))
  const todayOpen = days.find((d) => d.today && d.open)
  if (todayOpen) said.push(todayOpen.openHours > 0 ? `${hoursWords(todayOpen.openHours)} so far today, still on the clock` : 'on the clock today')
  const pastOpen = days.filter((d) => d.open && !d.today)
  for (const d of pastOpen) said.push(`clocked in ${LONG[d.dow]}, never clocked out`)
  if (reportDays > 0) said.push(`a report ${days.filter((d) => d.report).map((d) => LONG[d.dow]).join(' and ')}`)
  const words = `${dayWords(weekStart)} to ${dayWords(weekEnd)}: ${said.length ? said.join('; ') : 'nothing yet'}. ${capital(line)}.`

  return { weekStart, weekEnd, days, closedHours, openHours, reportDays, line, words }
}

/** The week rule under the strip, by the item's kind. */
export function lineOf(item: YourRecordItem): string {
  switch (item.key) {
    case 'no-report':
      return 'no report from you this pay week'
    case 'no-pct':
      return 'nobody has said how far along it is'
    case 'clock-open':
      return `still on the clock from ${LONG[dowOf(item.ymd)]}`
  }
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
