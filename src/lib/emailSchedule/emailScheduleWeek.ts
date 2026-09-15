/**
 * "My email schedule" week-grid kernel (v2.1321).
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
    /** 'all_users' | 'my_team' (v2.3472; absent from pre-v2.3472 RPC payloads). */
    crew_filter?: string
  }>
  one_offs: Array<{
    stream: 'billed_report' | 'schedule_day' | 'gc_statement' | 'weekly_movement' | 'weekly_money' | 'payment_forecast' | 'money_waiting' | 'crew_day' | 'statement_round'
    send_at: string
    /** Set when the send already went out (current-week history rows, v2.1323). */
    sent_at?: string | null
    repeat_weekly?: boolean
    detail: string
  }>
  events: {
    paid_in_full: boolean
    payment_received: boolean
    /** Org-wide "always notify on estimate acceptance" list (v2.1330; absent from pre-v2.1330 RPC payloads). */
    estimate_accepted_always?: boolean
    /** Ready to Bill stream (v2.1836; absent from pre-v2.1836 RPC payloads). */
    ready_to_bill?: boolean
  }
  /** Per-estimate acceptance subscriptions (v2.1330; absent from pre-v2.1330 RPC payloads). */
  estimate_specific?: { total: number; titles: string[] }
  /**
   * Field report email subscriptions addressed to me (v2.3472; absent from
   * pre-v2.3472 RPC payloads): one entry per report_email_subscriptions row —
   * every report anyone files, or only reports from the named authors.
   */
  report_emails?: Array<{
    enabled: boolean
    auto_send: boolean
    all_authors: boolean
    authors: string[]
    /** Team leads (v2.3480; absent from pre-v2.3480 RPC payloads): everyone they lead, plus themselves. */
    team_leads?: string[]
  }>
}

/** One field-report subscription addressed to me, normalized. */
export type MyReportEmailSubscription = {
  enabled: boolean
  autoSend: boolean
  allAuthors: boolean
  authors: string[]
  teamLeads: string[]
}

/**
 * Normalized subscription view of the payload's event streams — tolerant of a
 * not-yet-migrated RPC (missing v2.1330 keys default to "not subscribed").
 */
export type MyEmailSubscriptions = {
  paidInFull: boolean
  paymentReceived: boolean
  estimateAcceptedAlways: boolean
  readyToBill: boolean
  estimateSpecificTotal: number
  estimateSpecificTitles: string[]
  /** Field report emails (v2.3472) — every subscription addressed to me, enabled ones first. */
  reportEmails: MyReportEmailSubscription[]
}

export function normalizeMyEmailSubscriptions(
  payload: Pick<MyEmailSchedulePayload, 'events' | 'estimate_specific' | 'report_emails'> | null | undefined,
): MyEmailSubscriptions {
  const events = payload?.events
  const specific = payload?.estimate_specific
  const total = Number(specific?.total)
  const reportEmails: MyReportEmailSubscription[] = (Array.isArray(payload?.report_emails) ? payload.report_emails : [])
    .map((r) => ({
      enabled: r?.enabled === true,
      autoSend: r?.auto_send !== false,
      allAuthors: r?.all_authors === true,
      authors: cleanNames(r?.authors),
      teamLeads: cleanNames(r?.team_leads),
    }))
    .sort((a, b) => Number(b.enabled) - Number(a.enabled))
  return {
    paidInFull: events?.paid_in_full === true,
    paymentReceived: events?.payment_received === true,
    estimateAcceptedAlways: events?.estimate_accepted_always === true,
    readyToBill: events?.ready_to_bill === true,
    estimateSpecificTotal: Number.isFinite(total) && total > 0 ? Math.floor(total) : 0,
    estimateSpecificTitles: Array.isArray(specific?.titles)
      ? specific.titles.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
      : [],
    reportEmails,
  }
}

function cleanNames(list: unknown): string[] {
  return Array.isArray(list)
    ? list.filter((a): a is string => typeof a === 'string' && a.trim() !== '').map((a) => a.trim())
    : []
}

/** "Darren", "Darren and Paige", "Darren, Paige and 3 more" (first `shown` names). */
function joinNames(names: string[], shown = 3): string {
  if (names.length <= shown) {
    if (names.length <= 1) return names[0] ?? ''
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }
  return `${names.slice(0, shown).join(', ')} and ${names.length - shown} more`
}

/**
 * The trigger phrase for one field-report subscription: "every report anyone
 * files" / "reports from Darren and Paige", with " · sent on demand only" when
 * auto-send is off and " · paused" when the row is disabled.
 */
