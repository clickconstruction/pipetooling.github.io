import { describe, expect, it } from 'vitest'
import {
  buildJobSegmentsBar,
  dollarCoverageForSegments,
  exactSingleSegmentMatchForAmount,
  linkableSelectedIds,
  segmentBoundaryMarks,
  segmentSelectionNetSummary,
  segmentSelectionSummary,
  selectedSegmentSequencePositions,
  type JobDollarCoverage,
  type SegmentFixtureLine,
} from './jobSegmentsCoverage'

const line = (o: Partial<SegmentFixtureLine> & { id: string }): SegmentFixtureLine => ({
  name: 'Rough In',
  count: 1,
  line_unit_price: 100,
  invoice_id: null,
  ...o,
})

const statuses = { rtb: 'ready_to_bill', b: 'billed', p: 'paid' }

describe('buildJobSegmentsBar', () => {
  it('sizes segments by dollar share in display order', () => {
    const segs = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', name: 'Rough In', line_unit_price: 300 }),
        line({ id: 'b', name: 'Top Out', line_unit_price: 300 }),
        line({ id: 'c', name: 'Trim Set', line_unit_price: 400 }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: {},
    })
    expect(segs.map((s) => s.key)).toEqual(['a', 'b', 'c'])
    expect(segs.map((s) => Math.round(s.pctOfTotal))).toEqual([30, 30, 40])
    expect(segs.every((s) => s.status === 'unbilled' && s.selectable)).toBe(true)
  })

  it('multiplies count and skips unnamed/zero rows', () => {
    const segs = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', count: 2, line_unit_price: 50 }),
        line({ id: 'unnamed', name: '  ', line_unit_price: 500 }),
        line({ id: 'free', line_unit_price: null }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: {},
    })
    expect(segs.map((s) => s.key)).toEqual(['a'])
    expect(segs[0]?.dollars).toBe(100)
    expect(segs[0]?.pctOfTotal).toBe(100)
  })

  it('colors linked segments by invoice status; missing invoice falls back to unbilled', () => {
    const segs = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', invoice_id: 'rtb' }),
        line({ id: 'b', invoice_id: 'b' }),
        line({ id: 'c', invoice_id: 'p' }),
        line({ id: 'd', invoice_id: 'deleted' }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: statuses,
    })
    expect(segs.map((s) => s.status)).toEqual(['ready_to_bill', 'billed', 'paid', 'unbilled'])
    expect(segs.map((s) => s.selectable)).toEqual([false, false, false, true])
    expect(segs[3]?.invoiceId).toBeNull()
  })

  it('appends a non-selectable riders segment and returns [] for a zero-dollar job', () => {
    const withRiders = buildJobSegmentsBar({
      fixtures: [line({ id: 'a', line_unit_price: 900 })],
      riderFeesDollars: 100,
      invoiceStatusById: {},
    })
    expect(withRiders.map((s) => s.key)).toEqual(['a', 'riders'])
    expect(Math.round(withRiders[1]?.pctOfTotal ?? 0)).toBe(10)
    expect(withRiders[1]?.selectable).toBe(false)
    expect(buildJobSegmentsBar({ fixtures: [], riderFeesDollars: 0, invoiceStatusById: {} })).toEqual([])
  })
})

describe('segmentSelectionSummary', () => {
  it('totals only valid, unlinked, selected rows (cents-exact)', () => {
    const fixtures = [
      line({ id: 'a', line_unit_price: 0.1, count: 3 }),
      line({ id: 'linked', invoice_id: 'rtb' }),
      line({ id: 'unnamed', name: '' }),
      line({ id: 'unselected' }),
    ]
    const sum = segmentSelectionSummary(fixtures, new Set(['a', 'linked', 'unnamed']))
    expect(sum).toEqual({ totalDollars: 0.3, count: 1 })
  })
})

