/**
 * GC mode, the real build, Owner Billing's O3: a change order to the customer as its row holds it
 * (`gc_change_orders`, migration 20261008010000), read back as the prototype's `ChangeOrder`, so the
 * kernels in ./ownerBilling.ts and the schedule's change-order days read it unchanged.
 */
import type { Database } from '../../types/database'
import { changeRequestFromRow } from './tradePortalState'
import type { ChangeOrder, ChangeOrderReason, GcState } from './types'

export type ChangeOrderRow = Database['public']['Tables']['gc_change_orders']['Row']

const REASONS: readonly ChangeOrderReason[] = ['owner', 'field', 'plans']
const STATUSES: readonly ChangeOrder['status'][] = ['draft', 'sent', 'signed', 'declined']

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A change order's ${what} reads "${value}", which the app does not know.`)
}

/** The customer's reason for declining (O7c), read loosely until the types regenerate after 20261009235000's push. */
function declinedNoteOf(row: ChangeOrderRow): string {
  return ((row as ChangeOrderRow & { declined_note?: string | null }).declined_note ?? '').trim()
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
    ...(row.answered_how === 'portal' ? { answeredInPortal: true } : {}),
    ...(declinedNoteOf(row) ? { declinedNote: declinedNoteOf(row) } : {}),
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

/** A trade's ask for a change as its row holds it (`gc_trade_change_requests`, the Portal's P4a, migration 20261010006000). */
export type ChangeRequestRow = Database['public']['Tables']['gc_trade_change_requests']['Row']

/**
 * A change order made of a trade's ask, as `gc_draft_change_order_from_request` takes it (O3b): the words, cost, price and
 * days the office confirmed. The trade and the reason are the ask's own.
 */
export type ChangeRequestDraft = Pick<ChangeOrderDraft, 'description' | 'cost' | 'price' | 'days'>

/**
 * The board's projects with the trades' asks for a change laid over them (O3b), oldest first, each mapped by the portal's
 * own `changeRequestFromRow`.
 */
export function withChangeRequests(state: GcState, rows: ChangeRequestRow[]): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      changeRequests: rows
        .filter((row) => row.project_id === project.id)
        .sort((a, b) => a.asked_on.localeCompare(b.asked_on) || a.created_at.localeCompare(b.created_at))
        .map(changeRequestFromRow),
    })),
  }
}
