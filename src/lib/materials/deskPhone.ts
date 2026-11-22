/**
 * The Materials desk on a phone (v2.8291): what the desk draws at a phone's width, with no job open.
 *
 * At a computer the desk is a table of seven columns, a row for each job with a cage or a box. On a phone two of
 * those columns fit, and the five a person on site wants (which boxes are due a count, what came up short this week,
 * the credits, the row's own presses) sit off the right edge with nothing to say they are there.
 *
 * Here the same facts are laid out for a thumb:
 *
 * - **Three figures on top**, where the desk's sentence was. The sentence promised *what is on every site, what went
 *   missing this week, which containers have not been counted*: the figures are those three, across every job. *Due a
 *   count* and *Missing this week* narrow the list to the jobs they count, and *Boxes on site* brings it all back.
 * - **A section for each site**, its jobs as rows under its name, then the jobs on no site. A row is the job's number,
 *   its name on the whole width, one line of what it holds, and a line for each thing it needs in the words the desk
 *   already writes. A row that needs something is marked. The whole row opens the job.
 *
 * Nothing is counted here. The caller reads the store and hands each job's figures over, so the desk at a computer
 * and this one cannot disagree. Pure.
 *
 * The office reads it with money. An estimator, a primary and a superintendent read the same list on the Materials
 * page with none (`money: false`): two figures, no line about what came up short, and no way to narrow to it.
 */
import { flowFigure } from './flowRow'
import { missingWeekIsPartial, missingWeekNote } from './missingWeekWords'
import { deskJobsNotLoadedWords, deskRowNotLoadedWords } from './onSiteReadFailed'
import type { DeskGroup } from './siteRollup'

/** One job on the desk, as the caller read it from the on-site store. */
export type DeskPhoneJob = {
  id: string
  /** The job's number as these screens print it, '' when it has none. */
  number: string
  /** Its name, or what stands in for one. */
  name: string
  /** Live cages and boxes. */
  boxes: number
  /** Named places on the job. */
  places: number
  /** How many of its boxes are due a count, and the desk's own words for them (`staleWords`). */
  due: number
  dueWords: string
  missingLines: number
  missingUnpricedLines: number
  missingMoney: number
  credits: number
  /** The reason its own read failed, or null. A job that did not load has no figure to show. */
  failed: string | null
}

/** Which jobs the list shows: all of them, the ones with a box due a count, or the ones that came up short. */
export type DeskPhoneFilter = 'all' | 'due' | 'missing'

export type DeskPhoneTile = {
  key: DeskPhoneFilter
  figure: string
  word: string
  /** `here` is what is on site, `gap` a figure that asks for a hand, `out` a figure with nothing behind it. */
  tone: 'here' | 'gap' | 'out'
  /** Nothing to narrow to: the press does nothing. */
  off: boolean
  on: boolean
  /** The whole sentence, for the tooltip and the screen reader. */
  title: string
}

export type DeskPhoneRow = {
  id: string
  number: string
  name: string
  /** What the row is called when it is read aloud or pressed: `224 · Phase 2 draws`. */
  label: string
  /** One quiet line: `94 boxes · 2 places`, with `all counted this fortnight` when nothing is due. Empty on a row that did not load. */
  facts: string
  /** A line for each thing the job needs, in the desk's words. */
  needs: string[]
  /** The row is marked: it has a line in `needs`, or it did not load. */
  marked: boolean
  /** `Did not load. <the reason>` on a row whose read failed, else null. */
  failed: string | null
}

export type DeskPhoneSection = {
  /** `site:<id>`, or `loose` for the jobs on no site. */
  key: string
  /** The site this section is, or null for the jobs on no site. */
  siteId: string | null
  /** The site's name, *Not on a site*, or null when no job is on a site and the heading would say nothing. */
  heading: string | null
  /** `97 boxes` beside a site that holds more than one job here, where the rows alone do not add it up. */
  boxesWords: string | null
  /** `1 job did not load` beside a site, or ''. */
  notLoadedWords: string
  rows: DeskPhoneRow[]
}

