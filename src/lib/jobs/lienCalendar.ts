import type { LienPayRunway, LienRunwayTone } from './lienPayRunway'

/**
 * The Lien calendar (v2.4101, punch list #55 PR B): every billed or
 * collections job with its runway, grouped the way the work happens — by GC
 * (a § 53.056 notice goes to the owner AND the GC, and one GC's jobs share a
 * run), direct jobs under one heading, lien-gone jobs under another — with a
 * search across the Pipeline's fields and one line per group that names the
 * next move. Pure: the Pipeline hands in each job's runway; the tab renders.
 * PR C adds the shared axis, the density per 15th and the to-do sentences.
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
}

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
