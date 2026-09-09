import { describe, expect, it } from 'vitest'
import { buildPipelineStageBar, estimateChipsPx, fitStageChips, segmentLabel, stageBarAvailable, stageShortLabel, type PipelineStageBarFixture } from './pipelineStageBar'

// J892 Megan Connell's real line items: Rough In $15,098 · Top Out $15,098 · Trim Set $7,549 (40 / 40 / 20).
const fx = (over: Partial<PipelineStageBarFixture & { stage_kind: string | null; progress_pct: number | null }> & { id: string; name: string }) => ({
  count: 1,
  line_unit_price: null,
  sequence_order: 0,
  invoice_id: null,
  stage_kind: 'order',
  progress_pct: null,
  shared_with_gc: false,
  ...over,
})
const j892 = [
  fx({ id: 'r', name: 'Rough In', line_unit_price: 15098, sequence_order: 0 }),
  fx({ id: 't', name: 'Top Out', line_unit_price: 15098, sequence_order: 1 }),
  fx({ id: 's', name: 'Trim Set', line_unit_price: 7549, sequence_order: 2 }),
]
const today = '2026-09-09'

describe('stageShortLabel', () => {
  it('shortens the plumbing vocabulary by dictionary', () => {
    expect(stageShortLabel('Rough In')).toBe('Rough')
    expect(stageShortLabel('Rough-in plumbing, 2nd floor')).toBe('Rough')
    expect(stageShortLabel('Top Out')).toBe('Top Out')
    expect(stageShortLabel('Top-out')).toBe('Top Out')
    expect(stageShortLabel('Trim Set')).toBe('Trim')
    expect(stageShortLabel('Trim out fixtures')).toBe('Trim')
    expect(stageShortLabel('Underground plumbing')).toBe('Ground')
    expect(stageShortLabel('Under slab')).toBe('Ground')
    expect(stageShortLabel('Water heater install')).toBe('Heater')
    expect(stageShortLabel('Gas piping')).toBe('Gas')
  })
  it('drops a "Stage 2 —" prefix, keeps a first word of ten characters or fewer, else clips with an ellipsis', () => {
    expect(stageShortLabel('Stage 2 — Kitchen relocation')).toBe('Kitchen')
    expect(stageShortLabel('Phase 1: Demo')).toBe('Demo')
    expect(stageShortLabel('2. Bathrooms upstairs')).toBe('Bathrooms')
    expect(stageShortLabel('Reconfiguration of the mechanical room')).toBe('Reconfigu…')
    expect(stageShortLabel('Basement')).toBe('Basement')
    expect(stageShortLabel('   ')).toBe('—')
  })
})

