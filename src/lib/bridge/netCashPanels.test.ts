import { describe, expect, it } from 'vitest'
import { buildCashPanel, buildNetPanel } from './netCashPanels'

describe('buildNetPanel', () => {
  it('walks the change from the start to today and flags two cash figures', () => {
    const p = buildNetPanel({
      history: [
        { ymd: '2026-08-15', offset: -56, cashUsd: 50_000, arUsd: 344_600, apUsd: 243_200, netUsd: 151_400 },
        { ymd: '2026-10-10', offset: 0, cashUsd: 32_000, arUsd: 332_000, apUsd: 250_000, netUsd: 114_000 },
      ],
      startLabel: 'Aug 15',
      bankUsd: 390,
      typedRolledUsd: 32_100,
      typedLabel: 'Sep 3',
      pendingClosedHours: 585,
      paperProfitUsd: 54_600,
      billingLagUsd: 98_100,
      costGapUsd: -6100,
    })!
    expect(p.waterfall.map((b) => [b.label, b.usd])).toEqual([
      ['Aug 15', 151_400],
      ['cash', -18_000],
      ['owed to you', -12_600],
      ['owed by you grew', -6800],
      ['today', 114_000],
    ])
    expect(p.sources[0]!.tone).toBe('red')
    expect(p.sources[0]!.risk).toContain('the bank reads $390 and the typed figure rolled through the ledger reads $32.1k: $31.7k of flows are not in the app')
    expect(p.paper).toBe('Against the paper: profit for the same weeks says +$54.6k; net position says −$37.4k. The $92.0k between them is +$98.1k earned and not invoiced, less $6.1k of costs the paper misses. Net position moves when Bill moves.')
  })
  it('returns null with no history', () => {
    expect(buildNetPanel({ history: [], startLabel: 'Aug 15', bankUsd: null, typedRolledUsd: null, typedLabel: null, pendingClosedHours: 0, paperProfitUsd: null, billingLagUsd: null, costGapUsd: null })).toBeNull()
  })
})

describe('buildCashPanel', () => {
  it('walks the window from the bank through the receipts and the bills, and writes the lowest point', () => {
    const p = buildCashPanel({
      cashTodayUsd: 390,
      bankSynced: true,
      typedLabel: null,
      confidence: { promisedUsd: 1700, paceUsd: 88_900, lateUsd: 228_000, lateCount: 48, totalUsd: 318_600 },
      bills: [
        { usd: 118_000, label: 'Supply invoices due' },
        { usd: 7448, label: 'Payroll (estimated)' },
        { usd: 7448, label: 'Payroll (estimated)' },
        { usd: 63_000, label: 'Sub labor owed' },
      ],
      dailyDrainUsd: 45,
      daysAhead: 56,
      endUsd: 75_500,
      lowestUsd: -16_300,
      lowestLabel: 'Oct 12',
      floorUsd: 5000,
      clearsFloor: false,
      daysUnderFloor: 6,
      payrollWeeklyEstUsd: 7448,
      pendingClosedHours: 585,
      unattributedNoncard: 1151,
      doubtfulUsd: 14_300,
      doubtfulCount: 2,
      collectionsUsd: 17_500,
      collectionsCount: 4,
      carryLabel: 'Oct 17',
      carryUsd: 160_000,
    })
    expect(p.waterfall.map((b) => [b.label, Math.round(b.usd)])).toEqual([
      ['bank today', 390],
      ['promised', 1700],
      ['by pace', 88_900],
      ['late, assumed', 228_000],
      ['supply bills', -118_000],
      ['payroll', -14_896],
      ['sub labor', -63_000],
      ['office parts', -2520],
      ['end of window', 75_500],
    ])
    expect(p.sources[3]!.tone).toBe('red')
    expect(p.sources[3]!.from).toBe('48 late invoices assumed to land within their pace: $228k, 72% of the window')
    expect(p.sources[7]!.risk).toBe('one Friday payroll alone is $7.4k; the line can clear the floor on a Thursday and miss Friday')
    expect(p.lowest).toBe('The lowest point is −$16.3k on Oct 12, 6 days under the floor. It is a timing gap: $160k lands Oct 17 if the late invoices hold their pace. The week’s cash is Collect’s work; the window’s cash is Bill’s. Capital is the symptom, not the link.')
  })
})
