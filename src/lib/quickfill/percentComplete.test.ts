import { describe, expect, it } from 'vitest'
import { progressPaymentForJob, type ProgressPaymentJobLike } from '../jobs/progressPaymentForJob'
import { plainWordsFailures } from '../plainWords'
import {
  PERCENT_COMPLETE_ALL_AGREE_LINE,
  parsePercentInput,
  percentCompleteCard,
  percentCompleteCase,
  percentCompleteFacts,
  percentCompleteList,
  percentCompleteNoteBody,
  percentDismissedWords,
  percentMove,
  percentSavedWords,
  percentStops,
  snapPercentToStops,
  snoozeHolds,
  snoozeUntilIso,
  tickedWords,
  type PercentCompleteFacts,
  type PercentCompleteJobInput,
  type PercentTick,
} from './percentComplete'

const TODAY = '2026-10-23'
const NOW = '2026-10-23T15:00:00.000Z'

const tick = (number: number, name: string, sharePct: number): PercentTick => ({ number, name, short: name, sharePct })

function facts(over: Partial<PercentCompleteFacts>): PercentCompleteFacts {
  return { pct: null, paidShare: null, ticked: [], tickedShare: 0, ...over }
}

/**
 * A three-stage job as the Pipeline draws it: Rough In · Top Out · Trim Set, each an Order
 * stage with its price, the paid ones on a paid invoice with a payment against it.
 */
function stageJob(opts: { id: string; pct: number | null; prices: [number, number, number]; paidStages: number; status?: string; names?: [string, string, string] }): ProgressPaymentJobLike & { newestPaidOn: string | null } {
  const names = opts.names ?? ['Rough In', 'Top Out', 'Trim Set']
  const fixtures = names.map((name, i) => ({
    id: `${opts.id}-f${i + 1}`,
    name,
    count: 1,
    line_unit_price: opts.prices[i]!,
    sequence_order: i,
    invoice_id: i < opts.paidStages ? `${opts.id}-inv${i + 1}` : null,
    stage_kind: 'order',
    progress_pct: null,
    shared_with_gc: false,
  }))
  const invoices = fixtures.filter((f) => f.invoice_id).map((f, i) => ({ id: f.invoice_id!, status: 'paid', amount: opts.prices[i]!, billed_at: `2026-09-${10 + i}` }))
  const payments = invoices.map((inv, i) => ({ invoice_id: inv.id, paid_on: `2026-09-${16 + i}`, amount: inv.amount }))
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  return {
    id: opts.id,
    revenue: opts.prices.reduce((s, n) => s + n, 0),
    payments_made: paid,
    pct_complete: opts.pct,
    status: opts.status ?? 'working',
    fixtures,
    invoices,
    payments,
    newestPaidOn: payments.length ? payments[payments.length - 1]!.paid_on : null,
  }
}

function input(job: ReturnType<typeof stageJob>, jobNumber: string, jobName = 'Hunter Homes, lot 12'): PercentCompleteJobInput {
  const { model, view } = progressPaymentForJob(job, null, TODAY)
  return { id: job.id, jobNumber, jobName, status: job.status ?? null, pct: job.pct_complete, money: model, view, newestPaidOn: job.newestPaidOn }
}

describe('percentCompleteFacts', () => {
  it('job 879: Rough paid on a $41,550 bid reads as one tick worth 40% and 40% paid', () => {
    const f = percentCompleteFacts(input(stageJob({ id: '879', pct: 0, prices: [16620, 16620, 8310], paidStages: 1 }), '879'))
    expect(f.pct).toBe(0)
    expect(f.paidShare).toBe(40)
    expect(f.ticked.map((t) => t.short)).toEqual(['Rough'])
    expect(f.tickedShare).toBe(40)
  })

  it('job 892: Rough and Top Out paid on a $37,745 bid read as two ticks worth 75%', () => {
    const f = percentCompleteFacts(input(stageJob({ id: '892', pct: 30, prices: [14154, 14155, 9436], paidStages: 2 }), '892'))
    expect(f.pct).toBe(30)
    expect(f.paidShare).toBe(75)
    expect(f.ticked.map((t) => t.short)).toEqual(['Rough', 'Top Out'])
    expect(f.tickedShare).toBe(75)
  })

  it('a paid Deposit stage is neither a tick nor paid work', () => {
    const f = percentCompleteFacts(input(stageJob({ id: 'd', pct: 0, prices: [5000, 10000, 5000], paidStages: 1, names: ['50% deposit', 'Rough In', 'Trim Set'] }), 'd'))
    expect(f.ticked).toEqual([])
    expect(f.tickedShare).toBe(0)
    expect(f.paidShare).toBe(0)
  })

  it('a job with no bid has no paid share', () => {
    const job = { ...stageJob({ id: 'n', pct: 20, prices: [0, 0, 0], paidStages: 0 }), revenue: null, fixtures: [] }
    const f = percentCompleteFacts(input(job, 'n'))
    expect(f.paidShare).toBeNull()
    expect(f.ticked).toEqual([])
  })
})