describe('segmentSelectionNetSummary', () => {
  const cov = (bySegmentKey: JobDollarCoverage['bySegmentKey']): JobDollarCoverage => ({
    unattributedDollars: 0,
    remainingDollars: 0,
    bySegmentKey,
  })

  it('subtracts each selected row\'s covered dollars from its total (cents-exact)', () => {
    const fixtures = [
      line({ id: 'a', line_unit_price: 8400 }),
      line({ id: 'b', line_unit_price: 8400 }),
    ]
    const sum = segmentSelectionNetSummary(
      fixtures,
      new Set(['a', 'b']),
      cov({ b: { coveredDollars: 1600, fullyCovered: false } }),
    )
    expect(sum).toEqual({ grossDollars: 16800, coveredDollars: 1600, netDollars: 15200, count: 2 })
  })

  it('ignores coverage on unselected rows and clamps a row\'s coverage at its own dollars', () => {
    const fixtures = [
      line({ id: 'a', line_unit_price: 100 }),
      line({ id: 'covered-elsewhere', line_unit_price: 500 }),
    ]
    const sum = segmentSelectionNetSummary(
      fixtures,
      new Set(['a']),
      cov({
        a: { coveredDollars: 250, fullyCovered: true },
        'covered-elsewhere': { coveredDollars: 500, fullyCovered: true },
      }),
    )
    expect(sum).toEqual({ grossDollars: 100, coveredDollars: 100, netDollars: 0, count: 1 })
  })

  it('equals the gross summary with no coverage model, and skips invalid rows the same way', () => {
    const fixtures = [
      line({ id: 'a', line_unit_price: 0.1, count: 3 }),
      line({ id: 'linked', invoice_id: 'rtb' }),
      line({ id: 'unnamed', name: '' }),
    ]
    const sum = segmentSelectionNetSummary(fixtures, new Set(['a', 'linked', 'unnamed']), null)
    expect(sum).toEqual({ grossDollars: 0.3, coveredDollars: 0, netDollars: 0.3, count: 1 })
  })
})

describe('linkableSelectedIds', () => {
  it('returns exactly the rows the invoice will link', () => {
    const fixtures = [
      line({ id: 'a' }),
      line({ id: 'linked', invoice_id: 'rtb' }),
      line({ id: 'zero', line_unit_price: null }),
      line({ id: 'b' }),
    ]
    expect(linkableSelectedIds(fixtures, new Set(['a', 'linked', 'zero']))).toEqual(['a'])
    expect(linkableSelectedIds(fixtures, new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('selectedSegmentSequencePositions', () => {
  it('mirrors the save filter: named rows take positions in array order', () => {
    const fixtures = [
      line({ id: 'a' }),
      line({ id: 'unnamed', name: ' ' }),
      line({ id: 'b' }),
      line({ id: 'c', invoice_id: 'rtb' }),
      line({ id: 'd' }),
    ]
    // positions: a=0, b=1, c=2, d=3 (unnamed row is not written by the save engine)
    expect(selectedSegmentSequencePositions(fixtures, new Set(['b', 'd']))).toEqual([1, 3])
    // linked + invalid selections are ignored but still consume their position
    expect(selectedSegmentSequencePositions(fixtures, new Set(['c', 'unnamed']))).toEqual([])
  })
})

describe('segmentBoundaryMarks', () => {
  it('marks where each segment ends, skipping the final right-edge boundary', () => {
    const segments = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', name: 'Rough In', line_unit_price: 400 }),
        line({ id: 'b', name: 'Top Out', line_unit_price: 350 }),
        line({ id: 'c', name: 'Trim', line_unit_price: 250 }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: {},
    })
    expect(segmentBoundaryMarks(segments)).toEqual([
      { frac: 0.4, label: 'Rough In ends at 40%' },
      { frac: 0.75, label: 'Top Out ends at 75%' },
    ])
  })

  it('includes the riders boundary and drops marks hugging either edge', () => {
    const segments = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'tiny', name: 'Permit', line_unit_price: 0.5 }),
        line({ id: 'big', name: 'Everything', line_unit_price: 899 }),
      ],
      riderFeesDollars: 100.5,
      invoiceStatusById: {},
    })
    // Permit ends at 0.05% (dropped); Everything ends at 89.95% (kept, before riders).
    const marks = segmentBoundaryMarks(segments)
    expect(marks).toHaveLength(1)
    expect(marks[0]?.label).toBe('Everything ends at 90%')
    expect(marks[0]?.frac).toBeCloseTo(0.8995, 4)
  })

  it('returns no marks for a single segment or empty bar', () => {
    expect(segmentBoundaryMarks([])).toEqual([])
    expect(
      segmentBoundaryMarks(
        buildJobSegmentsBar({ fixtures: [line({ id: 'only' })], riderFeesDollars: 0, invoiceStatusById: {} }),
      ),
    ).toEqual([])
  })
})

