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
 * The eye chip on a bill row (Edit Job → Bill): who else sees it. Null when
 * nobody does — the row wears no chip rather than a "—" that invites a click.
 */
export function shownToChipText(shownTo: ShownToParty | null, names: { customer: string | null; gc: string | null }): string | null {
  if (!shownTo) return null
  const name = shownTo === 'gc' ? names.gc : names.customer
  return `👁 shown to ${(name ?? '').trim() || (shownTo === 'gc' ? 'the GC' : 'the customer')}`
}