describe('percentCompleteCase', () => {
  it('nothing done: a stage ticked and the % 0 (job 879)', () => {
    const c = percentCompleteCase(facts({ pct: 0, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }))
    expect(c?.kind).toBe('nothing-done')
    expect(c?.suggestedPct).toBe(40)
    expect(c?.suggestedFrom).toBe('stages')
    expect(c?.sentence).toBe('Rough is ticked and 40% is paid, but the job says 0% done.')
    expect(c?.noteWords).toBe('Rough is ticked and 40% is paid, but the job said 0% done.')
  })

  it('nothing done: a stage ticked and no % yet', () => {
    const c = percentCompleteCase(facts({ pct: null, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }))
    expect(c?.kind).toBe('nothing-done')
    expect(c?.sentence).toBe('Rough is ticked and 40% is paid, but the job has no % yet.')
  })

  it('behind the stages: two ticked worth 75% and the % at 30 (job 892)', () => {
    const c = percentCompleteCase(facts({ pct: 30, paidShare: 75, ticked: [tick(1, 'Rough', 37.5), tick(2, 'Top Out', 37.5)], tickedShare: 75 }))
    expect(c?.kind).toBe('behind-the-stages')
    expect(c?.suggestedPct).toBe(75)
    expect(c?.sentence).toBe('Rough and Top Out are ticked and 75% is paid, but the job says 30% done.')
  })

  it('the stages tolerance: five points under the ticked share is still agreement', () => {
    expect(percentCompleteCase(facts({ pct: 70, paidShare: 75, ticked: [tick(1, 'Rough', 75)], tickedShare: 75 }))).toBeNull()
    expect(percentCompleteCase(facts({ pct: 69, paidShare: 75, ticked: [tick(1, 'Rough', 75)], tickedShare: 75 }))?.kind).toBe('behind-the-stages')
  })

  it('a % ahead of the ticked stages is not a case', () => {
    expect(percentCompleteCase(facts({ pct: 90, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }))).toBeNull()
  })

  it('behind the money: no stage ticked, 60% paid, 20% done', () => {
    const c = percentCompleteCase(facts({ pct: 20, paidShare: 60 }))
    expect(c?.kind).toBe('behind-the-money')
    expect(c?.suggestedPct).toBe(60)
    expect(c?.suggestedFrom).toBe('paid')
    expect(c?.sentence).toBe('60% of the bid is paid, but the job says 20% done.')
  })

  it('the money tolerance: ten points under the paid share is still agreement, and under 10% paid says nothing', () => {
    expect(percentCompleteCase(facts({ pct: 50, paidShare: 60 }))).toBeNull()
    expect(percentCompleteCase(facts({ pct: 49, paidShare: 60 }))?.kind).toBe('behind-the-money')
    expect(percentCompleteCase(facts({ pct: 0, paidShare: 9 }))).toBeNull()
    expect(percentCompleteCase(facts({ pct: 0, paidShare: 10 }))?.kind).toBe('nothing-done')
  })

  it('paid in full and under 100% done suggests 100', () => {
    const c = percentCompleteCase(facts({ pct: 80, paidShare: 100, ticked: [tick(1, 'Rough', 50), tick(2, 'Trim', 50)], tickedShare: 100 }))
    expect(c?.kind).toBe('paid-in-full')
    expect(c?.suggestedPct).toBe(100)
    expect(c?.sentence).toBe('The bid is paid in full, but the job says 80% done.')
    expect(percentCompleteCase(facts({ pct: 100, paidShare: 100 }))).toBeNull()
  })

  it('agreement and no facts are null', () => {
    expect(percentCompleteCase(facts({ pct: 40, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }))).toBeNull()
    expect(percentCompleteCase(facts({ pct: null }))).toBeNull()
    expect(percentCompleteCase(facts({ pct: 0, paidShare: 0 }))).toBeNull()
  })

  it('every sentence is plain words', () => {
    const cases = [
      facts({ pct: 0, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }),
      facts({ pct: null, paidShare: 40, ticked: [tick(1, 'Rough', 40)], tickedShare: 40 }),
      facts({ pct: 30, paidShare: 75, ticked: [tick(1, 'Rough', 37.5), tick(2, 'Top Out', 37.5)], tickedShare: 75 }),
      facts({ pct: 10, paidShare: 90, ticked: [tick(1, 'Ground', 20), tick(2, 'Rough', 30), tick(3, 'Top Out', 20), tick(4, 'Trim', 20)], tickedShare: 90 }),
      facts({ pct: 10, paidShare: 70, ticked: [tick(1, 'Ground', 20), tick(2, 'Rough', 30), tick(3, 'Top Out', 20)], tickedShare: 70 }),
      facts({ pct: 20, paidShare: 60 }),
      facts({ pct: 80, paidShare: 100 }),
    ]
    for (const f of cases) {
      const c = percentCompleteCase(f)
      expect(c).not.toBeNull()
      expect(plainWordsFailures(c!.sentence)).toEqual([])
      expect(plainWordsFailures(c!.noteWords)).toEqual([])
    }
    expect(plainWordsFailures(PERCENT_COMPLETE_ALL_AGREE_LINE)).toEqual([])
    expect(plainWordsFailures(percentCompleteList([], new Map(), NOW).line)).toEqual([])
  })
})

