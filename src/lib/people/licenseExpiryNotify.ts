/**
 * After a license's date is saved: ask the database whether Dispatch should hear that it lapses soon, and send the
 * note when it says so. Shared by People → Licenses and Prospects → State roll → Our own, the two places a
 * license's date is saved. It never throws: the date is already saved, so a note that could not go is a warning.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/** The warning to show, or null when the note went or none was owed. */
export async function notifyDispatchLicenseExpiry(licenseId: string): Promise<string | null> {
  const link = `${window.location.origin}/people?tab=licenses`
  try {
    const dispatchId = await withSupabaseRetry(
      async () => supabase.rpc('notify_dispatch_license_expiry_if_needed', { p_license_id: licenseId, p_link: link }),
      'notify_dispatch_license_expiry_if_needed',
    )
    if (dispatchId == null || typeof dispatchId !== 'string') return null
    const { error } = await supabase.functions.invoke('notify-dispatch-request', { body: { dispatch_request_id: dispatchId } })
    return error ? `License saved; Dispatch notification may have failed: ${error.message}` : null
  } catch (e) {
    console.warn('notifyDispatchLicenseExpiry', e)
    return null
  }
}
