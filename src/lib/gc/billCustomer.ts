/**
 * GC mode, the real build, Owner Billing: the state our money screens read. The board maps each project
 * (`boardProjectFromView`) and O3-ui lays its change orders over it. Here the rest of billing goes on:
 * - the price as signed, by line (O1's `gc_owner_contract_lines`);
 * - the job's retainage and its step (decision 6: the job's, not the customer's);
 * - the property's owner by name;
 * - our bills to the customer as they went (O5a's `ownerBillingFromRows`);
 * - the customer's usual days to pay, from the app's own pay speeds (decision 7's "expected").
 * The kernels read retainage and the days to pay off the customer, so each job laid here reads its own
 * copy of its customer with the job's numbers. Pure: the reads are `gcIo.ts`'s.
 */
import { type OwnerLineKind, type OwnerPayApp, ownerPayAppToSend } from './ownerBilling'
import { type OwnerBillingRows, ownerBillingFromRows } from './ownerBillingRows'
import type { GcCustomer, GcState, OwnerRetainageStep } from './types'

/** The project's terms with the customer: O1's columns on `gc_projects`. */
export interface OwnerTermsRow {
  project_id: string
  owner_retainage_pct: number
  owner_retainage_step_at_pct: number | null
  owner_retainage_step_to_pct: number | null
  owner_retainage_step_way: string | null
  /** The contract's days to pay after the certificate (decision 7): when a bill falls due, read by O6b's interest. */
  owner_pay_days: number | null
  billing_job_id: string | null
  property_owner_customer_id: string | null
}

/** One line of the price as signed. */
export interface ContractLineRow {
  project_id: string
  line: string
  package_id: string | null
  worth: number
}

/** Everything billing reads beside the board, for the jobs it lays. */
export interface BillingRows {
  terms: OwnerTermsRow[]
  contract: ContractLineRow[]
  /** Our bills to the customer as they went, by project id. */
  billing: Map<string, OwnerBillingRows>
  /** Customers' names by id, for the property's owner. */
  names: Record<string, string>
  /** Each customer's usual days to pay, by customer id: their own median, absent when they never paid us. */
  payDays: Record<string, number>
}

/** The price as signed, keyed the kernels' way: each trade by its package, then gc, contingency and fee. Undefined: not signed. */
export function contractWorthFromRows(lines: ContractLineRow[]): Record<string, number> | undefined {
  if (lines.length === 0) return undefined
  return Object.fromEntries(lines.map((l) => [l.line === 'trade' ? (l.package_id ?? '') : l.line, Number(l.worth)]))
}

/** The job's retainage step, when all three columns are set. */
export function retainageStepFromTerms(terms: Pick<OwnerTermsRow, 'owner_retainage_step_at_pct' | 'owner_retainage_step_to_pct' | 'owner_retainage_step_way'>): OwnerRetainageStep | undefined {
  const { owner_retainage_step_at_pct: at, owner_retainage_step_to_pct: to, owner_retainage_step_way: way } = terms
  if (at === null || to === null || (way !== 'after' && way !== 'all')) return undefined
  return { atPct: Number(at), toPct: Number(to), way }
}

/** The id of a job's own copy of its customer. */
export function jobCustomerId(customerId: string, projectId: string): string {
  return `${customerId}@${projectId}`
}

/**
 * The board's state with billing laid on the given jobs (every job with terms when none are named). Each
 * laid job reads its own copy of its customer, carrying the job's retainage and the customer's usual days
 * to pay. Every other project is the board's as it was.
 */
export function billingStateForAll(state: GcState, rows: BillingRows, projectIds?: readonly string[]): GcState {
  const ids = new Set(projectIds ?? rows.terms.map((t) => t.project_id))
  const copies: GcCustomer[] = []
  const projects = state.projects.map((p) => {
    if (!ids.has(p.id)) return p
    const terms = rows.terms.find((t) => t.project_id === p.id)
    const worth = contractWorthFromRows(rows.contract.filter((l) => l.project_id === p.id))
    const step = terms ? retainageStepFromTerms(terms) : undefined
    const propertyOwner = terms?.property_owner_customer_id ? rows.names[terms.property_owner_customer_id] : undefined
    const billing = rows.billing.get(p.id)
    const customer = state.customers.find((c) => c.id === p.customerId)
    const own = customer ? { ...customer, id: jobCustomerId(customer.id, p.id), retainagePct: terms ? Number(terms.owner_retainage_pct) : customer.retainagePct, payDays: rows.payDays[customer.id] ?? null } : null
    if (own) copies.push(own)
    return {
      ...p,
      ...(own ? { customerId: own.id } : {}),
      ...(worth ? { ownerContractWorth: worth } : {}),
      ...(step ? { ownerRetainageStep: step } : {}),
      ...(propertyOwner && propertyOwner !== p.owner ? { propertyOwner } : {}),
      ownerBilling: billing ? ownerBillingFromRows(billing) : null,
    }
  })
  return { ...state, customers: [...state.customers, ...copies], projects }
}

/** The same for one job: what Bill the customer reads. */
export function billingStateFor(state: GcState, projectId: string, rows: BillingRows): GcState {
  return billingStateForAll(state, rows, [projectId])
}

/** A line's kind as `gc_owner_pay_app_lines.line` keeps it. */
export const PAY_APP_LINE_OF: Record<OwnerLineKind, 'trade' | 'self' | 'gc' | 'contingency' | 'fee' | 'change_order'> = {
  trade: 'trade',
  self: 'self',
  generalConditions: 'gc',
  contingency: 'contingency',
  fee: 'fee',
  changeOrder: 'change_order',
}

/** What Send hands `gc_send_owner_pay_app`. */
export interface PayAppSend {
  number: number
  final: boolean
  periodTo: string
  sentOn: string
  retainagePct: number
  retainageStep: OwnerRetainageStep | null
  retainage: number
  workToDate: number
  due: number
  lines: { line: (typeof PAY_APP_LINE_OF)[OwnerLineKind]; packageId: string | null; changeOrderId: string | null; label: string; worth: number; doneToDate: number; stored: number }[]
}

/**
 * The draft as it goes today: `ownerPayAppToSend`'s record, with each line's kind, key and name as the window
 * drew it. The server checks the work so far against the lines, so both come from the one draft.
 */
export function payAppSendPayload(app: OwnerPayApp, today: string): PayAppSend {
  const record = ownerPayAppToSend(app, today)
  return {
    number: record.number,
    final: false,
    periodTo: record.periodTo,
    sentOn: record.sentOn,
    retainagePct: record.retainagePct,
    retainageStep: record.retainageStep ?? null,
    retainage: record.retainage,
    workToDate: record.workToDate,
    due: record.due,
    lines: app.lines.map((l) => {
      const line = PAY_APP_LINE_OF[l.kind]
      return {
        line,
        packageId: line === 'trade' || line === 'self' ? l.id : null,
        changeOrderId: line === 'change_order' ? (l.changeOrderId ?? l.id) : null,
        label: l.label,
        worth: l.worth,
        doneToDate: l.doneToDate,
        stored: l.stored ?? 0,
      }
    }),
  }
}
