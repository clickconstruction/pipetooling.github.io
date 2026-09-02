import { describe, expect, it } from 'vitest'

import { canNudge, coverageFromCompareRows, deriveRfqChip, deriveRfqTrail, scopeDriftCount, type DeskRfq } from './rfqDesk'
import { type CompareRow } from './quoteCompare'

const base: DeskRfq = {
  id: 'r1',
  houseName: 'Moore Supply',
  sentEmail: 'danny@moore.com',
  status: 'sent',
  createdAt: '2026-09-01T12:00:00Z',
  viewedAt: null,
  lastRemindedAt: null,
  reminderCount: 0,
  neededBy: '2026-09-12',
  emailLastEvent: null,
  scopeLines: [{ fixture: 'WC-1', count: 4 }],
}

describe('deriveRfqTrail', () => {
  it('walks Sent → Delivered → Viewed → Quoted, highlighting the next step', () => {
    const t = deriveRfqTrail({ ...base, emailLastEvent: 'delivered' })
    expect(t.map((s) => s.state)).toEqual(['on', 'on', 'now', 'off'])
  })
  it('a page view implies delivery even if the webhook never fired', () => {
    const t = deriveRfqTrail({ ...base, viewedAt: '2026-09-01T13:00:00Z' })
    expect(t.map((s) => `${s.key}:${s.state}`)).toEqual(['sent:on', 'delivered:on', 'viewed:on', 'quoted:now'])
  })
  it('bounce becomes the bad terminal branch', () => {
    const t = deriveRfqTrail({ ...base, emailLastEvent: 'bounced' })
    expect(t.map((s) => s.key)).toEqual(['sent', 'bounced'])
    expect(t[1]?.state).toBe('bad')
  })
  it('a bounce on an already-quoted request does not un-quote the trail', () => {
    const t = deriveRfqTrail({ ...base, status: 'quoted', viewedAt: '2026-09-01T13:00:00Z', emailLastEvent: 'bounced' })
    expect(t[t.length - 1]).toEqual({ key: 'quoted', label: 'Quoted', state: 'on' })
  })
  it('lane-A copied links get the shorter trail', () => {
    const t = deriveRfqTrail({ ...base, sentEmail: null })
    expect(t.map((s) => s.key)).toEqual(['link', 'viewed', 'quoted'])
  })
})

describe('canNudge', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const sentAt = new Date(base.createdAt).getTime()
  it('throttles inside 24h of the send, allows after', () => {
    expect(canNudge(base, sentAt + dayMs - 1).ok).toBe(false)
    expect(canNudge(base, sentAt + dayMs + 1).ok).toBe(true)
  })
  it('a nudge restarts the clock', () => {
    const nudged = { ...base, lastRemindedAt: '2026-09-02T12:00:00Z' }
    expect(canNudge(nudged, new Date('2026-09-03T00:00:00Z').getTime()).ok).toBe(false)
  })
  it('never nudges quoted, closed, or link-only requests', () => {
    const late = sentAt + 10 * dayMs
    expect(canNudge({ ...base, status: 'quoted' }, late).ok).toBe(false)
    expect(canNudge({ ...base, status: 'closed' }, late).ok).toBe(false)
    expect(canNudge({ ...base, sentEmail: null }, late).ok).toBe(false)
  })
})

describe('scopeDriftCount', () => {
  it('counts changed and vanished lines, ignores stable ones', () => {
    const current = new Map([
      ['wc-1', 4],
      ['fco', 9],
    ])
    const n = scopeDriftCount(
      [
        { fixture: 'WC-1', count: 4 },
        { fixture: 'FCO', count: 5 },
        { fixture: 'GCO', count: 2 },
      ],
      current,
    )
    expect(n).toBe(2)
  })
})

describe('deriveRfqChip', () => {
  it('five states: none / quotes-only / waiting / bounced / all-in', () => {
    expect(deriveRfqChip([], 0)).toEqual({ kind: 'none' })
    expect(deriveRfqChip([], 2)).toEqual({ kind: 'quotes', tone: 'blue', label: 'Quotes (2)' })
    expect(deriveRfqChip([base], 0)).toEqual({ kind: 'desk', tone: 'amber', label: 'RFQs · 1 waiting' })
    expect(deriveRfqChip([{ ...base, emailLastEvent: 'bounced' }], 0)).toEqual({ kind: 'desk', tone: 'red', label: 'RFQs · 1 bounced' })
    expect(deriveRfqChip([{ ...base, status: 'quoted' }], 3)).toEqual({ kind: 'desk', tone: 'green', label: 'Quotes (3) · all in' })
  })
  it('closed requests drop out of the chip entirely', () => {
    expect(deriveRfqChip([{ ...base, status: 'closed' }], 1)).toEqual({ kind: 'quotes', tone: 'blue', label: 'Quotes (1)' })
  })
  it('red beats amber when both exist', () => {
    const chip = deriveRfqChip([base, { ...base, id: 'r2', emailLastEvent: 'bounced' }], 0)
    expect(chip).toEqual({ kind: 'desk', tone: 'red', label: 'RFQs · 1 bounced' })
  })
})

describe('coverageFromCompareRows', () => {
  it('a line is covered only by a live, supplied price', () => {
    const rows = [
      { fixture: 'A', perHouse: { h1: { quoteId: 'q', unitPriceEachCents: 100, cantSupply: false, expired: false, picked: false } } },
      { fixture: 'B', perHouse: { h1: { quoteId: 'q', unitPriceEachCents: 100, cantSupply: false, expired: true, picked: false } } },
      { fixture: 'C', perHouse: { h1: { quoteId: 'q', unitPriceEachCents: null, cantSupply: true, expired: false, picked: false } } },
    ] as unknown as CompareRow[]
    expect(coverageFromCompareRows(rows)).toEqual({ total: 3, priced: 1, bare: ['B', 'C'] })
  })
})
