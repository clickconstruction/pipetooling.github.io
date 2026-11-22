/**
 * State roll, the Our own view (punch list #411): the reads and the one write. `person_licenses` and a person's own
 * `people.license` for what we hold, `license_roll` for the state's rows marked as ours, and `person_licenses` again
 * for a date taken from the state. The roll rows read here are our own people's and nobody else's.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { notifyDispatchLicenseExpiry } from '../people/licenseExpiryNotify'
import type { OwnRecord, OwnStateRow } from './ownLicenses'

export type OwnLicensesRead = { records: OwnRecord[]; roll: OwnStateRow[] }

function failed(error: unknown, what: string): never {
  throw new Error(`Could not ${what}: ${formatErrorMessage(error)}`)
}

/** Everything the Our own view draws, in one go. Our own rows on the roll are a few dozen at most. */
export async function readOwnLicenses(): Promise<OwnLicensesRead> {
  const [licenses, people, roll] = await Promise.all([
    supabase.from('person_licenses').select('id, person_name, license_type, date_of_expiry').order('person_name'),
    supabase.from('people').select('id, name, kind, license').not('license', 'is', null).neq('license', '').is('archived_at', null).order('name'),
    supabase
      .from('license_roll')
      .select('id, license_class, license_number, status, expires_on, last_name, first_name, county, insurance_ends_on, gone_on')
      .eq('ours', true)
      .limit(1000),
  ])
  if (licenses.error) failed(licenses.error, 'read our licenses')
  if (people.error) failed(people.error, 'read the licenses on our people’s records')
  if (roll.error) failed(roll.error, 'read the state roll')
  const records: OwnRecord[] = [
    ...((licenses.data ?? []) as { id: string; person_name: string; license_type: string; date_of_expiry: string | null }[]).map((l) => ({
      key: `pl:${l.id}`,
      licenseId: l.id,
      personName: l.person_name,
      text: l.license_type,
      expiryYmd: l.date_of_expiry,
      sub: false,
    })),
    ...((people.data ?? []) as { id: string; name: string; kind: string; license: string | null }[]).map((p) => ({
      key: `p:${p.id}`,
      licenseId: null,
      personName: p.name,
      text: p.license ?? '',
      expiryYmd: null,
      sub: p.kind === 'sub',
    })),
  ]
  return { records, roll: (roll.data ?? []) as OwnStateRow[] }
}

/**
 * Save a license's date on People → Licenses, where the date lives. Throws with the reason when it is refused.
 * Answers a warning when the date is saved and the note to Dispatch could not go.
 */
export async function saveOwnLicenseDate(licenseId: string, ymd: string): Promise<string | null> {
  const { data, error } = await supabase.from('person_licenses').update({ date_of_expiry: ymd }).eq('id', licenseId).select('id')
  if (error) failed(error, 'save the date')
  // A row the database hides from this person is changed by nobody, and it says so with no error.
  if (!data || data.length === 0) throw new Error('The date was not saved. The license is gone, or it is not yours to change.')
  return notifyDispatchLicenseExpiry(licenseId)
}
