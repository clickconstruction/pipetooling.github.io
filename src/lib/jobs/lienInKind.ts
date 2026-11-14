/**
 * Paid in kind is paid, as far as the Lien desk goes (the owner's rule of 2026-11-14, v2.7253): a job on an
 * open in-kind deal is off the desk the way a job marked Uncollectible is (v2.4788). No row on any view, no
 * count, no total, no print run, no summary, and no lien mark on its Pipeline row.
 *
 * The mark is `jobs_ledger.in_kind_arrangement_id` (punch list #301, migration 20261110071633). Ending a deal
 * clears it on the deal's jobs (the trigger `in_kind_arrangements_end_releases_jobs`), so a link that is set
 * means the deal is open, and a job comes back to the desk by itself the next time the desk reads.
 *
 * The trade-off, stated once: the law's lien days run whether or not a deal is honoured. Off the desk, nobody
 * is reminded of them. The job's own Lien window still opens, says so, and still drafts and holds every paper.
 *
 * Every reader of the desk's jobs goes through here, so the views cannot disagree: the desk's read
 * (`useLienDeskData`), By job's book (`useLienTimelineBook`), By date and the Pipeline's marks
 * (`lienCalendarRows.ts`), Put a GC on notice (`useGcOnNoticeData`) and the Dashboard's lien watch
 * (`useLienWatchNudge`). Pure.
 */
import { jobIsScheduledInKind } from '../inKind/inKindLedger'

type InKindLinked = { in_kind_arrangement_id?: string | null }

/** Whether the Lien desk leaves this job off: an open in-kind deal pays it. */
export function jobOffLienDeskInKind(job: InKindLinked | null | undefined): boolean {
  return jobIsScheduledInKind(job)
}

/** The jobs an open in-kind deal pays, by id. */
export function lienInKindJobIds(jobs: ReadonlyArray<InKindLinked & { id: string }>): Set<string> {
  const ids = new Set<string>()
  for (const j of jobs) if (jobOffLienDeskInKind(j)) ids.add(j.id)
  return ids
}

/** The column the rule reads. A read of the desk's jobs names it through `withLienInKindColumn`, so no reader can forget it. */
export const LIEN_IN_KIND_COLUMN = 'in_kind_arrangement_id' as const

/** A select list of `jobs_ledger` columns with the deal's link on the end. The list keeps its literal type, so the typed client still reads the row's shape from it. */
export function withLienInKindColumn<C extends string>(columns: C): `${C}, ${typeof LIEN_IN_KIND_COLUMN}` {
  return `${columns}, ${LIEN_IN_KIND_COLUMN}`
}

/**
 * The jobs a desk read drops right after its jobs join, before any list is built: the ZZ test jobs when they
 * are hidden (the caller's set, null when shown) and every job an open in-kind deal pays. Null when there is
 * nothing to drop, so the read keeps its lists as they came.
 */
export function lienJobIdsOffDesk(jobs: ReadonlyArray<InKindLinked & { id: string }>, zzJobIds: ReadonlySet<string> | null): Set<string> | null {
  const inKind = lienInKindJobIds(jobs)
  if (inKind.size === 0) return zzJobIds ? new Set(zzJobIds) : null
  for (const id of zzJobIds ?? []) inKind.add(id)
  return inKind
}

/** What the job's own Lien window says on a job the desk leaves off. The window stays whole under it. */
export const LIEN_IN_KIND_WINDOW_NOTE = {
  head: 'Paid in kind',
  line: 'An in-kind deal pays this job, so it is off the Lien desk while the deal is open. Nobody is reminded of its lien dates there. They still run, and every paper still drafts here.',
} as const

/** The note for a job, or null when the desk still watches it. */
export function lienInKindWindowNote(job: InKindLinked | null | undefined): typeof LIEN_IN_KIND_WINDOW_NOTE | null {
  return jobOffLienDeskInKind(job) ? LIEN_IN_KIND_WINDOW_NOTE : null
}
