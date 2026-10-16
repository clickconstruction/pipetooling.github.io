/**
 * The ZZ rule for prospects (v2.5583, punch list #113): a company named `ZZ…` is a dev's test row,
 * as a ZZ job is (GLOSSARY → ZZ convention, `isZzTestName`). Jobs have hidden theirs from every
 * role but dev since v2.5116; the walk of 2026-10-16 left a ZZ sub on the Subs strip and in the
 * office's queue until it was deleted by hand. A view rule, not RLS: a dev sees them while their
 * per-device switch shows them (`useZzTestJobsHidden`).
 */
import { isZzTestName } from '../jobs/zzTestJobSweep'

export function isZzTestProspect(p: { company_name: string | null }): boolean {
  return isZzTestName(p.company_name)
}

/** The rows without the ZZ ones when `hidden`; the same array when not. */
export function withoutZzProspects<T extends { company_name: string | null }>(rows: readonly T[], hidden: boolean): T[] {
  if (!hidden) return rows as T[]
  return rows.filter((r) => !isZzTestProspect(r))
}
