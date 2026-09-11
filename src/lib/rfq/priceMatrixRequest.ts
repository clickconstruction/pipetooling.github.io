/**
 * Price-matrix requests — the door and the chip (Price Matrix PR 2,
 * docs/PRICE_MATRIX_PLAN.md). Pure: what a request row carries, how the
 * Pricing-header chip reads when a robot is on the bid, which of the bid's
 * Price-requests links the robot may read, and the per-request prompt a dev
 * copies from the Robots Queue lens.
 *
 * A request is a snapshot: the fixture rows (names + counts) and the folder
 * links at queue time. The robot prices THAT, never the live bid — the same
 * discipline as an RFQ's `scope`.
 */

import type { DeskRfq, RfqChip } from './rfqDesk'
import { deriveRfqChip } from './rfqDesk'

export type PriceMatrixStatus = 'queued' | 'working' | 'ready' | 'blocked' | 'cancelled' | 'done'

export type PriceMatrixScopeLine = { count_row_id: string; fixture: string; count: number; unit: string | null }

export type PriceMatrixSource = {
  rfq_id: string
  supply_house_id: string | null
  house_name: string
  url: string
  /** The day the request went out (outside rows) or was created (app rows), YYYY-MM-DD. */
  requested_on: string | null
}

export type PriceMatrixResult = {
  houses_read?: number
  pages_read?: number
  rows_priced?: number
  rows_asked?: number
  total_cents_at_counts?: number
  expired_houses?: string[]
  unreadable_sources?: string[]
}

export type PriceMatrixRequestRow = {
  id: string
  bid_id: string
  status: PriceMatrixStatus
  requested_at: string
  requested_by: string | null
  scope: PriceMatrixScopeLine[]
  sources: PriceMatrixSource[]
  claimed_by: string | null
  claimed_at: string | null
  heartbeat_at: string | null
  finished_at: string | null
  reviewed_at: string | null
  summary: string | null
  result: PriceMatrixResult | null
}

/** The rows the robot prices: today's count rows with a count, as the RFQ scope would carry them. */
export function buildPriceMatrixScope(
  rows: ReadonlyArray<{ id: string; fixture: string; count: number; unit?: string | null }>,
): PriceMatrixScopeLine[] {
  return rows
    .filter((r) => r.count > 0 && r.fixture.trim() !== '')
    .map((r) => ({ count_row_id: r.id, fixture: r.fixture, count: r.count, unit: r.unit ?? null }))
}

export type PriceRequestLinkRow = {
  id: string
  status: string
  sent_via?: 'app' | 'outside' | null
  supply_house_id: string | null
  sent_to: string | null
  created_at: string
  requested_on?: string | null
  quote_url?: string | null
}

const HTTP_RE = /^https?:\/\//i

/**
 * Which of the bid's Price-requests links the robot may read (a `quote_url`
 * the estimator pasted — the vendor's PDF or folder), and which houses were
 * asked but have nothing in the folder yet. Closed and draft requests drop
 * out; a house with several linked quotes gets several sources.
 */
export function buildPriceMatrixSources(
  rfqs: ReadonlyArray<PriceRequestLinkRow>,
  houseNameById: ReadonlyMap<string, string>,
): { readable: PriceMatrixSource[]; waiting: Array<{ rfq_id: string; house_name: string; requested_on: string | null }> } {
  const readable: PriceMatrixSource[] = []
  const waiting: Array<{ rfq_id: string; house_name: string; requested_on: string | null }> = []
  for (const r of rfqs) {
    if (r.status === 'closed' || r.status === 'draft') continue
    const houseName = (r.supply_house_id ? houseNameById.get(r.supply_house_id) : null) ?? r.sent_to?.trim() ?? 'Unknown house'
    const requestedOn = r.requested_on ?? (r.created_at ? r.created_at.slice(0, 10) : null)
    const url = r.quote_url?.trim() ?? ''
    if (url && HTTP_RE.test(url)) {
      readable.push({ rfq_id: r.id, supply_house_id: r.supply_house_id, house_name: houseName, url, requested_on: requestedOn })
    } else {
      waiting.push({ rfq_id: r.id, house_name: houseName, requested_on: requestedOn })
    }
  }
  readable.sort((a, b) => a.house_name.localeCompare(b.house_name) || (a.requested_on ?? '').localeCompare(b.requested_on ?? ''))
  waiting.sort((a, b) => a.house_name.localeCompare(b.house_name))
  return { readable, waiting }
}

/** The request the chip and the sheet talk about: the newest one that is still the estimator's business. */
export function activePriceMatrixRequest<T extends Pick<PriceMatrixRequestRow, 'status' | 'requested_at' | 'reviewed_at'>>(
  requests: ReadonlyArray<T>,
): T | null {
  const sorted = [...requests].sort((a, b) => b.requested_at.localeCompare(a.requested_at))
  for (const r of sorted) {
    if (r.status === 'queued' || r.status === 'working' || r.status === 'blocked') return r
    if (r.status === 'ready' && r.reviewed_at == null) return r
  }
  return null
}

