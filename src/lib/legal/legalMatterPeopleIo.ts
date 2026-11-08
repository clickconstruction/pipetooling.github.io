/**
 * The people on a legal matter, read for a letter (punch list #174, v2.6705): the demand letter on the Lien desk opens
 * on a job, not a matter, so it finds the payer's matter by its key (`payerForJob`) and reads the live people. Nothing
 * when the account has no matter yet, or the caller cannot read the legal tables.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { peopleFromRows, type LegalMatterPersonLike, type LegalMatterPersonRow } from './legalMatterPeople'

export const MATTER_PEOPLE_SELECT = 'id, name, role, organization, email, phone, mailing_address, use, reason, seeded_from, added_at'

export async function loadMatterPeopleForPayer(db: SupabaseClient, payerKey: string): Promise<{ matterId: string; people: LegalMatterPersonLike[] } | null> {
  const matter = await withSupabaseRetry<{ id: string } | null>(
    () => db.from('legal_matters').select('id').eq('payer_key', payerKey).is('closed_at', null).maybeSingle(),
    'find the matter for the letter',
  )
  if (!matter?.id) return null
  const rows =
    (await withSupabaseRetry<LegalMatterPersonRow[]>(
      () => db.from('legal_matter_people').select(MATTER_PEOPLE_SELECT).eq('matter_id', matter.id).is('removed_at', null).order('added_at').limit(200),
      'load the people on the matter',
    )) ?? []
  return { matterId: matter.id, people: peopleFromRows(rows) }
}
