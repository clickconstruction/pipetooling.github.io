/**
 * RFQ Desk kernel (lane B, v2.2636 — docs/SUPPLY_HOUSE_RFQ_PLAN.md).
 * Pure derivations for the desk UI:
 *   - the per-request progress trail (Sent → Delivered → Viewed → Quoted,
 *     with bounce as the bad branch; lane-A copied links get a shorter
 *     Link out → Viewed → Quoted trail),
 *   - nudge eligibility (24h server-matched throttle, email lane only),
 *   - scope drift vs the bid's CURRENT counts,
 *   - the Pricing-header chip (five states: none / quotes-only / waiting /
 *     bounced / all-in),
 *   - scope-level coverage from the compare kernel's rows ("58 of 63
 *     priced by someone; these 5 are bare").
 */

import { type CompareRow } from './quoteCompare'
import { endOfYmdInAppTzMs } from '../../utils/dateUtils'

export type DeskRfq = {
  id: string
  houseName: string | null
  sentEmail: string | null
  status: 'draft' | 'sent' | 'quoted' | 'closed'
  createdAt: string
  viewedAt: string | null
  lastRemindedAt: string | null
  reminderCount: number
  neededBy: string | null
  /** email_send_log.last_event for the rfq's resend_email_id (null = none yet). */
  emailLastEvent: string | null
  scopeLines: Array<{ fixture: string; count: number }>
}

export type TrailStepState = 'on' | 'now' | 'off' | 'bad'
export type TrailStep = { key: string; label: string; state: TrailStepState }

const DELIVERED_EVENTS = new Set(['delivered', 'opened', 'clicked', 'delivery_delayed'])
const BOUNCED_EVENTS = new Set(['bounced', 'complained'])

export const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** The per-row progress trail. Email lane gets 4 steps; copied links get 3. */
export function deriveRfqTrail(rfq: DeskRfq): TrailStep[] {
  const quoted = rfq.status === 'quoted'
  const viewed = rfq.viewedAt != null
  if (!rfq.sentEmail) {
    const steps: TrailStep[] = [
      { key: 'link', label: 'Link out', state: 'on' },
      { key: 'viewed', label: 'Viewed', state: viewed ? 'on' : 'off' },
      { key: 'quoted', label: 'Quoted', state: quoted ? 'on' : 'off' },
    ]
    return markCurrent(steps)
  }
  const bounced = rfq.emailLastEvent != null && BOUNCED_EVENTS.has(rfq.emailLastEvent)
  if (bounced && !quoted) {
    return [
      { key: 'sent', label: 'Sent', state: 'on' },
      { key: 'bounced', label: 'Bounced', state: 'bad' },
    ]
  }
  const delivered = viewed || quoted || (rfq.emailLastEvent != null && DELIVERED_EVENTS.has(rfq.emailLastEvent))
  const steps: TrailStep[] = [
    { key: 'sent', label: 'Sent', state: 'on' },
    { key: 'delivered', label: 'Delivered', state: delivered ? 'on' : 'off' },
    { key: 'viewed', label: 'Viewed', state: viewed ? 'on' : 'off' },
    { key: 'quoted', label: 'Quoted', state: quoted ? 'on' : 'off' },
  ]
  return markCurrent(steps)
}

/** Highlight the first not-yet-reached step (unless the trail is complete). */
function markCurrent(steps: TrailStep[]): TrailStep[] {
  const i = steps.findIndex((s) => s.state === 'off')
  const hit = i >= 0 ? steps[i] : undefined
  if (hit) steps[i] = { key: hit.key, label: hit.label, state: 'now' }
  return steps
}

/** One-tap nudge: email lane, still open, and 24h since the last send/nudge. */
export function canNudge(rfq: DeskRfq, nowMs: number): { ok: boolean; reason?: string } {
  if (!rfq.sentEmail) return { ok: false, reason: 'no email on this request — copy the link instead' }
  if (rfq.status === 'quoted') return { ok: false, reason: 'already quoted' }
  if (rfq.status === 'closed') return { ok: false, reason: 'closed' }
  const last = rfq.lastRemindedAt ?? rfq.createdAt
  const since = nowMs - new Date(last).getTime()
  if (since < NUDGE_COOLDOWN_MS) {
    const hrs = Math.ceil((NUDGE_COOLDOWN_MS - since) / 3_600_000)
    return { ok: false, reason: `nudged recently — try again in ~${hrs}h` }
  }
  return { ok: true }
}

/** Lines whose count changed (>0.5%) or vanished since the request went out. */
export function scopeDriftCount(
  scopeLines: ReadonlyArray<{ fixture: string; count: number }>,
  currentQtyByName: ReadonlyMap<string, number>,
): number {
  let drift = 0
  for (const l of scopeLines) {
    const now = currentQtyByName.get(l.fixture.trim().toLowerCase())
    if (now == null || now <= 0) {
      drift++
      continue
    }
    if (l.count > 0 && Math.abs(now - l.count) / l.count > 0.005) drift++
  }
  return drift
}

