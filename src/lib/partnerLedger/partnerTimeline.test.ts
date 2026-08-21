import { describe, expect, it } from 'vitest'
import type { JournalRow } from './partnerLedgerJournal'
import { buildPartnerTimeline, chargeTypeLabel, filterPartnerTimeline, type TimelineEventInputs } from './partnerTimeline'

const journal: JournalRow[] = [
  { date: '2026-08-15', label: 'Labor — 40.5 h (week of 2026-08-09)', detail: null, amount: 1755, balance: 1755, kind: 'labor', pay_stub_id: 's1' },
  { date: '2026-08-15', label: 'Profit share — Job 781', detail: null, amount: 1051.05, balance: 2806.05, kind: 'addition', pay_stub_id: 's1' },
  { date: '2026-08-15', label: 'Back-charge — return trip', detail: null, amount: -150, balance: 2656.05, kind: 'deduction', pay_stub_id: 's1' },
  { date: '2026-08-16', label: 'Paid out', detail: 'CashApp', amount: -1625, balance: 1031.05, kind: 'payout', pay_stub_id: 's1' },
]

const events: TimelineEventInputs = {
  pendingCharges: [{ type: 'backcharge', amount: 66.23, occurred_date: '2026-08-19', description: 'no-show 8/19' }],
  ncns: [{ work_date: '2026-08-19', details: 'crew waited 45 min' }],
  declines: [{ declined_at: '2026-08-18T14:00:00Z', decline_reason: 'truck in shop', amount: 1200 }],
  confirmedJobs: [{ label: '781', confirmed_at: '2026-08-14T20:00:00Z' }],
  statements: [{ period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: '2026-08-16' }],
}

describe('buildPartnerTimeline', () => {
  it('merges journal and events newest-first with money-first same-date order', () => {
    const rows = buildPartnerTimeline(journal, events)
    // 8/19: money-first convention — the pending charge precedes the NCNS event
    expect(rows[0]?.kind).toBe('charge_pending')
    expect(rows[1]?.kind).toBe('ncns')
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort().reverse())
    // 8/15: labor → addition → deduction posted before stmt marker; stmt (event) after money
    const d15 = rows.filter((r) => r.date === '2026-08-15').map((r) => r.kind)
    expect(d15).toEqual(['labor', 'addition', 'deduction', 'stmt'])
  })

  it('pending charges carry signed amounts but no balance', () => {
    const rows = buildPartnerTimeline(journal, events)
    const pend = rows.find((r) => r.kind === 'charge_pending')
    expect(pend?.amount).toBe(-66.23)
    expect(pend?.balance).toBeNull()
    expect(pend?.label).toContain('Back-charge')
  })

  it('event rows have no amount and preserve reasons', () => {
    const rows = buildPartnerTimeline(journal, events)
    expect(rows.find((r) => r.kind === 'decline')?.label).toContain('truck in shop')
    expect(rows.find((r) => r.kind === 'job')?.label).toContain('#781')
    expect(rows.find((r) => r.kind === 'stmt')?.sub).toContain('awaiting partner')
    expect(rows.filter((r) => ['ncns', 'decline', 'job', 'stmt'].includes(r.kind)).every((r) => r.amount === null)).toBe(true)
  })

  it('confirmed jobs with a service type carry trade and drop the "Job #" prefix', () => {
    const rows = buildPartnerTimeline([], {
      ...events,
      confirmedJobs: [
        { label: '781', confirmed_at: '2026-08-14T20:00:00Z', service_type_name: 'Plumbing' },
        { label: '813', confirmed_at: '2026-08-13T20:00:00Z' },
      ],
    })
    const jobs = rows.filter((r) => r.kind === 'job')
    expect(jobs[0]?.trade).toBe('Plumbing')
    expect(jobs[0]?.label).toBe('781 confirmed as partner-majority')
    expect(jobs[1]?.trade ?? null).toBeNull()
    expect(jobs[1]?.label).toBe('Job #813 confirmed as partner-majority')
  })

  it('skips declines without a declined_at and statements render ack states', () => {
    const rows = buildPartnerTimeline([], {
      ...events,
      declines: [{ declined_at: null, decline_reason: 'x', amount: null }],
      statements: [{ period_start: 'a', period_end: 'b', partner_ack_at: '2026-08-17', company_ack_at: '2026-08-16' }],
    })
    expect(rows.some((r) => r.kind === 'decline')).toBe(false)
    expect(rows.find((r) => r.kind === 'stmt')?.sub).toBe('acknowledged by both')
  })
})

describe('filterPartnerTimeline', () => {
  const rows = buildPartnerTimeline(journal, events)
  it('money keeps postings + pending charges, drops incidents', () => {
    const f = filterPartnerTimeline(rows, 'money')
    expect(f.every((r) => ['labor', 'addition', 'deduction', 'payout', 'charge_pending'].includes(r.kind))).toBe(true)
    expect(f.some((r) => r.kind === 'charge_pending')).toBe(true)
  })
  it('infractions keeps charges (posted + pending), ncns, declines', () => {
    const kinds = new Set(filterPartnerTimeline(rows, 'infractions').map((r) => r.kind))
    expect(kinds).toEqual(new Set(['deduction', 'charge_pending', 'ncns', 'decline']))
  })
  it('events keeps job + statement markers only', () => {
    const kinds = new Set(filterPartnerTimeline(rows, 'events').map((r) => r.kind))
    expect(kinds).toEqual(new Set(['job', 'stmt']))
  })
  it('all is identity', () => {
    expect(filterPartnerTimeline(rows, 'all')).toHaveLength(rows.length)
  })
})

describe('chargeTypeLabel', () => {
  it('maps known types and passes unknown through', () => {
    expect(chargeTypeLabel('backcharge')).toBe('Back-charge')
    expect(chargeTypeLabel('utility_overage')).toBe('Utility overage')
    expect(chargeTypeLabel('weird')).toBe('weird')
  })
})
