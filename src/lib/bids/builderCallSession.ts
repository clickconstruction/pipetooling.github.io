/**
 * Call-session save kernel (v2.1389): one hang-up → one builder contact,
 * a submission entry + last_contact stamp per bid the caller touched,
 * outcome updates for won/lost taps, and the promised next-follow-up date.
 * Pure row-building; the modal performs the writes.
 */

import { bidLossCategoryLabel, type BidLossCategoryKey } from '../bidLossCategories'
import { bidTabNoteLine, buildBidTabPatch, hasAnyBidTabValue, type BidTabRow, type BidTabValues } from '../bidTabCapture'

export type CallSessionOutcome = 'still_pending' | 'won' | 'lost' | 'rebid'

export type CallSessionBidDecision = {
  bidId: string
  /** null = the bid wasn't discussed; nothing is written for it. */
  outcome: CallSessionOutcome | null
  note: string
  lossReason: string
  /** Structured why-we-lost bucket (v2.1799); only written for 'lost' taps. */
  lossCategory: BidLossCategoryKey | null
  /** Bid-tab numbers captured on the call (v2.2103); null/absent = no tab discussed. */
  tab?: BidTabValues | null
  /** Our own bid value — lets the tab note derive "% over the low"; absent = unknown. */
  bidValue?: number
}

export type CallSessionWrites = {
  customerContact: {
    customer_id: string
    contact_date: string
    details: string
    contact_method: string
    created_by: string
  }
  bidEntries: Array<{
    bid_id: string
    /** The builder being called (Per-GC Phase 1) — folds into the own GC for own-GC bids. */
    gc_customer_id: string | null
    contact_method: string
    notes: string
    occurred_at: string
    created_by: string
  }>
  bidOutcomeUpdates: Array<{ bidId: string; outcome: 'won' | 'lost'; loss_reason: string | null; loss_category: string | null }>
  /** Bid-tab column patches for tabs captured on the call (v2.2103). */
  bidTabUpdates: Array<{ bidId: string; patch: BidTabRow }>
}

/** True when this decision has tab numbers worth writing. */
function decisionHasTab(d: CallSessionBidDecision): boolean {
  return d.tab != null && hasAnyBidTabValue(d.tab)
}

export function callSessionOutcomeLabel(d: Pick<CallSessionBidDecision, 'outcome' | 'lossReason' | 'lossCategory'>): string {
  switch (d.outcome) {
    case 'won':
      return 'Marked won on call'
    case 'lost': {
      const parts = [bidLossCategoryLabel(d.lossCategory), d.lossReason.trim() || null].filter(Boolean)
      return parts.length > 0 ? `Marked lost on call — ${parts.join(': ')}` : 'Marked lost on call'
    }
    case 'rebid':
      return 'Rebid / RFQ requested'
    case 'still_pending':
      return 'Still pending'
    default:
      return ''
  }
}

export function buildCallSessionWrites(args: {
  customerId: string
  userId: string
  nowIso: string
  summary: string
  decisions: CallSessionBidDecision[]
}): CallSessionWrites {
  const { customerId, userId, nowIso } = args
  const touched = args.decisions.filter((d) => d.outcome !== null || d.note.trim() !== '' || decisionHasTab(d))
  const details = args.summary.trim() || `Call session — ${touched.length} bid${touched.length === 1 ? '' : 's'} reviewed`
  return {
    customerContact: {
      customer_id: customerId,
      contact_date: nowIso,
      details,
      contact_method: 'Phone',
      created_by: userId,
    },
    bidEntries: touched.map((d) => {
      const outcomeLabel = callSessionOutcomeLabel(d)
      const note = d.note.trim()
      const tabLine = decisionHasTab(d) ? bidTabNoteLine(d.tab!, d.bidValue ?? 0) : ''
      const segments = [outcomeLabel, tabLine, note].filter(Boolean)
      return {
        bid_id: d.bidId,
        gc_customer_id: customerId,
        contact_method: 'Phone',
        notes: segments.join('. '),
        occurred_at: nowIso,
        created_by: userId,
      }
    }),
    // Per-GC Phase 1: bids.last_contact derives from the entry inserts (sync trigger) — no stamps.
    bidOutcomeUpdates: touched
      .filter((d): d is CallSessionBidDecision & { outcome: 'won' | 'lost' } => d.outcome === 'won' || d.outcome === 'lost')
      .map((d) => ({
        bidId: d.bidId,
        outcome: d.outcome,
        loss_reason: d.outcome === 'lost' ? d.lossReason.trim() || null : null,
        // Won on call clears any stale category from an earlier "lost" call.
        loss_category: d.outcome === 'lost' ? d.lossCategory : null,
      })),
    bidTabUpdates: touched.filter(decisionHasTab).map((d) => ({ bidId: d.bidId, patch: buildBidTabPatch(d.tab!) })),
  }
}

/**
 * The muted "what to ask" line under a pending bid in the session (v2.2103):
 * never contacted since sending → the full opener; sent a while ago with no
 * tab on file → the tab ask; otherwise nothing. Pure so tests stay dry.
 */
export function callSessionAskPrompt(bid: {
  sentIso: string | null
  lastContactIso: string | null
  hasTab: boolean
  nowIso: string
}): string | null {
  if (!bid.sentIso) return null
  const sent = Date.parse(bid.sentIso)
  const contact = bid.lastContactIso ? Date.parse(bid.lastContactIso) : Number.NaN
  const neverContacted = !Number.isFinite(contact) || (Number.isFinite(sent) && contact < sent)
  if (neverContacted) return 'ask: did our number land? can we get the bid tab?'
  if (!bid.hasTab) {
    const ageDays = (Date.parse(bid.nowIso) - sent) / 86_400_000
    if (Number.isFinite(ageDays) && ageDays >= 21) return 'ask: can we get the bid tab?'
  }
  return null
}

/** Quick-pick helpers for the "Next follow-up" row; returns an ISO at 8am local on the target day. */
export function nextFollowupQuickPickIso(pick: 'tomorrow' | 'next-week' | 'two-weeks', now: Date): string {
  const days = pick === 'tomorrow' ? 1 : pick === 'next-week' ? 7 : 14
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 8, 0, 0)
  return d.toISOString()
}
