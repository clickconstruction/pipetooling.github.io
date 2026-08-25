import { describe, expect, it } from 'vitest'
import {
  buildTabLadder,
  deriveTabSummaryFromEntries,
  markEntryOurs,
  parseBidTabPaste,
} from './bidTabPaste'

// The Culebra block from Burd & Assoc.'s 2026-08-21 "Bid Tabs for Take 5's" email.
const CULEBRA = `Culebra
$40,500
$54,500
$146,500
$56,500
$39,919 - Click Plumbing
$115,000`

describe('parseBidTabPaste', () => {
  it('parses the Culebra email block: 6 entries, ours auto-detected, header skipped', () => {
    const { entries, skippedLines } = parseBidTabPaste(CULEBRA)
    expect(entries).toHaveLength(6)
    expect(skippedLines).toEqual(['Culebra'])
    const ours = entries.find((e) => e.isOurs)!
    expect(ours.amount).toBe(39919)
    expect(ours.bidderName).toBe('Click Plumbing')
    expect(entries.filter((e) => e.isOurs)).toHaveLength(1)
  })

  it('attaches "(alternate $X)" to the same line and keeps the name', () => {
    const { entries } = parseBidTabPaste('Click $42,977  (alternate $100,672)')
    expect(entries).toEqual([
      { amount: 42977, alternateAmount: 100672, bidderName: 'Click', isOurs: true },
    ])
  })

  it('accepts a bare-number line but never a number inside words', () => {
    const { entries, skippedLines } = parseBidTabPaste('Take 5 - Post Oak\n39,400\nno numbers here')
    expect(entries).toEqual([{ amount: 39400, alternateAmount: null, bidderName: null, isOurs: false }])
    expect(skippedLines).toEqual(['Take 5 - Post Oak', 'no numbers here'])
  })

  it('flags ours on the first Click line only', () => {
    const { entries } = parseBidTabPaste('$10 - Click\n$20 - Click Plumbing')
    expect(entries.map((e) => e.isOurs)).toEqual([true, false])
  })
})

describe('deriveTabSummaryFromEntries', () => {
  it('derives the v2.2081 summary from the Culebra tab — we were #1 of 6', () => {
    const { entries } = parseBidTabPaste(CULEBRA)
    expect(deriveTabSummaryFromEntries(entries)).toEqual({
      low: 39919,
      high: 146500,
      rankFromLow: 1,
      bidderCount: 6,
    })
  })

  it('rank is null when no entry is ours; empty in, nulls out', () => {
    const { entries } = parseBidTabPaste('$100\n$200')
    expect(deriveTabSummaryFromEntries(entries).rankFromLow).toBe(null)
    expect(deriveTabSummaryFromEntries([])).toEqual({ low: null, high: null, rankFromLow: null, bidderCount: null })
  })
})

describe('markEntryOurs / buildTabLadder', () => {
  it('markEntryOurs moves the flag to exactly one entry', () => {
    const { entries } = parseBidTabPaste(CULEBRA)
    const moved = markEntryOurs(entries, 0) // $40,500
    expect(moved.filter((e) => e.isOurs).map((e) => e.amount)).toEqual([40500])
  })

  it('ladder is sorted, ranked, scaled, and gap-annotated', () => {
    const { entries } = parseBidTabPaste(CULEBRA)
    const ladder = buildTabLadder(entries)
    expect(ladder.map((r) => r.amount)).toEqual([39919, 40500, 54500, 56500, 115000, 146500])
    expect(ladder[0]!.rank).toBe(1)
    expect(ladder[0]!.gapBelow).toBe(null)
    expect(ladder[1]!.gapBelow).toBe(581)
    expect(ladder[5]!.widthPct).toBe(100)
    expect(ladder[0]!.widthPct).toBe(27)
  })
})
