import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { propertyKindPatch, type PropertyKind } from './propertyKind'

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
