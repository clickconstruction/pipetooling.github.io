import { describe, expect, it } from 'vitest'

import {
  activePriceMatrixRequest,
  buildPriceMatrixScope,
  buildPriceMatrixSources,
  buildPricerRequestPrompt,
  canTakeBack,
  derivePricingChip,
  requestAgeLabel,
  summarizeResult,
  type PriceMatrixRequestRow,
} from './priceMatrixRequest'
import type { DeskRfq } from './rfqDesk'

const req = (p: Partial<PriceMatrixRequestRow> = {}): PriceMatrixRequestRow => ({
  id: 'req-1',
  bid_id: 'b359',
  status: 'queued',
  requested_at: '2026-09-10T19:14:00Z',
  requested_by: 'wendi',
  scope: [{ count_row_id: 'r1', fixture: 'WC1&2', count: 11, unit: null }],
  sources: [{ rfq_id: 'rfq-1', supply_house_id: 'h-nws', house_name: 'National Wholesale Supply', url: 'https://drive.google.com/file/d/abc', requested_on: '2026-09-09' }],
  claimed_by: null,
  claimed_at: null,
  heartbeat_at: null,
  finished_at: null,
  reviewed_at: null,
  summary: null,
  result: null,
  ...p,
})

const waitingRfq: DeskRfq = {
  id: 'r1',
  houseName: 'Ferguson',
  sentEmail: 'x@ferguson.com',
  status: 'sent',
  createdAt: '2026-09-03T10:00:00Z',
  viewedAt: null,
  lastRemindedAt: null,
  reminderCount: 0,
  neededBy: null,
  emailLastEvent: null,
  scopeLines: [],
}

describe('buildPriceMatrixScope', () => {
  it('keeps counted, named rows with their count-row id and unit', () => {
    const scope = buildPriceMatrixScope([
      { id: 'r1', fixture: 'WC1&2', count: 11 },
      { id: 'r2', fixture: 'ft of 4IN WASTE', count: 507.65, unit: 'ft' },
      { id: 'r3', fixture: 'LABOR', count: 0 },
      { id: 'r4', fixture: '   ', count: 3 },
    ])
    expect(scope).toEqual([
      { count_row_id: 'r1', fixture: 'WC1&2', count: 11, unit: null },
      { count_row_id: 'r2', fixture: 'ft of 4IN WASTE', count: 507.65, unit: 'ft' },
    ])
  })
})

describe('buildPriceMatrixSources', () => {
  const houses = new Map([['h-nws', 'National Wholesale Supply'], ['h-ferg', 'Ferguson']])
  it('a pasted quote link is readable; a request with none is waiting; closed and draft drop out', () => {
    const { readable, waiting } = buildPriceMatrixSources(
      [
        { id: 'a', status: 'quoted', sent_via: 'outside', supply_house_id: 'h-nws', sent_to: null, created_at: '2026-09-09T10:00:00Z', requested_on: '2026-09-09', quote_url: 'https://drive.google.com/file/d/abc' },
        { id: 'b', status: 'sent', sent_via: 'outside', supply_house_id: 'h-ferg', sent_to: null, created_at: '2026-09-03T10:00:00Z', requested_on: '2026-09-03', quote_url: null },
        { id: 'c', status: 'closed', sent_via: 'outside', supply_house_id: 'h-ferg', sent_to: null, created_at: '2026-09-01T10:00:00Z', quote_url: 'https://x.test/q.pdf' },
        { id: 'd', status: 'sent', sent_via: 'app', supply_house_id: null, sent_to: 'Hajoca', created_at: '2026-09-05T10:00:00Z', quote_url: 'not a link' },
      ],
      houses,
    )
    expect(readable).toEqual([
      { rfq_id: 'a', supply_house_id: 'h-nws', house_name: 'National Wholesale Supply', url: 'https://drive.google.com/file/d/abc', requested_on: '2026-09-09' },
    ])
    expect(waiting.map((w) => w.house_name)).toEqual(['Ferguson', 'Hajoca'])
    expect(waiting[1]?.requested_on).toBe('2026-09-05')
  })
})