/** Take it back is only honest before the robot starts writing. */
export function canTakeBack(request: Pick<PriceMatrixRequestRow, 'status'>): boolean {
  return request.status === 'queued'
}

/** "23 picks, 4 to settle" — from the robot's result, or null before it finished. */
export function summarizeResult(result: PriceMatrixResult | null | undefined): string | null {
  if (!result) return null
  const priced = result.rows_priced ?? 0
  const asked = result.rows_asked ?? 0
  const picks = `${priced} pick${priced === 1 ? '' : 's'}`
  return asked > 0 ? `${picks}, ${asked} to settle` : picks
}

export type RobotChip = { kind: 'robot'; tone: 'blue' | 'green' | 'amber'; label: string; requestId: string; status: PriceMatrixStatus }
export type PricingChip = RfqChip | RobotChip

/**
 * The one Pricing-header chip with the robot folded in: an open request wins
 * over the RFQ states (queued / working → blue, blocked → amber, ready and
 * unreviewed → green); once the estimator has looked, the RFQ chip is back.
 */
export function derivePricingChip(
  rfqs: ReadonlyArray<DeskRfq>,
  quoteCount: number,
  requests: ReadonlyArray<PriceMatrixRequestRow>,
): PricingChip {
  const active = activePriceMatrixRequest(requests)
  if (!active) return deriveRfqChip(rfqs, quoteCount)
  if (active.status === 'queued') return { kind: 'robot', tone: 'blue', label: 'Robot pricing · queued', requestId: active.id, status: active.status }
  if (active.status === 'working') {
    const houses = active.sources.length
    return {
      kind: 'robot',
      tone: 'blue',
      label: houses > 0 ? `Robot pricing · reading ${houses} quote${houses === 1 ? '' : 's'}` : 'Robot pricing · working',
      requestId: active.id,
      status: active.status,
    }
  }
  if (active.status === 'blocked') return { kind: 'robot', tone: 'amber', label: 'Robot pricing · blocked', requestId: active.id, status: active.status }
  const summary = summarizeResult(active.result)
  return { kind: 'robot', tone: 'green', label: summary ? `Matrix ready · ${summary}` : 'Matrix ready', requestId: active.id, status: active.status }
}

/** 'just now' · '2h ago' · 'yesterday' · '3d ago' — the Queue lens's age words. */
export function requestAgeLabel(iso: string, nowMs: number): string {
  const hours = (nowMs - new Date(iso).getTime()) / 3600000
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

/**
 * The per-request prompt a dev copies from the Robots Queue lens — the pricing
 * kickoff's instructions pinned to one request, for running a single bid by
 * hand from a Claude Desktop chat on the twin-mcp connector.
 */
export function buildPricerRequestPrompt(
  request: Pick<PriceMatrixRequestRow, 'id' | 'requested_at' | 'scope' | 'sources'>,
  bid: { bid_number: string | null; project_name: string | null },
  requesterName: string | null,
): string {
  const num = bid.bid_number ? `b${bid.bid_number}` : 'this bid'
  const name = bid.project_name?.trim() || 'the project'
  const who = requesterName ? ` asked by ${requesterName}` : ''
  const when = request.requested_at.slice(0, 16).replace('T', ' ')
  const rows = request.scope.length
  const houses = request.sources.map((s) => s.house_name)
  const houseList = houses.length ? houses.join(', ') : 'no linked quotes yet'
  return `You are twin-pricer-1, the ClickTooling pricing twin. Using the twin-mcp connector, build the price matrix for request ${request.id} on ${num} (${name};${who} ${when}).

1. get_brief, get_pricing_guide, get_component_rules, get_answers — then next_price_matrix, which claims the oldest queued request. Confirm it returned request ${request.id}; if it returned another, work that one first and call again.
2. get_quote_documents(request) — ${request.sources.length} source${request.sources.length === 1 ? '' : 's'} (${houseList}). Read every page of every file, including any sheet the fixture schedule points at ("see the carrier and drain quote"). A folder the intake account cannot read: report the house and continue.
3. put_quote per house: kit subtotals as the fixture's $/each with unpriced members, carriers on the tag they belong to, size lists as option groups (never summed), validity and freight as the quote states them, a page reference on every line. The ${rows} fixture rows in the request snapshot are the only rows you price.
4. finish_price_matrix: cheapest complete kit per row across houses, one reason per pick; where the plans decide (carrier variant, size) ask_question(kind: 'choice', audience: 'estimator') and leave the row unpicked.

RULES: every bid verb is refused to you; never read the human bid's pricing; never sum an option group or read a printed grand total as the job total; never email anyone; never write costs — the estimator applies.`
}
