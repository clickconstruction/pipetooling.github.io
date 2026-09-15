import { supabase } from '../supabase'
import type { BidPacketFacts } from './jobAccountRepEmail'

/**
 * Job accounts from the bid (v2.3451): what the bid knows for the email to
 * the house's job-accounts rep — the property, the GC and their contact, the
 * start date, and the owner of record when the office has it. Every read is
 * best-effort: an estimator cannot read job_property_owners, so the owner
 * simply reads "to follow".
 */
export async function fetchBidPacketFacts(bidId: string, jobId: string | null, fallbackAddress: string | null | undefined): Promise<BidPacketFacts> {
  const facts: BidPacketFacts = { bidLabel: 'this bid', propertyName: null, address: fallbackAddress ?? null, startDate: null, gc: null, owner: null }
  try {
    const { data: bid } = await supabase
      .from('bids')
      .select('bid_number, project_name, address, estimated_job_start_date, gc_builder_id, gc_contact_name, gc_contact_phone, gc_contact_email')
      .eq('id', bidId)
      .maybeSingle()
    if (bid) {
      const num = (bid.bid_number ?? '').toString().trim()
      facts.bidLabel = [num ? `B${num}` : null, (bid.project_name ?? '').trim() || null].filter(Boolean).join(' · ') || 'this bid'
      facts.propertyName = bid.project_name
      facts.address = (bid.address ?? '').trim() || facts.address
      facts.startDate = bid.estimated_job_start_date
      let company: string | null = null
      if (bid.gc_builder_id) {
        const { data: builder } = await supabase.from('bids_gc_builders').select('name').eq('id', bid.gc_builder_id).maybeSingle()
        company = (builder as { name?: string | null } | null)?.name ?? null
      }
      // Per-GC rows (v2.2896): the contact the bid was submitted to is the freshest GC contact.
      const { data: gcRows } = await supabase
        .from('bid_gcs')
        .select('customer_id, submitted_to_name, submitted_to_phone, submitted_to_email, customer:customers(name)')
        .eq('bid_id', bidId)
        .limit(1)
      const gcRow = (gcRows ?? [])[0] as
        | { submitted_to_name: string | null; submitted_to_phone: string | null; submitted_to_email: string | null; customer: { name: string | null } | { name: string | null }[] | null }
        | undefined
      const gcCustomer = gcRow ? (Array.isArray(gcRow.customer) ? gcRow.customer[0] : gcRow.customer) : null
      const gcCompany = (gcCustomer?.name ?? '').trim() || company
      const contactName = (gcRow?.submitted_to_name ?? '').trim() || (bid.gc_contact_name ?? '').trim()
      const phone = (gcRow?.submitted_to_phone ?? '').trim() || (bid.gc_contact_phone ?? '').trim()
      const email = (gcRow?.submitted_to_email ?? '').trim() || (bid.gc_contact_email ?? '').trim()
      if (gcCompany || contactName) facts.gc = { company: gcCompany, contactName, phone, email }
    }
  } catch {
    // best-effort
  }
  if (jobId) {
    try {
      const { data: owner } = await supabase
        .from('job_property_owners')
        .select('owner_name, company_name, mailing_address')
        .eq('job_id', jobId)
        .maybeSingle()
      const name = ((owner?.company_name ?? '').trim() || (owner?.owner_name ?? '').trim())
      const mailing = (owner?.mailing_address ?? '').trim()
      if (name && mailing) facts.owner = { name, mailingAddress: mailing }
    } catch {
      // office-only table; estimators read nothing here
    }
  }
  return facts
}