describe('activePriceMatrixRequest / canTakeBack', () => {
  it('the newest open request wins; a reviewed ready one is over', () => {
    const older = req({ id: 'old', status: 'done', requested_at: '2026-09-01T00:00:00Z' })
    const ready = req({ id: 'ready', status: 'ready', requested_at: '2026-09-09T00:00:00Z' })
    expect(activePriceMatrixRequest([older, ready])?.id).toBe('ready')
    expect(activePriceMatrixRequest([older, { ...ready, reviewed_at: '2026-09-09T12:00:00Z' }])).toBeNull()
    expect(activePriceMatrixRequest([req({ status: 'cancelled' })])).toBeNull()
  })
  it('only a queued request can be taken back', () => {
    expect(canTakeBack(req({ status: 'queued' }))).toBe(true)
    expect(canTakeBack(req({ status: 'working' }))).toBe(false)
    expect(canTakeBack(req({ status: 'ready' }))).toBe(false)
  })
})

describe('summarizeResult', () => {
  it('reads picks and asks from the robot result', () => {
    expect(summarizeResult(null)).toBeNull()
    expect(summarizeResult({ rows_priced: 23, rows_asked: 4 })).toBe('23 picks, 4 to settle')
    expect(summarizeResult({ rows_priced: 1, rows_asked: 0 })).toBe('1 pick')
  })
})

describe('derivePricingChip', () => {
  it('falls back to the RFQ chip with no open request', () => {
    expect(derivePricingChip([waitingRfq], 0, [])).toEqual({ kind: 'desk', tone: 'amber', label: 'RFQs · 1 waiting' })
    expect(derivePricingChip([], 2, [req({ status: 'done' })])).toEqual({ kind: 'quotes', tone: 'blue', label: 'Quotes (2)' })
  })
  it('queued → blue, working names the quote count, blocked → amber, ready → green with the summary', () => {
    expect(derivePricingChip([waitingRfq], 0, [req()])).toMatchObject({ kind: 'robot', tone: 'blue', label: 'Robot pricing · queued', requestId: 'req-1' })
    expect(derivePricingChip([], 0, [req({ status: 'working' })])).toMatchObject({ tone: 'blue', label: 'Robot pricing · reading 1 quote' })
    expect(derivePricingChip([], 0, [req({ status: 'blocked' })])).toMatchObject({ tone: 'amber', label: 'Robot pricing · blocked' })
    expect(derivePricingChip([], 3, [req({ status: 'ready', result: { rows_priced: 23, rows_asked: 4 } })])).toMatchObject({
      tone: 'green',
      label: 'Matrix ready · 23 picks, 4 to settle',
    })
  })
  it('once reviewed, the RFQ chip is back', () => {
    expect(derivePricingChip([], 3, [req({ status: 'ready', reviewed_at: '2026-09-10T20:00:00Z' })])).toEqual({ kind: 'quotes', tone: 'blue', label: 'Quotes (3)' })
  })
})

describe('requestAgeLabel', () => {
  it('speaks the Queue lens dialect', () => {
    const now = Date.parse('2026-09-10T20:00:00Z')
    expect(requestAgeLabel('2026-09-10T19:40:00Z', now)).toBe('just now')
    expect(requestAgeLabel('2026-09-10T17:00:00Z', now)).toBe('3h ago')
    expect(requestAgeLabel('2026-09-09T20:00:00Z', now)).toBe('yesterday')
    expect(requestAgeLabel('2026-09-07T20:00:00Z', now)).toBe('3d ago')
  })
})

describe('buildPricerRequestPrompt', () => {
  it('pins the kickoff to the request: id, bid, who asked, sources, row count, the rules', () => {
    const p = buildPricerRequestPrompt(req(), { bid_number: '359', project_name: 'SPACEX BA-2 CORE AND SHELL' }, 'Wendi')
    expect(p).toContain('twin-pricer-1')
    expect(p).toContain('request req-1 on b359 (SPACEX BA-2 CORE AND SHELL; asked by Wendi 2026-09-10 19:14)')
    expect(p).toContain('1 source (National Wholesale Supply)')
    expect(p).toContain('The 1 fixture rows in the request snapshot are the only rows you price.')
    expect(p).toContain('every bid verb is refused to you')
    expect(p).toContain("ask_question(kind: 'choice', audience: 'estimator')")
  })
})
