import { describe, expect, it } from 'vitest'
import { BILL_GUESS_PCT, billStageInput, buildBillPile, effectiveBillPct, type BillPileJob } from './billPile'
import { buildStageFlow } from './stageFlow'

const job = (over: Partial<BillPileJob> & { id: string }): BillPileJob => ({ status: 'working', revenueUsd: 100_000, pctComplete: null, billedUsd: 0, paymentsUsd: 0, ...over })

describe('buildBillPile (v2.5834)', () => {
  it('reads a working job as the percent done times the contract, less what is billed', () => {
    // SpaceX on 2026-10-24: $249,716 at 50 %, $103,386 marked billed by hand → $21,471 finished and not billed, not $146k.
    const pile = buildBillPile({ jobs: [job({ id: 'spacex', revenueUsd: 249_715.66, pctComplete: 50, billedUsd: 103_386.4 })] })
    expect(Math.round(pile.knownUsd)).toBe(21_471)
    expect(pile.knownJobs).toBe(1)
    expect(pile.guessJobs).toBe(0)
    expect(pile.items[0]).toMatchObject({ id: 'spacex', pct: 50, source: 'hand' })
  })

  it('never reads below zero when the office billed ahead of the percent', () => {
    // Megan Connell: 30 % on the row, 75 % billed.
    const pile = buildBillPile({ jobs: [job({ id: 'connell', revenueUsd: 37_745, pctComplete: 30, billedUsd: 28_309 })] })
    expect(pile.knownUsd).toBe(0)
    expect(pile.knownJobs).toBe(1)
  })

  it('counts the whole remainder on a ready-to-bill job, whatever its percent', () => {
    const pile = buildBillPile({ jobs: [job({ id: 'locks', status: 'ready_to_bill', revenueUsd: 215, pctComplete: null }), job({ id: 'done', status: 'ready_to_bill', revenueUsd: 10_000, pctComplete: 40, billedUsd: 4_000 })] })
    expect(pile.knownUsd).toBe(215 + 6_000)
    expect(pile.readyJobs).toBe(2)
    expect(pile.items.map((i) => i.source)).toEqual(['ready', 'ready'])
  })

  it('reads a working job with no percent as half done and keeps it apart as the guess', () => {
    // Dudley Mason: no %, $21,950, $17,560 billed → half the contract is already billed, the guess is $0 but the job is still grey.
    // NexGen: no %, $16,700, $13,360 billed → $0 too. Cano Camera: $350, nothing billed → $175.
    const pile = buildBillPile({ jobs: [job({ id: 'dudley', revenueUsd: 21_950, billedUsd: 17_560 }), job({ id: 'nexgen', revenueUsd: 16_700, billedUsd: 13_360 }), job({ id: 'cano', revenueUsd: 350 })] })
    expect(BILL_GUESS_PCT).toBe(50)
    expect(pile.guessUsd).toBe(175)
    expect(pile.guessJobs).toBe(3)
    expect(pile.knownJobs).toBe(0)
    expect(pile.items.every((i) => i.source === 'guess')).toBe(true)
  })

  it('leaves a job with no contract price out of both piles and counts it', () => {
    const pile = buildBillPile({ jobs: [job({ id: 'free', revenueUsd: 0, pctComplete: 100 }), job({ id: 'none', revenueUsd: null })] })
    expect(pile.noPriceJobs).toBe(2)
    expect(pile.knownUsd + pile.guessUsd).toBe(0)
    expect(pile.items.map((i) => i.source)).toEqual(['no-price', 'no-price'])
  })

  it('counts money paid on no bill as covering the work, and never counts a paid bill twice', () => {
    // Job 363 on 2026-10-24: 100 % done, $31,400, no bill with a billed day, $31,400 of payments → nothing waits on Bill.
    expect(buildBillPile({ jobs: [job({ id: '363', revenueUsd: 31_400, pctComplete: 100, paymentsUsd: 31_400 })] }).knownUsd).toBe(0)
    // A paid bill is one sum of money: the bill ($10k) and its payment ($10k) cover $10k, not $20k.
    expect(buildBillPile({ jobs: [job({ id: 'paid', revenueUsd: 30_000, pctComplete: 100, billedUsd: 10_000, paymentsUsd: 10_000 })] }).knownUsd).toBe(20_000)
    // A deposit on top of a billed sum covers the larger of the two.
    expect(buildBillPile({ jobs: [job({ id: 'dep', revenueUsd: 30_000, pctComplete: 100, billedUsd: 10_000, paymentsUsd: 12_000 })] }).knownUsd).toBe(18_000)
  })

  it("rests on the row's percent, lets a field report fill a job with none, and never reads a report from after today", () => {
    const points = [
      { jobId: 'j', atYmd: '2026-06-23', pct: 100, source: 'report' as const },
      { jobId: 'n', atYmd: '2026-07-30', pct: 80, source: 'report' as const },
      { jobId: 'n', atYmd: '2026-07-01', pct: 60, source: 'report' as const },
      { jobId: 'n', atYmd: '2026-10-30', pct: 100, source: 'report' as const },
      { jobId: 'h', atYmd: '2026-10-20', pct: 90, source: 'hand' as const },
    ]
    // Heron: the row says 40 %, an old report said 100 % — the office's word stands.
    expect(effectiveBillPct({ id: 'j', pctComplete: 40 }, points, '2026-10-24')).toEqual({ pct: 40, source: 'hand' })
    // NexGen: no percent on the row, the newest report on or before today fills it.
    expect(effectiveBillPct({ id: 'n', pctComplete: null }, points, '2026-10-24')).toEqual({ pct: 80, source: 'report' })
    // A hand point alone is not a fill: the row already carries the latest hand-set percent.
    expect(effectiveBillPct({ id: 'h', pctComplete: null }, points, '2026-10-24')).toBeNull()
    const pile = buildBillPile({ jobs: [job({ id: 'n', revenueUsd: 16_700, billedUsd: 13_360 })], points, todayYmd: '2026-10-24' })
    expect(pile.knownUsd).toBe(0)
    expect(pile.items[0]).toMatchObject({ pct: 80, source: 'report' })
  })

  it('feeds the stage flow the known pile with the guess grey, and the card says so', () => {
    const pile = buildBillPile({ jobs: [job({ id: 'a', pctComplete: 60, billedUsd: 20_000 }), job({ id: 'b', revenueUsd: 50_000 }), job({ id: 'c', status: 'ready_to_bill', revenueUsd: 1_000 })] })
    const bill = billStageInput(pile, 50_000, 40_000)
    expect(bill).toEqual({ pileUsd: 41_000, pileCount: 2, inPerWeekUsd: 50_000, outPerWeekUsd: 40_000, guessUsd: 25_000, guessJobs: 1 })
    const stage = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill, collect: null, build: null, heldLinkId: null }).stages.find((s) => s.id === 'bill')!
    expect(stage.pile.headline).toBe('$41k finished, not yet billed')
    expect(stage.pile.sub).toEqual(['on 2 jobs that have a %', 'grey: 1 job has no %'])
    expect(stage.pile.guessShare).toBeCloseTo(25_000 / 66_000)
    // The guess widens the range only when it moves the rounded figure: $41k and $53.5k at $40k a week both round to 1.
    expect(stage.weeksText).toBe('1.0 weeks to bill what is already finished')
    const wide = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: { ...bill, guessUsd: 120_000 }, collect: null, build: null, heldLinkId: null }).stages.find((s) => s.id === 'bill')!
    expect(wide.weeksText).toBe('1 to 3 weeks to bill what is already finished')
    expect(stage.badge).toBe('the weakest link · set the %s')
  })
})
