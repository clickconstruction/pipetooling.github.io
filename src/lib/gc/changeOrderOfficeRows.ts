/**
 * GC mode, the real build, the schedule's PR 16b-ii: a change order's non-money half as the office reads it, through
 * the view `gc_change_orders_office` (migration 20261010081000), laid over the board for the schedule's readers: a
 * change order's days on the chart (G-76), the late-finish line (G-98) and Ask for the days (G-141). The view never
 * carries cost, price or pct_done. A row here becomes the kernels' `ChangeOrder` with its money hidden at 0, which no
 * schedule reader reads (to-dos/gc-mode/mockups/schedule-pr16.md on branch spike/gc-mode, call 4). The money team's
 * own lines read the full table into a state of their own (16c), so a hidden 0 never reaches a money line.
 */
import type { ChangeOrder, ChangeOrderReason, GcState } from './types'

/**
 * One row of the view, typed here until gc 7's regen after 20261010081000's push puts the view in `database.ts`; then
 * it becomes `Database['public']['Views']['gc_change_orders_office']['Row']`. Every column is nullable, as the
 * generated type of a view's is. Its keys are the view's twelve, never cost, price or pct_done (the test holds it).
 */
export interface ChangeOrderOfficeRow {
  id: string | null
  project_id: string | null
  number: number | null
  description: string | null
  reason: string | null
  schedule_words: string | null
  package_id: string | null
  status: string | null
  sent_on: string | null
  answered_on: string | null
  days: number | null
  days_on_chart: string[] | null
}

/** The columns the io reads: the view's twelve, never a money one. */
export const CHANGE_ORDER_OFFICE_COLUMNS = 'id, project_id, number, description, reason, schedule_words, package_id, status, sent_on, answered_on, days, days_on_chart'

const REASONS: readonly ChangeOrderReason[] = ['owner', 'field', 'plans']
const STATUSES: readonly ChangeOrder['status'][] = ['draft', 'sent', 'signed', 'declined']

function known<T extends string>(value: string | null, allowed: readonly T[], what: string): T {
  if (value !== null && (allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A change order's ${what} reads "${value ?? ''}", which the app does not know.`)
}

/** One row as the schedule's kernels read it, its money hidden (call 4). Null: a row with no id or number. */
export function changeOrderFromOfficeRow(row: ChangeOrderOfficeRow): ChangeOrder | null {
  if (row.id === null || row.number === null) return null
  return {
    id: row.id,
    number: row.number,
    description: row.description ?? '',
    reason: known(row.reason, REASONS, 'reason'),
    schedule: row.schedule_words ?? '',
    packageId: row.package_id,
    // The view carries none of the three: hidden at 0, read by no schedule reader.
    cost: 0,
    price: 0,
    pctDone: 0,
    status: known(row.status, STATUSES, 'status'),
    sentOn: row.sent_on,
    answeredOn: row.answered_on,
    ...(row.days !== null ? { days: row.days } : {}),
    ...(row.days_on_chart ? { daysOnChart: row.days_on_chart } : {}),
  }
}

/** The board's projects with their change orders' non-money half laid over them, oldest first by number. */
export function withOfficeChangeOrders(state: GcState, rows: readonly ChangeOrderOfficeRow[]): GcState {
  const orders = rows.flatMap((row) => {
    const order = changeOrderFromOfficeRow(row)
    return order && row.project_id ? [{ projectId: row.project_id, order }] : []
  })
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      changeOrders: orders
        .filter((o) => o.projectId === project.id)
        .map((o) => o.order)
        .sort((a, b) => a.number - b.number),
    })),
  }
}
