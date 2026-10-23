import { BID_LOSS_CATEGORIES, bidLossCategoryLabel, isBidLossCategoryKey, type BidLossCategoryKey } from '../bidLossCategories'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The lost-bid kind (v2.5774, punch list #146, PR 2): the rows behind the Needs you line
 * *N lost bids have no reason recorded*, what the app knows about each, the fields the
 * assistant fills, and the writes. The rows are the Why we lost lens's own rule
 * (`bidSentCounts`: lost, no `loss_category`, not adopted into another bid), biggest value
 * first. The write is the lens's own: the bid's `loss_category` and `loss_reason`; and, when
 * the assistant names who they talked to, one contact-log entry, which is what stamps the
 * bid's last contact. Pure; `fillInLostBidsIo.ts` reads and writes.
 */
export type LostBidSource = {
  id: string
  bid_number: string | null
  project_name: string | null
  customer_id: string | null
  bid_value: number | string | null
  outcome: string | null
  outcome_at: string | null
  bid_date_sent: string | null
  last_contact: string | null
  loss_category: string | null
  loss_reason: string | null
  adopted_into_bid_id: string | null
  customers?: { name: string | null } | null
  bids_gc_builders?: { name: string | null } | null
}

export type LostBidFillInRow = FillInRowBase & {
  kind: 'lost-bid'
  bidId: string
  customerId: string | null
  /** "b412" — the bid's number as the Needs you lines say it. */
  bidLabel: string
  project: string
  gcName: string
  value: number | null
  /** What the row held before the save, for Undo. */
  previous: { loss_category: string | null; loss_reason: string | null }
}

function money(v: number | string | null | undefined): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : null
}

function day(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : null
}

/** "Marked lost on Sep 30." · "Bid went out Aug 14." · "Last contact: Sep 22." or "No contact recorded since it went out." */
export function lostBidKnows(b: Pick<LostBidSource, 'outcome_at' | 'bid_date_sent' | 'last_contact' | 'loss_reason'>): string[] {
  const out: string[] = []
  const lost = day(b.outcome_at)
  const sent = day(b.bid_date_sent)
  if (lost) out.push(`Marked lost on ${lost}.`)
  if (sent) out.push(`Bid went out ${sent}.`)
  const sentMs = b.bid_date_sent ? Date.parse(b.bid_date_sent) : Number.NaN
  const contactMs = b.last_contact ? Date.parse(b.last_contact) : Number.NaN
  if (Number.isFinite(contactMs) && (!Number.isFinite(sentMs) || contactMs >= sentMs)) out.push(`Last contact: ${day(b.last_contact)}.`)
  else if (sent) out.push('No contact recorded since it went out.')
  const note = (b.loss_reason ?? '').trim()
  if (note) out.push(`A note already says: ${note}`)
  return out
}

export function lostBidFillInRows(bids: readonly LostBidSource[]): LostBidFillInRow[] {
  const rows = bids
    .filter((b) => b.outcome === 'lost' && !isBidLossCategoryKey(b.loss_category) && !b.adopted_into_bid_id)
    .map((b): LostBidFillInRow => {
      const num = (b.bid_number ?? '').trim()
      const bidLabel = num ? `b${num}` : 'a bid'
      const project = (b.project_name ?? '').trim() || 'no project name'
      const gcName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'no builder'
      const value = money(b.bid_value)
      const dollars = value != null ? `$${Math.round(value).toLocaleString('en-US')}` : null
      return {
        key: fillInRowKey('lost-bid', b.id),
        kind: 'lost-bid',
        severity: 'gray',
        title: [`${bidLabel} ${project}`, gcName, dollars].filter(Boolean).join(' · '),
        knows: lostBidKnows(b),
        doorHref: `/bids?tab=bid-board&bidId=${encodeURIComponent(b.id)}`,
        doorLabel: 'Open the bid',
        bidId: b.id,
        customerId: b.customer_id,
        bidLabel,
        project,
        gcName,
        value,
        previous: { loss_category: b.loss_category, loss_reason: b.loss_reason },
      }
    })
  return rows.sort(compareLostBidRows)
}

/** Biggest value first, as the line's dollars count them; no value last. */
export function compareLostBidRows(a: LostBidFillInRow, b: LostBidFillInRow): number {
  return (b.value ?? -1) - (a.value ?? -1)
}

/** The fields the assistant fills: the reason chip, what they said, who they talked to. */
export type LostBidDecision = {
  category: BidLossCategoryKey | null
  said: string
  who: string
}

export const EMPTY_LOST_BID_DECISION: LostBidDecision = { category: null, said: '', who: '' }

export function lostBidDecisionReady(d: LostBidDecision): boolean {
  return d.category != null
}

export type LostBidWrites = {
  bidId: string
  patch: { loss_category: BidLossCategoryKey; loss_reason: string | null }
  /** One contact-log row when the assistant named who they talked to; it stamps the bid's last contact. */
  entry: { bid_id: string; gc_customer_id: string | null; contact_method: string | null; notes: string; occurred_at: string; created_by: string } | null
}

export function lostBidWrites(row: LostBidFillInRow, d: LostBidDecision, ctx: { userId: string; nowIso: string }): LostBidWrites | null {
  if (!d.category) return null
  const said = d.said.trim()
  const who = d.who.trim()
  const label = bidLossCategoryLabel(d.category) ?? d.category
  const entry = who
    ? {
        bid_id: row.bidId,
        gc_customer_id: row.customerId,
        contact_method: null,
        notes: [`Reason recorded on Quickfill — ${label}${said ? `: ${said}` : ''}`, `Talked to ${who}`].join('. ') + '.',
        occurred_at: ctx.nowIso,
        created_by: ctx.userId,
      }
    : null
  return {
    bidId: row.bidId,
    patch: { loss_category: d.category, loss_reason: said || row.previous.loss_reason || null },
    entry,
  }
}

/** The saved line under the deck, after the row's title: the reason, and where it landed. */
export function lostBidTrailWords(category: BidLossCategoryKey, withEntry: boolean): string {
  const label = bidLossCategoryLabel(category) ?? category
  return `${label} · ${withEntry ? 'the Why we lost lens and the contact log have it' : 'the Why we lost lens has it'}`
}

export const LOST_BID_CATEGORY_CHIPS = BID_LOSS_CATEGORIES
