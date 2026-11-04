/**
 * Saving a license from the logbook (punch list #255): the same row and the same Dispatch notice as
 * People → Licenses' Save. RLS on person_licenses lets the Licenses tab's audience write (dev,
 * assistant, pay-approved master and their assistants).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { TDLR_TIMEOUT_MS, TDLR_TIMEOUT_REASON, isTimeoutError, tdlrQueryUrl, type TdlrRow } from './licenseText'

export type LicenseSave = { id: string | null; personName: string; licenseType: string; expiryYmd: string; note: string }

/** Inserts or updates the row; answers its id. Throws the database's error. */
export async function saveLicense(s: LicenseSave): Promise<string> {
  const row = { person_name: s.personName, license_type: s.licenseType, date_of_expiry: s.expiryYmd, note: s.note.trim() || null }
  if (s.id) {
    const { error } = await supabase.from('person_licenses').update(row).eq('id', s.id)
    if (error) throw error
    return s.id
  }
  const { data, error } = await supabase.from('person_licenses').insert(row).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Tells Dispatch when the saved license expires soon, as the Licenses tab does. Never throws. */
export async function notifyDispatchLicenseExpiry(licenseId: string): Promise<string | null> {
  try {
    const dispatchId = await withSupabaseRetry(
      async () => supabase.rpc('notify_dispatch_license_expiry_if_needed', { p_license_id: licenseId, p_link: `${window.location.origin}/people?tab=licenses` }),
      'notify_dispatch_license_expiry_if_needed',
    )
    if (dispatchId == null || typeof dispatchId !== 'string') return null
    const { error } = await supabase.functions.invoke('notify-dispatch-request', { body: { dispatch_request_id: dispatchId } })
    return error ? error.message : null
  } catch {
    return null
  }
}

/**
 * TDLR's rows for one bare number. Throws when TDLR does not answer, and after `TDLR_TIMEOUT_MS`
 * with the wait named, so a Socrata stall never leaves Checking… lit for good.
 */
export async function fetchTdlrRows(number: string, fetchImpl: typeof fetch = fetch): Promise<TdlrRow[]> {
  let res: Response
  try {
    res = await fetchImpl(tdlrQueryUrl(number), { signal: AbortSignal.timeout(TDLR_TIMEOUT_MS) })
  } catch (e) {
    if (isTimeoutError(e)) throw new Error(TDLR_TIMEOUT_REASON)
    throw e
  }
  if (!res.ok) throw new Error(`TDLR answered ${res.status}. Try again in a minute.`)
  return (await res.json()) as TdlrRow[]
}