const DAY_MS = 24 * 60 * 60 * 1000
export const URGENCY_UNVIEWED_DAYS = 2
export const URGENCY_NEEDED_BY_DAYS = 3
export const URGENCY_VIEWED_SILENT_DAYS = 1

export type RfqUrgency = {
  /** Lower = more urgent. 0 bounced · 1 needed-by at risk · 2 unviewed-stale · 3 viewed-silent · 4 fresh · 5 quoted. */
  tier: number
  /** Human reason for the attention chip; null = no chip (fresh / quoted). */
  reason: string | null
}

/**
 * Rung A (v2.2642): why a request floats to the top of the desk. The desk
 * never auto-emails anyone — it just refuses to let silence look like
 * progress. Sort by tier, oldest first inside a tier.
 */
export function rfqUrgency(rfq: DeskRfq, nowMs: number): RfqUrgency {
  if (rfq.status === 'quoted') return { tier: 5, reason: null }
  const bounced = rfq.emailLastEvent != null && BOUNCED_EVENTS.has(rfq.emailLastEvent)
  if (bounced) return { tier: 0, reason: 'bounced — fix & resend' }
  if (rfq.neededBy) {
    const untilMs = endOfYmdInAppTzMs(rfq.neededBy) - nowMs
    if (untilMs < 0) return { tier: 1, reason: 'needed-by has passed — still no quote' }
    if (untilMs <= URGENCY_NEEDED_BY_DAYS * DAY_MS) {
      const days = Math.max(1, Math.ceil(untilMs / DAY_MS))
      return { tier: 1, reason: `needed-by in ${days} day${days === 1 ? '' : 's'} — still silent` }
    }
  }
  const ageMs = nowMs - new Date(rfq.createdAt).getTime()
  if (!rfq.viewedAt && ageMs >= URGENCY_UNVIEWED_DAYS * DAY_MS) {
    const days = Math.floor(ageMs / DAY_MS)
    return { tier: 2, reason: `unviewed for ${days} day${days === 1 ? '' : 's'}` }
  }
  if (rfq.viewedAt && nowMs - new Date(rfq.viewedAt).getTime() >= URGENCY_VIEWED_SILENT_DAYS * DAY_MS) {
    return { tier: 3, reason: 'viewed, still silent' }
  }
  return { tier: 4, reason: null }
}

/** Desk order: urgency tier, then oldest first inside a tier. */
export function sortRfqsByUrgency<T extends DeskRfq>(rfqs: ReadonlyArray<T>, nowMs: number): T[] {
  return [...rfqs].sort((a, b) => {
    const ta = rfqUrgency(a, nowMs).tier
    const tb = rfqUrgency(b, nowMs).tier
    if (ta !== tb) return ta - tb
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export type RfqChip =
  | { kind: 'none' }
  | { kind: 'quotes'; tone: 'blue' | 'green'; label: string }
  | { kind: 'desk'; tone: 'amber' | 'red' | 'green'; label: string }

/**
 * The Pricing-header chip, five states (mockup artboard 4):
 * no requests + no quotes → none · quotes only → the shipped Quotes(n)
 * chip · any open request → the desk chip (red beats amber beats green).
 */
export function deriveRfqChip(rfqs: ReadonlyArray<DeskRfq>, quoteCount: number): RfqChip {
  const live = rfqs.filter((r) => r.status !== 'closed' && r.status !== 'draft')
  if (live.length === 0) {
    if (quoteCount === 0) return { kind: 'none' }
    return { kind: 'quotes', tone: 'blue', label: `Quotes (${quoteCount})` }
  }
  const bounced = live.filter(
    (r) => r.status === 'sent' && r.emailLastEvent != null && BOUNCED_EVENTS.has(r.emailLastEvent),
  ).length
  if (bounced > 0) return { kind: 'desk', tone: 'red', label: `RFQs · ${bounced} bounced` }
  const waiting = live.filter((r) => r.status === 'sent').length
  if (waiting > 0) return { kind: 'desk', tone: 'amber', label: `RFQs · ${waiting} waiting` }
  return { kind: 'desk', tone: 'green', label: quoteCount > 0 ? `Quotes (${quoteCount}) · all in` : 'RFQs · all in' }
}

/** Scope-level coverage from compare rows: which items have a live price from ANYONE. */
export function coverageFromCompareRows(rows: ReadonlyArray<CompareRow>): {
  total: number
  priced: number
  bare: string[]
} {
  let priced = 0
  const bare: string[] = []
  for (const r of rows) {
    const has = Object.values(r.perHouse).some((c) => !c.expired && !c.cantSupply && c.unitPriceEachCents != null)
    if (has) priced++
    else bare.push(r.fixture)
  }
  return { total: rows.length, priced, bare }
}
