import { describe, expect, it } from 'vitest'

import {
  canNudge,
  coverageFromCompareRows,
  deriveRfqChip,
  deriveRfqTrail,
  deskRfqsFromRows,
  openRfqHouseIdsFromRows,
  rfqEmailEventsById,
  rfqReopenStatus,
  rfqResendEmailIds,
  scopeDriftCount,
  type DeskRfq,
  type PricingRfqRow,
} from './rfqDesk'
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
    // v2.3175: a request recorded by hand has no email lane to nudge.
    expect(canNudge({ ...base, sentVia: 'outside' }, late)).toEqual({ ok: false, reason: 'sent outside the app — nudge from your own email' })
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

describe('rfqUrgency + sortRfqsByUrgency', () => {
  const day = 24 * 60 * 60 * 1000
  const now = new Date('2026-09-05T12:00:00Z').getTime()
  const fresh: DeskRfq = { ...base, createdAt: '2026-09-05T09:00:00Z', neededBy: null }
  it('tiers: bounced < needed-by risk < unviewed-stale < viewed-silent < fresh < quoted', async () => {
    const { rfqUrgency } = await import('./rfqDesk')
    expect(rfqUrgency({ ...fresh, emailLastEvent: 'bounced' }, now).tier).toBe(0)
    expect(rfqUrgency({ ...fresh, neededBy: '2026-09-07' }, now)).toEqual({ tier: 1, reason: 'needed-by in 3 days — still silent' })
    expect(rfqUrgency({ ...fresh, neededBy: '2026-09-01' }, now).reason).toBe('needed-by has passed — still no quote')
    expect(rfqUrgency({ ...fresh, createdAt: '2026-09-02T09:00:00Z' }, now)).toEqual({ tier: 2, reason: 'unviewed for 3 days' })
    expect(rfqUrgency({ ...fresh, viewedAt: new Date(now - 2 * day).toISOString() }, now)).toEqual({ tier: 3, reason: 'viewed, still silent' })
    expect(rfqUrgency(fresh, now)).toEqual({ tier: 4, reason: null })
    expect(rfqUrgency({ ...fresh, status: 'quoted', emailLastEvent: 'bounced' }, now).tier).toBe(5)
  })
  it('a fresh view resets nothing but stays chip-free', async () => {
    const { rfqUrgency } = await import('./rfqDesk')
    expect(rfqUrgency({ ...fresh, viewedAt: new Date(now - day / 2).toISOString() }, now)).toEqual({ tier: 4, reason: null })
  })
  it('sorts by tier then oldest first', async () => {
    const { sortRfqsByUrgency } = await import('./rfqDesk')
    const rows: DeskRfq[] = [
      { ...fresh, id: 'fresh' },
      { ...fresh, id: 'bounce-new', createdAt: '2026-09-05T10:00:00Z', emailLastEvent: 'bounced' },
      { ...fresh, id: 'bounce-old', createdAt: '2026-09-04T10:00:00Z', emailLastEvent: 'bounced' },
      { ...fresh, id: 'quoted', status: 'quoted' },
      { ...fresh, id: 'risk', neededBy: '2026-09-06' },
    ]
    expect(sortRfqsByUrgency(rows, now).map((r) => r.id)).toEqual(['bounce-old', 'bounce-new', 'risk', 'fresh', 'quoted'])
  })
})

describe('rfqReopenStatus', () => {
  it('a closed request with a quote on file reopens as quoted', () => {
    expect(rfqReopenStatus({ hasQuote: true })).toBe('quoted')
  })
  it('a closed request with no quote reopens as sent — the link works again', () => {
    expect(rfqReopenStatus({ hasQuote: false })).toBe('sent')
  })
})

describe('the Pricing header read: rows → chip requests', () => {
  const row = (over: Partial<PricingRfqRow> = {}): PricingRfqRow => ({
    id: 'r1',
    status: 'sent',
    supply_house_id: 'h1',
    sent_to: 'Moore Supply',
    sent_email: 'danny@moore.com',
    resend_email_id: 're_1',
    created_at: '2026-09-01T12:00:00Z',
    viewed_at: null,
    last_reminded_at: null,
    reminder_count: 2,
    needed_by: '2026-09-12',
    ...over,
  })

  it('looks up one resend id per emailed request and skips copied links', () => {
    expect(rfqResendEmailIds([row(), row({ id: 'r2', resend_email_id: null }), row({ id: 'r3', resend_email_id: 're_3' })])).toEqual(['re_1', 're_3'])
    expect(rfqResendEmailIds([])).toEqual([])
  })

  it('maps a resend id to its last event; rows with no id or no event are skipped and the last row wins', () => {
    const m = rfqEmailEventsById([
      { resend_email_id: 're_1', last_event: 'delivered' },
      { resend_email_id: null, last_event: 'bounced' },
      { resend_email_id: 're_2', last_event: null },
      { resend_email_id: 're_1', last_event: 'opened' },
    ])
    expect([...m.entries()]).toEqual([['re_1', 'opened']])
  })

  it('names the houses with a request still out: sent only, and only with a house', () => {
    const ids = openRfqHouseIdsFromRows([
      row(),
      row({ id: 'r2', supply_house_id: 'h2', status: 'quoted' }),
      row({ id: 'r3', supply_house_id: null }),
      row({ id: 'r4', supply_house_id: 'h1' }),
      row({ id: 'r5', supply_house_id: 'h5', status: 'closed' }),
    ])
    expect([...ids]).toEqual(['h1'])
  })

  it('shapes a row for the chip: the email event by resend id, no scope lines', () => {
    const [d] = deskRfqsFromRows([row()], new Map([['re_1', 'delivered']]))
    expect(d).toEqual({
      id: 'r1',
      houseName: 'Moore Supply',
      sentEmail: 'danny@moore.com',
      status: 'sent',
      createdAt: '2026-09-01T12:00:00Z',
      viewedAt: null,
      lastRemindedAt: null,
      reminderCount: 2,
      neededBy: '2026-09-12',
      emailLastEvent: 'delivered',
      scopeLines: [],
    })
  })

  it('reads a missing status as sent, a missing reminder count as 0 and an unknown or absent resend id as no event', () => {
    const out = deskRfqsFromRows(
      [row({ status: null, reminder_count: null, resend_email_id: 're_9' }), row({ id: 'r2', resend_email_id: null })],
      new Map([['re_1', 'delivered']]),
    )
    expect(out.map((d) => [d.status, d.reminderCount, d.emailLastEvent])).toEqual([
      ['sent', 0, null],
      ['sent', 2, null],
    ])
  })

  it('feeds the chip: two requests out with one bounced reads as the desk chip in red', () => {
    const chip = deriveRfqChip(deskRfqsFromRows([row(), row({ id: 'r2', resend_email_id: 're_2' })], new Map([['re_2', 'bounced']])), 0)
    expect(chip.kind).toBe('desk')
    expect(chip.kind === 'desk' ? chip.tone : null).toBe('red')
  })
})
