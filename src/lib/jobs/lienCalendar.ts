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
 * v2.4265: the work tick (the day every date was counted from, hollow when it is the
 * creation day), the grey wash past the day a lien died, a job row that speaks only when
 * its deadline differs from its GC's, and a key of short words with the long ones on a tap.
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
  /** The linked property record (`customer_addresses.id`) — where a kind is written (PR D). */
  addressId?: string | null
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
    const by = owed.find((j) => j.runway.daysToNotice === min)?.runway.noticeByYmd
    const byWords = by ? ` by ${formatYmdMonthDay(by)}` : ''
    return { word: owed.length === 1 ? `send the notice${byWords} · ${daysWords(min)}` : `send ${owed.length} notices${byWords} · ${daysWords(min)}`, tone }
  }
  const tightest = jobs[0]
  if (!tightest) return { word: '', tone: 'grey' }
  const verdict = tightest.runway.lines[tightest.runway.lines.length - 1] ?? tightest.runway.words
  const fileFirst = jobs.filter((j) => j.runway.state === 'file_first').length
  if (fileFirst > 1) return { word: `file first on ${fileFirst}`, tone: 'red' }
  return { word: verdict, tone: tightest.runway.tone }
}

/** "4 at one property" — the largest set of a group's jobs that share one address (one notice can cover them, v2.3777); '' when none share. */
export function sharedPropertyNote(jobs: ReadonlyArray<Pick<LienCalendarJob, 'address'>>): string {
  const counts = new Map<string, number>()
  for (const j of jobs) {
    const key = norm(j.address).replace(/[.,#]/g, '').replace(/\b(tx|texas)\b.*$/, '').trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const most = Math.max(0, ...counts.values())
  return most >= 2 ? `${most} at one property` : ''
}

/**
 * The words under a job row's money — only what its GC row does not already say (v2.4265).
 * Under a GC whose word is "send N notices by Oct 15", a job owing that same notice says nothing;
 * a job on a later notice says its own date; every other state keeps the runway's verdict.
 */
export function rowWord(job: Pick<LienCalendarJob, 'runway'>, group: Pick<LienCalendarGroup, 'kind' | 'jobs'> | null): { text: string; tone: LienRunwayTone } | null {
  const r = job.runway
  if (r.state === 'none') return null
  if (r.state === 'closed') return { text: 'still owed', tone: 'grey' }
  if (r.state === 'notice_due' && r.daysToNotice != null) {
    const owed = group?.kind === 'gc' ? group.jobs.filter((j) => j.runway.state === 'notice_due') : []
    const min = owed.length ? Math.min(...owed.map((j) => j.runway.daysToNotice ?? Number.MAX_SAFE_INTEGER)) : null
    if (min != null && r.daysToNotice === min) return null
    return { text: `notice by ${formatYmdMonthDay(r.noticeByYmd)} · ${daysWords(r.daysToNotice)}`, tone: r.tone }
  }
  const verdict = r.lines[r.lines.length - 1] ?? r.words
  return verdict ? { text: verdict, tone: r.tone } : null
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
      sub: `GC · ${list.length} ${list.length === 1 ? 'job' : 'jobs'}${owed ? ` · ${owed} ${owed === 1 ? 'notice' : 'notices'} owed` : ''}${sharedPropertyNote(list) ? ` · ${sharedPropertyNote(list)}` : ''}`,
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
      sub: `${gone.length} ${gone.length === 1 ? 'job' : 'jobs'} · a window closed unsent · nothing left to file — Collections or the Legal desk`,
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
  // The basis the flag was counted from — the creation day on a job with no hours (v2.4265; before, those rows drew no bracket).
  const basis = job.runway.basisYmd || job.lastWorkYmd
  if (!job.runway.kindAssumed || !basis) return null
  const ymd = filingDeadlineForMonth(basis.slice(0, 10), 'non_residential')
  return ymd && ymd > job.runway.lienByYmd ? ymd : null
}

/**
 * The axis every row shares: a past gutter for lien-gone rows (their closed date, up to
 * ninety days back), today, then every statutory date on the board, a little room after
 * the last. The columns are the distinct dates — Texas deadlines all land on a 15th.
 */
/** The day a closed row's lien died: the notice date when the notice was never sent, else the lien date (v2.4265). */
export function closedYmdFor(runway: Pick<LienPayRunway, 'state' | 'closedBy' | 'noticeByYmd' | 'lienByYmd'>): string {
  if (runway.state !== 'closed') return ''
  return runway.closedBy === 'notice' && runway.noticeByYmd ? runway.noticeByYmd : runway.lienByYmd
}

export function lienCalendarAxis(jobs: ReadonlyArray<LienCalendarJob>, todayYmd: string): LienCalendarAxis {
  const dates = new Set<string>()
  let earliestClosed: string | null = null
  for (const j of jobs) {
    if (j.runway.state === 'none') continue
    if (j.runway.state === 'closed') {
      const closed = closedYmdFor(j.runway)
      if (closed && (!earliestClosed || closed < earliestClosed)) earliestClosed = closed
      if (closed) dates.add(closed)
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
  | { kind: 'work'; pct: number; ymd: string; offAxis: boolean; fromCreation: boolean; label: string }
  | { kind: 'gone'; pct: number; ymd: string; by: 'notice' | 'lien'; label: string }
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

function monthShort(ymd: string): string {
  return new Date(`${ymd.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/**
 * The work tick (v2.4265): the day every date on the row was counted from — the last approved
 * clock day, drawn solid with its date; or, on a job with no hours, the creation day, drawn hollow
 * and amber with "Jun · no hours (created)". A day before the axis's left edge sits at the edge
 * with a "◂". Null when the runway has no basis.
 */
export function workMarkFor(job: Pick<LienCalendarJob, 'runway'>, axis: Pick<LienCalendarAxis, 'pct' | 'startYmd'>): Extract<LienCalendarMark, { kind: 'work' }> | null {
  const ymd = job.runway.basisYmd
  if (!ymd) return null
  const offAxis = ymd < axis.startYmd
  const fromCreation = job.runway.datedFromCreation
  // The stand-in whispers (v2.4266): the month and "no hours"; the creation-day words are the hover and the key.
  const words = fromCreation ? `${monthShort(ymd)} · no hours` : formatYmdMonthDay(ymd)
  return { kind: 'work', pct: offAxis ? 0 : axis.pct(ymd), ymd, offAxis, fromCreation, label: offAxis ? `◂ ${words}` : words }
}

/**
 * A job row's marks on the shared axis — the runway's picture, one scale for everyone.
 * `payMissingDot` (default true) draws the dashed "no pay date" dot; the tab passes false under a
 * GC row, whose own dot speaks for its jobs (v2.4265).
 */
export function lienCalendarMarks(job: LienCalendarJob, axis: LienCalendarAxis, opts: { payMissingDot?: boolean } = {}): LienCalendarMark[] {
  const r = job.runway
  const out: LienCalendarMark[] = []
  if (r.state === 'none') return out
  const work = workMarkFor(job, axis)
  if (work) out.push(work)
  if (r.state === 'closed') {
    const closed = closedYmdFor(r)
    if (closed) {
      const by = r.closedBy === 'notice' ? 'notice' : 'lien'
      out.push({ kind: 'gone', pct: axis.pct(closed), ymd: closed, by, label: by === 'notice' ? `notice not sent by ${formatYmdMonthDay(closed)}` : `lien window closed ${formatYmdMonthDay(closed)}` })
      out.push({ kind: 'lien', pct: axis.pct(closed), ymd: closed, tone: 'red', closed: true })
    }
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
  else if (r.state !== 'filed' && opts.payMissingDot !== false) out.push({ kind: 'pay_missing', pct: axis.pct(addDays(axis.todayYmd, 2)) })
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

export function lienCalendarTodo(cal: Pick<LienCalendar, 'jobs'>, density: ReadonlyArray<LienCalendarDensityColumn>, jobsById: ReadonlyMap<string, LienCalendarJob>, firstYmd?: string | null): LienCalendarTodo[] {
  const ahead = density.filter((c) => !c.past && (c.notices.count > 0 || c.liens.count > 0))
  // A clicked density bar leads (PR D); else the first column with a notice owed.
  const first = (firstYmd ? ahead.find((c) => c.ymd === firstYmd) : null) ?? ahead.find((c) => c.notices.count > 0) ?? ahead[0] ?? null
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

/**
 * The key: a strip of marks, each with a few words under it, and the long words on a tap (v2.4265;
 * before, ten sentences in a fold). `label` stays the hover on a row's mark. `door` names the
 * board's own door the panel offers; the tab maps it to the handler it already has.
 */
export type LienCalendarKeyGlyph = 'today' | 'work' | 'work_hollow' | 'notice' | 'check' | 'lien' | 'pay' | 'pay_missing' | 'room' | 'short' | 'bracket' | 'count' | 'gone'
export type LienCalendarKeyEntry = { glyph: LienCalendarKeyGlyph; short: string; label: string; long: string; door?: 'kinds' | 'draft' }
export const LIEN_CALENDAR_KEY: ReadonlyArray<LienCalendarKeyEntry> = [
  { glyph: 'today', short: 'Today', label: 'today — one line down the whole board', long: 'One line down the whole board on today’s date. Everything left of it has happened; everything right of it is still ahead.' },
  {
    glyph: 'work',
    short: 'Last day worked',
    label: 'the last day worked — every date on the row is counted from its month',
    long: 'The last approved clock day on the job. Texas counts every lien date from the month the work was done (§ 53.052, § 53.056), so this tick is where the whole row starts — a wrong tick moves every flag. If it looks wrong, the job’s clock sessions are where to look.',
  },
  {
    glyph: 'work_hollow',
    short: 'No approved hours',
    label: 'no approved hours — the job’s creation month stands in for the work month',
    long: 'This job has no approved clock hours, so the board counts from the month the job was created instead — the Lien desk’s rule. That is a stand-in, not a fact: if the work was done in a different month, the flags sit in the wrong place. Approve the hours, or check the month before a notice goes out.',
  },
  {
    glyph: 'notice',
    short: 'Notice owed',
    label: 'a § 53.056 notice owed for that work month — hollow until it is recorded',
    long: 'On a job under a GC, a § 53.056 notice for each unpaid month must reach the owner and the GC by the 15th of the second month after the work (third for a commercial property). The flag is hollow until that month’s notice is recorded; a month whose flag passes unsent loses its lien.',
    door: 'draft',
  },
  { glyph: 'check', short: 'Notice on file', label: 'that month’s notice is on file', long: 'That month’s § 53.056 notice is recorded — sent from the desk or entered by hand. The lien for that month stays alive to its own flag.' },
  {
    glyph: 'lien',
    short: 'Lien deadline',
    label: 'the last day to file the lien affidavit (§ 53.052) — red inside a week',
    long: 'The last day the lien affidavit can be filed with the county — the 15th of the third month after the work month on a residential property, the fourth on a commercial one (§ 53.052). Slate, like the liens on the density strip; red inside a week. After this day the lien is gone; the debt is not.',
  },
  { glyph: 'pay', short: 'Pay date they gave', label: 'when they said they would pay (a promise, the GC’s word, or the pay-speed estimate)', long: 'When they said the money would come — a promise on the job, the GC’s word from the statement round, or, with neither, the estimate from how fast this customer usually pays. Click it to change it.' },
  { glyph: 'pay_missing', short: 'No pay date yet', label: 'no pay date yet — click to record what they said', long: 'Nobody has said when this will be paid. On a GC row one dot speaks for all of its jobs — click it to record the GC’s word for every job at once; a job row shows its own dot only when it has its own date.' },
  { glyph: 'room', short: 'Room', label: 'room: the money is expected before the lien date', long: 'Green room between the pay date and the lien flag: the money is expected before the window closes. Wait for it; the lien is still there if it does not come.' },
  { glyph: 'short', short: 'File first', label: 'file first: the lien date comes before the money', long: 'Red hatching: the lien window closes before the money is expected. File the affidavit first, or get the pay date moved ahead of the flag.' },
  {
    glyph: 'bracket',
    short: 'Kind not set',
    label: 'property kind not set — the flag sits at the residential date but could be as late as the commercial one',
    long: 'The property’s kind — a house or a commercial building — is not on its record, so the board shows the earlier, residential date and stripes the stretch to the commercial one. A house read as commercial is a lien lost a month late, so the safer date stands until someone sets the kind.',
    door: 'kinds',
  },
  { glyph: 'count', short: 'Jobs on one date', label: 'on a GC row, the number is how many of its jobs share that date', long: 'On a GC row the flags are folded: one flag per date, and the number is how many of that GC’s jobs share it. Open the row to see each job’s own flags.' },
  {
    glyph: 'gone',
    short: 'Lien gone',
    label: 'lien gone — a window closed unsent; nothing can be filed after that day',
    long: 'A window closed with nothing sent or filed — the notice’s, or the lien’s — so the lien for that work is gone. The row is grey past that day because nothing can be filed after it. The money is still owed: Collections, or the Legal desk.',
  },
]


// ---------------------------------------------------------------------------
// PR D — the pen (v2.4153)
// ---------------------------------------------------------------------------

/** What a pay date means against the lien flag — read back before Save. */
export type PromiseConsequence = { tone: 'green' | 'red' | 'amber'; text: string }

export function promiseConsequence(payYmd: string, lienByYmd: string, todayYmd: string): PromiseConsequence {
  if (!lienByYmd) return { tone: 'amber', text: 'no lien date on this job' }
  if (payYmd < todayYmd) return { tone: 'amber', text: 'that day has passed' }
  const d = daysBetweenYmd(payYmd, lienByYmd) ?? 0
  if (d < 0) return { tone: 'red', text: `${-d} d after the lien flag — file first` }
  if (d === 0) return { tone: 'red', text: 'on the lien day — file first' }
  return { tone: 'green', text: `${d} d of room before the lien flag` }
}

/** Whose word a pay date can be: the owner the job is for, and the GC on a sub job. */
export function whoseWordOptions(job: Pick<LienCalendarJob, 'customer' | 'gcName' | 'isSub'>): Array<{ key: 'owner' | 'gc'; label: string }> {
  const out: Array<{ key: 'owner' | 'gc'; label: string }> = []
  if (job.customer.trim()) out.push({ key: 'owner', label: `${job.customer.trim()} (owner)` })
  if (job.isSub && job.gcName?.trim()) out.push({ key: 'gc', label: `${job.gcName.trim()} (GC)` })
  if (out.length === 0) out.push({ key: 'owner', label: 'the owner' })
  return out
}

/** The GC row's one dot: the date every one of its jobs with a date shares — the GC's word from the statement round — else none. */
export function groupPayYmd(jobs: ReadonlyArray<Pick<LienCalendarJob, 'runway'>>, todayYmd: string): string | null {
  const dates = new Set<string>()
  for (const j of jobs) {
    if (j.runway.state === 'closed' || j.runway.state === 'filed') continue
    const pay = j.runway.marks?.pay
    if (pay) dates.add(addDays(todayYmd, pay.days))
  }
  return dates.size === 1 ? [...dates][0]! : null
}

/** The "Set kinds, biggest first" sheet: the rows whose kind is assumed, largest balance first, each with where the kind is written. */
export function kindsQueue(jobs: ReadonlyArray<LienCalendarJob>): Array<{ jobId: string; addressId: string | null; label: string; openBalance: number; lienByYmd: string; commercialYmd: string | null }> {
  return jobs
    .filter((j) => j.runway.kindAssumed && j.runway.state !== 'closed' && j.runway.state !== 'filed')
    .sort((a, b) => b.openBalance - a.openBalance)
    .map((j) => ({ jobId: j.jobId, addressId: j.addressId ?? null, label: `${j.number} · ${j.name}`, openBalance: j.openBalance, lienByYmd: j.runway.lienByYmd, commercialYmd: commercialLienByFor(j) }))
}
