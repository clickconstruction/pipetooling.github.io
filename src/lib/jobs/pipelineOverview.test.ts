import { describe, expect, it } from 'vitest'
import { buildPipelineFixups, buildPipelineMoneyMoves, buildPipelineMoneyStory } from './pipelineOverview'
import type { StagesHeaderStats } from './stagesHeaderStats'

const stats = (over: Partial<StagesHeaderStats> = {}): StagesHeaderStats => ({
  waiting: { count: 17, total: 262300 },
  working: { count: 34, total: 247000 },
  readyToBill: { count: 1, total: 1850 },
  billed: { count: 121, total: 224400 },
  collections: { count: 5, total: 22800 },
  paid: { count: 630 },
  capableToBill: 71969,
  billedAging: { count30_90: 10, sum30_90: 40000, count90: 4, sum90: 44000 },
  collectedByDay: [0, 0, 0, 0, 12000, 30000, 40000, 36000].map((total, i) => ({
    dayYmd: `2026-0${i < 4 ? 7 : 8}-0${(i % 4) + 1}`,
    total,
  })),
  billedNoDate: 65,
  ...over,
})

describe('buildPipelineMoneyStory', () => {
  it('builds the four cards from header stats alone', () => {
    const cards = buildPipelineMoneyStory(stats())
    expect(cards.map((c) => c.key)).toEqual(['ready-to-ask', 'waiting-on-customers', 'in-collections', 'collected'])
    expect(cards[0]!.value).toBe('$73,819')
    expect(cards[0]!.sub).toContain('$71,969 capable in Working')
    expect(cards[0]!.sub).toContain('$1,850 in Ready to Bill')
    expect(cards[1]!.value).toBe('$224,400')
    expect(cards[1]!.tone).toBe('red-edge')
    // fresh = total − 30-90 − 90+ = 224,400 − 40,000 − 44,000
    expect(cards[1]!.ageBar).toEqual({ fresh: 140400, mid: 40000, old: 44000 })
    expect(cards[1]!.ageBarLabels?.right).toBe('90+ $44,000 · 4 bills')
    expect(cards[2]!.value).toBe('$22,800')
    expect(cards[2]!.sub).toBe('5 jobs')
    expect(cards[3]!.value).toBe('$118,000')
    expect(cards[3]!.spark).toEqual([0, 0, 0, 0, 12000, 30000, 40000, 36000])
  })

  it('includeCollected:false drops only the collected card (non dev/master viewers)', () => {
    const cards = buildPipelineMoneyStory(stats(), { includeCollected: false })
    expect(cards.map((c) => c.key)).toEqual(['ready-to-ask', 'waiting-on-customers', 'in-collections'])
  })

  it('no 90+ tail → waiting card is plain, not red', () => {
    const cards = buildPipelineMoneyStory(stats({ billedAging: { count30_90: 2, sum30_90: 500, count90: 0, sum90: 0 } }))
    expect(cards[1]!.tone).toBe('plain')
  })

  it('fresh segment never goes negative when buckets exceed the billed total', () => {
    const cards = buildPipelineMoneyStory(
      stats({ billed: { count: 2, total: 100 }, billedAging: { count30_90: 1, sum30_90: 80, count90: 1, sum90: 90 } }),
    )
    expect(cards[1]!.ageBar?.fresh).toBe(0)
  })
})

describe('buildPipelineMoneyMoves', () => {
  it('emits all four moves when every signal fires', () => {
    const moves = buildPipelineMoneyMoves({ stats: stats(), arUnallocatedCount: 2, canOpenAr: true })
    expect(moves.map((m) => m.key)).toEqual(['bill-capable', 'chase-90', 'allocate-deposits', 'fix-dates'])
    expect(moves[0]!.claim).toBe('Bill the finished work — $71,969')
    expect(moves[1]!.why).toBe('4 bills waiting 90+ days')
    expect(moves[2]!.claim).toBe('Allocate 2 bank deposits')
    expect(moves[3]!.claim).toBe('65 billed jobs have no bill line')
    expect(moves[3]!.actionLabel).toBe('Show them')
  })

  it('quiet board → only the standing idle AR card for AR roles; empty for others', () => {
    const quiet = {
      stats: stats({
        capableToBill: 0,
        billedAging: { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 },
        billedNoDate: 0,
      }),
      arUnallocatedCount: 0,
    }
    const arMoves = buildPipelineMoneyMoves({ ...quiet, canOpenAr: true })
    expect(arMoves.map((m) => m.key)).toEqual(['allocate-deposits'])
    expect(arMoves[0]!.idle).toBe(true)
    expect(arMoves[0]!.claim).toBe('Accounts Receivable')
    expect(arMoves[0]!.actionLabel).toBe('Open')
    expect(buildPipelineMoneyMoves({ ...quiet, canOpenAr: false })).toEqual([])
  })

  it('busy AR card carries the amber badge count and is not idle', () => {
    const moves = buildPipelineMoneyMoves({ stats: stats(), arUnallocatedCount: 2, canOpenAr: true })
    const ar = moves.find((m) => m.key === 'allocate-deposits')!
    expect(ar.badgeCount).toBe(2)
    expect(ar.idle).toBeUndefined()
  })

  it('AR move is suppressed for roles that cannot open Accounts Receivable', () => {
    const moves = buildPipelineMoneyMoves({ stats: stats(), arUnallocatedCount: 2, canOpenAr: false })
    expect(moves.some((m) => m.key === 'allocate-deposits')).toBe(false)
  })

  it('singular forms read correctly', () => {
    const moves = buildPipelineMoneyMoves({
      stats: stats({ billedAging: { count30_90: 0, sum30_90: 0, count90: 1, sum90: 500 }, billedNoDate: 1 }),
      arUnallocatedCount: 1,
      canOpenAr: true,
    })
    expect(moves.find((m) => m.key === 'chase-90')?.why).toBe('1 bill waiting 90+ days')
    expect(moves.find((m) => m.key === 'allocate-deposits')?.claim).toBe('Allocate 1 bank deposit')
    expect(moves.find((m) => m.key === 'fix-dates')?.claim).toBe('1 billed job has no bill line')
  })
})

describe('buildPipelineFixups', () => {
  it('builds a chip per non-zero count, in strip order, with tones', () => {
    const fixups = buildPipelineFixups({ noCustomer: 1, noPictures: 3, noEmail: 2 })
    expect(fixups.map((f) => [f.key, f.label, f.tone])).toEqual([
      ['no-customer', 'No customer · 1', 'red'],
      ['no-pictures', 'No customer pictures · 3', 'red'],
      ['no-email', 'No email · 2', 'amber'],
    ])
  })

  it('drops zero counts; all-clean yields an empty list (strip hides)', () => {
    expect(buildPipelineFixups({ noCustomer: 0, noPictures: 0, noEmail: 5 }).map((f) => f.key)).toEqual(['no-email'])
    expect(buildPipelineFixups({ noCustomer: 0, noPictures: 0, noEmail: 0 })).toEqual([])
  })
})
