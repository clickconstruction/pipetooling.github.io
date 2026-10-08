/**
 * GC mode, the real build, Owner Billing's O4a: what Bill the customer reads and sends. The board maps the
 * project (`boardProjectFromView`) and O3-ui lays its change orders over it. Here the rest of billing goes on:
 * - the price as signed, by line (O1's `gc_owner_contract_lines`);
 * - the job's retainage and its step (decision 6: the job's, not the customer's);
 * - the property's owner by name;
 * - our bills to the customer as they went (O5a's `ownerBillingFromRows`).
 * Then `payAppSendPayload` is what Send hands `gc_send_owner_pay_app`: `ownerPayAppToSend`'s record, with the
 * lines as the window drew them. Pure: the reads and the writes are `gcIo.ts`'s.
 */
import { type OwnerLineKind, type OwnerPayApp, ownerPayAppToSend } from './ownerBilling'
import { type OwnerBillingRows, ownerBillingFromRows } from './ownerBillingRows'
import type { GcState, OwnerRetainageStep } from './types'

/** The project's terms with the customer: O1's columns on `gc_projects`. */
export interface OwnerTermsRow {
  project_id: string
  owner_retainage_pct: number
  owner_retainage_step_at_pct: number | null
  owner_retainage_step_to_pct: number | null
  owner_retainage_step_way: string | null
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

/**
 * The state Bill the customer reads for one project: the board's, with that project's billing laid on. The
 * kernels read retainage and the days to pay off the customer, so the project's customer reads the job's
 * here. `names` holds the customers by id, for the property's owner.
 */
export function billingStateFor(
  state: GcState,
  projectId: string,
  terms: OwnerTermsRow | undefined,
  contract: ContractLineRow[],
  billing: OwnerBillingRows | undefined,
  names: Record<string, string>,
): GcState {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return state
  const worth = contractWorthFromRows(contract.filter((l) => l.project_id === projectId))
  const step = terms ? retainageStepFromTerms(terms) : undefined
  const propertyOwner = terms?.property_owner_customer_id ? names[terms.property_owner_customer_id] : undefined
  const ownerBilling = billing ? ownerBillingFromRows(billing) : null
  return {
    ...state,
    customers: state.customers.map((c) =>
      c.id === project.customerId && terms ? { ...c, retainagePct: Number(terms.owner_retainage_pct), payDays: terms.owner_pay_days ?? c.payDays } : c,
    ),
    projects: state.projects.map((p) =>
      p.id !== projectId
        ? p
        : {
            ...p,
            ...(worth ? { ownerContractWorth: worth } : {}),
            ...(step ? { ownerRetainageStep: step } : {}),
            ...(propertyOwner && propertyOwner !== p.owner ? { propertyOwner } : {}),
            ownerBilling,
          },
    ),
  }
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
