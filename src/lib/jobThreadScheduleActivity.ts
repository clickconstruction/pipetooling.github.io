import type { JobScheduleBlockWithAssigneeName } from './jobScheduleBlocks'

/** Dispatch schedule row merged into Job activity / notes (read-only). */
export type JobScheduleBlockActivityRow = {
  /** Stable React key fragment: `sb-group:${uuid}` or `sb-solo:${blockId}` */
  dedupeKey: string
  /** ISO timestamp for timeline sort (`updated_at` fallback `created_at`). */
  sortAt: string
  work_date: string
  time_start: string
  time_end: string
  note: string
  assigneeLabels: string
}

export type JobThreadScheduleActivityItem = {
  kind: 'schedule_block'
  schedule: JobScheduleBlockActivityRow
}

function sortAtFromBlock(row: JobScheduleBlockWithAssigneeName): string {
  const u = row.updated_at?.trim()
  const c = row.created_at?.trim()
  return u || c || new Date(0).toISOString()
}

function assigneeLabel(row: JobScheduleBlockWithAssigneeName): string {
  const n = row.users?.name?.trim()
  if (n) return n
  return row.assignee_user_id?.trim() || 'Unknown'
}

/** Rows with non-empty trimmed schedule note. */
export function blocksWithNotesFromFetch(rows: JobScheduleBlockWithAssigneeName[]): JobScheduleBlockWithAssigneeName[] {
  return rows.filter((r) => (r.note ?? '').trim().length > 0)
}

/**
 * One timeline row per linked group (shared_block_group_id); solo rows unchanged.
 */
export function scheduleBlocksToScheduleActivityItems(
  rows: JobScheduleBlockWithAssigneeName[],
): JobThreadScheduleActivityItem[] {
  const withNotes = blocksWithNotesFromFetch(rows)
  const linkedByGroup = new Map<string, JobScheduleBlockWithAssigneeName[]>()
  const solo: JobScheduleBlockWithAssigneeName[] = []

  for (const r of withNotes) {
    const gid = r.shared_block_group_id?.trim()
    if (gid) {
      const arr = linkedByGroup.get(gid) ?? []
      arr.push(r)
      linkedByGroup.set(gid, arr)
    } else {
      solo.push(r)
    }
  }

  const linkedItems: JobThreadScheduleActivityItem[] = [...linkedByGroup.entries()].map(([gid, legs]) => {
    const sortedLegs = [...legs].sort((a, b) => assigneeLabel(a).localeCompare(assigneeLabel(b)))
    const head = sortedLegs[0]
    if (!head) {
      throw new Error(`linked schedule group "${gid}" has no legs`)
    }
    const names = [...new Set(sortedLegs.map(assigneeLabel))].sort((a, b) => a.localeCompare(b))
    let maxTs = 0
    let sortAtIso = sortAtFromBlock(head)
    for (const leg of sortedLegs) {
      const t = new Date(sortAtFromBlock(leg)).getTime()
      if (Number.isFinite(t) && t >= maxTs) {
        maxTs = t
        sortAtIso = sortAtFromBlock(leg)
      }
    }
    const canonical = [...sortedLegs].sort((a, b) => a.id.localeCompare(b.id))[0]
    if (!canonical) {
      throw new Error(`linked schedule group "${gid}" canonical missing`)
    }
    const note = (canonical.note ?? '').trim()
    return {
      kind: 'schedule_block' as const,
      schedule: {
        dedupeKey: `sb-group:${gid}`,
        sortAt: sortAtIso,
        work_date: canonical.work_date,
        time_start: canonical.time_start,
        time_end: canonical.time_end,
        note,
        assigneeLabels: names.join(', '),
      },
    }
  })

  const soloItems: JobThreadScheduleActivityItem[] = solo.map((r) => ({
    kind: 'schedule_block' as const,
    schedule: {
      dedupeKey: `sb-solo:${r.id}`,
      sortAt: sortAtFromBlock(r),
      work_date: r.work_date,
      time_start: r.time_start,
      time_end: r.time_end,
      note: (r.note ?? '').trim(),
      assigneeLabels: assigneeLabel(r),
    },
  }))

  return [...linkedItems, ...soloItems]
}
