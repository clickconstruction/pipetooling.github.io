// The ask a person makes with "Price it with the robot" (Bids → Pricing), as its pure rules: which count rows the robot
// prices, which of the bid's Price-requests links it may read, which request is still open, and when one can be taken
// back. Lifted from src/lib/rfq/priceMatrixRequest.ts in v2.7958 so the dev seat's plan_price_matrix_request queues what
// the window queues by the window's own rules; that file re-exports everything here. Pure: no env, no network.

import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'

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
  request_url?: string | null
  quote_url?: string | null
}

const HTTP_RE = /^https?:\/\//i

/**
 * Which of the bid's Price-requests links the robot may read, and which houses
 * were asked but have nothing linked yet. A row's `quote_url` (the vendor's
 * reply) wins; else its `request_url` — on a hand-sent request that link is
 * usually the vendor's PDF or the Drive folder it landed in, and the table
 * today offers only that one field. Closed and draft requests drop out; a
 * house with several linked requests gets several sources.
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
    const requestedOn = r.requested_on ?? (r.created_at ? calendarYmdInAppTzFromIso(r.created_at) || null : null)
    const quote = r.quote_url?.trim() ?? ''
    const request = r.request_url?.trim() ?? ''
    const url = quote && HTTP_RE.test(quote) ? quote : request
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
export function activePriceMatrixRequest<T extends { status: PriceMatrixStatus; requested_at: string; reviewed_at: string | null }>(
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
export function canTakeBack(request: { status: PriceMatrixStatus }): boolean {
  return request.status === 'queued'
}

