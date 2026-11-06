/**
 * The Scoreboard's cuts and window (punch list #250, PR 4, v2.6558). *Cut by* job (the board as built), part of
 * the site (the Plans look's parts as rows, their jobs under each, the jobs on no part last) or person (the grid
 * turned over: a person is the row, their jobs under them, earned their share by hours, so it wears ≈). *Window*
 * all time, this month or 90 days, the same grid cut to the days inside it (`buildScoreboard` takes the range).
 * The device remembers both (`devicePrefs.ts`). Pure; the page reads, the component draws.
 */
import type { ScoreboardColumnKey, ScoreboardJob, ScoreboardMeasures, ScoreboardModel, ScoreboardSort, ScoreboardViewer, ScoreboardWindowRange } from './scoreboard'
import type { SiteLaborRead } from './siteLabor'
import { inScoreboardWindow } from './scoreboard'

export type ScoreboardCut = 'job' | 'part' | 'person'

export const SCOREBOARD_CUTS: ReadonlyArray<{ key: ScoreboardCut; label: string; title: string }> = [
  { key: 'job', label: 'job', title: 'A row per job, with who put what in under each' },
  { key: 'part', label: 'part of the site', title: 'The parts of the site as rows, their jobs under each; the jobs on no part come last' },
  { key: 'person', label: 'person', title: 'The crew who clocked on the site as rows, their jobs under each; earned is their share of the job by hours' },
]

export function isScoreboardCut(v: unknown): v is ScoreboardCut {
  return SCOREBOARD_CUTS.some((c) => c.key === v)
}

export type ScoreboardWindowKey = 'all' | 'month' | '90d'

export const SCOREBOARD_WINDOWS: ReadonlyArray<{ key: ScoreboardWindowKey; label: string; title: string }> = [
  { key: 'all', label: 'all time', title: 'The site’s whole life' },
  { key: 'month', label: 'this month', title: 'From the first of the month to today' },
  { key: '90d', label: '90 days', title: 'The last 90 days, today included' },
]

export function isScoreboardWindowKey(v: unknown): v is ScoreboardWindowKey {
  return SCOREBOARD_WINDOWS.some((w) => w.key === v)
}

/** What a window does to the figures, said once beside the chips. */
export const SCOREBOARD_WINDOW_NOTE = 'hours, labor, subs, parts and overhead dated in the window; earned by the hours in it; an undated charge stays out'

const DAY_MS = 86_400_000

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!) + days * DAY_MS).toISOString().slice(0, 10)
}

