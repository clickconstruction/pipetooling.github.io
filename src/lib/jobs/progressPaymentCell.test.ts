import { describe, expect, it } from 'vitest'
import { buildStagesMoneyBarModel } from '../stagesMoneyBar'
import { buildPipelineStageBar } from './pipelineStageBar'
import { crewPositionsFromRpc, type JobCrewPositionRpcRow } from './jobCrewPosition'
import { buildProgressPaymentView, crewClause, dayWord, moneyClause, percentClause } from './progressPaymentCell'

// The five rows of the 2026-09-14 brief, from that morning's Working section.
const today = '2026-09-14'
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
const crewOf = (over: Partial<JobCrewPositionRpcRow>) => crewPositionsFromRpc([crewRow({ job_ledger_id: 'j', ...over })], today).get('j')!
const line = (id: string, name: string, price: number, seq: number, invoice_id: string | null = null) => ({ id, name, count: 1, line_unit_price: price, sequence_order: seq, invoice_id, stage_kind: 'any' as const, progress_pct: null as number | null })

describe('the words', () => {
  it('dayWord: today, a weekday inside six days, else the month and day', () => {
    expect(dayWord('2026-09-14', today)).toBe('today')
    expect(dayWord('2026-09-12', today)).toBe('Sat')
    expect(dayWord('2026-09-11', today)).toBe('Fri')
    expect(dayWord('2026-09-03', today)).toBe('Sep 3')
  })
  it('crewClause reads the clock, then the sheet, then nothing', () => {
    expect(crewClause(crewOf({ last_work_date: today, last_day_people: ['Behar Kraja', 'Abraham Ruiz', 'Bryan Diaz'] }), today)).toBe('3 on site today')
    expect(crewClause(crewOf({ last_work_date: today, last_day_people: ['Behar Kraja'] }), today)).toBe('Behar on site today')
    expect(crewClause(crewOf({ last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'] }), today)).toBe('Behar & Malachi on site Sat')
    expect(crewClause(crewOf({ last_work_date: '2026-09-03', last_day_people: ['A B', 'C D', 'E F', 'G H'] }), today)).toBe('4 people on site Sep 3')
    expect(crewClause(crewOf({ sheet_stage: 'working', sheet_names: 'Texas Rooter' }), today)).toBe('Texas Rooter on the sheet, no clock-ins')
    expect(crewClause(crewOf({}), today)).toBe('nobody clocked in')
    expect(crewClause(null, today)).toBe('nobody clocked in')
    // v2.3459: the printed line leaves the names to the row's Crew & Dates column.
    expect(crewClause(crewOf({ last_work_date: today, last_day_people: ['Behar Kraja'] }), today, { names: false })).toBe('worked today')
    expect(crewClause(crewOf({ last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'] }), today, { names: false })).toBe('worked Sat')
    expect(crewClause(crewOf({ sheet_stage: 'working', sheet_names: 'Texas Rooter' }), today, { names: false })).toBe('on the sheet, no clock-ins')
    expect(crewClause(crewOf({}), today, { names: false })).toBe('no hours')
    expect(crewClause(null, today, { names: false })).toBe('no hours')
  })
  it('percentClause and moneyClause', () => {
    expect(percentClause(null)).toBe('no % yet')
    expect(percentClause({ pct: 80, source: 'typed', at: '2026-09-03T12:00:00Z' })).toBe('80% typed Sep 3')
    expect(percentClause({ pct: 12, source: 'report', at: '2026-09-11T12:00:00Z' })).toBe('12% reported Sep 11')
    expect(percentClause({ pct: 40, source: 'typed', at: null })).toBe('40% typed')
    // The three sources by the event that set the number: the back-fill reads "set", a report's propagation "reported", a hand-set "typed".
    expect(percentClause({ pct: 40, source: 'seed', at: '2026-08-07T05:10:00Z' })).toBe('40% set Aug 7')
    expect(percentClause({ pct: 12, source: 'report', at: '2026-09-11T12:00:05Z' })).toBe('12% reported Sep 11')
    expect(percentClause({ pct: 90, source: 'typed', at: '2026-09-03T12:00:00Z' })).toBe('90% typed Sep 3')
    // v2.3461: the printed line drops the source word; the tooltip keeps it.
    expect(percentClause({ pct: 90, source: 'typed', at: '2026-09-03T12:00:00Z' }, { source: false })).toBe('90% Sep 3')
    expect(percentClause({ pct: 40, source: 'seed', at: '2026-08-07T05:10:00Z' }, { source: false })).toBe('40% Aug 7')
    expect(percentClause({ pct: 40, source: 'typed', at: null }, { source: false })).toBe('40%')
    expect(percentClause(null, { source: false })).toBe('no % yet')
    expect(moneyClause(buildStagesMoneyBarModel({ totalBill: 48_700, paymentsMade: 24_359.44, pctComplete: 40 }))).toEqual({ text: '$24,359 paid, nothing billed', tone: 'plain' })
    expect(moneyClause(buildStagesMoneyBarModel({ totalBill: 40_135, paymentsMade: 0, pctComplete: 60, billedUnpaid: 32_108.3 }))).toEqual({ text: '$32,108 billed, nothing paid', tone: 'amber' })
    expect(moneyClause(buildStagesMoneyBarModel({ totalBill: 40_000, paymentsMade: 13_412, pctComplete: 80, billedUnpaid: 11_770 }))).toEqual({ text: '$13,412 paid · $11,770 billed · $6,818 done, not billed', tone: 'amber' })
    expect(moneyClause(buildStagesMoneyBarModel({ totalBill: 31_400, paymentsMade: 31_400, pctComplete: 100 }))).toEqual({ text: 'paid in full', tone: 'green' })
    expect(moneyClause(buildStagesMoneyBarModel({ totalBill: 0, paymentsMade: 0, pctComplete: null }))).toEqual({ text: 'nothing to bill against', tone: 'muted' })
  })
})

describe('buildProgressPaymentView — the five rows', () => {
  it('J931 Heron: recognized stages, the money covers Rough In, the crew was on site Sat → Top Out is live, the Aug 7 seed is stale and not drawn', () => {
    const fixtures = [line('r', 'Rough In', 19_480, 0), line('t', 'Top Out', 19_480, 1), line('s', 'Trim Set', 9_740, 2)]
    const money = buildStagesMoneyBarModel({ totalBill: 48_700, paymentsMade: 24_359.44, pctComplete: 40 })
    const stageBar = buildPipelineStageBar({ fixtures, invoices: [], payments: [], pctComplete: 40, todayYmd: today })
    const crew = crewOf({ last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'], sessions_60d: 14, people_60d: 6, sheet_stage: 'working', sheet_names: 'Behar | Malachi | Abraham | Bryan | Behar Kraja', sheet_date: '2026-09-10' })
    const v = buildProgressPaymentView({ money, stageBar, fixtures, invoices: [], crew, pctComplete: 40, status: 'working', todayYmd: today })
    expect(v.mode).toBe('stages')
    expect(v.stale).toBe(true)
    expect(v.segments.map((s) => [s.name, s.state, s.fillPct, s.label])).toEqual([
      ['Rough In', 'done', 100, '✓'],
      ['Top Out', 'live', 0, 'on site Sat'],
      ['Trim Set', 'later', 0, null],
    ])
    // Money poured in order with no invoice naming a line: Rough In fully paid, a quarter of Top Out.
    expect(v.segments[0]!.money.paidFrac).toBeCloseTo(1, 2)
    expect(v.segments[1]!.money.paidFrac).toBeCloseTo(0.25, 2)
    expect(v.segments[2]!.money.paidFrac).toBe(0)
    expect(v.stageBar?.liveNumber).toBe(2)
    // v2.3459: the chip carries no name and the printed line no stage or name — both sit elsewhere on the row.
    expect(v.liveChipSuffix).toBeNull()
    expect(v.words).toMatchObject({ text: 'Worked Sat · 40%', full: 'Top Out · Behar & Malachi on site Sat · 40% typed · $24,359 paid, nothing billed', tone: 'plain' })
  })

  it('J931 Heron with pct_set_at: the seed carries its date — "40% set Aug 7", still stale and not drawn; SpaceX reads "12% reported Sep 11"', () => {
    const fixtures = [line('r', 'Rough In', 19_480, 0), line('t', 'Top Out', 19_480, 1), line('s', 'Trim Set', 9_740, 2)]
    const money = buildStagesMoneyBarModel({ totalBill: 48_700, paymentsMade: 24_359.44, pctComplete: 40 })
    const stageBar = buildPipelineStageBar({ fixtures, invoices: [], payments: [], pctComplete: 40, todayYmd: today })
    const crew = crewOf({ last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'], pct_set_at: '2026-08-07T05:10:00Z', pct_source: 'seed' })
    const v = buildProgressPaymentView({ money, stageBar, fixtures, invoices: [], crew, pctComplete: 40, status: 'working', todayYmd: today })
    expect(v.stale).toBe(true)
    expect(v.segments[1]).toMatchObject({ state: 'live', fillPct: 0, label: 'on site Sat' })
    expect(v.percent).toEqual({ pct: 40, source: 'seed', at: '2026-08-07T05:10:00Z' })
    expect(v.words).toMatchObject({ text: 'Worked Sat · 40% Aug 7', full: 'Top Out · Behar & Malachi on site Sat · 40% set Aug 7 · $24,359 paid, nothing billed', tone: 'plain' })

    const spacex = buildProgressPaymentView({
      money: buildStagesMoneyBarModel({ totalBill: 20_000, paymentsMade: 0, pctComplete: 12 }),
      stageBar: null,
      fixtures: [line('p', 'Plumbing per plans', 20_000, 0)],
      invoices: [],
      crew: crewOf({ last_work_date: '2026-09-10', last_day_people: ['Miguel Rodriguez'], report_pct: 12, report_at: '2026-09-11T12:00:00Z', pct_set_at: '2026-09-11T12:00:05Z', pct_source: 'service' }),
      pctComplete: 12,
      status: 'working',
      todayYmd: today,
    })
    expect(spacex.stale).toBe(false)
    expect(spacex.segments[0]).toMatchObject({ fillPct: 12, label: 'Plumbing per plans · 12%' })
    expect(spacex.words.text).toBe('Worked Thu · 12% Sep 11')
    expect(spacex.words.full).toBe('Miguel on site Thu · 12% reported Sep 11 · nothing billed · $2,400 done, not billed')
  })

  it('Michael Palmer · Moses Hughes: no % ever typed; paid = Rough In to the dollar and 3 on site today → Top Out, no office input', () => {
    const fixtures = [line('r', 'Rough In', 16_620, 0), line('t', 'Top Out', 16_620, 1), line('s', 'Trim Set', 8_310, 2)]
    const money = buildStagesMoneyBarModel({ totalBill: 41_550, paymentsMade: 16_620, pctComplete: null })
    const stageBar = buildPipelineStageBar({ fixtures, invoices: [], payments: [], pctComplete: null, todayYmd: today })
    const crew = crewOf({ last_work_date: today, last_day_people: ['Abraham Ruiz', 'Behar Kraja', 'Bryan Diaz'], sessions_60d: 3, people_60d: 3 })
    const v = buildProgressPaymentView({ money, stageBar, fixtures, invoices: [], crew, pctComplete: null, status: 'working', todayYmd: today })
    expect(v.segments.map((s) => [s.state, s.label])).toEqual([
      ['done', '✓'],
      ['live', '3 on site today'],
      ['later', null],
    ])
    expect(v.liveChipSuffix).toBe('today')
    expect(v.percent).toBeNull()
    expect(v.words.text).toBe('Worked today · no % yet')
    expect(v.words.full).toBe('Top Out · 3 on site today · no % yet · $16,620 paid, nothing billed')
  })

  it('J977 Springtown (the screenshot): one line, the work at 80 over the money at 63, the amber named', () => {
    const fixtures = [line('e', 'Electrical', 40_000, 0)]
    const money = buildStagesMoneyBarModel({ totalBill: 40_000, paymentsMade: 13_412, pctComplete: 80, billedUnpaid: 11_770 })
    const crew = crewOf({ sheet_stage: 'working', sheet_names: 'Texas Rooter', pct_manual_at: '2026-09-03T12:00:00Z' })
    const v = buildProgressPaymentView({ money, stageBar: null, fixtures, invoices: [], crew, pctComplete: 80, status: 'working', todayYmd: today })
    expect(v.mode).toBe('lines')
    expect(v.stale).toBe(false)
    expect(v.segments).toHaveLength(1)
    expect(v.segments[0]).toMatchObject({ name: 'Electrical', fillPct: 80, label: 'Electrical · 80%', widthPct: 100 })
    expect(v.segments[0]!.money.paidFrac).toBeCloseTo(0.3353, 3)
    expect(v.segments[0]!.money.billedFrac).toBeCloseTo(0.29425, 3)
    expect(v.segments[0]!.money.unbilledFrac).toBeCloseTo(0.17045, 3)
    expect(v.words).toMatchObject({ text: 'On the sheet, no clock-ins · 80% Sep 3', full: 'Texas Rooter on the sheet, no clock-ins · 80% typed Sep 3 · $13,412 paid · $11,770 billed · $6,818 done, not billed', tone: 'amber' })
  })

  it('Take 5 Seguin: billed ahead of the work, Miguel’s crew on site Friday, amber', () => {
    const fixtures = [line('f', 'Fixtures per plans', 40_135, 0)]
    const money = buildStagesMoneyBarModel({ totalBill: 40_135, paymentsMade: 0, pctComplete: 60, billedUnpaid: 32_108.3 })
    const crew = crewOf({ last_work_date: '2026-09-11', last_day_people: ['Miguel Rodriguez', 'Edgar Lopez', 'Jose Cruz'], sessions_60d: 41, people_60d: 7, sheet_stage: 'working', sheet_names: 'Miguel Rodriguez', pct_manual_at: '2026-09-12T12:00:00Z' })
    const v = buildProgressPaymentView({ money, stageBar: null, fixtures, invoices: [], crew, pctComplete: 60, status: 'working', todayYmd: today })
    expect(v.segments[0]).toMatchObject({ fillPct: 60, label: 'Fixtures per plans · 60%' })
    expect(v.segments[0]!.money.billedFrac).toBeCloseTo(0.8, 2)
    expect(v.words).toMatchObject({ text: 'Worked Fri · 60% Sep 12', full: '3 people on site Fri · 60% typed Sep 12 · $32,108 billed, nothing paid', tone: 'amber' })
  })

  it('the empty rows: Vecchio Pinpoint says what is missing; DRF with a crew on site and no lines reads red', () => {
    const vecchio = buildProgressPaymentView({
      money: buildStagesMoneyBarModel({ totalBill: 450, paymentsMade: 0, pctComplete: null }),
      stageBar: null,
      fixtures: [line('p', 'Pinpoint', 450, 0)],
      invoices: [],
      crew: crewOf({}),
      pctComplete: null,
      status: 'working',
      todayYmd: today,
    })
    expect(vecchio.mode).toBe('lines')
    expect(vecchio.segments[0]).toMatchObject({ name: 'Pinpoint', fillPct: 0, label: 'Pinpoint' })
    expect(vecchio.words).toMatchObject({ text: 'No hours · no % yet', full: 'nobody clocked in · no % yet · nothing billed', tone: 'plain' })

    const drf = buildProgressPaymentView({
      money: buildStagesMoneyBarModel({ totalBill: 0, paymentsMade: 0, pctComplete: null }),
      stageBar: null,
      fixtures: [],
      invoices: [],
      crew: crewOf({ last_work_date: today, last_day_people: ['Edgar Lopez', 'Jose Cruz'] }),
      pctComplete: null,
      status: 'working',
      todayYmd: today,
    })
    expect(drf.mode).toBe('nobid')
    expect(drf.segments).toEqual([])
    // A no-bid row has no legend money to repeat, so the whole sentence prints — minus the names (v2.3459).
    expect(drf.words).toEqual({ text: 'Worked today · no lines on the job · nothing to bill against', full: 'Edgar & Jose on site today · no lines on the job · nothing to bill against', tone: 'red' })
    const quiet = buildProgressPaymentView({ ...drf, money: buildStagesMoneyBarModel({ totalBill: null, paymentsMade: null, pctComplete: null }), stageBar: null, fixtures: [], invoices: [], crew: null, pctComplete: null, todayYmd: today } as never)
    expect(quiet.words.tone).toBe('muted')
  })
})

describe('buildProgressPaymentView — the rules at the edges', () => {
  const fixtures = [line('r', 'Rough In', 15_098, 0), line('t', 'Top Out', 15_098, 1), line('s', 'Trim Set', 7_549, 2)]

  it('a fresh typed percent pours down the stages: done stages full, the remainder on the live one', () => {
    const money = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 15_098, pctComplete: 55 })
    const stageBar = buildPipelineStageBar({ fixtures, invoices: [], payments: [], pctComplete: 55, todayYmd: today })
    const crew = crewOf({ last_work_date: '2026-09-10', last_day_people: ['Miguel Rodriguez'], pct_manual_at: '2026-09-13T12:00:00Z' })
    const v = buildProgressPaymentView({ money, stageBar, fixtures, invoices: [], crew, pctComplete: 55, status: 'working', todayYmd: today })
    expect(v.stale).toBe(false)
    // 55 − 40 done = 15 points of a 40-point stage → 38 %
    expect(v.segments.map((s) => [s.state, s.fillPct, s.label])).toEqual([
      ['done', 100, '✓'],
      ['live', 38, '38%'],
      ['later', 0, null],
    ])
    expect(v.words).toMatchObject({ text: 'Worked Thu · 55% Sep 13', full: 'Top Out · Miguel on site Thu · 55% typed Sep 13 · $15,098 paid, nothing billed · $5,662 done, not billed', tone: 'amber' })
  })

  it('a stage report beats the money floor when it points further along; a paid invoice on a line covers that line outright', () => {
    const withReport = fixtures.map((f) => (f.id === 's' ? { ...f, progress_pct: 30 } : f.id === 'r' ? { ...f, invoice_id: 'inv1' } : f))
    const money = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 15_098, pctComplete: null })
    const stageBar = buildPipelineStageBar({ fixtures: withReport, invoices: [{ id: 'inv1', status: 'paid' }], payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }], pctComplete: null, todayYmd: today })
    const v = buildProgressPaymentView({ money, stageBar, fixtures: withReport, invoices: [{ id: 'inv1', status: 'paid' }], crew: null, pctComplete: null, status: 'working', todayYmd: today })
    // The plan's live stage is Top Out (first unpaid); a report on Trim says the crew is there — but Trim reported, Top Out did not, so the plan's live wins the max. The report's fill lands on its own segment only when it is live.
    expect(v.segments.map((s) => s.state)).toEqual(['done', 'live', 'later'])
    expect(v.segments[0]!.money.paidFrac).toBe(1)
  })

  it('every draw paid: all done, green words', () => {
    const paidAll = fixtures.map((f) => ({ ...f, invoice_id: 'inv' }))
    const money = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 37_745, pctComplete: 100 })
    const stageBar = buildPipelineStageBar({ fixtures: paidAll, invoices: [{ id: 'inv', status: 'paid' }], payments: [{ invoice_id: 'inv', paid_on: '2026-09-01' }], pctComplete: 100, todayYmd: today })
    const v = buildProgressPaymentView({ money, stageBar, fixtures: paidAll, invoices: [{ id: 'inv', status: 'paid' }], crew: null, pctComplete: 100, status: 'paid', todayYmd: today })
    expect(v.segments.every((s) => s.state === 'done')).toBe(true)
    expect(v.stageBar?.liveNumber).toBeNull()
    expect(v.words).toMatchObject({ text: 'All 3 stages done', full: 'All 3 stages done · paid in full', tone: 'green' })
  })

  it('lines mode with several unrecognized lines: one segment per line, the invoice-named line takes its own money first', () => {
    const lines = [line('c', 'CHANGE ORDER: deep clean', 1_980, 0, 'inv9'), line('h', 'HVAC to spec', 1_650, 1)]
    const money = buildStagesMoneyBarModel({ totalBill: 3_630, paymentsMade: 0, pctComplete: null, billedUnpaid: 3_052.5 })
    const v = buildProgressPaymentView({ money, stageBar: null, fixtures: lines, invoices: [{ id: 'inv9', status: 'billed' }], crew: null, pctComplete: null, status: 'working', todayYmd: today })
    expect(v.mode).toBe('lines')
    expect(v.segments.map((s) => s.name)).toEqual(['CHANGE ORDER: deep clean', 'HVAC to spec'])
    expect(v.segments[0]!.money.billedFrac).toBeCloseTo(1, 2)
    expect(v.segments[1]!.money.billedFrac).toBeCloseTo((3_052.5 - 1_980) / 1_650, 2)
    expect(v.words.text).toBe('No hours · no % yet')
    expect(v.words.full).toBe('nobody clocked in · no % yet · $3,053 billed, nothing paid')
  })

})
