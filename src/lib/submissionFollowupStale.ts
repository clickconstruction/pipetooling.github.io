import { denverCalendarDaysBetweenInstantAndNow } from '../utils/dateUtils'
import type { Database } from '../types/database'

type BidStaleFields = Pick<Database['public']['Tables']['bids']['Row'], 'id' | 'customer_id'>
type CustomerContactRow = Database['public']['Tables']['customer_contacts']['Row']

/** Latest note activity: max of bids_submission_entries (per bid) and customer_contacts (per bid's customer). Ignores bids.last_contact alone. */
export function effectiveSubmissionBidLastNoteIso(
  bid: BidStaleFields,
  lastContactFromEntries: Record<string, string>,
  customerContacts: CustomerContactRow[],
): string | null {
  const dates: string[] = []
  const entry = lastContactFromEntries[bid.id]
  if (entry?.trim()) dates.push(entry)
  const cid = bid.customer_id
  if (cid) {
    for (const c of customerContacts) {
      if (c.customer_id === cid && c.contact_date?.trim()) dates.push(c.contact_date)
    }
  }
  if (dates.length === 0) return null
  return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
}

export function isSubmissionBidStaleForThreshold(
  bid: BidStaleFields,
  lastContactFromEntries: Record<string, string>,
  customerContacts: CustomerContactRow[],
  thresholdDays: number,
): boolean {
  const iso = effectiveSubmissionBidLastNoteIso(bid, lastContactFromEntries, customerContacts)
  if (!iso) return true
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return true
  return denverCalendarDaysBetweenInstantAndNow(ms) > thresholdDays
}
