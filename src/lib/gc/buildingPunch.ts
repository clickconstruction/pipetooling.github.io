/**
 * GC mode, the real build, the Building lane's U2: the punch list, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingPunch.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
import type { GcProject, PunchItem } from './types'

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