export type DeskPhoneModel = {
  tiles: DeskPhoneTile[]
  /** The filter in force: the one asked for, or `all` when it would leave the list empty. */
  filter: DeskPhoneFilter
  sections: DeskPhoneSection[]
}

export const DESK_PHONE_NOT_ON_A_SITE = 'Not on a site'
export const DESK_PHONE_WHOLE_SITE = 'Whole site'
export const DESK_PHONE_ALL_COUNTED = 'all counted this fortnight'

/** `1 box`, `94 boxes`. */
export function deskPhoneBoxesWords(n: number): string {
  return `${flowFigure(n)} ${n === 1 ? 'box' : 'boxes'}`
}

/** A sentence's money, as the desk writes it: `$85.00`. */
function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** A tile's money: whole dollars, since a tile is read at a glance. `$85`, `$1,204`. */
function tileMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * A job's missing line: `$85.00 missing this week · 2 lines`. With no priced line there is no money to name, so the
 * line leads with what happened: `Missing this week · 3 lines, none with a price`. Empty when nothing came up short.
 */
export function deskPhoneMissingWords(job: Pick<DeskPhoneJob, 'missingLines' | 'missingUnpricedLines' | 'missingMoney'>): string {
  const note = missingWeekNote(job.missingLines, job.missingUnpricedLines)
  if (!note) return ''
  return job.missingMoney > 0 ? `${money(job.missingMoney)} missing this week · ${note}` : `Missing this week · ${note}`
}

function matches(job: DeskPhoneJob, filter: DeskPhoneFilter): boolean {
  // A job that did not load may be due a count or short: it stays in every list, with its press to read it again.
  if (job.failed) return true
  if (filter === 'due') return job.due > 0
  if (filter === 'missing') return job.missingLines > 0
  return true
}

function row(job: DeskPhoneJob, withMoney: boolean): DeskPhoneRow {
  // A job with no number is named by its name alone, as the desk's own label does.
  const label = [job.number, job.name].filter(Boolean).join(' · ') || '—'
  if (job.failed) return { id: job.id, number: job.number, name: job.name, label, facts: '', needs: [], marked: true, failed: deskRowNotLoadedWords(job.failed) }
  const needs = [job.dueWords, withMoney ? deskPhoneMissingWords(job) : ''].filter(Boolean)
  const facts = [
    deskPhoneBoxesWords(job.boxes),
    job.places > 1 ? `${job.places} places` : '',
    job.due === 0 && job.boxes > 0 ? DESK_PHONE_ALL_COUNTED : '',
    withMoney && job.credits > 0 ? (job.credits === 1 ? '1 credit due' : `${flowFigure(job.credits)} credits due`) : '',
  ].filter(Boolean).join(' · ')
  return { id: job.id, number: job.number, name: job.name, label, facts, needs, marked: needs.length > 0, failed: null }
}