describe('buildPipelineStageBar', () => {
  it('is null without an Order stage (Any and plain rows keep the money bar)', () => {
    expect(stageBarAvailable([fx({ id: 'a', name: 'x', stage_kind: 'any' })])).toBe(false)
    expect(buildPipelineStageBar({ fixtures: [fx({ id: 'a', name: 'x', stage_kind: null })], invoices: [], payments: [], pctComplete: 40, todayYmd: today })).toBeNull()
  })

  it('J892 today: three segments sized 40/40/20, stage 1 paid, stage 2 live, nothing reported yet', () => {
    const bar = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, j892[1]!, j892[2]!],
      invoices: [{ id: 'inv1', status: 'paid' }],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: null,
      todayYmd: today,
    })!
    expect(bar.count).toBe(3)
    expect(bar.segments.map((s) => [s.number, s.short, s.state, s.edge, s.workPct])).toEqual([
      [1, 'Rough', 'done', 'paid', 100],
      [2, 'Top Out', 'live', 'later', 0],
      [3, 'Trim', 'later', 'later', 0],
    ])
    expect(bar.segments.map((s) => Math.round(s.sharePct))).toEqual([40, 40, 20])
    expect(bar.segments.map((s) => Math.round(s.widthPct))).toEqual([40, 40, 20])
    expect(bar.liveNumber).toBe(2)
    expect(bar.caption).toBe('Stage 2 of 3 · Top Out · draw 1 paid')
    expect(bar.captionTone).toBe('plain')
    expect(bar.impliedJobPct).toBe(40)
  })

  it('a stage report fills the live segment and lands in the caption; the implied job % is Σ weight × stage %', () => {
    const bar = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1', progress_pct: 100 }, { ...j892[1]!, progress_pct: 60 }, j892[2]!],
      invoices: [{ id: 'inv1', status: 'paid' }],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: 64,
      todayYmd: today,
    })!
    expect(bar.segments[1]).toMatchObject({ workPct: 60, workSource: 'stage' })
    expect(bar.caption).toBe('Stage 2 of 3 · Top Out 60% · draw 1 paid')
    expect(bar.impliedJobPct).toBe(64)
  })

  it('with no stage report the job % spreads by weight: done stages full, the remainder on the live stage', () => {
    const bar = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, j892[1]!, j892[2]!],
      invoices: [{ id: 'inv1', status: 'paid' }],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: 55,
      todayYmd: today,
    })!
    // 55 − 40 done = 15 points of a 40-point stage → 37.5 → 38 %
    expect(bar.segments[1]).toMatchObject({ workPct: 38, workSource: 'job' })
    expect(bar.segments[2]).toMatchObject({ workPct: 0, workSource: 'none' })
    expect(bar.caption).toBe('Stage 2 of 3 · Top Out 38% · draw 1 paid')
  })

  it('a passed stage with its draw unsent reads full fill + ready edge and an amber caption', () => {
    const bar = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, { ...j892[1]!, progress_pct: 100 }, j892[2]!],
      invoices: [{ id: 'inv1', status: 'paid' }],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: null,
      todayYmd: today,
    })!
    // Without a sub sheet the kernel has no "passed" signal, so a 100% report is still the live stage's fill.
    expect(bar.segments[1]).toMatchObject({ state: 'live', workPct: 100, edge: 'later' })
    // Billed early: the draw is out while the work is at 40%.
    const early = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, { ...j892[1]!, invoice_id: 'inv2', progress_pct: 40 }, j892[2]!],
      invoices: [
        { id: 'inv1', status: 'paid' },
        { id: 'inv2', status: 'billed', billed_at: '2026-09-01T15:00:00Z' },
      ],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: null,
      todayYmd: today,
    })!
    expect(early.segments[1]).toMatchObject({ state: 'live', workPct: 40, edge: 'billed' })
    expect(early.caption).toBe('Stage 2 of 3 · Top Out 40% · draw 2 billed')
    // A draft invoice on a stage = ready to bill (amber).
    const ready = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, { ...j892[1]!, invoice_id: 'inv2', progress_pct: 100 }, j892[2]!],
      invoices: [
        { id: 'inv1', status: 'paid' },
        { id: 'inv2', status: 'draft' },
      ],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: null,
      todayYmd: today,
    })!
    expect(ready.segments[1]!.edge).toBe('ready')
    expect(ready.caption).toBe('Stage 2 of 3 · Top Out 100% · draw 2 ready to bill')
    expect(ready.captionTone).toBe('amber')
  })

  it('every draw paid: all done, paid in full, every edge green', () => {
    const bar = buildPipelineStageBar({
      fixtures: j892.map((f, i) => ({ ...f, invoice_id: `inv${i}` })),
      invoices: [0, 1, 2].map((i) => ({ id: `inv${i}`, status: 'paid' })),
      payments: [0, 1, 2].map((i) => ({ invoice_id: `inv${i}`, paid_on: '2026-09-01' })),
      pctComplete: 100,
      todayYmd: today,
    })!
    expect(bar.liveNumber).toBeNull()
    expect(bar.segments.every((s) => s.state === 'done' && s.edge === 'paid' && s.workPct === 100)).toBe(true)
    expect(bar.caption).toBe('All 3 stages done · paid in full')
    expect(bar.captionTone).toBe('green')
  })

  it('floors a tiny stage at 10 % of the bar and shares equally when no stage carries a price', () => {
    const bar = buildPipelineStageBar({
      fixtures: [fx({ id: 'a', name: 'Big', line_unit_price: 30000 }), fx({ id: 'b', name: 'Tiny', line_unit_price: 500, sequence_order: 1 })],
      invoices: [],
      payments: [],
      pctComplete: null,
      todayYmd: today,
    })!
    expect(Math.round(bar.segments[1]!.sharePct * 10) / 10).toBe(1.6)
    expect(bar.segments[1]!.widthPct).toBeGreaterThanOrEqual(9)
    expect(bar.segments.reduce((s, x) => s + x.widthPct, 0)).toBeCloseTo(100, 6)
    const free = buildPipelineStageBar({ fixtures: [fx({ id: 'a', name: 'A' }), fx({ id: 'b', name: 'B', sequence_order: 1 })], invoices: [], payments: [], pctComplete: null, todayYmd: today })!
    expect(free.segments.map((s) => s.sharePct)).toEqual([50, 50])
  })
})