describe('tickedWords', () => {
  it('names up to three stages and counts more', () => {
    expect(tickedWords([])).toBe('no stage')
    expect(tickedWords([tick(1, 'Rough', 40)])).toBe('Rough')
    expect(tickedWords([tick(1, 'Rough', 40), tick(2, 'Top Out', 35)])).toBe('Rough and Top Out')
    expect(tickedWords([tick(1, 'Ground', 20), tick(2, 'Rough', 30), tick(3, 'Top Out', 20)])).toBe('Ground, Rough and Top Out')
    expect(tickedWords([tick(1, 'Ground', 20), tick(2, 'Rough', 30), tick(3, 'Top Out', 20), tick(4, 'Trim', 20)])).toBe('4 stages')
  })
})

describe('percentCompleteCard and percentCompleteList', () => {
  const j879 = input(stageJob({ id: '879', pct: 0, prices: [16620, 16620, 8310], paidStages: 1 }), '879', 'Hunter Homes, lot 12')
  const j892 = input(stageJob({ id: '892', pct: 30, prices: [14154, 14155, 9436], paidStages: 2 }), '892', 'Cedar Bend, building C')
  const fine = input(stageJob({ id: 'ok', pct: 40, prices: [16620, 16620, 8310], paidStages: 1 }), '900')
  const paidJob = input(stageJob({ id: 'p', pct: 0, prices: [16620, 16620, 8310], paidStages: 3, status: 'paid' }), '700')

  it('builds the two cards the owner named and leaves the agreeing and the paid jobs out', () => {
    const c879 = percentCompleteCard(j879)
    expect(c879?.kind).toBe('nothing-done')
    expect(c879?.label).toBe('879 · Hunter Homes, lot 12')
    expect(c879?.suggestedPct).toBe(40)
    expect(c879?.sentence).toBe('Rough is ticked and 40% is paid, but the job says 0% done.')
    const c892 = percentCompleteCard(j892)
    expect(c892?.kind).toBe('behind-the-stages')
    expect(c892?.suggestedPct).toBe(75)
    expect(c892?.sentence).toBe('Rough and Top Out are ticked and 75% is paid, but the job says 30% done.')
    expect(percentCompleteCard(fine)).toBeNull()
    expect(percentCompleteCard(paidJob)).toBeNull()
  })

  it('orders newest money first, holds back a live snooze and counts it, and lets a spent snooze go', () => {
    const list = percentCompleteList([j879, j892, fine], new Map(), NOW)
    // 892's second payment landed 2026-09-17; 879's only one on 2026-09-16.
    expect(list.cards.map((c) => c.jobNumber)).toEqual(['892', '879'])
    expect(list.count).toBe(2)
    expect(list.line).toBe('2 open jobs where the stages or the money disagree with the % done.')
    const held = percentCompleteList([j879, j892], new Map([['892', '2026-10-30T15:00:00.000Z']]), NOW)
    expect(held.cards.map((c) => c.jobNumber)).toEqual(['879'])
    expect(held.snoozedCount).toBe(1)
    expect(held.line).toBe('1 open job where the stages or the money disagree with the % done.')
    const spent = percentCompleteList([j879, j892], new Map([['892', '2026-10-22T15:00:00.000Z']]), NOW)
    expect(spent.cards.length).toBe(2)
    expect(spent.snoozedCount).toBe(0)
    expect(percentCompleteList([fine], new Map(), NOW).line).toBe(PERCENT_COMPLETE_ALL_AGREE_LINE)
  })
})

