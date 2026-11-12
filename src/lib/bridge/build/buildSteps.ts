/**
 * The Build window on the shared step frame (spike candidate 9, punch list #303, drawn in
 * `to-dos/bridge-one-story/desks.html`, section 3). The Build desk's kernel (`buildDesk.ts`) already sorts every open
 * job into what the hours did. This kernel says the same reading as things to do: where Build stands in one headline
 * and one line, then three short lists named by the act, the biggest hours or money first. It adds no arithmetic of
 * its own: every number here is one the desk already holds. Every sentence is held to the plain-words rule by
 * `buildSteps.test.ts`. Pure: no React, no Supabase.
 */
import { stageUsd } from '../stageFlow'
import { BUILD_DESK_CREW_DAYS, type BuildDesk, type BuildDeskRow } from './buildDesk'

export type BuildStepKey = 'percent' | 'price' | 'crew'

/** How many rows each list shows before *Show all* (the drawing: two, one, one). */
export const BUILD_STEP_SHOWN: Record<BuildStepKey, number> = { percent: 2, price: 1, crew: 1 }

export type BuildStepRow = {
  id: string
  /** The job's number and name, as the desk labels it. */
  title: string
  /** One short line: the hours or the money, and why it is here. */
  sub: string
  /** The press's words: "Set the percent", "Set a price", "Schedule it". */
  press: string
  /** The page the press opens. Null when the press opens the job's detail under the row instead. */
  href: string | null
  /** The desk's own row, for the detail a row opens. */
  row: BuildDeskRow
}

export type BuildStepGroup = { key: BuildStepKey; title: string; shown: number; rows: BuildStepRow[] }

