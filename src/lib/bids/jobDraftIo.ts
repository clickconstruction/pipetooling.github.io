/**
 * What the Send to Dispatch sheet (v2.5659) reads: the bid, the GCs its job can be for (`loadBidImportGcs`, the read New
 * Job's import uses) and the trades, and the draft the sheet opens with (`draftFromBid`). Every read is one an estimator
 * already has on the Bid Board; no job row is read.
 */
import { supabase } from '../supabase'
import type { BidImportGcOption } from './jobImportFromBid'
import { loadBidImportGcs } from './bidImportGcIo'
import { draftFromBid, type JobDraft } from './jobDraft'
import { pickableServiceTypes } from '../serviceTypePickers'

export interface JobDraftStart {
  bid: { id: string; bid_number: string | null; project_name: string | null; address: string | null; service_type_id: string | null; agreed_value: number | string | null }
  options: BidImportGcOption[]
  serviceTypes: Array<{ id: string; name: string }>
  draft: JobDraft
}

export interface JobDraftIo {
  load(bidId: string): Promise<JobDraftStart | null>
}

export const supabaseJobDraftIo: JobDraftIo = {
  async load(bidId) {
    const [bidRes, typesRes] = await Promise.all([
      supabase
        .from('bids')
        .select('id, bid_number, project_name, address, service_type_id, agreed_value, customer_id, bid_date_sent, customers(name)')
        .eq('id', bidId)
        .maybeSingle(),
      supabase.from('service_types').select('id, name, billing_only').order('sequence_order', { ascending: true }),
    ])
    if (bidRes.error) throw bidRes.error
    const b = bidRes.data as
      | (JobDraftStart['bid'] & { customer_id: string | null; bid_date_sent: string | null; customers: { name: string } | null })
      | null
    if (!b) return null
    const { packets, options } = await loadBidImportGcs({ bidId: b.id, bidCustomerId: b.customer_id, bidGcName: b.customers?.name ?? null, bidDateSent: b.bid_date_sent ?? null })
    const types = pickableServiceTypes(((typesRes.data ?? []) as Array<{ id: string; name: string; billing_only: boolean }>)).map((t) => ({ id: t.id, name: t.name }))
    const bid = { id: b.id, bid_number: b.bid_number, project_name: b.project_name, address: b.address, service_type_id: b.service_type_id, agreed_value: b.agreed_value }
    return { bid, options, serviceTypes: types, draft: draftFromBid({ bid, packets, options }) }
  },
}
