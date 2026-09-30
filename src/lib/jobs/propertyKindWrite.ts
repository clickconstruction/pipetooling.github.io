import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { propertyKindPatch, type PropertyKind } from './propertyKind'
import { planPropertyLink } from './propertyLinkPlan'
import type { CustomerAddressRow } from './lienProperty'

/**
 * Save a property's kind on the customer's saved property — the one field the
 * property sheet, Edit Job's Property record row and the lien screens all read
 * (v2.3667). Every job linked to the row follows it.
 */
export async function savePropertyKind(customerAddressId: string, kind: PropertyKind): Promise<void> {
  const patch = { ...propertyKindPatch(kind), updated_at: new Date().toISOString() }
  await withSupabaseRetry(async () => await supabase.from('customer_addresses').update(patch as never).eq('id', customerAddressId), 'save property kind')
}

/** The Homestead tick beside a residential kind. */
export async function savePropertyHomestead(customerAddressId: string, homestead: boolean): Promise<void> {
  await withSupabaseRetry(async () => await supabase.from('customer_addresses').update({ homestead, updated_at: new Date().toISOString() } as never).eq('id', customerAddressId), 'save homestead')
}

/**
 * A property-kind pick on a job with NO linked property (v2.4212): reuse the
 * customer's property the job address matches, else save the address as a new
 * one — with the kind on it either way — then link the job to that property.
 * Returns the property's id so the board can remember the link at once.
 */
export async function linkJobPropertyAndSaveKind(input: { jobId: string; customerId: string; jobAddress: string; kind: Exclude<PropertyKind, ''> }): Promise<{ customerAddressId: string; reused: boolean }> {
  const existing = await withSupabaseRetry(
    async () => await supabase.from('customer_addresses').select('*').eq('customer_id', input.customerId),
    'load customer properties',
  )
  const plan = planPropertyLink(input, (existing ?? []) as CustomerAddressRow[])
  let customerAddressId: string
  if (plan.action === 'link') {
    customerAddressId = plan.customerAddressId
    await withSupabaseRetry(async () => await supabase.from('customer_addresses').update({ ...plan.patch, updated_at: new Date().toISOString() } as never).eq('id', customerAddressId), 'save property kind')
  } else {
    const created = await withSupabaseRetry(
      async () => await supabase.from('customer_addresses').insert(plan.row as never).select('id').single(),
      'save the job address as a property',
    )
    const id = (created as { id: string } | null)?.id
    if (!id) throw new Error('the new property row came back without an id')
    customerAddressId = id
  }
  await withSupabaseRetry(async () => await supabase.from('jobs_ledger').update({ customer_address_id: customerAddressId } as never).eq('id', input.jobId), 'link job to property')
  return { customerAddressId, reused: plan.action === 'link' }
}
