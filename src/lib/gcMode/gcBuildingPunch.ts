/**
 * GC mode — design spike: the punch list (Building lane, owner 2026-10-03). Our superintendent
 * walks a trade's work and lists what is left to fix; the trade marks each item fixed in its
 * portal; our superintendent checks it, or sends it back with a note. We accept a trade's work
 * (Closeout) once every item on it is checked fixed. Our own crew's closeout runs on the Pipeline,
 * so the list here is for the trades we hire.
 *
 * Types only, so gcBuilding can read it without a loop. Import from `./gcModel`.
 */
import type { GcProject, PunchItem } from './gcTypes'

/** Open: still to fix. Fixed: the trade says so and it waits on our check. Done: checked fixed. */
export type PunchState = 'open' | 'fixed' | 'done'

export function punchState(item: PunchItem): PunchState {
  return item.checkedOn ? 'done' : item.fixedOn ? 'fixed' : 'open'
}

/** A trade's punch items, in the order they were added. */
export function punchItems(project: GcProject, packageId: string): PunchItem[] {
  return (project.punch ?? []).filter((i) => i.packageId === packageId)
}

export interface PunchCounts {
  open: number
  fixed: number
  done: number
  total: number
}

/** How a trade's punch list stands, or the whole job's without a trade. */
export function punchCounts(project: GcProject, packageId?: string): PunchCounts {
  const items = packageId ? punchItems(project, packageId) : (project.punch ?? [])
  const count = (st: PunchState) => items.filter((i) => punchState(i) === st).length
  return { open: count('open'), fixed: count('fixed'), done: count('done'), total: items.length }
}

/** Nothing left on the trade's list: every item is checked fixed, or there are none. */
export function punchClear(project: GcProject, packageId: string): boolean {
  const c = punchCounts(project, packageId)
  return c.open + c.fixed === 0
}

/** The list in a few words: "1 to fix, 1 fixed and waiting on our check, 1 checked". */
export function punchWords(c: PunchCounts): string {
  const parts = [
    c.open > 0 ? `${c.open} to fix` : '',
    c.fixed > 0 ? `${c.fixed} fixed and waiting on our check` : '',
    c.done > 0 ? `${c.done} checked` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

/** The next item's id on the project. */
export function nextPunchId(project: GcProject): string {
  const n = (project.punch ?? []).reduce((m, i) => Math.max(m, Number(i.id.split('-').pop()) || 0), 0)
  return `${project.id}-punch-${n + 1}`
}