export type BuildSteps = {
  headline: string
  /** One line under the headline: where most of the gap is. '' when no hours went on a job that did not move. */
  line: string
  groups: [BuildStepGroup, BuildStepGroup, BuildStepGroup]
  /** Said in place of the three lists when all three are empty. '' otherwise. */
  nothingWaiting: string
  /** The jobs whose percent rose in the window: the dollars the headline names. */
  moved: { label: string; words: string; rows: BuildDeskRow[] }
  /** The press that opens the whole ledger, every open job. */
  everyLabel: string
  /** *How this is counted*, one plain sentence each. */
  counted: string[]
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const jobs = (n: number): string => `${n} ${plural(n, 'job', 'jobs')}`
/** "96 hours", "1 hour", and "Under 1 hour" for a sliver that would round to none. */
const hoursWords = (h: number): string => {
  const n = Math.round(h)
  return n < 1 ? 'Under 1 hour' : `${n} ${plural(n, 'hour', 'hours')}`
}

/** "52 days quiet", or the desk's own "No hours in 13 weeks" when the job had none in the whole span. */
function quietWords(r: BuildDeskRow): string {
  if (r.quietDays != null) return `${r.quietDays} ${plural(r.quietDays, 'day', 'days')} quiet`
  const span = /no hours in \d+ weeks?/.exec(r.hoursWords)?.[0]
  return span ? `N${span.slice(1)}` : 'Nobody on it lately'
}

const priceDoor = (r: BuildDeskRow): string | null => (r.doors.find((d) => d.label === 'Price the job') ?? r.doors[0])?.href ?? null

function percentRow(r: BuildDeskRow): BuildStepRow {
  const pct = r.pctNow == null ? 'No percent yet.' : `Still ${Math.round(r.pctNow)}%.`
  return { id: r.id, title: r.label, sub: `${hoursWords(r.hours)}. ${pct}`, press: 'Set the percent', href: null, row: r }
}

function priceRow(r: BuildDeskRow): BuildStepRow {
  const n = Math.round(r.hours)
  return { id: r.id, title: r.label, sub: `${hoursWords(r.hours)} ${n > 1 ? 'earn' : 'earns'} nothing until it has a price.`, press: 'Set a price', href: priceDoor(r), row: r }
}

function crewRow(r: BuildDeskRow): BuildStepRow {
  const quiet = `${quietWords(r)}.`
  // A job with no price is priced before it is crewed: the row's own first door.
  if (r.noPrice) return { id: r.id, title: r.label, sub: `No price yet. ${quiet}`, press: 'Set a price', href: priceDoor(r), row: r }
  const money = r.leftUsd != null ? `${stageUsd(r.leftUsd)} left.` : `${stageUsd(r.contractUsd ?? 0)} contract, no percent yet.`
  return { id: r.id, title: r.label, sub: `${money} ${quiet}`, press: 'Schedule it', href: null, row: r }
}

export function buildBuildSteps(desk: BuildDesk): BuildSteps {
  const { totals, days } = desk
  // The desk's order holds inside each list: hours first for the two that ate hours, money left first for the quiet ones.
  const percent = desk.rows.filter((r) => r.group === 'ate' && !r.noPrice)
  const price = desk.rows.filter((r) => r.group === 'ate' && r.noPrice)
  const crew = desk.rows.filter((r) => r.group === 'stalled')
  const moved = desk.rows.filter((r) => r.movedUsd > 0 && (r.group === 'moved' || r.group === 'finished'))

  const gap = percent.length + price.length > 0
  const allHours = Math.round(totals.hours)
  const headline = `The field put in ${allHours} ${plural(allHours, 'hour', 'hours')}. ${gap ? 'Only ' : ''}${stageUsd(totals.movedUsd)} of work shows as done.`
  const percentHours = percent.reduce((s, r) => s + r.hours, 0)
  const priceHours = price.reduce((s, r) => s + r.hours, 0)
  const line = !gap ? '' : percent.length > 0 && percentHours >= priceHours ? 'Most of that gap is percents nobody updated.' : price.length > 0 ? 'Most of that gap is hours on jobs with no price.' : ''

  const groups: BuildSteps['groups'] = [
    { key: 'percent', title: `Hours went in, the percent did not move · ${jobs(percent.length)}`, shown: BUILD_STEP_SHOWN.percent, rows: percent.map(percentRow) },
    { key: 'price', title: `Hours on a job with no price · ${jobs(price.length)}`, shown: BUILD_STEP_SHOWN.price, rows: price.map(priceRow) },
    { key: 'crew', title: `Sold, and nobody on it · ${jobs(crew.length)}, ${stageUsd(totals.stalledUsd)}`, shown: BUILD_STEP_SHOWN.crew, rows: crew.map(crewRow) },
  ]
  const nothingWaiting = percent.length + price.length + crew.length > 0 ? '' : desk.rows.length === 0 ? 'Nothing waiting on Build. There is no open job to read.' : 'Nothing waiting on Build. Every job with hours moved its percent.'

  const movedWords = moved.length > 0 ? `${jobs(moved.length)} moved ${stageUsd(totals.movedUsd)} in the last ${days} days. The hours and the percent agree.` : `Nothing moved in the last ${days} days. A job shows here when its percent goes up.`

  const counted = [
    `Hours are each job’s clock hours over the last ${days} days.`,
    'Hours still waiting on approval count too.',
    `Work done is how far a job’s percent rose in those ${days} days, times its price.`,
    'The percents come from the percent window and from the crews’ reports.',
    'A job with hours and no rise in its percent has an old percent, or work that went nowhere.',
    'This window cannot tell which. One look at the job can.',
    'A job with no price shows hours but never work done.',
    `A job is quiet when nobody clocked on it in those ${days} days.`,
    `The crew on a job comes from the Schedule for the next ${BUILD_DESK_CREW_DAYS} days.`,
    'The hours a job still expects are its expected hours less the hours already clocked.',
    'The percent window files a status report on the job, as a crew’s does.',
    'The week’s call is recorded on the link desk, not here.',
  ]

  return { headline, line, groups, nothingWaiting, moved: { label: `What moved (${moved.length})`, words: movedWords, rows: moved }, everyLabel: `Every open job (${desk.rows.length})`, counted }
}
