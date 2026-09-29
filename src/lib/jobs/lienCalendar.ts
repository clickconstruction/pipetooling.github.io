import { daysBetweenYmd, type LienPayRunway, type LienRunwayTone } from './lienPayRunway'
import { filingDeadlineForMonth } from './lienDeadlines'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { NoticeState } from './forecastWorkMonths'

/**
 * The Lien calendar (v2.4101, punch list #55 PR B): every billed or
 * collections job with its runway, grouped the way the work happens — by GC
 * (a § 53.056 notice goes to the owner AND the GC, and one GC's jobs share a
 * run), direct jobs under one heading, lien-gone jobs under another — with a
 * search across the Pipeline's fields and one line per group that names the
 * next move. Pure: the Pipeline hands in each job's runway; the tab renders.
 * PR C (v2.4152): the shared axis with the 15ths as columns, each row's marks on it, the
 * GC row's counted flags, the density per 15th, the three to-do sentences and the key.
 */

export type LienCalendarJob = {
  jobId: string
  /** "1046 PLUM" / "J258" — the ledger number as the board prints it. */
  number: string
  name: string
  customer: string
  gcId: string | null
  gcName: string | null
  address: string
  openBalance: number
  isSub: boolean
  runway: LienPayRunway
  /** The job's last work day — the commercial lien date for the kind bracket is counted from it. */
  lastWorkYmd?: string | null
  /** Every work month's § 53.056 notice (from `buildWorkMonthsByJob`), when the clock sessions have loaded; null → the runway's last-month flag stands in. */
  months?: ReadonlyArray<LienCalendarMonth> | null
}

/** One work month's notice on the calendar: its statutory deadline and where it stands. */
export type LienCalendarMonth = { key: string; due: string; state: NoticeState }

export type LienCalendarGroupKind = 'gc' | 'direct' | 'gone'

export type LienCalendarGroup = {
  key: string
  kind: LienCalendarGroupKind
  name: string
  /** The grey line under the name: "GC · 6 jobs · 3 notices owed". */
  sub: string
  jobs: LienCalendarJob[]
  total: number
  /** The group's next move, from its tightest job — "send 3 notices · 17 d", "file lien by Nov 16 · 49 d", "money still owed". */
  word: string
  tone: LienRunwayTone
  sortKey: number
}

