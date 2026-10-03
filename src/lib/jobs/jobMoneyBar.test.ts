import { describe, expect, it } from 'vitest'
import { billMarkFor, blockMoneyWords, buildJobMoneyBar, tickLeftPct } from './jobMoneyBar'
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

  it('Vasquez (1019): one line, all amber; a finished job leaves the date off', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'vz', pct_set_at: '2026-09-23T15:00:00Z', pct_source: 'manual' })], today).get('vz')!
    const { view } = progressPaymentForJob({ id: 'vz', revenue: 450, payments_made: 0, pct_complete: 100, status: 'waiting', fixtures: [line('p', 'Pinpoint', 450, 0)], invoices: [], payments: [] }, crew, today)
    const bar = buildJobMoneyBar(view, { pctComplete: 100 })
    expect(bar.blocks[0]!.slices).toEqual([{ tone: 'unbilled', pct: 100 }])
    expect(bar.blocks[0]!.title).toBe('Pinpoint · $450 · $450 done, not billed')
    expect(bar.date).toBeNull()
    // The same 100% with the crew on site since keeps its amber date.
    const since = crewPositionsFromRpc([crewRow({ job_ledger_id: 'vz', last_work_date: '2026-09-29', last_day_people: ['Abraham'], sessions_60d: 1, people_60d: 1, pct_set_at: '2026-09-23T15:00:00Z', pct_source: 'manual' })], today).get('vz')!
    const again = progressPaymentForJob({ id: 'vz', revenue: 450, payments_made: 0, pct_complete: 100, status: 'waiting', fixtures: [line('p', 'Pinpoint', 450, 0)], invoices: [], payments: [] }, since, today)
    expect(buildJobMoneyBar(again.view, { pctComplete: 100 }).date).toEqual({ text: 'Sep 23', stale: true, title: '100% typed Sep 23. The crew has worked since, so the % may be behind.' })
  })

  it('Knight Springtown Vet (963): a part-paid bill that names a line fills it green for what is paid on it, blue for the rest', () => {
    const invoices = [
      { id: 'b0', status: 'billed', amount: 2_200, sequence_order: 0 },
      { id: 'b2', status: 'billed', amount: 1_560, sequence_order: 2 },
      { id: 'b3', status: 'billed', amount: 3_002.45, sequence_order: 3 },
    ]
    const payments = [{ invoice_id: 'b0', paid_on: '2026-09-10', amount: 2_090 }, { invoice_id: 'b2', paid_on: '2026-09-10', amount: 1_482 }]
    const { view, model } = progressPaymentForJob(
      { id: 'vet', revenue: 6_762.45, payments_made: 3_572, pct_complete: 100, status: 'billed', fixtures: [{ ...line('co', 'CHANGE ORDER: Chip and move copper manifold', 2_200, 0), invoice_id: 'b0' }, line('pl', 'Plumbing according to spec', 4_562.45, 1)], invoices, payments },
      null,
      today,
    )
    expect(model.billedUnpaid).toBeCloseTo(3_190.45, 2)
    const bar = buildJobMoneyBar(view, { pctComplete: 100 })
    expect(bar.blocks.map((b) => b.slices.map((s) => `${s.tone} ${Math.round(s.pct)}`))).toEqual([['paid 95', 'billed 5'], ['paid 32', 'billed 68']])
    expect(bar.names).toBeNull()
  })

  it('an empty box with a field report: the date words say the report', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'r', report_pct: 30, report_at: '2026-09-25T15:00:00Z' })], today).get('r')!
    const { view } = progressPaymentForJob({ id: 'r', revenue: 1_000, payments_made: 0, pct_complete: null, status: 'working', fixtures: [line('a', 'Work', 1_000, 0)], invoices: [], payments: [] }, crew, today)
    const bar = buildJobMoneyBar(view, { pctComplete: null })
    expect(bar.tick!.pct).toBe(30)
    expect(bar.date!.text).toBe('30% reported Sep 25')
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