describe('dollarCoverageForSegments', () => {
  const threeSegments = () =>
    buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', name: 'Rough In', line_unit_price: 400 }),
        line({ id: 'b', name: 'Top Out', line_unit_price: 350 }),
        line({ id: 'c', name: 'Trim', line_unit_price: 250 }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: {},
    })

  it('a dollar invoice waterfalls over unbilled segments in order; partial rows stay unlocked', () => {
    const coverage = dollarCoverageForSegments({
      segments: threeSegments(),
      grossDollars: 1000,
      paidDollars: 0,
      invoices: [{ status: 'billed', amount: 500 }],
    })
    expect(coverage.unattributedDollars).toBe(500)
    expect(coverage.remainingDollars).toBe(500)
    expect(coverage.bySegmentKey).toEqual({
      a: { coveredDollars: 400, fullyCovered: true },
      b: { coveredDollars: 100, fullyCovered: false },
    })
  })

  it('segment-linked invoices are attributed, not double-counted; paid/void invoices follow the slider basis', () => {
    const segments = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', name: 'Rough In', line_unit_price: 400, invoice_id: 'rtb' }),
        line({ id: 'b', name: 'Top Out', line_unit_price: 600 }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: { rtb: 'ready_to_bill' },
    })
    // The rtb invoice's $400 is fully accounted for by its linked segment: nothing waterfalls.
    const linkedOnly = dollarCoverageForSegments({
      segments,
      grossDollars: 1000,
      paidDollars: 0,
      invoices: [{ status: 'ready_to_bill', amount: 400 }],
    })
    expect(linkedOnly.unattributedDollars).toBe(0)
    expect(linkedOnly.bySegmentKey).toEqual({})
    expect(linkedOnly.remainingDollars).toBe(600)
    // Paid invoices don't count (their money arrives as payments); void/unknown statuses ignored.
    const withPayment = dollarCoverageForSegments({
      segments,
      grossDollars: 1000,
      paidDollars: 250,
      invoices: [
        { status: 'ready_to_bill', amount: 400 },
        { status: 'paid', amount: 999 },
        { status: 'void', amount: 999 },
      ],
    })
    expect(withPayment.unattributedDollars).toBe(250)
    expect(withPayment.bySegmentKey).toEqual({ b: { coveredDollars: 250, fullyCovered: false } })
    expect(withPayment.remainingDollars).toBe(350)
  })

  it('covers riders in the waterfall and clamps remaining at zero when over-invoiced', () => {
    const segments = buildJobSegmentsBar({
      fixtures: [line({ id: 'a', name: 'Work', line_unit_price: 900 })],
      riderFeesDollars: 100,
      invoiceStatusById: {},
    })
    const coverage = dollarCoverageForSegments({
      segments,
      grossDollars: 1000,
      paidDollars: 200,
      invoices: [{ status: 'billed', amount: 950 }],
    })
    expect(coverage.unattributedDollars).toBe(1150)
    expect(coverage.remainingDollars).toBe(0)
    expect(coverage.bySegmentKey).toEqual({
      a: { coveredDollars: 900, fullyCovered: true },
      riders: { coveredDollars: 100, fullyCovered: true },
    })
  })

  it('is inert with no invoices or payments', () => {
    const coverage = dollarCoverageForSegments({
      segments: threeSegments(),
      grossDollars: 1000,
      paidDollars: 0,
      invoices: [],
    })
    expect(coverage).toEqual({ unattributedDollars: 0, remainingDollars: 1000, bySegmentKey: {} })
  })
})

describe('dollarCoverageForSegments — elastic primary bundle (v2.1134)', () => {
  it('ignores the never-sent primary remainder but counts real drafts and billed rows', () => {
    const segments = buildJobSegmentsBar({
      fixtures: [
        line({ id: 'a', name: 'Rough In', line_unit_price: 600 }),
        line({ id: 'b', name: 'Top Out', line_unit_price: 400 }),
      ],
      riderFeesDollars: 0,
      invoiceStatusById: {},
    })
    // A full-job primary alone: nothing hatches, everything stays billable.
    const primaryOnly = dollarCoverageForSegments({
      segments,
      grossDollars: 1000,
      paidDollars: 0,
      invoices: [{ status: 'ready_to_bill', amount: 1000, is_primary_rtb_bundle: true }],
    })
    expect(primaryOnly).toEqual({ unattributedDollars: 0, remainingDollars: 1000, bySegmentKey: {} })
    // A real (non-primary) draft still covers; the primary next to it does not.
    const mixed = dollarCoverageForSegments({
      segments,
      grossDollars: 1000,
      paidDollars: 0,
      invoices: [
        { status: 'ready_to_bill', amount: 250, is_primary_rtb_bundle: false },
        { status: 'ready_to_bill', amount: 750, is_primary_rtb_bundle: true },
      ],
    })
    expect(mixed.unattributedDollars).toBe(250)
    expect(mixed.remainingDollars).toBe(750)
    expect(mixed.bySegmentKey).toEqual({ a: { coveredDollars: 250, fullyCovered: false } })
  })
})

