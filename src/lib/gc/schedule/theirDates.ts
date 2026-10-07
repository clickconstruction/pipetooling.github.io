/**
 * GC mode, the real build, the schedule's PR 1b: their dates to meet (G-145), moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcTheirDates.ts`).
 */
import { addDays } from '../building'
import { contractDaysAdded } from '../ownerBilling'
import type { ScheduleFileReading } from './import'
import { sameName } from './import'
import type { MilestoneRow } from './schedule'
import { daysBetween, isSubstantial, milestoneRows, projectedFinish } from './schedule'
import type { ScheduleMilestone } from './types'
import type { GcProject, GcState } from '../types'
import { weekdayDate } from '../words'

/** One of their dates as the action carries it: to one of ours by id, or a new one. */
export interface TheirDate {
  name: string
  on: string
  /** The id of ours it takes the place of. Null: a new date to meet. */
  ours: string | null
}

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Why the door is closed on this job, or null when it is open: a job being built, with a schedule, and no what-if copy open. */
export function theirDatesRefusal(project: GcProject): string | null {
  if (project.stage !== 'building' || project.lostOn || !project.schedule) return 'Their dates come in on a job being built.'
  if (project.whatIf) return 'A what-if copy is open. Keep it or throw it away first.'
  return null
}

/** One of their dates in the window. */
export interface TheirDateRow {
  /** The file's own key. */
  key: string
  name: string
  on: string
  /** The one of ours it takes the place of to start: the same name, not met. Null: a new date to meet. */
  ours: string | null
  /** Ours with the same name, already met: it stays, and this date cannot be ticked. */
  metOurs: MilestoneRow | null
  /** Ticked to start: it differs from ours, or it is new and still ahead. Never the contract's finish, a new one passed, or the same day. */
  ticked: boolean
}

export interface TheirDates {
  rows: TheirDateRow[]
  /** Their activities, counted and passed over. */
  activities: number
  /** Ours not met: what "which of ours" can pick. */
  ours: MilestoneRow[]
}

/** Their dates from a file read by G-137's reader, each beside ours by name. Only the rows the reader marks as a date. */
export function theirDates(state: GcState, project: GcProject, reading: ScheduleFileReading): TheirDates {
  const rows = milestoneRows(state, project)
  const open = rows.filter((r) => !r.milestone.metOn)
  const out: TheirDateRow[] = reading.rows
    .filter((r) => r.date)
    .map((r) => {
      const same = rows.filter((x) => sameName(x.milestone.label, r.name))
      const ours = same.find((x) => !x.milestone.metOn) ?? null
      const metOurs = ours ? null : (same.find((x) => x.milestone.metOn) ?? null)
      const ticked = metOurs !== null ? false : ours ? !isSubstantial(ours.milestone) && r.start !== ours.due : r.start > state.today
      return { key: r.key, name: r.name, on: r.start, ours: ours?.milestone.id ?? null, metOurs, ticked }
    })
  return { rows: out, activities: reading.rows.filter((r) => !r.date).length, ours: open }
}

/** Their day against the day ours is due: "7 days later", "3 days earlier", "the same day", or "a new date". */
export function differenceWords(on: string, ours: MilestoneRow | null): string {
  if (!ours) return 'a new date'
  const d = daysBetween(ours.due, on)
  return d === 0 ? 'the same day' : d > 0 ? `${days(d)} later` : `${days(-d)} earlier`
}

/** Under the contract's finish: the projected finish against their day, in the Projected finish measure's own words. */
export function contractWords(state: GcState, project: GcProject, on: string): string {
  const finish = projectedFinish(project, state.today)
  if (!finish) return "This is the contract's finish."
  const past = daysBetween(on, finish.on)
  const tail = past > 0 ? `is ${days(past)} past the contract` : past === 0 ? 'leaves no days to spare' : `leaves ${days(-past)} to spare`
  return `This is the contract's finish. With theirs, the projected finish, ${weekdayDate(finish.on)}, ${tail}.`
}

/** When signed change orders moved ours: their day is the day it is due, so its planned day takes those days off. Null: none. */
export function changeOrderWords(project: GcProject, on: string): string | null {
  const added = contractDaysAdded(project)
  return added > 0 ? `Ours counts ${days(added)} by change order, so it is due ${weekdayDate(on)} as theirs.` : null
}

/** A row's note, in the window's words, for the one of ours it is set to: met, passed, or the contract's finish. */
export function rowNotes(state: GcState, project: GcProject, row: TheirDateRow, ours: MilestoneRow | null): string[] {
  if (row.metOurs?.milestone.metOn) return [`Ours was met ${weekdayDate(row.metOurs.milestone.metOn)}, so it stays.`]
  if (!ours && row.on <= state.today) return ['That day has passed.']
  if (ours && isSubstantial(ours.milestone)) return [contractWords(state, project, row.on), ...(changeOrderWords(project, row.on) ? [changeOrderWords(project, row.on) as string] : [])]
  return []
}

/**
 * The job's dates to meet with theirs taken: one of ours gets a new planned day (their day, less
 * the change orders' days on substantial completion), a new one comes in as the job's own, not met.
 * Null, refused whole: a date with no name or no day, one of ours that is met or not there, or two
 * of theirs on one of ours.
 */
export function withTheirDates(project: GcProject, dates: TheirDate[]): ScheduleMilestone[] | null {
  const schedule = project.schedule
  if (!schedule) return null
  const added = contractDaysAdded(project)
  const byId = new Map(schedule.milestones.map((m) => [m.id, m]))
  const ids = new Set(schedule.milestones.map((m) => m.id))
  const taken = new Set<string>()
  let milestones = [...schedule.milestones]
  for (const d of dates) {
    const name = d.name.trim()
    if (!name || !ISO_DAY.test(d.on)) return null
    if (d.ours !== null) {
      const m = byId.get(d.ours)
      if (!m || m.metOn || taken.has(m.id)) return null
      taken.add(m.id)
      const planned = isSubstantial(m) && added > 0 ? addDays(d.on, -added) : d.on
      milestones = milestones.map((x) => (x.id === m.id ? { ...x, planned } : x))
    } else {
      // Made the way the Milestones card makes one, a number further on while it is taken.
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      let n = milestones.length + 1
      while (ids.has(`${project.id}-ms-${n}-${slug}`)) n += 1
      const id = `${project.id}-ms-${n}-${slug}`
      ids.add(id)
      milestones.push({ id, label: name, planned: d.on, packageId: null, metOn: null })
    }
  }
  return milestones
}

/** The log's line, naming the file: "Took 3 of Cibolo Creek Partners' dates to meet from cibolo-master.xml on Fair Oaks Shops, Building D." */
export function theirDatesLogWords(project: GcProject, from: string, file: string, dates: TheirDate[]): string {
  const first = dates[0]
  if (dates.length === 1 && first) return `Took ${possessive(from)} date for ${first.name} from ${file} on ${project.name}.`
  return `Took ${dates.length} of ${possessive(from)} dates to meet from ${file} on ${project.name}.`
}
