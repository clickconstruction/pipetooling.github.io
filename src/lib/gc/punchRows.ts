/**
 * GC mode, the real build, the Building lane's U6d: the punch list as its rows hold it (`gc_punch_items`, U1's table),
 * read back into each project's `punch`, so the kernels in ./buildingPunch.ts read it unchanged. The Closeout window
 * reads it to hold Accept the work, as `gc_accept_work` does, and the Punch list window lays it under its presses (U3b-ii).
 * An item taken off (`removed_at`, U3b-i) is kept in the table and read by no one. The plans:
 * to-dos/gc-mode/mockups/building-u6.md and building-u3b.md on branch spike/gc-mode.
 */
import type { Database } from '../../types/database'
import type { GcProject, GcState, PunchItem, TradePackage } from './types'

type PunchTableRow = Database['public']['Tables']['gc_punch_items']['Row']

/**
 * May we add to this trade's list, as `gc_add_punch_item` holds: a job we are building, a trade we hired with a signed
 * statement of work, its work not accepted.
 */
export function punchCanAdd(project: GcProject, pkg: TradePackage): boolean {
  return project.stage === 'building' && !project.closedOn && !pkg.selfPerform && pkg.sow?.status === 'signed' && !pkg.sow.acceptedOn
}

/** The columns `loadGcPunch` reads. */
export type PunchRow = Pick<
  PunchTableRow,
  'id' | 'project_id' | 'package_id' | 'position' | 'text' | 'where_on' | 'added_on' | 'fixed_on' | 'checked_on' | 'sent_back_times' | 'sent_back_note' | 'sent_back_on' | 'removed_at'
>

export const PUNCH_COLUMNS = 'id, project_id, package_id, position, text, where_on, added_on, fixed_on, checked_on, sent_back_times, sent_back_note, sent_back_on, removed_at'

/** One item as the kernels read it. The send-back's three columns go together (the table's check). */
export function punchItemOf(row: PunchRow): PunchItem {
  return {
    id: row.id,
    packageId: row.package_id,
    text: row.text,
    ...(row.where_on ? { where: row.where_on } : {}),
    addedOn: row.added_on,
    fixedOn: row.fixed_on,
    checkedOn: row.checked_on,
    ...(row.sent_back_times > 0 ? { sentBack: { times: row.sent_back_times, note: row.sent_back_note ?? '', on: row.sent_back_on ?? '' } } : {}),
  }
}

/**
 * Each project's punch list laid over the board's, in the order the items were added, an item taken off left out. A project
 * with no rows keeps its own.
 */
export function withPunch(state: GcState, rows: PunchRow[]): GcState {
  if (rows.length === 0) return state
  const byProject = new Map<string, PunchRow[]>()
  for (const r of rows) if (!r.removed_at) byProject.set(r.project_id, [...(byProject.get(r.project_id) ?? []), r])
  return {
    ...state,
    projects: state.projects.map((p) => {
      const mine = byProject.get(p.id)
      if (!mine) return p
      const punch = [...mine].sort((a, b) => a.position - b.position || a.added_on.localeCompare(b.added_on)).map(punchItemOf)
      return { ...p, punch }
    }),
  }
}
