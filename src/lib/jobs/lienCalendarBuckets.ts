import { buildLienCalendar, kindsQueue, lienAddressKey, lienCalendarRowMatches, type LienCalendarGroup, type LienCalendarJob, type LienCalendarPropertyRows } from './lienCalendar'
import { formatYmdMonthDay } from './billedExpectedPay'
import { daysBetweenYmd } from './lienPayRunway'
import { LIEN_DESK_LEAD_DAYS } from './lienDesk'

/**
 * The Lien calendar's buckets (v2.4340): Overdue, This month, Next month, Later.
 *
 * Every job is counted once, at its next date — the § 53.056 notice it owes, else
 * its § 53.052 lien date — and lands in the calendar month that date falls in.
 * Overdue holds the jobs whose window closed with nothing sent: nothing is left to
 * file, the money is still owed. A filed lien has nothing left on this clock and
 * waits in Later. Before, the to-do counted a job once per deadline, so October's
 * and November's sums together came to more than the whole board.
 *
 * Pure: the tab draws the pills, the section bars and the counts on the date row
 * from this; each bucket's rows are grouped the way the board groups them
 * (`buildLienCalendar`: by GC, direct, lien gone).
 *
 * v2.4526: an Overdue job is still counted in Overdue, but when its property has a job with a
 * date ahead it is LISTED there, under that property, greyed (`placeOverdueWithProperty`). One
 * property reads in one place: the notice about to go out beside the older money owed at the
 * same address. Overdue lists only the jobs with nothing ahead at their property.
 */

export type LienCalendarBucketKey = 'overdue' | 'this_month' | 'next_month' | 'later'

export const LIEN_CALENDAR_BUCKET_KEYS: ReadonlyArray<LienCalendarBucketKey> = ['overdue', 'this_month', 'next_month', 'later']

const TITLES: Record<LienCalendarBucketKey, string> = { overdue: 'Overdue', this_month: 'This month', next_month: 'Next month', later: 'Later' }

/** A job's next date on the lien clock: the notice it owes, else its lien date; null once the window closed or the lien is filed. */
export type LienNextDate = { ymd: string; what: 'notice' | 'lien' }

export function lienNextDate(job: Pick<LienCalendarJob, 'runway'>): LienNextDate | null {
  const r = job.runway
  if (r.state === 'none' || r.state === 'closed' || r.state === 'filed') return null
  if (r.state === 'notice_due' && r.noticeByYmd) return { ymd: r.noticeByYmd, what: 'notice' }
  return r.lienByYmd ? { ymd: r.lienByYmd, what: 'lien' } : null
}

function monthIndex(ymd: string): number {
  return Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7)) - 1
}