/** The figures, across every job the desk read: three with money, the first two without. A job that did not load adds nothing: it has no figure. */
function tiles(jobs: ReadonlyArray<DeskPhoneJob>, filter: DeskPhoneFilter, withMoney: boolean): DeskPhoneTile[] {
  const read = jobs.filter((j) => !j.failed)
  const boxes = read.reduce((n, j) => n + j.boxes, 0)
  const due = read.reduce((n, j) => n + j.due, 0)
  const lines = read.reduce((n, j) => n + j.missingLines, 0)
  const unpriced = read.reduce((n, j) => n + j.missingUnpricedLines, 0)
  const moneyShort = read.reduce((n, j) => n + j.missingMoney, 0)
  const jobsDue = read.filter((j) => j.due > 0).length
  const jobsShort = read.filter((j) => j.missingLines > 0).length
  const jobsWords = (n: number) => (n === 1 ? '1 job' : `${n} jobs`)
  // The money leaves out a line with no price, so it is a floor then: say so with a plus. With no priced line at all
  // there is no money to show, and the figure is how many lines came up short.
  const missing = lines === 0
    ? { figure: '$0', word: 'Missing this week', title: 'Nothing came up short this week.' }
    : moneyShort > 0
      ? { figure: `${tileMoney(moneyShort)}${missingWeekIsPartial(lines, unpriced) ? '+' : ''}`, word: 'Missing this week', title: `${money(moneyShort)} missing this week on ${jobsWords(jobsShort)}: ${missingWeekNote(lines, unpriced)}. Press to see ${jobsShort === 1 ? 'that job' : 'those jobs'}.` }
      : { figure: flowFigure(lines), word: 'Short this week', title: `${lines === 1 ? '1 line' : `${flowFigure(lines)} lines`} came up short this week on ${jobsWords(jobsShort)}, with no price to add up. Press to see ${jobsShort === 1 ? 'that job' : 'those jobs'}.` }
  const all: DeskPhoneTile[] = [
    { key: 'all', figure: flowFigure(boxes), word: 'Boxes on site', tone: 'here', off: false, on: filter === 'all', title: `${deskPhoneBoxesWords(boxes)} on site across ${jobsWords(read.length)}. Press to see every job.` },
    { key: 'due', figure: flowFigure(due), word: 'Due a count', tone: due > 0 ? 'gap' : 'out', off: due === 0, on: filter === 'due', title: due === 0 ? 'No box is due a count.' : `${deskPhoneBoxesWords(due)} due a count on ${jobsWords(jobsDue)}. Press to see ${jobsDue === 1 ? 'that job' : 'those jobs'}.` },
    { key: 'missing', ...missing, tone: lines > 0 ? 'gap' : 'out', off: lines === 0, on: filter === 'missing' },
  ]
  return withMoney ? all : all.filter((t) => t.key !== 'missing')
}

/**
 * The desk for a phone. `jobs` are in the desk's own order (what needs a hand first), `groups` its sites and loose
 * jobs as `groupDeskBySite` gives them. A filter that would leave nothing to show falls back to every job, so a
 * figure that drops to zero while it is pressed never leaves an empty page. With `money: false` nothing about money
 * is drawn or asked for: the *Missing this week* figure, a row's missing line and its credits.
 */
export function buildDeskPhone(input: { jobs: ReadonlyArray<DeskPhoneJob>; groups: ReadonlyArray<DeskGroup>; filter: DeskPhoneFilter; money?: boolean }): DeskPhoneModel {
  const withMoney = input.money !== false
  const byId = new Map(input.jobs.map((j) => [j.id, j] as const))
  const asked: DeskPhoneFilter = !withMoney && input.filter === 'missing' ? 'all' : input.filter
  const filter: DeskPhoneFilter = asked !== 'all' && input.jobs.some((j) => !j.failed && matches(j, asked)) ? asked : 'all'
  const anySite = input.groups.some((g) => g.kind === 'site')
  const sections: DeskPhoneSection[] = []
  const loose: DeskPhoneRow[] = []
  for (const g of input.groups) {
    if (g.kind === 'job') {
      const job = byId.get(g.jobId)
      if (job && matches(job, filter)) loose.push(row(job, withMoney))
      continue
    }
    const members = g.jobIds.map((id) => byId.get(id)).filter((j): j is DeskPhoneJob => Boolean(j))
    const shown = members.filter((j) => matches(j, filter))
    if (shown.length === 0) continue
    sections.push({
      key: `site:${g.siteId}`,
      siteId: g.siteId,
      heading: g.name,
      boxesWords: members.length > 1 ? deskPhoneBoxesWords(members.reduce((n, j) => n + (j.failed ? 0 : j.boxes), 0)) : null,
      notLoadedWords: deskJobsNotLoadedWords(members.filter((j) => j.failed).length),
      rows: shown.map((j) => row(j, withMoney)),
    })
  }
  if (loose.length > 0) sections.push({ key: 'loose', siteId: null, heading: anySite ? DESK_PHONE_NOT_ON_A_SITE : null, boxesWords: null, notLoadedWords: '', rows: loose })
  return { tiles: tiles(input.jobs, filter, withMoney), filter, sections }
}