export type LienCalendar = {
  groups: LienCalendarGroup[]
  /** Every row that survived the search, tightest first (the phone list). */
  jobs: LienCalendarJob[]
  totals: { jobs: number; open: number; noticesOwed: number; gone: number }
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Every space-separated token must appear in the job's number, name, customer, GC or address. */
export function lienCalendarRowMatches(job: LienCalendarJob, query: string): boolean {
  const q = norm(query)
  if (!q) return true
  const hay = norm([job.number, job.name, job.customer, job.gcName ?? '', job.address].join(' '))
  return q.split(' ').every((t) => hay.includes(t))
}

function daysWords(n: number): string {
  return `${n} d`
}

function groupWord(jobs: LienCalendarJob[], kind: LienCalendarGroupKind): { word: string; tone: LienRunwayTone } {
  if (kind === 'gone') return { word: 'money still owed', tone: 'red' }
  const owed = jobs.filter((j) => j.runway.state === 'notice_due')
  if (owed.length > 0) {
    const min = Math.min(...owed.map((j) => j.runway.daysToNotice ?? Number.MAX_SAFE_INTEGER))
    const tone: LienRunwayTone = owed.some((j) => j.runway.tone === 'red') ? 'red' : 'amber'
    return { word: owed.length === 1 ? `send the notice · ${daysWords(min)}` : `send ${owed.length} notices · ${daysWords(min)}`, tone }
  }
  const tightest = jobs[0]
  if (!tightest) return { word: '', tone: 'grey' }
  const verdict = tightest.runway.lines[tightest.runway.lines.length - 1] ?? tightest.runway.words
  const fileFirst = jobs.filter((j) => j.runway.state === 'file_first').length
  if (fileFirst > 1) return { word: `file first on ${fileFirst}`, tone: 'red' }
  return { word: verdict, tone: tightest.runway.tone }
}

export function buildLienCalendar(rows: ReadonlyArray<LienCalendarJob>, query: string): LienCalendar {
  const live = rows.filter((r) => r.runway.state !== 'none' && lienCalendarRowMatches(r, query))
  const bySort = (a: LienCalendarJob, b: LienCalendarJob) => a.runway.sortKey - b.runway.sortKey || b.openBalance - a.openBalance
  const jobs = [...live].sort(bySort)

  const gcGroups = new Map<string, LienCalendarJob[]>()
  const direct: LienCalendarJob[] = []
  const gone: LienCalendarJob[] = []
  for (const j of jobs) {
    if (j.runway.state === 'closed') gone.push(j)
    else if (j.isSub && j.gcId) (gcGroups.get(j.gcId) ?? gcGroups.set(j.gcId, []).get(j.gcId)!).push(j)
    else direct.push(j)
  }

  const groups: LienCalendarGroup[] = []
  for (const [gcId, list] of gcGroups) {
    const owed = list.filter((j) => j.runway.state === 'notice_due').length
    const { word, tone } = groupWord(list, 'gc')
    groups.push({
      key: `gc:${gcId}`,
      kind: 'gc',
      name: list[0]?.gcName?.trim() || 'GC',
      sub: `GC · ${list.length} ${list.length === 1 ? 'job' : 'jobs'}${owed ? ` · ${owed} ${owed === 1 ? 'notice' : 'notices'} owed` : ''}`,
      jobs: list,
      total: list.reduce((s, j) => s + j.openBalance, 0),
      word,
      tone,
      sortKey: list[0]?.runway.sortKey ?? Number.MAX_SAFE_INTEGER,
    })
  }
  groups.sort((a, b) => a.sortKey - b.sortKey || b.total - a.total)
  if (direct.length) {
    const { word, tone } = groupWord(direct, 'direct')
    groups.push({
      key: 'direct',
      kind: 'direct',
      name: 'Direct — we contracted with the owner',
      sub: `${direct.length} ${direct.length === 1 ? 'job' : 'jobs'} · no notice step`,
      jobs: direct,
      total: direct.reduce((s, j) => s + j.openBalance, 0),
      word,
      tone,
      sortKey: direct[0]?.runway.sortKey ?? Number.MAX_SAFE_INTEGER,
    })
  }
  // Direct sorts among the GCs by its tightest job; lien-gone is always last.
  groups.sort((a, b) => a.sortKey - b.sortKey || b.total - a.total)
  if (gone.length) {
    const { word, tone } = groupWord(gone, 'gone')
    groups.push({
      key: 'gone',
      kind: 'gone',
      name: 'Lien gone',
      sub: `${gone.length} ${gone.length === 1 ? 'job' : 'jobs'} · a window closed unsent · Collections or the Legal desk`,
      jobs: gone,
      total: gone.reduce((s, j) => s + j.openBalance, 0),
      word,
      tone,
      sortKey: Number.MAX_SAFE_INTEGER,
    })
  }

  return {
    groups,
    jobs,
    totals: {
      jobs: jobs.length,
      open: jobs.reduce((s, j) => s + j.openBalance, 0),
      noticesOwed: jobs.filter((j) => j.runway.state === 'notice_due').length,
      gone: gone.length,
    },
  }
}


// ---------------------------------------------------------------------------
// PR C — the shared axis (v2.4152)
// ---------------------------------------------------------------------------

/** One column of the calendar: a statutory date (the 15th, weekend-rolled) and where it sits on the axis. */
export type LienCalendarColumn = { ymd: string; pct: number; label: string; daysFromToday: number; past: boolean }

export type LienCalendarAxis = {
  todayYmd: string
  startYmd: string
  endYmd: string
  todayPct: number
  columns: LienCalendarColumn[]
  /** Position of any day on the axis, 0–100, clamped. */
  pct: (ymd: string) => number
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A job's notice flags: every unpaid month when the clock sessions are in, else the runway's one flag. */
export function noticeFlagsFor(job: Pick<LienCalendarJob, 'runway' | 'months' | 'isSub'>): Array<{ ymd: string; done: boolean; monthKey: string | null }> {
  if (!job.isSub || job.runway.state === 'closed' || job.runway.state === 'filed') return []
  if (job.months && job.months.length) {
    return job.months.filter((m) => m.state !== 'closed').map((m) => ({ ymd: m.due, done: m.state === 'sent', monthKey: m.key }))
  }
  const n = job.runway.marks?.notice
  if (!n || !job.runway.noticeByYmd) return []
  return [{ ymd: job.runway.noticeByYmd, done: n.done, monthKey: null }]
}

/** The commercial lien date when the property kind is not set — the bracket's far end. */
export function commercialLienByFor(job: Pick<LienCalendarJob, 'runway' | 'lastWorkYmd'>): string | null {
  if (!job.runway.kindAssumed || !job.lastWorkYmd) return null
  const ymd = filingDeadlineForMonth(job.lastWorkYmd.slice(0, 10), 'non_residential')
  return ymd && ymd > job.runway.lienByYmd ? ymd : null
}

/**
 * The axis every row shares: a past gutter for lien-gone rows (their closed date, up to
 * ninety days back), today, then every statutory date on the board, a little room after
 * the last. The columns are the distinct dates — Texas deadlines all land on a 15th.
 */
export function lienCalendarAxis(jobs: ReadonlyArray<LienCalendarJob>, todayYmd: string): LienCalendarAxis {
  const dates = new Set<string>()
  let earliestClosed: string | null = null
  for (const j of jobs) {
    if (j.runway.state === 'none') continue
    if (j.runway.state === 'closed') {
      if (j.runway.lienByYmd && (!earliestClosed || j.runway.lienByYmd < earliestClosed)) earliestClosed = j.runway.lienByYmd
      if (j.runway.lienByYmd) dates.add(j.runway.lienByYmd)
      continue
    }
    if (j.runway.lienByYmd) dates.add(j.runway.lienByYmd)
    for (const f of noticeFlagsFor(j)) dates.add(f.ymd)
    const commercial = commercialLienByFor(j)
    if (commercial) dates.add(commercial)
  }
  const floor = addDays(todayYmd, -90)
  let startYmd = addDays(todayYmd, -21)
  if (earliestClosed && earliestClosed < startYmd) startYmd = earliestClosed < floor ? floor : earliestClosed
  const future = [...dates].filter((d) => d >= todayYmd).sort()
  const last = future[future.length - 1] ?? addDays(todayYmd, 30)
  const endYmd = addDays(last > addDays(todayYmd, 30) ? last : addDays(todayYmd, 30), 10)
  const span = Math.max(1, daysBetweenYmd(startYmd, endYmd) ?? 1)
  const pct = (ymd: string) => {
    const d = daysBetweenYmd(startYmd, ymd)
    if (d == null) return 0
    return Math.max(0, Math.min(100, Math.round((1000 * d) / span) / 10))
  }
  const columns: LienCalendarColumn[] = [...dates]
    .filter((d) => d >= startYmd && d <= endYmd)
    .sort()
    .map((ymd) => ({ ymd, pct: pct(ymd), label: formatYmdMonthDay(ymd), daysFromToday: daysBetweenYmd(todayYmd, ymd) ?? 0, past: ymd < todayYmd }))
  return { todayYmd, startYmd, endYmd, todayPct: pct(todayYmd), columns, pct }
}

export type LienCalendarMark =
  | { kind: 'pay'; pct: number; ymd: string }
  | { kind: 'pay_missing'; pct: number }
  | { kind: 'notice'; pct: number; ymd: string; done: boolean; monthKey: string | null; tone: LienRunwayTone }
  | { kind: 'lien'; pct: number; ymd: string; tone: LienRunwayTone; closed: boolean }
  | { kind: 'run'; fromPct: number; toPct: number; short: boolean }
  | { kind: 'bracket'; fromPct: number; toPct: number; toYmd: string }

function noticeTone(ymd: string, todayYmd: string): LienRunwayTone {
  const d = daysBetweenYmd(todayYmd, ymd) ?? 0
  return d <= 7 ? 'red' : d <= 21 ? 'amber' : 'grey'
}

/** A job row's marks on the shared axis — the runway's picture, one scale for everyone. */
export function lienCalendarMarks(job: LienCalendarJob, axis: LienCalendarAxis): LienCalendarMark[] {
  const r = job.runway
  const out: LienCalendarMark[] = []
  if (r.state === 'none') return out
  if (r.state === 'closed') {
    if (r.lienByYmd) out.push({ kind: 'lien', pct: axis.pct(r.lienByYmd), ymd: r.lienByYmd, tone: 'red', closed: true })
    return out
  }
  const payYmd = r.marks?.pay ? addDays(axis.todayYmd, r.marks.pay.days) : null
  if (payYmd && r.lienByYmd) {
    const short = payYmd > r.lienByYmd
    out.push({ kind: 'run', fromPct: axis.pct(short ? r.lienByYmd : payYmd), toPct: axis.pct(short ? payYmd : r.lienByYmd), short })
  }
  const commercial = commercialLienByFor(job)
  if (commercial && r.lienByYmd) out.push({ kind: 'bracket', fromPct: axis.pct(r.lienByYmd), toPct: axis.pct(commercial), toYmd: commercial })
  if (payYmd) out.push({ kind: 'pay', pct: axis.pct(payYmd), ymd: payYmd })
  else if (r.state !== 'filed') out.push({ kind: 'pay_missing', pct: axis.pct(addDays(axis.todayYmd, 2)) })
  for (const f of noticeFlagsFor(job)) out.push({ kind: 'notice', pct: axis.pct(f.ymd), ymd: f.ymd, done: f.done, monthKey: f.monthKey, tone: f.done ? 'green' : noticeTone(f.ymd, axis.todayYmd) })
  if (r.lienByYmd) out.push({ kind: 'lien', pct: axis.pct(r.lienByYmd), ymd: r.lienByYmd, tone: r.state === 'filed' ? 'green' : r.tone, closed: false })
  return out
}

/** A GC row's marks: the group's flags folded per date, each carrying a count. */
export type LienCalendarGroupFlag = { ymd: string; pct: number; notices: number; liens: number; tone: LienRunwayTone }

export function lienCalendarGroupFlags(group: Pick<LienCalendarGroup, 'jobs'>, axis: LienCalendarAxis): LienCalendarGroupFlag[] {
  const byYmd = new Map<string, LienCalendarGroupFlag>()
  const bump = (ymd: string, what: 'notices' | 'liens', tone: LienRunwayTone) => {
    const f = byYmd.get(ymd) ?? { ymd, pct: axis.pct(ymd), notices: 0, liens: 0, tone: 'grey' as LienRunwayTone }
    f[what] += 1
    if (rank(tone) > rank(f.tone)) f.tone = tone
    byYmd.set(ymd, f)
  }
  for (const j of group.jobs) {
    for (const m of lienCalendarMarks(j, axis)) {
      if (m.kind === 'notice' && !m.done) bump(m.ymd, 'notices', m.tone)
      else if (m.kind === 'lien' && !m.closed) bump(m.ymd, 'liens', m.tone)
    }
  }
  return [...byYmd.values()].sort((a, b) => a.ymd.localeCompare(b.ymd))
}

function rank(t: LienRunwayTone): number {
  return t === 'red' ? 3 : t === 'amber' ? 2 : t === 'green' ? 1 : 0
}

/** What lands on each 15th: the notices owed and the liens to file, with the dollars behind them. */
export type LienCalendarDensityColumn = LienCalendarColumn & {
  notices: { count: number; total: number; jobIds: string[]; gcIds: Set<string> }
  liens: { count: number; total: number; jobIds: string[] }
}

export function lienCalendarDensity(cal: Pick<LienCalendar, 'jobs'>, axis: LienCalendarAxis): LienCalendarDensityColumn[] {
  const cols = new Map<string, LienCalendarDensityColumn>(axis.columns.map((c) => [c.ymd, { ...c, notices: { count: 0, total: 0, jobIds: [], gcIds: new Set() }, liens: { count: 0, total: 0, jobIds: [] } }]))
  for (const j of cal.jobs) {
    for (const m of lienCalendarMarks(j, axis)) {
      const col = 'ymd' in m ? cols.get(m.ymd) : undefined
      if (!col) continue
      if (m.kind === 'notice' && !m.done) {
        col.notices.count += 1
        col.notices.total += j.openBalance
        col.notices.jobIds.push(j.jobId)
        if (j.gcId) col.notices.gcIds.add(j.gcId)
      } else if (m.kind === 'lien' && !m.closed) {
        col.liens.count += 1
        col.liens.total += j.openBalance
        col.liens.jobIds.push(j.jobId)
      }
    }
  }
  return [...cols.values()]
}

/** The first fold: three sentences the columns write, each with the one action it asks for. */
export type LienCalendarTodo = {
  heading: string
  sentence: string
  action: { kind: 'draft'; ymd: string; jobIds: string[]; label: string } | { kind: 'kinds'; jobIds: string[]; label: string } | null
  tone: 'amber' | 'grey'
}

function moneyShort(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function lienCalendarTodo(cal: Pick<LienCalendar, 'jobs'>, density: ReadonlyArray<LienCalendarDensityColumn>, jobsById: ReadonlyMap<string, LienCalendarJob>): LienCalendarTodo[] {
  const ahead = density.filter((c) => !c.past && (c.notices.count > 0 || c.liens.count > 0))
  const first = ahead.find((c) => c.notices.count > 0) ?? ahead[0] ?? null
  const out: LienCalendarTodo[] = []
  const gcWords = (col: LienCalendarDensityColumn) => {
    const gcs = [...col.notices.gcIds]
    if (gcs.length === 1) {
      const name = col.notices.jobIds.map((id) => jobsById.get(id)?.gcName).find(Boolean)
      return name ? `to ${name}` : ''
    }
    return `across ${gcs.length} GCs`
  }
  if (first) {
    const n = first.notices.count
    const parts: string[] = []
    if (n) parts.push(`${n} ${n === 1 ? 'notice' : 'notices'} ${gcWords(first)}`.trim())
    if (first.liens.count) parts.push(`${first.liens.count} ${first.liens.count === 1 ? 'lien' : 'liens'} to file`)
    out.push({
      heading: `By ${first.label} · ${first.daysFromToday} d`,
      sentence: `${parts.join(' · ')} · ${moneyShort(first.notices.total + first.liens.total)}`,
      action: n ? { kind: 'draft', ymd: first.ymd, jobIds: first.notices.jobIds, label: n === 1 ? 'Draft the one' : `Draft the ${n === 2 ? 'two' : n === 3 ? 'three' : n}` } : null,
      tone: 'amber',
    })
  } else {
    out.push({ heading: 'Nothing lands next', sentence: 'no notice owed and no lien to file on the board', action: null, tone: 'grey' })
  }
  const unset = cal.jobs.filter((j) => j.runway.kindAssumed && j.runway.state !== 'closed' && j.runway.state !== 'filed')
  if (unset.length) {
    out.push({
      heading: 'Before that',
      sentence: `${unset.length} ${unset.length === 1 ? 'property has' : 'properties have'} no kind — ${unset.length === 1 ? 'its flag' : 'their flags'} could sit a month later · ${moneyShort(unset.reduce((s, j) => s + j.openBalance, 0))}`,
      action: { kind: 'kinds', jobIds: [...unset].sort((a, b) => b.openBalance - a.openBalance).map((j) => j.jobId), label: 'Set kinds, biggest first' },
      tone: 'amber',
    })
  }
  const next = first ? ahead.find((c) => c.ymd > first.ymd) ?? null : null
  if (next) {
    const parts: string[] = []
    if (next.notices.count) parts.push(`${next.notices.count} ${next.notices.count === 1 ? 'notice' : 'notices'} ${gcWords(next)}`.trim())
    if (next.liens.count) parts.push(`${next.liens.count} ${next.liens.count === 1 ? 'lien' : 'liens'} to file`)
    out.push({ heading: `By ${next.label} · ${next.daysFromToday} d`, sentence: `${parts.join(' · ')} · ${moneyShort(next.notices.total + next.liens.total)}`, action: null, tone: 'grey' })
  }
  return out
}

/** The key under the axis: every mark beside its meaning — the same words are the hover on any flag. */
export const LIEN_CALENDAR_KEY: ReadonlyArray<{ glyph: 'pay' | 'pay_missing' | 'notice' | 'check' | 'lien' | 'room' | 'short' | 'bracket' | 'count' | 'today'; label: string }> = [
  { glyph: 'today', label: 'today — one line down the whole board' },
  { glyph: 'pay', label: 'when they said they would pay (a promise, the GC’s word, or the pay-speed estimate)' },
  { glyph: 'pay_missing', label: 'no pay date yet — click to record what they said' },
  { glyph: 'notice', label: 'a § 53.056 notice owed for that work month — hollow until it is recorded' },
  { glyph: 'check', label: 'that month’s notice is on file' },
  { glyph: 'lien', label: 'the last day to file the lien affidavit (§ 53.052) — darker as it nears' },
  { glyph: 'room', label: 'room: the money is expected before the lien date' },
  { glyph: 'short', label: 'file first: the lien date comes before the money' },
  { glyph: 'bracket', label: 'property kind not set — the flag sits at the residential date but could be as late as the commercial one' },
  { glyph: 'count', label: 'on a GC row, the number is how many of its jobs share that date' },
]
