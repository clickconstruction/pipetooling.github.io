/**
 * The Materials desk's Open a job pick (v2.7310): the rows of a searchable list in place of the native select, which
 * could only scroll. The jobs that hold a box come first under their own heading, then every other job; a row's search
 * words are the number, the name and the address, so a typed street or customer finds the job as a number does.
 */
import type { SearchableSelectOption } from '../../components/SearchableSelect'
import { onSiteJobWords, type OnSiteJobNamed } from './onSiteJobWords'

export type DeskPickJob = OnSiteJobNamed & { id: string; job_address?: string | null }

export const DESK_PICK_ON_DESK = 'On the desk'
export const DESK_PICK_EVERY_JOB = 'Every other job'
export const DESK_PICK_PLACEHOLDER = 'Type a number, a name or an address'

/** One row's search words: the label the desk reads, then the address, so either finds it. */
export function deskPickSearchWords(job: DeskPickJob): string {
  const address = (job.job_address ?? '').trim()
  const label = onSiteJobWords(job)
  return address ? `${label} · ${address}` : label
}

/** The list: the jobs with a box first, in the desk's own order, then the rest as given. Nothing is listed twice. */
export function deskPickRows(jobs: ReadonlyArray<DeskPickJob>, onDeskIds: ReadonlyArray<string>): { onDesk: DeskPickJob[]; rest: DeskPickJob[] } {
  const byId = new Map(jobs.map((j) => [j.id, j]))
  const onDesk = onDeskIds.map((id) => byId.get(id)).filter((j): j is DeskPickJob => Boolean(j))
  const seen = new Set(onDesk.map((j) => j.id))
  const rest = jobs.filter((j) => !seen.has(j.id))
  return { onDesk, rest }
}

/** The options the searchable list draws: a heading over each group, none when a group is empty. */
export function deskPickOptions(jobs: ReadonlyArray<DeskPickJob>, onDeskIds: ReadonlyArray<string>): SearchableSelectOption[] {
  const { onDesk, rest } = deskPickRows(jobs, onDeskIds)
  const row = (j: DeskPickJob): SearchableSelectOption => ({ value: j.id, label: deskPickSearchWords(j) })
  const out: SearchableSelectOption[] = []
  if (onDesk.length > 0) out.push({ kind: 'separator', id: 'on-desk', label: DESK_PICK_ON_DESK }, ...onDesk.map(row))
  if (rest.length > 0) out.push({ kind: 'separator', id: 'rest', label: onDesk.length > 0 ? DESK_PICK_EVERY_JOB : 'Every job' }, ...rest.map(row))
  return out
}