/** The first day of the month `add` months from `ymd`'s. */
function monthStart(ymd: string, add: number): string {
  const i = monthIndex(ymd) + add
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`
}

function monthName(ymd: string): string {
  return new Date(`${ymd.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** Which bucket a job lands in; null for a job with nothing on the lien clock. */
export function lienBucketOf(job: Pick<LienCalendarJob, 'runway'>, todayYmd: string): LienCalendarBucketKey | null {
  const r = job.runway
  if (r.state === 'none') return null
  if (r.state === 'closed') return 'overdue'
  const next = lienNextDate(job)
  if (!next) return 'later'
  if (next.ymd < todayYmd) return 'overdue'
  const ahead = monthIndex(next.ymd) - monthIndex(todayYmd)
  return ahead <= 0 ? 'this_month' : ahead === 1 ? 'next_month' : 'later'
}

export type LienCalendarBucket = {
  key: LienCalendarBucketKey
  /** "Overdue", "This month", "Next month", "Later". */
  title: string
  /** Tightest first. */
  jobs: LienCalendarJob[]
  /** The bucket's jobs grouped as the board groups them: by GC, then direct, then lien gone. */
  groups: LienCalendarGroup[]
  total: number
  /** Jobs whose next date is a notice, and jobs whose next date is the lien. */
  notices: number
  liens: number
  /** Liens on file: nothing left on their clock, so they wait in Later. */
  filed: number
  /** The distinct next dates, oldest first. */
  dates: string[]
  /** The pill's date: "Oct 15", or "Dec 15 +" when Later holds more than one date; '' on Overdue and when empty. */
  dateLabel: string
  /** The section bar's one line of facts. */
  facts: string
  /** The words under the bar when the bucket is picked and holds nothing. */
  empty: string
  /** Draft the N: the bucket's notices the desk already lists (inside its 30-day lead). */
  draft: { ymd: string; jobIds: string[]; label: string } | null
  /** The stretch of the axis the bucket covers, [fromYmd, toYmd); a null end runs to the axis's edge. */
  span: { fromYmd: string | null; toYmd: string | null }
  /** Overdue only: how many of its jobs are listed with their property under a later bucket (`groups` leaves them out). */
  away: number
  /** Overdue only, when some are away: every one of its jobs and the plain facts, for when Overdue is shown on its own. */
  whole: { groups: LienCalendarGroup[]; facts: string } | null
  /** The later buckets: how many Overdue jobs are listed here, under their property. */
  guests: number
}

export type LienCalendarBoard = {
  /** All four, in order, empty ones too: the pills always show four counts. */
  buckets: LienCalendarBucket[]
  count: number
  total: number
  /** Jobs whose property kind is not set: the toolbar's "N kinds not set" door. */
  kindsUnset: number
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function inDays(todayYmd: string, ymd: string): string {
  const d = daysBetweenYmd(todayYmd, ymd) ?? 0
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}

function draftLabel(n: number): string {
  return `Draft the ${n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : n}`
}

/**
 * Under a bar that already says "by Oct 15 · in 14 days", a GC row whose notices are all on that
 * date says only "send 9 notices"; a row with a later notice keeps its own date.
 */
function wordUnderBar(g: LienCalendarGroup, ymd: string | null): LienCalendarGroup {
  if (!ymd || g.kind !== 'gc') return g
  const owed = g.jobs.filter((j) => j.runway.state === 'notice_due')
  if (!owed.length || owed.some((j) => j.runway.noticeByYmd !== ymd)) return g
  return { ...g, word: owed.length === 1 ? 'send the notice' : `send ${owed.length} notices` }
}

function bucketOf(key: LienCalendarBucketKey, jobs: LienCalendarJob[], todayYmd: string): LienCalendarBucket {
  const cal = buildLienCalendar(jobs, '')
  const sorted = cal.jobs
  const nexts = sorted.map((j) => lienNextDate(j))
  const dates = [...new Set(nexts.filter((n): n is LienNextDate => n != null).map((n) => n.ymd))].sort()
  const barDate = key !== 'overdue' && dates.length === 1 ? dates[0]! : null
  const noticeJobs = sorted.filter((_, i) => nexts[i]?.what === 'notice')
  const liens = nexts.filter((n) => n?.what === 'lien').length
  const filed = sorted.filter((j) => j.runway.state === 'filed').length
  const gcs = new Map<string, string>()
  for (const j of noticeJobs) if (j.gcId) gcs.set(j.gcId, j.gcName?.trim() || 'the GC')

  const facts: string[] = []
  if (key === 'overdue') {
    if (sorted.length) facts.push(plural(sorted.length, 'job', 'jobs'), 'nothing left to file', 'money still owed')
  } else {
    const first = dates[0]
    const last = dates[dates.length - 1]
    if (first && dates.length === 1) facts.push(`by ${formatYmdMonthDay(first)}`, inDays(todayYmd, first))
    else if (first && last) facts.push(key === 'later' ? `${formatYmdMonthDay(first)} and after` : `${formatYmdMonthDay(first)} to ${formatYmdMonthDay(last)}`)
    if (noticeJobs.length) {
      const to = gcs.size === 1 ? ` to ${[...gcs.values()][0]}` : gcs.size > 1 ? ` across ${gcs.size} GCs` : ''
      facts.push(`${plural(noticeJobs.length, 'notice', 'notices')}${to}`)
    }
    if (liens) facts.push(`${plural(liens, 'lien', 'liens')} to file`)
    if (filed) facts.push(`${plural(filed, 'lien', 'liens')} filed`)
  }

  const next = monthStart(todayYmd, 1)
  const empty =
    key === 'overdue'
      ? 'No lien window has closed on a billed job.'
      : key === 'this_month'
        ? `Nothing else falls due in ${monthName(todayYmd)}.`
        : key === 'next_month'
          ? `Nothing falls due in ${monthName(next)}.`
          : `Nothing falls due after ${monthName(next)}.`

  // The desk's notice list reaches 30 days ahead: a door to notices further out would open on an empty list.
  const draftable = noticeJobs.filter((j) => j.runway.daysToNotice != null && j.runway.daysToNotice <= LIEN_DESK_LEAD_DAYS)
  const draftYmd = draftable.map((j) => j.runway.noticeByYmd).sort()[0]
  const draft = key !== 'overdue' && draftable.length && draftYmd ? { ymd: draftYmd, jobIds: draftable.map((j) => j.jobId), label: draftLabel(draftable.length) } : null

  const span =
    key === 'overdue'
      ? { fromYmd: null, toYmd: todayYmd }
      : key === 'this_month'
        ? { fromYmd: todayYmd, toYmd: next }
        : key === 'next_month'
          ? { fromYmd: next, toYmd: monthStart(todayYmd, 2) }
          : { fromYmd: monthStart(todayYmd, 2), toYmd: null }

  return {
    key,
    title: TITLES[key],
    jobs: sorted,
    groups: cal.groups.map((g) => wordUnderBar(g, barDate)),
    total: sorted.reduce((s, j) => s + j.openBalance, 0),
    notices: noticeJobs.length,
    liens,
    filed,
    dates,
    dateLabel: key === 'overdue' || !dates[0] ? '' : key === 'later' && dates.length > 1 ? `${formatYmdMonthDay(dates[0])} +` : formatYmdMonthDay(dates[0]),
    facts: facts.join(' · '),
    empty,
    draft,
    span,
    away: 0,
    whole: null,
    guests: 0,
  }
}

/** The address as a heading: the street and the city, nothing from the state on. */
function propertyLabel(job: Pick<LienCalendarJob, 'address'>): string {
  return job.address.replace(/[,\s]+(TX|Texas)\b.*$/i, '').trim() || 'One property'
}

/**
 * Two jobs at one property: the same linked record, the same typed address, or one typed address
 * that is the other cut short at a word ("628 Terrell Rd" and "628 Terrell Rd, San Antonio, TX").
 * The short one must still name a number and two more words, so "12 Oak" matches nothing.
 */
export function lienSameProperty(a: Pick<LienCalendarJob, 'address' | 'addressId'>, b: Pick<LienCalendarJob, 'address' | 'addressId'>): boolean {
  if (a.addressId && b.addressId && a.addressId === b.addressId) return true
  const x = lienAddressKey(a.address)
  const y = lienAddressKey(b.address)
  if (!x || !y || !/^\d/.test(x) || !/^\d/.test(y)) return false
  if (x === y) return true
  const [short, long] = x.length < y.length ? [x, y] : [y, x]
  return short.split(' ').length >= 3 && long.startsWith(`${short} `)
}

type Host = { job: LienCalendarJob; bucket: number; groupKey: string; ymd: string }

function hostBefore(a: Host, b: Host): boolean {
  if (a.bucket !== b.bucket) return a.bucket < b.bucket
  if (a.ymd !== b.ymd) return a.ymd < b.ymd
  return a.job.runway.sortKey < b.job.runway.sortKey
}

/**
 * Lists each Overdue job with its property (v2.4526). A job in a later bucket with a date still
 * ahead hosts its property; an Overdue job at that property moves under the host's group, in the
 * bucket of the property's earliest date. Counts and money do not move: Overdue's `jobs` and
 * `total` still hold every overdue job, a group's `jobs`, `total` and word are still its own.
 */
export function placeOverdueWithProperty(buckets: ReadonlyArray<LienCalendarBucket>, todayYmd: string): LienCalendarBucket[] {
  const overdue = buckets.find((b) => b.key === 'overdue')
  if (!overdue || overdue.jobs.length === 0) return [...buckets]

  const hosts: Host[] = []
  buckets.forEach((b, bucket) => {
    if (b.key === 'overdue') return
    for (const g of b.groups) {
      for (const job of g.jobs) {
        const next = lienNextDate(job)
        if (next) hosts.push({ job, bucket, groupKey: g.key, ymd: next.ymd })
      }
    }
  })

  // bucket index → group key → host job id → the overdue jobs listed with it
  const placed = new Map<number, Map<string, Map<string, { host: Host; closed: LienCalendarJob[] }>>>()
  const away = new Set<string>()
  for (const job of overdue.jobs) {
    let host: Host | null = null
    for (const h of hosts) {
      if (lienSameProperty(h.job, job) && (!host || hostBefore(h, host))) host = h
    }
    if (!host) continue
    away.add(job.jobId)
    const byGroup = placed.get(host.bucket) ?? placed.set(host.bucket, new Map()).get(host.bucket)!
    const byHost = byGroup.get(host.groupKey) ?? byGroup.set(host.groupKey, new Map()).get(host.groupKey)!
    const slot = byHost.get(host.job.jobId) ?? byHost.set(host.job.jobId, { host, closed: [] }).get(host.job.jobId)!
    slot.closed.push(job)
  }
  if (away.size === 0) return [...buckets]

  const where = [...placed.keys()].sort()
  const whereWords = where.length === 1 ? `listed under ${buckets[where[0]!]!.title}` : 'listed with their property'

  return buckets.map((b, bucket) => {
    if (b.key === 'overdue') {
      const here = b.jobs.filter((j) => !away.has(j.jobId))
      return {
        ...b,
        groups: bucketOf('overdue', here, todayYmd).groups,
        facts: [plural(b.jobs.length, 'job', 'jobs'), `${here.length} listed here`, `${away.size} ${away.size === 1 ? 'is' : 'are'} ${whereWords}`].join(' · '),
        away: away.size,
        whole: { groups: b.groups, facts: b.facts },
      }
    }
    const byGroup = placed.get(bucket)
    if (!byGroup) return b
    let guests = 0
    const groups = b.groups.map((g) => {
      const byHost = byGroup.get(g.key)
      if (!byHost) return g
      const order = new Map(g.jobs.map((j, i) => [j.jobId, i]))
      const slots = [...byHost.values()].sort((x, y) => (order.get(x.host.job.jobId) ?? 0) - (order.get(y.host.job.jobId) ?? 0))
      const claimed = new Set<string>()
      const byProperty: LienCalendarPropertyRows[] = slots.map((slot) => {
        const here = [slot.host.job, ...slot.closed]
        const jobs = g.jobs.filter((j) => !claimed.has(j.jobId) && here.some((p) => p.jobId === j.jobId || lienSameProperty(p, j)))
        for (const j of jobs) claimed.add(j.jobId)
        return { key: `p:${slot.host.job.jobId}`, label: propertyLabel(slot.host.job), jobs, closed: [...slot.closed].sort((x, y) => y.openBalance - x.openBalance) }
      })
      const rest = g.jobs.filter((j) => !claimed.has(j.jobId))
      if (rest.length) byProperty.push({ key: 'rest', label: null, jobs: rest, closed: [] })
      const n = slots.reduce((s, slot) => s + slot.closed.length, 0)
      guests += n
      // Said before "4 at one property", which is the first thing a narrow row cuts off.
      const closedWords = ` · ${n} ${n === 1 ? 'window' : 'windows'} closed`
      const sub = / · \d+ at one property$/.test(g.sub) ? g.sub.replace(/( · \d+ at one property)$/, `${closedWords}$1`) : `${g.sub}${closedWords}`
      return { ...g, sub, byProperty }
    })
    return { ...b, groups, guests }
  })
}

/** A group's rows as the board draws them: a heading per property and its overdue jobs greyed, when the group lists any; else its jobs. */
export type LienCalendarRow = { kind: 'label'; key: string; label: string } | { kind: 'job'; key: string; job: LienCalendarJob; closed: boolean }

export function lienGroupRows(g: Pick<LienCalendarGroup, 'jobs' | 'byProperty'>): LienCalendarRow[] {
  if (!g.byProperty) return g.jobs.map((job) => ({ kind: 'job', key: job.jobId, job, closed: false }))
  return g.byProperty.flatMap((p): LienCalendarRow[] => [
    { kind: 'label', key: p.key, label: p.label ?? 'Other properties' },
    ...p.jobs.map((job): LienCalendarRow => ({ kind: 'job', key: job.jobId, job, closed: false })),
    ...p.closed.map((job): LienCalendarRow => ({ kind: 'job', key: job.jobId, job, closed: true })),
  ])
}

export function buildLienCalendarBoard(rows: ReadonlyArray<LienCalendarJob>, query: string, todayYmd: string): LienCalendarBoard {
  const split: Record<LienCalendarBucketKey, LienCalendarJob[]> = { overdue: [], this_month: [], next_month: [], later: [] }
  const live: LienCalendarJob[] = []
  for (const j of rows) {
    if (!lienCalendarRowMatches(j, query)) continue
    const key = lienBucketOf(j, todayYmd)
    if (!key) continue
    split[key].push(j)
    live.push(j)
  }
  const buckets = placeOverdueWithProperty(LIEN_CALENDAR_BUCKET_KEYS.map((key) => bucketOf(key, split[key], todayYmd)), todayYmd)
  return {
    buckets,
    count: live.length,
    total: live.reduce((s, j) => s + j.openBalance, 0),
    kindsUnset: kindsQueue(live).length,
  }
}

/** What the date row counts on each 15th: the jobs whose next date it is — each job once. */
export type LienNextDateCount = { ymd: string; jobs: number; notices: number; liens: number; total: number }

export function lienNextDateCounts(buckets: ReadonlyArray<Pick<LienCalendarBucket, 'jobs'>>): Map<string, LienNextDateCount> {
  const out = new Map<string, LienNextDateCount>()
  for (const b of buckets) {
    for (const j of b.jobs) {
      const next = lienNextDate(j)
      if (!next) continue
      const c = out.get(next.ymd) ?? { ymd: next.ymd, jobs: 0, notices: 0, liens: 0, total: 0 }
      c.jobs += 1
      c[next.what === 'notice' ? 'notices' : 'liens'] += 1
      c.total += j.openBalance
      out.set(next.ymd, c)
    }
  }
  return out
}

/**
 * A phone row's one line under its money: the dates ("notice by Oct 15 · lien by Nov 16"), since the
 * bar above already says when and how many. A verdict that changes what to do stays: "file first",
 * and the day a lien died.
 */
export function lienPhoneLine(job: Pick<LienCalendarJob, 'runway'>): string {
  const r = job.runway
  if (r.state === 'closed' || r.state === 'file_first') return r.lines.join(' · ')
  return r.lines[0] ?? r.words
}
