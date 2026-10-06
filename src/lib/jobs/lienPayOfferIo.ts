import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienOfferPatch, type LienPayOffer } from './lienPayOffer'

/**
 * The pay offer's one write on the desk (v2.4700): the leader's choice on the notice being
 * approved. The guard trigger refuses anyone but a master or dev and stamps who and when;
 * clearing the offer clears the stamp. The money side (the Stripe credit on each bill) is the
 * `lien-pay-offer` function's, called when the run is recorded.
 */
export async function setLienDeskItemOffer(itemId: string, offer: LienPayOffer | null): Promise<void> {
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update(lienOfferPatch(offer) as never).eq('id', itemId), 'lien desk: the pay offer')
}