describe('exactSingleSegmentMatchForAmount', () => {
  const noCoverage: JobDollarCoverage = { unattributedDollars: 0, remainingDollars: 0, bySegmentKey: {} }

  it("matches a typed amount that equals exactly one segment's value (Taunya, job 978)", () => {
    const fixtures = [
      line({ id: 'co', name: 'CHANGE ORDER: Deep cleaning of 2 systems', line_unit_price: 1980 }),
      line({ id: 'hvac', name: 'HVAC to spec', line_unit_price: 1650 }),
    ]
    expect(exactSingleSegmentMatchForAmount(fixtures, noCoverage, 198000)).toEqual({
      fixtureId: 'co',
      label: 'CHANGE ORDER: Deep cleaning of 2 systems',
    })
    expect(exactSingleSegmentMatchForAmount(fixtures, noCoverage, 165000)).toEqual({
      fixtureId: 'hvac',
      label: 'HVAC to spec',
    })
  })

  it('matches on the remaining NET of a partially covered segment', () => {
    const fixtures = [line({ id: 'a', name: 'Rough In', line_unit_price: 1000 })]
    const coverage: JobDollarCoverage = {
      unattributedDollars: 400,
      remainingDollars: 600,
      bySegmentKey: { a: { coveredDollars: 400, fullyCovered: false } },
    }
    expect(exactSingleSegmentMatchForAmount(fixtures, coverage, 60000)).toEqual({
      fixtureId: 'a',
      label: 'Rough In',
    })
    // The gross no longer matches once part of it is covered elsewhere.
    expect(exactSingleSegmentMatchForAmount(fixtures, coverage, 100000)).toBeNull()
  })

  it('returns null when two segments share the value (ambiguous — never guess)', () => {
    const fixtures = [
      line({ id: 'a', name: 'Rough In', line_unit_price: 500 }),
      line({ id: 'b', name: 'Top Out', line_unit_price: 500 }),
    ]
    expect(exactSingleSegmentMatchForAmount(fixtures, noCoverage, 50000)).toBeNull()
  })

  it('returns null for arbitrary partial amounts', () => {
    const fixtures = [line({ id: 'a', name: 'Rough In', line_unit_price: 1980 })]
    expect(exactSingleSegmentMatchForAmount(fixtures, noCoverage, 100000)).toBeNull()
  })

  it('skips already-linked, unnamed, zero-dollar, and fully covered rows', () => {
    const fixtures = [
      line({ id: 'linked', name: 'Rough In', line_unit_price: 700, invoice_id: 'inv1' }),
      line({ id: 'unnamed', name: '  ', line_unit_price: 700 }),
      line({ id: 'zero', name: 'Freebie', line_unit_price: 0 }),
      line({ id: 'covered', name: 'Top Out', line_unit_price: 700 }),
    ]
    const coverage: JobDollarCoverage = {
      unattributedDollars: 700,
      remainingDollars: 0,
      bySegmentKey: { covered: { coveredDollars: 700, fullyCovered: true } },
    }
    expect(exactSingleSegmentMatchForAmount(fixtures, coverage, 70000)).toBeNull()
  })

  it('applies quantity to the line value and rejects non-positive amounts', () => {
    const fixtures = [line({ id: 'a', name: 'Fixture set', count: 3, line_unit_price: 250 })]
    expect(exactSingleSegmentMatchForAmount(fixtures, null, 75000)).toEqual({
      fixtureId: 'a',
      label: 'Fixture set',
    })
    expect(exactSingleSegmentMatchForAmount(fixtures, null, 0)).toBeNull()
    expect(exactSingleSegmentMatchForAmount(fixtures, null, -75000)).toBeNull()
  })
})
