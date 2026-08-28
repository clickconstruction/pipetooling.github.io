/**
 * "Waiting to hear" pending-bid chase: call-mode grouping + rollup for the
 * Followup tab's fourth lens. The queue is every sent bid with no outcome
 * yet — the recent ones first, because that's where bid tabs and real
 * feedback still live (estimator ask, 2026-08-21).
 *
 * Sibling of `bidLossCategories.ts` (the Why we lost lens kernel).
 * Pure module — no React, no Supabase; callers pass `nowIso` so tests stay
 * deterministic.
 */

import { callSessionOutcomeLabel } from './bids/builderCallSession'
import type { BidLossCategoryKey } from './bidLossCategories'

/** A bid counts as chased while its last contact is at most this many days old. */
export const PENDING_CHASE_STALE_CONTACT_DAYS = 7

/** Minimal pending-bid shape the chase grouping needs; the lens maps BidWithBuilder rows into this. */
export type PendingChaseBid = {
  id: string
  /** Grouping key — builder/customer id, or the display name when no id exists. */
  builderKey: string
  builderName: string
  value: number
  /** `bids.bid_date_sent` (YYYY-MM-DD). Rows without one are not pending-chase material. */
  sentIso: string
  /** Effective last contact instant (bid `last_contact` / latest note), null = never. */
  lastContactIso: string | null
}

const DAY_MS = 86_400_000

/** Whole days from `fromIso` to `toIso` (negative when `fromIso` is in the future). */
export function pendingChaseDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.floor((to - from) / DAY_MS)
}

/**
 * A bid needs a chase when nobody has talked to the builder since it went out,
 * or the last touch has gone stale: no contact at all, contact older than the
 * sent date, or contact older than `staleDays`.
 */
export function bidNeedsChase(
  b: Pick<PendingChaseBid, 'sentIso' | 'lastContactIso'>,
  nowIso: string,
  staleDays: number = PENDING_CHASE_STALE_CONTACT_DAYS,
): boolean {
  if (!b.lastContactIso) return true
  const contact = Date.parse(b.lastContactIso)
  const sent = Date.parse(b.sentIso)
  if (!Number.isFinite(contact)) return true
  if (Number.isFinite(sent) && contact < sent) return true
  return pendingChaseDaysBetween(b.lastContactIso, nowIso) > staleDays
}

export type PendingChaseBuilderGroup = {
  builderKey: string
  builderName: string
  /** Newest sent first inside the group. */
  bids: PendingChaseBid[]
  /** Bids still needing a chase. */
  needsCount: number
  /** Total value of the bids still needing a chase. */
  needsValue: number
  /** The group's most recent sent date — the queue ranking signal. */
  newestSentIso: string
}

/**
 * Group pending bids into the call-mode builder queue: builders with bids to
 * chase first, most recently sent first inside that band (recent bids are the
 * ones with feedback worth having), fully-chased builders after, alphabetical
 * as the tiebreak. Bid order inside a group is newest sent first.
 */
export function groupPendingChaseByBuilder(
  bids: readonly PendingChaseBid[],
  nowIso: string,
  staleDays: number = PENDING_CHASE_STALE_CONTACT_DAYS,
): PendingChaseBuilderGroup[] {
  const byKey = new Map<string, PendingChaseBuilderGroup>()
  for (const b of bids) {
    let g = byKey.get(b.builderKey)
    if (!g) {
      g = { builderKey: b.builderKey, builderName: b.builderName, bids: [], needsCount: 0, needsValue: 0, newestSentIso: b.sentIso }
      byKey.set(b.builderKey, g)
    }
    g.bids.push(b)
    if (b.sentIso > g.newestSentIso) g.newestSentIso = b.sentIso
    if (bidNeedsChase(b, nowIso, staleDays)) {
      g.needsCount += 1
      g.needsValue += Number.isFinite(b.value) ? b.value : 0
    }
  }
  const groups = Array.from(byKey.values())
  for (const g of groups) {
    g.bids.sort((a, b) => (a.sentIso === b.sentIso ? a.id.localeCompare(b.id) : a.sentIso < b.sentIso ? 1 : -1))
  }
  return groups.sort((a, b) => {
    const aOpen = a.needsCount > 0 ? 1 : 0
    const bOpen = b.needsCount > 0 ? 1 : 0
    if (aOpen !== bOpen) return bOpen - aOpen
    if (a.newestSentIso !== b.newestSentIso) return a.newestSentIso < b.newestSentIso ? 1 : -1
    return a.builderName.localeCompare(b.builderName)
  })
}

/**
 * The next bid to work in call mode: the first needs-chase bid after `fromIdx`
 * in the group, wrapping to the group's first needs-chase bid; null when the
 * group is fully chased.
 */
export function nextPendingChaseBidIndex(
  group: Pick<PendingChaseBuilderGroup, 'bids'>,
  fromIdx: number,
  nowIso: string,
  staleDays: number = PENDING_CHASE_STALE_CONTACT_DAYS,
): number | null {
  const later = group.bids.findIndex((b, i) => i > fromIdx && bidNeedsChase(b, nowIso, staleDays))
  if (later >= 0) return later
  const any = group.bids.findIndex((b) => bidNeedsChase(b, nowIso, staleDays))
  return any >= 0 ? any : null
}

