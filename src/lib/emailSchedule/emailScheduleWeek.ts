/**
 * "My email schedule" week-grid kernel (v2.1320).
 *
 * Pure assembly for the Settings → Your account section: turns the
 * get_my_email_schedule() RPC payload into a Monday-first 7-day grid.
 * Timezone work (converting one-off send_at instants to Chicago days/times)
 * happens in the component with Intl; this kernel only buckets and sorts.
 *
 * days_of_week semantics: 0=Sun … 6=Sat (the recurring-report convention —
 * the schedule editor labels itself "Days (0=Sun)").
 */

export type MyEmailSchedulePayload = {
  weekly: Array<{
    name: string
    enabled: boolean
    /** 'HH:MM' 24h (RPC formats time_local). */
    time_local: string
    days_of_week: number[]
    timezone: string
    include_costs: boolean
    activity_scope: string
  }>
  one_offs: Array<{ stream: 'billed_report' | 'schedule_day'; send_at: string; detail: string }>
  events: { paid_in_full: boolean; payment_received: boolean }
}

export type WeekGridEntry = {
  stream: 'report_digest' | 'billed_report' | 'schedule_day'
  label: string
  timeLabel: string
  /** Minutes since midnight — the in-day sort key. */
  minutes: number
  detail: string | null
  /** True for a disabled recurring schedule (rendered dimmed, not hidden). */
  muted: boolean
}

export type WeekGridDay = { dow: number; ymd: string; label: string; isToday: boolean; entries: WeekGridEntry[] }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 'HH:MM' → minutes since midnight; null on garbage. */
export function parseHhMm(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutes since midnight → '6:30 AM'. */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** Dow (0=Sun) for a YYYY-MM-DD, via the repo's noon-UTC trick. */
export function dowForYmd(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}

/** YYYY-MM-DD + n days (UTC-safe). */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The Monday-first week containing todayYmd: seven {ymd, dow} in display order. */
export function currentWeekDays(todayYmd: string): Array<{ ymd: string; dow: number }> {
  const todayDow = dowForYmd(todayYmd)
  // Monday-first offset: Mon(1)→0 … Sat(6)→5, Sun(0)→6.
  const offsetFromMonday = (todayDow + 6) % 7
  const monday = addDaysYmd(todayYmd, -offsetFromMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDaysYmd(monday, i)
    return { ymd, dow: dowForYmd(ymd) }
  })
}

export type PlacedOneOff = {
  stream: 'billed_report' | 'schedule_day'
  detail: string | null
  /** Chicago calendar day of the send instant. */
  ymd: string
  minutes: number
}

/**
 * Assemble the Monday-first grid: weekly digests expand onto their weekdays;
 * placed one-offs land on their exact day when it falls inside this week.
 */
export function buildMyEmailWeekGrid(
  payload: Pick<MyEmailSchedulePayload, 'weekly'>,
  placedOneOffs: PlacedOneOff[],
  todayYmd: string,
): WeekGridDay[] {
  const days = currentWeekDays(todayYmd)
  return days.map(({ ymd, dow }) => {
    const entries: WeekGridEntry[] = []
    for (const w of payload.weekly) {
      if (!w.days_of_week.includes(dow)) continue
      const minutes = parseHhMm(w.time_local) ?? 0
      entries.push({
        stream: 'report_digest',
        label: 'Job report digest',
        timeLabel: formatMinutes(minutes),
        minutes,
        detail: `${w.name}${w.enabled ? '' : ' (paused)'}`,
        muted: !w.enabled,
      })
    }
    for (const o of placedOneOffs) {
      if (o.ymd !== ymd) continue
      entries.push({
        stream: o.stream,
        label: o.stream === 'billed_report' ? 'Billed report' : 'My dispatch day',
        timeLabel: formatMinutes(o.minutes),
        minutes: o.minutes,
        detail: o.detail,
        muted: false,
      })
    }
    entries.sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label))
    return { dow, ymd, label: DAY_LABELS[dow] ?? '?', isToday: ymd === todayYmd, entries }
  })
}