describe('fitStageChips', () => {
  const bar = buildPipelineStageBar({
    fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, { ...j892[1]!, progress_pct: 60 }, j892[2]!],
    invoices: [{ id: 'inv1', status: 'paid' }],
    payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
    pctComplete: null,
    todayYmd: today,
  })!

  it('keeps every name when the strip is wide, and reports the live percent beside its name', () => {
    const fit = fitStageChips(bar.segments, 400)
    expect(fit.tier).toBe(0)
    expect(fit.chips.map((c) => [c.text, c.pctText])).toEqual([
      ['Rough', null],
      ['Top Out', '60%'],
      ['Trim', null],
    ])
    expect(fit.chips[1]!.title).toBe('Stage 2 · Top Out')
  })

  it('collapses later stages first, then done ones, then clips the live name, then numbers only', () => {
    const full = estimateChipsPx(fitStageChips(bar.segments, null).chips)
    expect(fitStageChips(bar.segments, full).tier).toBe(0)
    const t1 = fitStageChips(bar.segments, full - 1)
    expect(t1.tier).toBe(1)
    expect(t1.chips.map((c) => c.text)).toEqual(['Rough', 'Top Out', null])
    const t2 = fitStageChips(bar.segments, t1.estimatedPx - 1)
    expect(t2.tier).toBe(2)
    expect(t2.chips.map((c) => c.text)).toEqual([null, 'Top Out', null])
    const t3 = fitStageChips(bar.segments, t2.estimatedPx - 1)
    expect(t3.tier).toBe(3)
    expect(t3.chips[1]!.text).toBe('Top O…')
    const t4 = fitStageChips(bar.segments, 40)
    expect(t4.tier).toBe(4)
    expect(t4.chips.every((c) => c.text === null)).toBe(true)
    expect(t4.chips[1]!.pctText).toBe('60%')
  })
})

describe('segmentLabel', () => {
  it('✓ on a full segment, the percent when there is room, nothing on an empty or hair-thin one', () => {
    const [done, live, later] = buildPipelineStageBar({
      fixtures: [{ ...j892[0]!, invoice_id: 'inv1' }, { ...j892[1]!, progress_pct: 60 }, j892[2]!],
      invoices: [{ id: 'inv1', status: 'paid' }],
      payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
      pctComplete: null,
      todayYmd: today,
    })!.segments
    expect(segmentLabel(done!, 60)).toBe('✓')
    expect(segmentLabel(done!, 12)).toBeNull()
    expect(segmentLabel(live!, 60)).toBe('60%')
    expect(segmentLabel(live!, 24)).toBeNull()
    expect(segmentLabel(later!, 200)).toBeNull()
  })
})