// --- One-tap chase actions (PR 2 of the pending-chase train) -----------------

export type PendingChaseActionKey = 'left_message' | 'still_pending' | 'bid_tab' | 'rebid' | 'won' | 'lost'

export type PendingChaseAction = {
  key: PendingChaseActionKey
  label: string
}

export const PENDING_CHASE_ACTIONS: readonly PendingChaseAction[] = [
  { key: 'left_message', label: 'Left message' },
  { key: 'still_pending', label: 'Still pending' },
  { key: 'bid_tab', label: 'Bid tab received' },
  { key: 'rebid', label: 'Rebid / RFQ' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost…' },
]

/** The submission-entry note line for one chase action (mirrors the call-session labels). */
export function pendingChaseActionNote(
  action: PendingChaseActionKey,
  note: string,
  lossCategory: BidLossCategoryKey | null,
): string {
  const trimmed = note.trim()
  let label: string
  switch (action) {
    case 'left_message':
      label = 'Chased — left a message / no answer'
      break
    case 'bid_tab':
      label = 'Bid tab received'
      break
    default:
      label = callSessionOutcomeLabel({
        outcome: action,
        lossReason: action === 'lost' ? trimmed : '',
        lossCategory: action === 'lost' ? lossCategory : null,
      })
  }
  if (action === 'lost') return label // note already folded into the lost label
  return trimmed ? `${label}. ${trimmed}` : label
}

export type PendingChaseActionWrites = {
  entry: {
    bid_id: string
    /** The GC this chase was with (Per-GC Phase 1); null = the bid's own GC. */
    gc_customer_id: string | null
    contact_method: string
    notes: string
    occurred_at: string
    created_by: string
  }
  /** New `bids.last_contact` value. */
  lastContact: string
  /** Outcome patch for won/lost taps; null for contact-only actions. */
  outcomeUpdate: { outcome: 'won' | 'lost'; loss_reason: string | null; loss_category: string | null } | null
}

/**
 * Build the rows one chase tap writes: a submission entry, the last_contact
 * stamp, and (for Won / Lost) the outcome patch — same shape the builder call
 * session writes, so the bid's history reads identically either way.
 */
export function buildPendingChaseActionWrites(args: {
  bidId: string
  userId: string
  nowIso: string
  action: PendingChaseActionKey
  note: string
  lossCategory: BidLossCategoryKey | null
  /** The GC this chase is with (Per-GC Phase 1); omit/null = the bid's own GC. */
  gcCustomerId?: string | null
}): PendingChaseActionWrites {
  const { bidId, userId, nowIso, action, note, lossCategory } = args
  return {
    entry: {
      bid_id: bidId,
      gc_customer_id: args.gcCustomerId ?? null,
      contact_method: 'Phone',
      notes: pendingChaseActionNote(action, note, lossCategory),
      occurred_at: nowIso,
      created_by: userId,
    },
    lastContact: nowIso,
    outcomeUpdate:
      action === 'won'
        ? { outcome: 'won', loss_reason: null, loss_category: null }
        : action === 'lost'
          ? { outcome: 'lost', loss_reason: note.trim() || null, loss_category: lossCategory }
          : null,
  }
}

export type PendingChaseRollup = {
  pendingCount: number
  pendingValue: number
  /** Bids currently needing a chase (stale or untouched). */
  needsCount: number
  needsValue: number
  /** Bids never contacted since they were sent. */
  untouchedCount: number
  untouchedValue: number
  /** Age in days of the oldest never-contacted bid; null when none. */
  oldestUntouchedDays: number | null
}

export function buildPendingChaseRollup(
  bids: readonly PendingChaseBid[],
  nowIso: string,
  staleDays: number = PENDING_CHASE_STALE_CONTACT_DAYS,
): PendingChaseRollup {
  let pendingValue = 0
  let needsCount = 0
  let needsValue = 0
  let untouchedCount = 0
  let untouchedValue = 0
  let oldestUntouchedDays: number | null = null
  for (const b of bids) {
    const v = Number.isFinite(b.value) ? b.value : 0
    pendingValue += v
    if (bidNeedsChase(b, nowIso, staleDays)) {
      needsCount += 1
      needsValue += v
    }
    const contact = b.lastContactIso ? Date.parse(b.lastContactIso) : Number.NaN
    const sent = Date.parse(b.sentIso)
    const untouched = !Number.isFinite(contact) || (Number.isFinite(sent) && contact < sent)
    if (untouched) {
      untouchedCount += 1
      untouchedValue += v
      const age = pendingChaseDaysBetween(b.sentIso, nowIso)
      if (oldestUntouchedDays == null || age > oldestUntouchedDays) oldestUntouchedDays = age
    }
  }
  return {
    pendingCount: bids.length,
    pendingValue,
    needsCount,
    needsValue,
    untouchedCount,
    untouchedValue,
    oldestUntouchedDays,
  }
}
