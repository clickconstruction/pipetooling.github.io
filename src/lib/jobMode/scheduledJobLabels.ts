import type { JobModeScheduleBlock } from '../jobModePickCurrentNext'

/**
 * Job Mode's scheduled visits read their job through an embed on `job_schedule_blocks`, which runs
 * under the reader's own policies on `jobs_ledger`. A superintendent has no read policy of their own
 * there: a job opens to them only once they clock onto it. So the first visit on a new job came back
 * with no number, no name and no address, and the card drew "J— · —" with nowhere to drive (seen
 * 2026-11-08; a superintendent had three such visits in October). The Dashboard already holds the jobs the
 * person may see through definer reads (their team's jobs, the ready-to-bill ones, a superintendent's
 * project jobs), each with the same label fields. A visit whose job read came back empty takes them
 * from there. A field the visit's own read did fill is never replaced.
 */
export type ScheduledJobLabelSource = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  service_type_id?: string | null
}

const blank = (v: string | null | undefined): boolean => (v ?? '').trim() === ''

/** True when the visit's own job read gave nothing to draw: no number, no name, no address. */
export function scheduledJobReadCameBackEmpty(b: Pick<JobModeScheduleBlock, 'hcp_number' | 'click_number' | 'job_name' | 'job_address'>): boolean {
  return blank(b.hcp_number) && blank(b.click_number) && blank(b.job_name) && blank(b.job_address)
}

/**
 * The visits with their job's labels filled from the known jobs where their own read came back
 * empty. Hands back the same array when nothing changed, so a memo downstream holds.
 */
export function fillScheduledJobLabels<B extends JobModeScheduleBlock>(blocks: readonly B[], known: readonly ScheduledJobLabelSource[] | null | undefined): readonly B[] {
  if (!known || known.length === 0 || blocks.length === 0) return blocks
  const byId = new Map<string, ScheduledJobLabelSource>()
  for (const j of known) if (j?.id && !byId.has(j.id)) byId.set(j.id, j)
  let changed = false
  const out = blocks.map((b) => {
    if (!scheduledJobReadCameBackEmpty(b)) return b
    const j = byId.get(b.job_id)
    if (!j) return b
    changed = true
    return {
      ...b,
      hcp_number: j.hcp_number ?? null,
      click_number: j.click_number ?? null,
      job_name: j.job_name ?? null,
      job_address: j.job_address ?? null,
      service_type_id: b.service_type_id ?? j.service_type_id ?? null,
    }
  })
  return changed ? out : blocks
}
