/**
 * GC mode, the real build, Owner Billing's O3: a change order to the customer as its row holds it
 * (`gc_change_orders`, migration 20261008010000), read back as the prototype's `ChangeOrder`, so the
 * kernels in ./ownerBilling.ts and the schedule's change-order days read it unchanged.
 */
import type { Database } from '../../types/database'
import type { ChangeOrder, ChangeOrderReason, GcState } from './types'

export type ChangeOrderRow = Database['public']['Tables']['gc_change_orders']['Row']

const REASONS: readonly ChangeOrderReason[] = ['owner', 'field', 'plans']
const STATUSES: readonly ChangeOrder['status'][] = ['draft', 'sent', 'signed', 'declined']

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A change order's ${what} reads "${value}", which the app does not know.`)
}

/** One row as the kernels read it. A time extension names its moves (`daysOnChart`); an ordinary one has none. */
export function changeOrderFromRow(row: ChangeOrderRow): ChangeOrder {
  return {
    id: row.id,
    number: row.number,
    description: row.description,
    reason: known(row.reason, REASONS, 'reason'),
    schedule: row.schedule_words,
    packageId: row.package_id,
    cost: Number(row.cost),
    price: Number(row.price),
    status: known(row.status, STATUSES, 'status'),
    sentOn: row.sent_on,
    answeredOn: row.answered_on,
    pctDone: Number(row.pct_done),
    days: row.days,
    ...(row.days_on_chart ? { daysOnChart: row.days_on_chart } : {}),
  }
}

/** A project's change orders as the kernels read them, oldest first by number. */
export function changeOrdersFromRows(rows: ChangeOrderRow[]): ChangeOrder[] {
  return [...rows].sort((a, b) => a.number - b.number).map(changeOrderFromRow)
}

/** A new change order as the draft function takes it (the prototype's draftChangeOrder action). */
export interface ChangeOrderDraft {
  description: string
  reason: ChangeOrderReason
  /** Plain words for the schedule; empty: the database words it from the days. */
  schedule: string
  /** The trade the work belongs to. Null: our own work. */
  packageId: string | null
  cost: number
  price: number
  days: number
}

/** The board's projects with their change orders laid over them (`boardProjectFromView` maps the rest). */
export function withChangeOrders(state: GcState, rows: ChangeOrderRow[]): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({ ...project, changeOrders: changeOrdersFromRows(rows.filter((row) => row.project_id === project.id)) })),
  }
}
