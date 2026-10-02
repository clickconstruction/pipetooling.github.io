import { describe, expect, it } from 'vitest'
import { blockMoneyWords, buildJobMoneyBar, tickLeftPct } from './jobMoneyBar'
import { crewPositionsFromRpc, type JobCrewPositionRpcRow } from './jobCrewPosition'
import { progressPaymentForJob } from './progressPaymentForJob'

const today = '2026-10-01'
const line = (id: string, name: string, price: number, seq: number, extra: Record<string, unknown> = {}) => ({ id, name, count: 1, line_unit_price: price, sequence_order: seq, invoice_id: null, stage_kind: 'any', progress_pct: null, ...extra })
const stage = (id: string, name: string, price: number, seq: number) => line(id, name, price, seq, { stage_kind: 'order' })
const crewRow = (over: Partial<JobCrewPositionRpcRow> & { job_ledger_id: string }): JobCrewPositionRpcRow => ({
  last_work_date: null,
  last_day_people: null,
  sessions_60d: 0,
  people_60d: 0,
  sheet_stage: null,
  sheet_names: null,
  sheet_date: null,
  sheet_progress_pct: null,
  sheet_stage_changed_at: null,
  report_pct: null,
  report_at: null,
  pct_manual_at: null,
  ...over,
})
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('tickLeftPct', () => {
  it('walks the money shares and lands at the same fraction of the drawn block', () => {
    // 742: three paid lines then the windows line; the salt line is floored wider than its share.
    const segs = [
      { sharePct: 21.58, widthPct: 20.2 },
      { sharePct: 43.45, widthPct: 40.4 },
      { sharePct: 2.23, widthPct: 9.1 },
      { sharePct: 32.74, widthPct: 30.3 },
    ]
    expect(tickLeftPct(segs, 75)).toBeCloseTo(69.7 + ((75 - 67.26) / 32.74) * 30.3, 1)
    expect(tickLeftPct(segs, 0)).toBe(0)
    expect(tickLeftPct(segs, 100)).toBe(100)
    expect(tickLeftPct([], 40)).toBe(0)
  })
})