export function describeReportEmailSubscription(sub: MyReportEmailSubscription): string {
  const teams =
    sub.teamLeads.length > 0
      ? `everyone ${joinNames(sub.teamLeads)} ${sub.teamLeads.length === 1 ? 'leads' : 'lead'}`
      : null
  const who = sub.allAuthors
    ? 'every report anyone files'
    : sub.authors.length > 0 && teams
      ? `reports from ${joinNames(sub.authors)}, and ${teams}`
      : sub.authors.length > 0
        ? `reports from ${joinNames(sub.authors)}`
        : teams
          ? `reports from ${teams}`
          : 'reports from nobody yet'
  const tail = [sub.autoSend ? null : 'sent on demand only', sub.enabled ? null : 'paused'].filter(Boolean)
  return tail.length > 0 ? `${who} · ${tail.join(' · ')}` : who
}

const ACTIVITY_SCOPE_LABEL: Record<string, string> = {
  calendar_yesterday: 'jobs yesterday',
  calendar_today: 'jobs today',
  calendar_week: 'jobs this week',
  calendar_last_week: 'jobs last week',
}

/** "jobs yesterday · my team · with costs" — the recipient's own slice of a digest schedule. */
export function describeDigestScope(w: { activity_scope: string; crew_filter?: string; include_costs: boolean }): string {
  const parts = [
    ACTIVITY_SCOPE_LABEL[w.activity_scope] ?? null,
    w.crew_filter === 'my_team' ? 'my team' : w.crew_filter === 'all_users' ? 'all users' : null,
    w.include_costs ? 'with costs' : null,
  ].filter((p): p is string => p != null)
  return parts.join(' · ')
}

/** "Mon–Fri", "Every day", "Mon, Wed, Fri". */
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  if (sorted.join(',') === '1,2,3,4,5') return 'Mon–Fri'
  if (sorted.length === 7) return 'Every day'
  if (sorted.length === 0) return 'no days'
  return sorted.map((d) => DAY_LABELS[d] ?? '?').join(', ')
}

/**
 * The standing-row phrase for one digest schedule I'm on:
 * "Daily recap — Mon–Fri · 7:00 AM · jobs yesterday · my team (paused)".
 */
export function describeDigestSchedule(w: MyEmailSchedulePayload['weekly'][number]): string {
  const minutes = parseHhMm(w.time_local)
  const time = minutes == null ? w.time_local : formatMinutes(minutes)
  const scope = describeDigestScope(w)
  return `${w.name} — ${describeDays(w.days_of_week)} · ${time}${scope ? ` · ${scope}` : ''}${w.enabled ? '' : ' (paused)'}`
}

export type WeekGridEntry = {
  stream: 'report_digest' | 'billed_report' | 'schedule_day' | 'gc_statement' | 'weekly_movement' | 'weekly_money' | 'payment_forecast' | 'money_waiting' | 'crew_day' | 'statement_round'
  label: string
  timeLabel: string
  /** Minutes since midnight — the in-day sort key. */
  minutes: number
  detail: string | null
  /** True for a disabled recurring schedule (rendered dimmed, not hidden). */
  muted: boolean
  /** Already went out this week (rendered dimmed with a checkmark). */
  sent: boolean
  /** Weekly self-perpetuating chain. */
  weekly: boolean
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
  stream: 'billed_report' | 'schedule_day' | 'gc_statement' | 'weekly_movement' | 'weekly_money' | 'payment_forecast' | 'money_waiting' | 'crew_day' | 'statement_round'
  detail: string | null
  /** Chicago calendar day of the send instant. */
  ymd: string
  minutes: number
  sent?: boolean
  weekly?: boolean
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
        detail: `${w.name}${describeDigestScope(w) ? ` · ${describeDigestScope(w)}` : ''}${w.enabled ? '' : ' (paused)'}`,
        muted: !w.enabled,
        sent: false,
        weekly: true,
      })
    }
    for (const o of placedOneOffs) {
      if (o.ymd !== ymd) continue
      entries.push({
        stream: o.stream,
        label: o.stream === 'billed_report' ? 'Billed report' : o.stream === 'gc_statement' ? 'GC statement' : o.stream === 'weekly_movement' ? 'Weekly movement' : o.stream === 'weekly_money' ? 'Weekly money' : o.stream === 'payment_forecast' ? 'Payment forecast' : o.stream === 'money_waiting' ? 'Money waiting' : o.stream === 'crew_day' ? 'Crew Day' : o.stream === 'statement_round' ? 'Statement round' : 'My dispatch day',
        timeLabel: formatMinutes(o.minutes),
        minutes: o.minutes,
        detail: o.detail,
        muted: o.sent === true,
        sent: o.sent === true,
        weekly: o.weekly === true,
      })
    }
    entries.sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label))
    return { dow, ymd, label: DAY_LABELS[dow] ?? '?', isToday: ymd === todayYmd, entries }
  })
}