describe('billMarkFor (which part of the bar a bill row is about, v2.4353)', () => {
  const springtownInvoices = [
    { id: 'i1', status: 'paid', amount: 13_412, sequence_order: 0 },
    { id: 'i2', status: 'billed', amount: 11_770.3, sequence_order: 1 },
    { id: 'i3', status: 'billed', amount: 3_635.92, sequence_order: 2 },
  ]
  // Bill 2 has $11,181.78 paid on it; bill 1 is marked paid.
  const springtownPayments = [{ invoice_id: 'i1', paid_on: '2026-08-01', amount: 13_412 }, { invoice_id: 'i2', paid_on: '2026-09-20', amount: 11_181.78 }]
  const springtown = progressPaymentForJob(
    { id: 'sp', revenue: 40_000, payments_made: 24_593.78, pct_complete: 100, status: 'billed', fixtures: [line('e', 'Electrical according to spec', 40_000, 0)], invoices: springtownInvoices, payments: springtownPayments },
    null,
    today,
  )

  it('Springtown (one line, bills by amount): a part-paid bill straddles the green and the blue, the next bill follows it', () => {
    const fixtures = [{ id: 'e', invoice_id: null }]
    const b2 = billMarkFor(springtown.view, { billId: 'i2', fixtures, invoices: springtownInvoices, payments: springtownPayments })
    expect(b2?.kind).toBe('bracket')
    if (b2?.kind !== 'bracket') throw new Error('bracket')
    expect(b2.leftPct).toBeCloseTo(33.53, 1)
    expect(b2.leftPct + b2.widthPct).toBeCloseTo(62.96, 1)
    expect(b2.title).toBe("This row's bill: $11,770")
    const b3 = billMarkFor(springtown.view, { billId: 'i3', fixtures, invoices: springtownInvoices, payments: springtownPayments })
    if (b3?.kind !== 'bracket') throw new Error('bracket')
    expect(b3.leftPct).toBeCloseTo(62.96, 1)
    expect(b3.leftPct + b3.widthPct).toBeCloseTo(72.05, 1)
  })

  it('273 Dudley: an unpaid first bill sits on the blue, after the payments that went to no bill (v2.4387)', () => {
    const invoices = [
      { id: 'b0', status: 'billed', amount: 13_420, sequence_order: 0, billed_at: '2026-03-16' },
      { id: 'b1', status: 'billed', amount: 665, sequence_order: 1, billed_at: '2026-08-21' },
      { id: 'b2', status: 'billed', amount: 3_500, sequence_order: 2, billed_at: '2026-08-21' },
    ]
    const fixtures = [line('jt', 'Job total', 52_200, 0), { ...line('co1', 'CHANGE ORDER: hose bibs', 555, 1), invoice_id: 'b1' }, { ...line('m', 'Material', 110, 2), invoice_id: 'b1' }, { ...line('co2', 'CHANGE ORDER: gas line', 3_500, 3), invoice_id: 'b2' }]
    const payments = [{ invoice_id: null, paid_on: '2026-04-01', amount: 38_780 }]
    const { view } = progressPaymentForJob({ id: 'dudley', revenue: 56_365, payments_made: 38_780, pct_complete: 80, status: 'billed', fixtures, invoices, payments }, null, today)
    const w0 = view.segments[0]!.widthPct
    const mark = billMarkFor(view, { billId: 'b0', fixtures, invoices, payments })
    if (mark?.kind !== 'bracket') throw new Error('bracket')
    // The old placement went by billing order: 0 to 19 %, all of it on the green.
    expect(mark.leftPct).toBeCloseTo((38_780 / 52_200) * w0, 1)
    expect(mark.leftPct + mark.widthPct).toBeCloseTo(w0, 1)
    const covered = billMarkFor(view, { billId: 'b2', fixtures, invoices, payments })
    if (covered?.kind !== 'bracket') throw new Error('bracket')
    expect(covered.leftPct + covered.widthPct).toBeCloseTo(100, 5)
  })

  it('650 ATI Schertz: a $6,700 bill that names the job’s only $33,500 line sits by its amount, not across the whole bar (v2.4387)', () => {
    const invoices = [
      { id: 'b0', status: 'billed', amount: 26_800, sequence_order: 0, billed_at: '2026-07-15' },
      { id: 'b1', status: 'billed', amount: 6_700, sequence_order: 1, billed_at: '2026-09-10' },
    ]
    const fixtures = [{ ...line('p', 'As per plans', 33_500, 0), invoice_id: 'b1' }]
    const payments = [{ invoice_id: 'b0', paid_on: '2026-08-01', amount: 17_777.51 }]
    const { view } = progressPaymentForJob({ id: 'ati', revenue: 33_500, payments_made: 17_777.51, pct_complete: 100, status: 'billed', fixtures, invoices, payments }, null, today)
    const first = billMarkFor(view, { billId: 'b0', fixtures, invoices, payments })
    const second = billMarkFor(view, { billId: 'b1', fixtures, invoices, payments })
    if (first?.kind !== 'bracket' || second?.kind !== 'bracket') throw new Error('bracket')
    expect(first.leftPct).toBeCloseTo(0, 5)
    expect(first.leftPct + first.widthPct).toBeCloseTo(80, 1)
    expect(second.leftPct).toBeCloseTo(80, 1)
    expect(second.leftPct + second.widthPct).toBeCloseTo(100, 1)
  })

  it('880 Reliant HVAC: an open bill sent before a paid one sits after the paid one, where its blue is (v2.4387)', () => {
    const invoices = [
      { id: 'b0', status: 'billed', amount: 3_840, sequence_order: 0, billed_at: '2026-07-06' },
      { id: 'b1', status: 'paid', amount: 960, sequence_order: 1, billed_at: '2026-06-25' },
    ]
    const fixtures = [line('f', 'Final', 4_800, 0)]
    const payments = [{ invoice_id: 'b0', paid_on: '2026-08-01', amount: 2_460 }, { invoice_id: 'b1', paid_on: '2026-07-01', amount: 960 }]
    const { view } = progressPaymentForJob({ id: 'hvac', revenue: 4_800, payments_made: 3_420, pct_complete: 90, status: 'billed', fixtures, invoices, payments }, null, today)
    const mark = billMarkFor(view, { billId: 'b0', fixtures, invoices, payments })
    if (mark?.kind !== 'bracket') throw new Error('bracket')
    expect(mark.leftPct).toBeCloseTo(20, 1)
    expect(mark.leftPct + mark.widthPct).toBeCloseTo(100, 1)
  })

  it('Knight Springtown Vet (963): the change order’s bill spans its line; the two bills by amount share the other line, part-paid first', () => {
    const invoices = [
      { id: 'b0', status: 'billed', amount: 2_200, sequence_order: 0 },
      { id: 'b2', status: 'billed', amount: 1_560, sequence_order: 2 },
      { id: 'b3', status: 'billed', amount: 3_002.45, sequence_order: 3 },
    ]
    const fixtures = [{ ...line('co', 'CHANGE ORDER: Chip and move copper manifold', 2_200, 0), invoice_id: 'b0' }, line('pl', 'Plumbing according to spec', 4_562.45, 1)]
    const payments = [{ invoice_id: 'b0', paid_on: '2026-09-10', amount: 2_090 }, { invoice_id: 'b2', paid_on: '2026-09-10', amount: 1_482 }]
    const { view } = progressPaymentForJob({ id: 'vet', revenue: 6_762.45, payments_made: 3_572, pct_complete: 100, status: 'billed', fixtures, invoices, payments }, null, today)
    const w0 = view.segments[0]!.widthPct
    const w1 = view.segments[1]!.widthPct
    const spans = ['b0', 'b2', 'b3'].map((id) => {
      const m = billMarkFor(view, { billId: id, fixtures, invoices, payments })
      if (m?.kind !== 'bracket') throw new Error('bracket')
      return [m.leftPct, m.leftPct + m.widthPct]
    })
    expect(spans[0]![0]).toBeCloseTo(0, 5)
    expect(spans[0]![1]).toBeCloseTo(w0, 5)
    expect(spans[1]![0]).toBeCloseTo(w0, 5)
    expect(spans[1]![1]).toBeCloseTo(w0 + (1_560 / 4_562.45) * w1, 1)
    expect(spans[2]![0]).toBeCloseTo(w0 + (1_560 / 4_562.45) * w1, 1)
    expect(spans[2]![1]).toBeCloseTo(100, 1)
  })

  it('a job with one bill out and none paid draws no mark (the whole bar is that bill); a draft does not count', () => {
    const invoices = [{ id: 'a', status: 'billed', amount: 350 }, { id: 'd', status: 'ready_to_bill', amount: 100 }]
    const { view } = progressPaymentForJob({ id: 'lx', revenue: 450, payments_made: 0, pct_complete: 100, status: 'billed', fixtures: [line('t', 'Trip charge', 450, 0)], invoices, payments: [] }, null, today)
    expect(billMarkFor(view, { billId: 'a', fixtures: [{ id: 't' }], invoices })).toBeNull()
  })

  it('Palmer (922, stages): a bill that names one stage bolds that stage instead of a bracket', () => {
    const invoices = [{ id: 'b1', status: 'billed', amount: 2_000, sequence_order: 0 }, { id: 'b2', status: 'billed', amount: 2_000, sequence_order: 1 }]
    const fixtures = [{ ...stage('r', 'Rough In', 2_000, 0), invoice_id: 'b1' }, { ...stage('t', 'Top Out', 2_000, 1), invoice_id: 'b2' }, stage('s', 'Trim Set', 1_000, 2)]
    const { view } = progressPaymentForJob({ id: 'palmer', revenue: 5_000, payments_made: 0, pct_complete: 30, status: 'working', fixtures, invoices, payments: [] }, null, today)
    expect(billMarkFor(view, { billId: 'b2', fixtures, invoices })).toEqual({ kind: 'stage', key: 't', title: "This row's bill: $2,000" })
  })

  it('a bill that names two lines of a plain job spans their blocks', () => {
    const invoices = [{ id: 'x', status: 'paid', amount: 1_000, sequence_order: 0 }, { id: 'y', status: 'billed', amount: 3_000, sequence_order: 1 }]
    const fixtures = [{ ...line('a', 'Rough plumbing', 1_000, 0), invoice_id: 'x' }, { ...line('b', 'Fixtures', 2_000, 1), invoice_id: 'y' }, { ...line('c', 'Water heater', 1_000, 2), invoice_id: 'y' }]
    const { view } = progressPaymentForJob({ id: 'two', revenue: 4_000, payments_made: 1_000, pct_complete: 100, status: 'billed', fixtures, invoices, payments: [] }, null, today)
    const mark = billMarkFor(view, { billId: 'y', fixtures, invoices })
    if (mark?.kind !== 'bracket') throw new Error('bracket')
    expect(mark.leftPct).toBeCloseTo(view.segments[0]!.widthPct, 5)
    expect(mark.leftPct + mark.widthPct).toBeCloseTo(100, 5)
  })

  it('no mark for an unknown bill or a job with no price', () => {
    expect(billMarkFor(springtown.view, { billId: 'nope', fixtures: [], invoices: springtownInvoices })).toBeNull()
    const none = progressPaymentForJob({ id: 'x', revenue: 0, payments_made: 0, pct_complete: null, status: 'billed', fixtures: [], invoices: [], payments: [] }, null, today)
    expect(billMarkFor(none.view, { billId: 'i2', fixtures: [], invoices: springtownInvoices })).toBeNull()
  })
})

describe('buildJobMoneyBar · a percent set in the evening keeps its day (v2.4472)', () => {
  it('dates the percent by the Central day', () => {
    // 00:30 UTC on Aug 8 is 7:30 pm CDT on Aug 7.
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'heron', last_work_date: '2026-09-12', last_day_people: ['Behar Kraja'], sessions_60d: 14, people_60d: 6, pct_set_at: '2026-08-08T00:30:00Z', pct_source: 'seed' })], today).get('heron')!
    const { view } = progressPaymentForJob(
      { id: 'heron', revenue: 48_700, payments_made: 24_359.44, pct_complete: 40, status: 'working', fixtures: [stage('r', 'Rough In', 19_480, 0), stage('t', 'Top Out', 19_480, 1), stage('s', 'Trim Set', 9_740, 2)], invoices: [], payments: [] },
      crew,
      today,
    )
    expect(buildJobMoneyBar(view, { pctComplete: 40 }).date).toMatchObject({ text: 'Aug 7' })
  })
})