describe('percentStops and percentMove (v2.5805, the slider)', () => {
  const j879 = input(stageJob({ id: '879', pct: 0, prices: [16620, 16620, 8310], paidStages: 1 }), '879')
  const j892 = input(stageJob({ id: '892', pct: 30, prices: [14154, 14155, 9436], paidStages: 2 }), '892')

  it('one stop per stage end, ticked stages with their check, in bar order', () => {
    expect(percentStops({ view: j879.view, paidShare: 40 }).map((s) => s.words)).toEqual(['Rough ✓ 40%', 'Top Out 80%', 'Trim 100%'])
    expect(percentStops({ view: j892.view, paidShare: 75 }).map((s) => s.words)).toEqual(['Rough ✓ 37%', 'Top Out ✓ 75%', 'Trim 100%'])
  })

  it('the paid share is a stop of its own only when it is not a stage end', () => {
    const between = percentStops({ view: j879.view, paidShare: 57 })
    expect(between.map((s) => s.words)).toEqual(['Rough ✓ 40%', 'Paid 57%', 'Top Out 80%', 'Trim 100%'])
    expect(between[1]).toMatchObject({ kind: 'paid', label: 'Paid', pct: 57 })
    expect(percentStops({ view: j879.view, paidShare: 0 }).map((s) => s.pct)).toEqual([40, 80, 100])
    expect(percentStops({ view: j879.view, paidShare: null }).map((s) => s.pct)).toEqual([40, 80, 100])
  })

  it('a Deposit stage is no stop, and the stages after it run on the same share the ticks use', () => {
    const d = input(stageJob({ id: 'd', pct: 0, prices: [5000, 10000, 5000], paidStages: 1, names: ['50% deposit', 'Rough In', 'Trim Set'] }), 'd')
    const f = percentCompleteFacts(d)
    expect(percentStops({ view: d.view, paidShare: f.paidShare }).map((s) => s.words)).toEqual(['Rough 50%', 'Trim 75%'])
  })

  it('a job with no stages has only the paid share, and no bid has nothing', () => {
    const lines = { ...stageJob({ id: 'l', pct: 60, prices: [3200, 0, 0], paidStages: 1 }), fixtures: [{ id: 'l-f1', name: 'Water heater', count: 1, line_unit_price: 3200, sequence_order: 0, invoice_id: 'l-inv1', stage_kind: 'any', progress_pct: null, shared_with_gc: false }] }
    const li = input(lines, 'l')
    expect(li.view.mode).not.toBe('stages')
    expect(percentStops({ view: li.view, paidShare: 100 }).map((s) => s.words)).toEqual(['Paid 100%'])
    const none = input({ ...stageJob({ id: 'n', pct: 20, prices: [0, 0, 0], paidStages: 0 }), revenue: null, fixtures: [] }, 'n')
    expect(percentStops({ view: none.view, paidShare: null })).toEqual([])
  })

  it("a stage's share is the bar's own, so a ticked stage's share is its block's end even when the bid differs from the stage prices' sum", () => {
    // 892 with a bid $3,000 under its stage prices: the bar still splits by the prices, and so does the suggestion.
    const discounted = input({ ...stageJob({ id: 'x', pct: 30, prices: [14154, 14155, 9436], paidStages: 2 }), revenue: 34745 }, 'x')
    const f = percentCompleteFacts(discounted)
    expect(f.ticked.map((t) => Math.round(t.sharePct * 10) / 10)).toEqual([37.5, 37.5])
    expect(f.tickedShare).toBe(75)
    expect(percentStops({ view: discounted.view, paidShare: f.paidShare }).map((s) => s.pct)).toEqual([37, 75, 81, 100])
  })

  it('the card carries its stops, and the suggestion is one of them', () => {
    const c = percentCompleteCard(j879)!
    expect(c.stops.map((s) => s.pct)).toEqual([40, 80, 100])
    expect(c.stops.some((s) => s.pct === c.suggestedPct)).toBe(true)
    const c2 = percentCompleteCard(j892)!
    expect(c2.stops.some((s) => s.pct === c2.suggestedPct)).toBe(true)
  })

  it('a knob let go within two points of a stop lands on it, the nearest one when two are close', () => {
    const stops = [40, 57, 80, 100]
    expect(snapPercentToStops(38, stops)).toBe(40)
    expect(snapPercentToStops(42, stops)).toBe(40)
    expect(snapPercentToStops(43, stops)).toBe(43)
    expect(snapPercentToStops(59, stops)).toBe(57)
    expect(snapPercentToStops(98, stops)).toBe(100)
    expect(snapPercentToStops(70, stops)).toBe(70)
    expect(snapPercentToStops(41, [40, 42])).toBe(40)
    expect(snapPercentToStops(50, [])).toBe(50)
    expect(snapPercentToStops(45, stops, 5)).toBe(40)
  })

  it('reads the move: up, down, no change, and from no % at all', () => {
    expect(percentMove(0, 57)).toEqual({ from: '0%', to: '57%', delta: '▲ 57', tone: 'up', same: false })
    expect(percentMove(75, 60)).toEqual({ from: '75%', to: '60%', delta: '▼ 15', tone: 'down', same: false })
    expect(percentMove(40, 40)).toEqual({ from: '40%', to: '40%', delta: null, tone: 'none', same: true })
    expect(percentMove(null, 0)).toEqual({ from: 'No %', to: '0%', delta: null, tone: 'up', same: false })
  })
})

