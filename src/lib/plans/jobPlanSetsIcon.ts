/**
 * The Pipeline row's plans icon (punch list #239, PR 6): it does what the Bid Board's does today. A job with one
 * set opens it; with two or more, the icon names the set the job builds from and opens a picker that lists
 * every set on the job's part with Open ↗. A job that names no part yet falls back to its old `job_plans_link`,
 * so every row reads as it did. Pure.
 */
import { compareSets, isAsBuilt, isDrawingSet, type PlanSetRow } from './planSets'

/** What the rows' read hands each job: its part, the set it builds from and every set on the part. */
export type JobPlanSetsEntry = { partId: string; currentSetId: string | null; sets: PlanSetRow[] }

export type JobPlansPress = { kind: 'none' } | { kind: 'open'; link: string; title: string } | { kind: 'pick'; title: string; count: number }

/** The sets a person can open: the drawings with a link. A paper reads under Papers with the plans, never here. */
export function openableSets(entry: JobPlanSetsEntry | null | undefined): PlanSetRow[] {
  return (entry?.sets ?? []).filter((s) => isDrawingSet(s) && s.link.trim() !== '')
}

/** What the icon does: nothing to draw, open the one set, or offer the picker. */
export function jobPlansPress(entry: JobPlanSetsEntry | null | undefined, jobPlansLink: string | null | undefined): JobPlansPress {
  const sets = openableSets(entry)
  if (sets.length === 0) {
    const link = (jobPlansLink ?? '').trim()
    return link ? { kind: 'open', link, title: 'Job plans' } : { kind: 'none' }
  }
  if (sets.length === 1) return { kind: 'open', link: sets[0]!.link.trim(), title: `Job plans · ${sets[0]!.name}` }
  const current = entry?.currentSetId ? sets.find((s) => s.id === entry.currentSetId) : null
  return { kind: 'pick', title: current ? `Job plans · ${current.name} · ${sets.length} sets` : `Job plans · ${sets.length} sets`, count: sets.length }
}

export type JobPlansPickerView = {
  /** The set the job builds from, when it has a link. */
  current: PlanSetRow | null
  /** Every other set that is not an as-built, newest first. */
  older: PlanSetRow[]
  /** Our as-builts, newest first. */
  asBuilts: PlanSetRow[]
}

/** The picker's groups, from the openable sets. */
export function jobPlansPickerView(entry: JobPlanSetsEntry | null | undefined): JobPlansPickerView {
  const sets = openableSets(entry)
  const current = entry?.currentSetId ? (sets.find((s) => s.id === entry.currentSetId) ?? null) : null
  const asBuilts = sets.filter(isAsBuilt).filter((s) => s !== current).sort(compareSets)
  const older = sets.filter((s) => !isAsBuilt(s) && s !== current).sort(compareSets)
  return { current, older, asBuilts }
}

/** The picker's first line: *3 sets of plans on this job. Open the one you want.* */
export function jobPlansPickerWords(view: JobPlansPickerView): string {
  const n = (view.current ? 1 : 0) + view.older.length + view.asBuilts.length
  return `${n} ${n === 1 ? 'set' : 'sets'} of plans on this job. Open the one you want.`
}