/** The window's two days from its key and today's date: this month from the first, 90 days back from today, today inside both; null for all time. */
export function scoreboardWindowRange(key: ScoreboardWindowKey, todayYmd: string): ScoreboardWindowRange | null {
  if (key === 'month') return { from: `${todayYmd.slice(0, 7)}-01`, to: todayYmd }
  if (key === '90d') return { from: shiftYmd(todayYmd, -89), to: todayYmd }
  return null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayWords(ymd: string, withYear: boolean): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${MONTHS[m! - 1]} ${d}${withYear ? ` ${y}` : ''}`
}

/** The window as two days, *Nov 1 – Nov 5*; the years when they differ. */
export function scoreboardWindowWords(range: ScoreboardWindowRange): string {
  const years = range.from.slice(0, 4) !== range.to.slice(0, 4)
  return `${dayWords(range.from, years)} – ${dayWords(range.to, years)}`
}

// ---- the cut by part of the site --------------------------------------------------------------

export type ScoreboardPart = { id: string; name: string }

export type ScoreboardPartGroup = {
  key: string
  name: string
  /** The part's jobs with money on them. */
  rows: ScoreboardJob[]
  m: ScoreboardMeasures
}

export const NO_PART_WORDS = 'No part'

const ZERO: ScoreboardMeasures = { hours: 0, days: 0, labor: 0, subs: 0, parts: 0, overhead: 0, earned: 0, cost: 0, profit: 0 }

const round2 = (n: number) => Math.round(n * 100) / 100

/** The rows' measures together, days counted once across them where the rows know their days. */
export function sumScoreboardRows(rows: ReadonlyArray<Pick<ScoreboardJob, 'm' | 'dayKeys'>>): ScoreboardMeasures {
  const m: ScoreboardMeasures = { ...ZERO }
  const days = new Set<string>()
  let undatedDays = 0
  for (const r of rows) {
    for (const k of Object.keys(m) as ScoreboardColumnKey[]) if (k !== 'days') m[k] = round2(m[k] + r.m[k])
    if (r.dayKeys) for (const d of r.dayKeys) days.add(d)
    else undatedDays += r.m.days
  }
  m.days = days.size + undatedDays
  return m
}

/**
 * The board's rows grouped by the part of the site each job builds from, in the parts' own order (the Plans look's),
 * a part with no job with money on it left out, the jobs on no part last. Each group's nine are its rows together.
 */
export function scoreboardPartGroups(model: ScoreboardModel, partOfJob: ReadonlyMap<string, string | null | undefined>, parts: ReadonlyArray<ScoreboardPart>): ScoreboardPartGroup[] {
  const byPart = new Map<string, ScoreboardJob[]>()
  for (const r of model.rows) {
    const partId = partOfJob.get(r.jobId) ?? null
    const key = partId && parts.some((p) => p.id === partId) ? partId : 'none'
    byPart.set(key, [...(byPart.get(key) ?? []), r])
  }
  const out: ScoreboardPartGroup[] = []
  for (const p of parts) {
    const rows = byPart.get(p.id)
    if (rows?.length) out.push({ key: p.id, name: p.name, rows, m: sumScoreboardRows(rows) })
  }
  const none = byPart.get('none')
  if (none?.length) out.push({ key: 'none', name: NO_PART_WORDS, rows: none, m: sumScoreboardRows(none) })
  return out
}

// ---- the cut by person --------------------------------------------------------------------------

/** What a person put into one job: their hours and days, their labor (null on the leader's board) and their share of the job's earned dollars, by hours. */
export type ScoreboardPersonMeasures = { hours: number; days: number; labor: number | null; cost: number | null; earned: number }

export type ScoreboardPersonLine = { row: ScoreboardJob; lead: boolean; m: ScoreboardPersonMeasures }

export type ScoreboardPersonRow = {
  key: string
  name: string
  you: boolean
  m: ScoreboardPersonMeasures
  lines: ScoreboardPersonLine[]
}

/** The columns a person's row fills; the rest are blank, since subs, supply houses, the card and overhead are not people. */
export const SCOREBOARD_PERSON_KEYS: ReadonlySet<ScoreboardColumnKey> = new Set(['hours', 'days', 'labor', 'earned', 'cost'])

export const SCOREBOARD_PERSON_NOTE = 'Subs, supply houses, the card and overhead are not people. Their dollars stay on the jobs.'

export const SCOREBOARD_PERSON_EARNED_TITLE = 'Their share of the job’s earned dollars, by hours'

const sameName = (a: string | null | undefined, b: string | null | undefined) => !!a?.trim() && !!b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The grid turned over: the crew who clocked on the site as rows, each with their hours, days and labor across the
 * site's jobs and their share of each job's earned dollars by hours (≈), and under each the jobs they were on. In a
 * window, their hours and days inside it alone. Sorted by the board's sort where a person fills that column, else
 * by earned, biggest first. The leader's board carries no dollar of labor.
 */
export function scoreboardPeopleCut(args: { model: ScoreboardModel; labor: SiteLaborRead | undefined; seesCosts: boolean; viewer: ScoreboardViewer; sort?: ScoreboardSort }): ScoreboardPersonRow[] {
  const labor = args.labor?.state === 'read' ? args.labor.labor : null
  if (!labor) return []
  const win = args.model.window
  const people = new Map<string, { name: string; you: boolean; days: Set<string>; undatedDays: number; hours: number; labor: number; earned: number; lines: ScoreboardPersonLine[] }>()
  for (const row of [...args.model.rows, ...args.model.empties]) {
    const lj = labor.byJobId.get(row.jobId)
    if (!lj) continue
    for (const p of lj.people) {
      let hours = p.hours
      let laborUsd = p.costUsd
      const days = new Set<string>()
      let undated = 0
      if (p.byWorkDate) {
        if (win) {
          hours = 0
          laborUsd = 0
        }
        for (const d of p.byWorkDate) {
          if (!inScoreboardWindow(win, d.ymd)) continue
          days.add(d.ymd)
          if (win) {
            hours += d.hours
            laborUsd += d.costUsd
          }
        }
      } else undated = p.days
      if (!(hours > 0)) continue
      const key = p.personId ?? p.personName
      const you = (args.viewer.userId != null && p.userId === args.viewer.userId) || (p.userId == null && sameName(p.personName, args.viewer.name))
      const earned = row.m.hours > 0 ? round2((hours / row.m.hours) * row.m.earned) : 0
      const m: ScoreboardPersonMeasures = { hours, days: days.size + undated, labor: args.seesCosts ? round2(laborUsd) : null, cost: args.seesCosts ? round2(laborUsd) : null, earned }
      const cur = people.get(key) ?? { name: p.personName, you, days: new Set<string>(), undatedDays: 0, hours: 0, labor: 0, earned: 0, lines: [] }
      cur.hours += hours
      cur.labor += laborUsd
      cur.earned += earned
      cur.undatedDays += undated
      for (const d of days) cur.days.add(d)
      cur.you = cur.you || you
      cur.lines.push({ row, lead: labor.daysKnown && p.leadDays > 0, m })
      people.set(key, cur)
    }
  }
  const sort = args.sort ?? args.model.sort
  const key: ScoreboardColumnKey = SCOREBOARD_PERSON_KEYS.has(sort.key) ? sort.key : 'earned'
  const dir = SCOREBOARD_PERSON_KEYS.has(sort.key) ? (sort.desc ? -1 : 1) : -1
  const value = (m: ScoreboardPersonMeasures): number => (key === 'labor' || key === 'cost' ? (m.labor ?? 0) : key === 'hours' ? m.hours : key === 'days' ? m.days : m.earned)
  const out: ScoreboardPersonRow[] = [...people.entries()].map(([k, p]) => ({
    key: k,
    name: p.name,
    you: p.you,
    m: { hours: p.hours, days: p.days.size + p.undatedDays, labor: args.seesCosts ? round2(p.labor) : null, cost: args.seesCosts ? round2(p.labor) : null, earned: round2(p.earned) },
    lines: p.lines.sort((a, b) => dir * (value(a.m) - value(b.m)) || a.row.label.localeCompare(b.row.label, undefined, { numeric: true })),
  }))
  return out.sort((a, b) => dir * (value(a.m) - value(b.m)) || a.name.localeCompare(b.name))
}

/** The words after a person's name: *3 jobs*. */
export function personJobsWords(n: number): string {
  return `${n} ${n === 1 ? 'job' : 'jobs'}`
}