describe('snoozes and words', () => {
  it('a snooze holds until its hour and lasts a week', () => {
    expect(snoozeHolds('2026-10-30T15:00:00.000Z', NOW)).toBe(true)
    expect(snoozeHolds('2026-10-23T14:59:00.000Z', NOW)).toBe(false)
    expect(snoozeHolds(null, NOW)).toBe(false)
    expect(snoozeHolds('nope', NOW)).toBe(false)
    expect(snoozeUntilIso(NOW)).toBe('2026-10-30T15:00:00.000Z')
  })

  it('the note starts "N% complete" so the activity parsers read it, and the lines say what happened', () => {
    const card = { noteWords: 'Rough is ticked and 40% is paid, but the job said 0% done.', jobNumber: '879', pct: 0 }
    expect(percentCompleteNoteBody(40, card)).toBe('40% complete — Rough is ticked and 40% is paid, but the job said 0% done. Set in Quickfill.')
    expect(percentSavedWords(card, 40)).toBe('879 set to 40%. Was 0%.')
    expect(percentSavedWords({ jobNumber: '879', pct: null }, 40)).toBe('879 set to 40%. Had no % before.')
    expect(percentDismissedWords(card, '2026-10-30T15:00:00.000Z')).toBe('879 dismissed until Oct 30.')
  })

  it('parses a whole percent from 0 to 100 and nothing else', () => {
    expect(parsePercentInput('40')).toBe(40)
    expect(parsePercentInput(' 100% ')).toBe(100)
    expect(parsePercentInput('0')).toBe(0)
    expect(parsePercentInput('101')).toBeNull()
    expect(parsePercentInput('4.5')).toBeNull()
    expect(parsePercentInput('')).toBeNull()
    expect(parsePercentInput('-1')).toBeNull()
  })
})
