/**
 * Share this bill (v2.3375) — client kernel. The rule lives in the shared
 * Deno module so the customer-portal edge function and the UI can never
 * disagree; this file re-exports it and adds the office-side wording.
 */
import type { ShownToParty } from '../../../supabase/functions/_shared/billVisibility'

export {
  defaultShowOtherParty,
  otherPartyOf,
  parseShownToParty,
  shownToPartyFor,
  statementRoleFor,
} from '../../../supabase/functions/_shared/billVisibility'
export type {
  InvoiceVisibilityFields,
  JobVisibilityFields,
  ShownToParty,
  StatementRole,
} from '../../../supabase/functions/_shared/billVisibility'

/**
 * Share this bill (v2.3377): a GC whose card says "sees their customers'
 * bills by default" starts a fresh job's memory on. Mirrors
 * `shouldDefaultBillsToGc`: judged once per GC pick, only when the GC is not
 * the job's customer row, and never over a memory already switched on.
 */
export function shouldDefaultShowOtherParty(args: {
  gc: { id: string; sees_customer_bills?: boolean | null } | null | undefined
  customerId: string | null
  current: boolean
}): boolean {
  const gc = args.gc
  if (!gc || gc.sees_customer_bills !== true) return false
  if (args.customerId && gc.id === args.customerId) return false
  return args.current === false
}

/**
 * The eye chip on a bill row (Edit Job → Bill): who else sees it. Null when
 * nobody does — the row wears no chip rather than a "—" that invites a click.
 */
export function shownToChipText(shownTo: ShownToParty | null, names: { customer: string | null; gc: string | null }): string | null {
  if (!shownTo) return null
  const name = shownTo === 'gc' ? names.gc : names.customer
  return `👁 shown to ${(name ?? '').trim() || (shownTo === 'gc' ? 'the GC' : 'the customer')}`
}