describe('buildJobMoneyBar', () => {
  it('Heron (931, stages): Rough green, Top Out a quarter green, Trim grey; a hollow tick at 40; names under the blocks with Top Out bold', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'heron', last_work_date: '2026-09-12', last_day_people: ['Behar Kraja'], sessions_60d: 14, people_60d: 6, pct_set_at: '2026-08-07T12:00:00Z', pct_source: 'seed' })], today).get('heron')!
    const { view } = progressPaymentForJob(
      { id: 'heron', revenue: 48_700, payments_made: 24_359.44, pct_complete: 40, status: 'working', fixtures: [stage('r', 'Rough In', 19_480, 0), stage('t', 'Top Out', 19_480, 1), stage('s', 'Trim Set', 9_740, 2)], invoices: [], payments: [] },
      crew,
      today,
    )
    const bar = buildJobMoneyBar(view, { pctComplete: 40 })
    expect(bar.blocks.map((b) => b.slices.map((s) => `${s.tone} ${Math.round(s.pct)}`))).toEqual([['paid 100'], ['paid 25'], []])
    expect(bar.blocks[0]!.title).toBe('1. Rough In · $19,480 · paid')
    expect(bar.blocks[1]!.title).toBe('2. Top Out · $19,480 · $4,879 paid')
    expect(bar.tick).toEqual({ leftPct: 40, hollow: true, pct: 40 })
    expect(bar.names!.map((n) => `${n.number} ${n.name}${n.done ? ' ✓' : ''}${n.bold ? ' (bold)' : ''}`)).toEqual(['1 Rough ✓', '2 Top Out (bold)', '3 Trim'])
    expect(bar.date).toEqual({ text: 'Aug 7', stale: true, title: '40% set Aug 7. The crew has worked since, so the % may be behind.' })
  })

  it('Palmer (922, stages): $4,000 billed fills Rough and Top Out blue; the tick sits inside Rough at 30', () => {
    const { view } = progressPaymentForJob(
      {
        id: 'palmer', revenue: 5_000, payments_made: 0, pct_complete: 30, status: 'working',
        fixtures: [{ ...stage('r', 'Rough In', 2_000, 0), invoice_id: 'b1' }, { ...stage('t', 'Top Out', 2_000, 1), invoice_id: 'b2' }, stage('s', 'Trim Set', 1_000, 2)],
        invoices: [{ id: 'b1', status: 'billed', amount: 2_000 }, { id: 'b2', status: 'billed', amount: 2_000 }],
        payments: [],
      },
      null,
      today,
    )
    const bar = buildJobMoneyBar(view, { pctComplete: 30 })
    expect(bar.blocks.map((b) => b.slices.map((s) => `${s.tone} ${Math.round(s.pct)}`))).toEqual([['billed 100'], ['billed 100'], []])
    expect(bar.tick!.leftPct).toBeCloseTo(30, 5)
    expect(bar.tick!.hollow).toBe(false)
  })

  it('Stimson (742, lines): three paid lines and the windows line with $520 amber that ends at the tick', () => {
    const { view, model } = progressPaymentForJob(
      {
        id: 'stimson', revenue: 6_720, payments_made: 4_520, pct_complete: 75, status: 'waiting',
        fixtures: [line('a', 'Handrails in main house', 1_450, 0), line('b', 'Handrails in guesthouse', 2_920, 1), line('c', 'Pick up salt and fill water softener', 150, 2), line('d', 'Two custom window replacements', 2_200, 3)],
        invoices: [], payments: [],
      },
      null,
      today,
    )
    expect(model.doneNotBilled).toBeCloseTo(520, 2)
    const bar = buildJobMoneyBar(view, { pctComplete: 75 })
    expect(bar.names).toBeNull()
    const windows = bar.blocks[3]!
    expect(windows.slices).toHaveLength(1)
    expect(windows.slices[0]!.tone).toBe('unbilled')
    expect(windows.slices[0]!.pct).toBeCloseTo((520 / 2_200) * 100, 4)
    expect(windows.title).toBe('Two custom window replacements · $2,200 · $520 done, not billed')
    // The tick lands where the amber ends.
    const before = sum(bar.blocks.slice(0, 3).map((b) => b.widthPct))
    expect(bar.tick!.leftPct).toBeCloseTo(before + (windows.slices[0]!.pct / 100) * windows.widthPct, 4)
  })

  it('Springtown (one line): paid, then billed, then done but not billed, poured left to right', () => {
    const { view } = progressPaymentForJob(
      { id: 'sp', revenue: 40_000, payments_made: 24_593.78, pct_complete: 100, status: 'billed', fixtures: [line('e', 'Electrical according to spec', 40_000, 0)], invoices: [{ id: 'i2', status: 'billed', amount: 11_770.3 }, { id: 'i3', status: 'billed', amount: 3_635.92 }], payments: [{ invoice_id: 'i2', amount: 11_181.78 }] as never },
      null,
      today,
    )
    const bar = buildJobMoneyBar(view, { pctComplete: 100 })
    expect(bar.blocks).toHaveLength(1)
    expect(bar.blocks[0]!.slices.map((s) => s.tone)).toEqual(['paid', 'billed', 'unbilled'])
    expect(bar.blocks[0]!.slices.map((s) => Math.round(s.pct))).toEqual([61, 11, 28])
    expect(bar.tick).toEqual({ leftPct: 100, hollow: false, pct: 100 })
  })

  it('Vasquez (1019): one line, all amber, and the % date beside the box', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'vz', pct_set_at: '2026-09-23T15:00:00Z', pct_source: 'manual' })], today).get('vz')!
    const { view } = progressPaymentForJob({ id: 'vz', revenue: 450, payments_made: 0, pct_complete: 100, status: 'waiting', fixtures: [line('p', 'Pinpoint', 450, 0)], invoices: [], payments: [] }, crew, today)
    const bar = buildJobMoneyBar(view, { pctComplete: 100 })
    expect(bar.blocks[0]!.slices).toEqual([{ tone: 'unbilled', pct: 100 }])
    expect(bar.blocks[0]!.title).toBe('Pinpoint · $450 · $450 done, not billed')
    expect(bar.date).toEqual({ text: 'Sep 23', stale: false, title: '100% typed Sep 23.' })
  })

  it('an empty box with a field report: the date words say the report', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'r', report_pct: 30, report_at: '2026-09-25T15:00:00Z' })], today).get('r')!
    const { view } = progressPaymentForJob({ id: 'r', revenue: 1_000, payments_made: 0, pct_complete: null, status: 'working', fixtures: [line('a', 'Work', 1_000, 0)], invoices: [], payments: [] }, crew, today)
    const bar = buildJobMoneyBar(view, { pctComplete: null })
    expect(bar.tick!.pct).toBe(30)
    expect(bar.date!.text).toBe('30% on a report, Sep 25')
  })

  it('no % at all: no tick and no date; a job with no price draws no blocks', () => {
    const plain = progressPaymentForJob({ id: 'n', revenue: 600, payments_made: 0, pct_complete: null, status: 'working', fixtures: [line('p', 'Pinpoint', 600, 0)], invoices: [], payments: [] }, null, today)
    const bar = buildJobMoneyBar(plain.view, { pctComplete: null })
    expect(bar.tick).toBeNull()
    expect(bar.date).toBeNull()
    expect(bar.blocks[0]!.slices).toEqual([])
    expect(bar.blocks[0]!.title).toBe('Pinpoint · $600 · nothing billed')
    const none = progressPaymentForJob({ id: 'x', revenue: 0, payments_made: 0, pct_complete: null, status: 'working', fixtures: [], invoices: [], payments: [] }, null, today)
    expect(buildJobMoneyBar(none.view, { pctComplete: null })).toEqual({ blocks: [], tick: null, names: null, date: null })
  })
})

describe('blockMoneyWords', () => {
  it('names the money on a block in a few words', () => {
    expect(blockMoneyWords({ amount: 1_000, money: { paidFrac: 0.4, billedFrac: 0.6, unbilledFrac: 0 } })).toBe('$400 paid · $600 billed')
    expect(blockMoneyWords({ amount: 1_000, money: { paidFrac: 0, billedFrac: 0.5, unbilledFrac: 0.2 } })).toBe('$500 billed · $200 done, not billed')
    expect(blockMoneyWords({ amount: 1_000, money: { paidFrac: 0, billedFrac: 0, unbilledFrac: 0 } })).toBe('nothing billed')
  })
})
