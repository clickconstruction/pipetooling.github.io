/**
 * The GCs a bid's job can be for, read once for both doors that open a job from a bid: New Job's import
 * (`useJobFormImport`) and the estimator's Send to Dispatch draft (v2.5659). The bid's versions, their latest sends and
 * its recipients, grouped into packets (`groupVersionsByGc`) and offered as options (`bidImportGcOptions`), so the two
 * doors offer the same GCs and the same figures.
 */
import { supabase } from '../supabase'
import { groupVersionsByGc, type GcPacket } from './gcPackets'
import { latestSendByVersion, type VersionSendRow } from './versionSends'
import { bidImportGcOptions, type BidImportGcOption } from './jobImportFromBid'

export async function loadBidImportGcs(args: {
  bidId: string
  bidCustomerId: string | null
  bidGcName: string | null
  bidDateSent: string | null
  /** The bid GC's name from a caller's customer cache, when it has one. */
  cachedBidGcName?: string | null
}): Promise<{ packets: GcPacket[]; options: BidImportGcOption[] }> {
  const [vRes, sRes, rRes] = await Promise.all([
    supabase.from('bid_versions').select('id, name, customer_id, sort_order, created_at, outcome').eq('bid_id', args.bidId).order('sort_order'),
    supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', args.bidId),
    supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', args.bidId),
  ])
  const versions = (vRes.data ?? []) as Array<{ id: string; name: string; customer_id: string | null; sort_order: number; created_at: string | null; outcome: string | null }>
  const gcIds = [...new Set(versions.map((v) => v.customer_id).filter((x): x is string => !!x))]
  let gcNames: Record<string, string> = {}
  if (gcIds.length > 0) {
    const { data } = await supabase.from('customers').select('id, name').in('id', gcIds)
    gcNames = Object.fromEntries(((data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
  }
  const recipients = ((rRes.data ?? []) as Array<{ customer_id: string; customers: { name: string } | null }>).map((r) => ({ customerId: r.customer_id, name: r.customers?.name ?? '…' }))
  const packets = groupVersionsByGc(versions, {
    bidGcName: args.bidGcName,
    gcNames,
    latestSends: latestSendByVersion((sRes.data ?? []) as VersionSendRow[]),
    bidDateSent: args.bidDateSent,
    recipients,
  })
  // A bid with recipients but no versions has no own packet — the bid's GC is still a choice.
  const options = bidImportGcOptions({
    packets,
    bidCustomerId: args.bidCustomerId,
    cachedBidGcName: args.cachedBidGcName,
    embeddedBidGcName: args.bidGcName,
    bidDateSent: args.bidDateSent,
  })
  return { packets, options }
}
