import { describe, it, expect } from 'vitest'
import {
  rawPxToBasePt,
  readablePtToRawPx,
  overviewBoxToRawRect,
  assembleTakeoff,
  validateTakeoff,
  countsVsSchedule,
  pixelsPerUnitFromSpan,
  calibrateFromDoors,
  feetByLineType,
  marksFarFromLines,
  deriveFittings,
  fittingSummary,
  materializeFittings,
  registrationScore,
  applyDefaultCanvases,
  orthogonalizePolyline,
  diagonalSegments,
  expandVerticalAllowances,
  buildToolingRows,
  dedupeSeamMarks,
  developedFeetBySystem,
} from './takeoffPlacement'

describe('rawPxToBasePt', () => {
  it('600 dpi → PDF points is ÷ 8.333…', () => {
    expect(rawPxToBasePt({ x: 600, y: 1200 }, 600)).toEqual({ x: 72, y: 144 })
  })
  it('72 dpi is identity', () => {
    expect(rawPxToBasePt({ x: 10, y: 20 }, 72)).toEqual({ x: 10, y: 20 })
  })
})

describe('readablePtToRawPx (90° CW rotated crop)', () => {
  const crop = { x: 100, y: 200, w: 400, h: 300 }
  it('readable origin (top-left) is the raw crop bottom-left', () => {
    expect(readablePtToRawPx({ x: 0, y: 0 }, crop)).toEqual({ x: 100, y: 500 })
  })
  it('readable top-right is the raw crop origin corner', () => {
    // readable width = crop.h → x_readable = crop.h at the right edge
    expect(readablePtToRawPx({ x: 300, y: 0 }, crop)).toEqual({ x: 100, y: 200 })
  })
  it('round-trips a known interior point', () => {
    // A raw point (150, 260): xr' = y - cropY = 60 from top after rotation…
    // readable coords: x_readable = crop.h - (y_raw - crop.y) = 300 - 60 = 240; y_readable = x_raw - crop.x = 50
    expect(readablePtToRawPx({ x: 240, y: 50 }, crop)).toEqual({ x: 150, y: 260 })
  })
})

describe('overviewBoxToRawRect', () => {
  it('matches EXTRACTOR.md math at 40→600 dpi (k=15)', () => {
    // Overview readable frame: page height at 40dpi = 500 readable-x units.
    const r = overviewBoxToRawRect({ x: 100, y: 40, w: 60, h: 80 }, 40, 600, 500)
    expect(r).toEqual({ x: 600, y: (500 - 160) * 15, w: 1200, h: 900 })
  })
})

describe('assembleTakeoff + validateTakeoff', () => {
  const counters = [{ id: 'c-wc1', name: 'WC-1' }]
  it('groups marks by page, converts to base points, sorts pages', () => {
    const t = assembleTakeoff({
      counters,
      marks: [
        { counterId: 'c-wc1', pageIndex: 5, raw: { x: 600, y: 600 }, dpi: 600 },
        { counterId: 'c-wc1', pageIndex: 2, raw: { x: 72, y: 72 }, dpi: 72 },
      ],
      pageScales: { 2: { pixelsPerUnit: 12.5, unit: 'ft' } },
    })
    expect(t.pages.map((p) => p.index)).toEqual([2, 5])
    expect(t.pages[0]!.counterMarkers!['c-wc1']).toEqual([{ x: 72, y: 72 }])
    expect(t.pages[1]!.counterMarkers!['c-wc1']).toEqual([{ x: 72, y: 72 }])
    expect(t.pages[0]!.scale).toEqual({ pixelsPerUnit: 12.5, unit: 'ft' })
    expect(validateTakeoff(t, 55)).toEqual([])
  })

  it('flags the same problems import-takeoff would, by name', () => {
    const t = assembleTakeoff({ counters, marks: [{ counterId: 'c-nope', pageIndex: 60, raw: { x: 0, y: 0 }, dpi: 600 }] })
    const problems = validateTakeoff(t, 55)
    expect(problems.some((p) => p.includes('unknown counter id c-nope'))).toBe(true)
    expect(problems.some((p) => p.includes("beyond the PDF's page count (55)"))).toBe(true)
  })
})

describe('door calibration (doors are 3 ft)', () => {
  it('one span of known feet gives base-frame px per foot', () => {
    // 90 raw px at 300 dpi = 21.6 pt over 3 ft → 7.2 pt/ft
    expect(pixelsPerUnitFromSpan({ x: 0, y: 0 }, { x: 90, y: 0 }, 3, 300)).toBeCloseTo(7.2)
  })
  it('median wins and >10% outliers are flagged by index', () => {
    const doors = [
      { a: { x: 0, y: 0 }, b: { x: 90, y: 0 } },
      { a: { x: 0, y: 0 }, b: { x: 92, y: 0 } },
      { a: { x: 0, y: 0 }, b: { x: 150, y: 0 } }, // mis-measured (a double door?)
    ]
    const cal = calibrateFromDoors(doors, 300)
    expect(cal.pixelsPerUnit).toBeCloseTo((92 * 72) / 300 / 3)
    expect(cal.outliers).toEqual([2])
  })
})

describe('lines: assembly, scale requirement, feet, connectivity', () => {
  const counters = [{ id: 'c-wc1', name: 'WC-1' }]
  const lineTypes = [{ id: 'lt-sa', name: 'Sanitary' }]

  it('doorSamples calibrate the page; traced feet come out right', () => {
    const t = assembleTakeoff({
      counters,
      lineTypes,
      marks: [{ counterId: 'c-wc1', pageIndex: 0, raw: { x: 300, y: 300 }, dpi: 300 }],
      lines: [{ lineTypeId: 'lt-sa', pageIndex: 0, dpi: 300, points: [{ x: 300, y: 300 }, { x: 1200, y: 300 }] }],
      doorSamples: { 0: { dpi: 300, doors: [{ a: { x: 0, y: 0 }, b: { x: 90, y: 0 } }] } },
    })
    expect(validateTakeoff(t, 55)).toEqual([])
    expect(t.pages[0]!.scale).toEqual({ pixelsPerUnit: 7.2, unit: 'ft' })
    // 900 raw px @300 = 216 pt; 216 / 7.2 = 30 ft
    expect(feetByLineType(t)).toEqual([{ lineType: 'Sanitary', feet: 30, runs: 1 }])
  })

  it('polylines on an unscaled page are refused loudly', () => {
    const t = assembleTakeoff({
      counters,
      lineTypes,
      marks: [],
      lines: [{ lineTypeId: 'lt-sa', pageIndex: 0, dpi: 300, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
    })
    expect(validateTakeoff(t).some((p) => p.includes('doorways are 3 ft'))).toBe(true)
  })

  it('unknown lineTypeId is named, like import-takeoff would', () => {
    const t = assembleTakeoff({
      counters,
      lineTypes,
      marks: [],
      lines: [{ lineTypeId: 'lt-nope', pageIndex: 0, dpi: 300, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
      pageScales: { 0: { pixelsPerUnit: 7.2, unit: 'ft' } },
    })
    expect(validateTakeoff(t).some((p) => p.includes('unknown lineTypeId lt-nope'))).toBe(true)
  })

  it('connectivity: a fixture with no run within reach is flagged in feet', () => {
    const t = assembleTakeoff({
      counters,
      lineTypes,
      marks: [
        { counterId: 'c-wc1', pageIndex: 0, raw: { x: 300, y: 310 }, dpi: 300 }, // ~2.4pt off the run → 0.33 ft
        { counterId: 'c-wc1', pageIndex: 0, raw: { x: 300, y: 900 }, dpi: 300 }, // 144pt → 20 ft away
      ],
      lines: [{ lineTypeId: 'lt-sa', pageIndex: 0, dpi: 300, points: [{ x: 0, y: 300 }, { x: 1200, y: 300 }] }],
      pageScales: { 0: { pixelsPerUnit: 7.2, unit: 'ft' } },
    })
    const { far, skippedUnscaled } = marksFarFromLines(t, 6)
    expect(skippedUnscaled).toBe(0)
    expect(far).toEqual([{ counter: 'WC-1', page: 0, feet: 20 }])
  })
})

describe('registrationScore (the trace must sit on the ink)', () => {
  it('a line fully on ink scores 100', () => {
    const r = registrationScore([{ x: 0, y: 0 }, { x: 120, y: 0 }], (p) => p.y === 0, 6)
    expect(r.pct).toBe(100)
    expect(r.worstGap).toBeNull()
  })

  it('a floating stretch is scored down and its worst gap located', () => {
    // Ink exists only for x < 60 — the back half of the line floats.
    const r = registrationScore([{ x: 0, y: 0 }, { x: 120, y: 0 }], (p) => p.x < 60, 6)
    expect(r.pct).toBeLessThan(60)
    expect(r.worstGap).not.toBeNull()
    expect(r.worstGap!.from.x).toBeGreaterThanOrEqual(60)
    expect(r.worstGap!.to.x).toBe(120)
  })
})

describe('applyDefaultCanvases (per-layer review toggling)', () => {
  it('fixtures, per-system, and fittings land on their own canvases; explicit wins', () => {
    const t = assembleTakeoff({
      counters: [
        { id: 'c-wc1', name: 'WC-1' },
        { id: 'fit-cw-tee', name: 'CW · Tee' },
        { id: 'c-x', name: 'X', canvas: 'Custom' },
      ],
      lineTypes: [{ id: 'lt-sa', name: 'Sanitary' }],
      marks: [{ counterId: 'c-wc1', pageIndex: 0, raw: { x: 1, y: 1 }, dpi: 72 }],
    })
    const out = applyDefaultCanvases(t)
    expect(out.counters.map((c) => c.canvas)).toEqual(['Fixtures', 'Fittings', 'Custom'])
    expect(out.lineTypes[0]!.canvas).toBe('Sanitary')
  })
})

describe('orthogonalizePolyline (plumbing is Manhattan)', () => {
  it('a diagonal shortcut becomes an L through the chosen corner', () => {
    const out = orthogonalizePolyline(
      [{ x: 0, y: 0 }, { x: 40, y: 30 }],
      (_f, _t, a) => a, // horizontal-first corner
    )
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }])
  })

  it('near-axis wobble squares exactly instead of growing corners', () => {
    const out = orthogonalizePolyline([{ x: 0, y: 0 }, { x: 100, y: 1 }, { x: 100, y: 50 }])
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])
  })

  it('jog staircases collapse collinear intermediates', () => {
    const out = orthogonalizePolyline([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 120, y: 10 }, { x: 200, y: 10 },
    ])
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 200, y: 10 }])
  })

  it('diagonalSegments flags real diagonals and ignores wobble', () => {
    expect(diagonalSegments([{ x: 0, y: 0 }, { x: 40, y: 30 }])).toHaveLength(1)
    expect(diagonalSegments([{ x: 0, y: 0 }, { x: 40, y: 1 }])).toHaveLength(0)
  })
})

describe('fitting derivation (the joints fall out of the geometry)', () => {
  const lineTypes = [{ id: 'lt-cw', name: 'CW' }]
  const scale = { 0: { pixelsPerUnit: 7.2, unit: 'ft' } }

  it('90° interior turn = ell90; 45° = ell45; shallow wobble ignored', () => {
    const t = assembleTakeoff({
      counters: [],
      lineTypes,
      marks: [],
      lines: [
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] },
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 0, y: 200 }, { x: 100, y: 200 }, { x: 170, y: 270 }] },
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 0, y: 400 }, { x: 100, y: 400 }, { x: 200, y: 410 }] },
      ],
      pageScales: scale,
    })
    const { fittings } = deriveFittings(t)
    const kinds = fittings.map((f) => f.kind).sort()
    expect(kinds).toEqual(['ell45', 'ell90'])
  })

  it('endpoint on another run body: 90° = tee, 45° = wye; axial join = coupling (none)', () => {
    const t = assembleTakeoff({
      counters: [],
      lineTypes,
      marks: [],
      lines: [
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 0, y: 0 }, { x: 300, y: 0 }] },     // main
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 100, y: 0 }, { x: 100, y: 80 }] },  // 90 branch
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 200, y: 0 }, { x: 260, y: 60 }] },  // 45 branch
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 300, y: 0 }, { x: 400, y: 0 }] },   // continuation
      ],
      pageScales: scale,
    })
    const { fittings } = deriveFittings(t)
    const kinds = fittings.map((f) => f.kind).sort()
    expect(kinds).toEqual(['tee', 'wye'])
  })

  it('summary rolls up per system+kind; materialize turns fittings into visible counters', () => {
    const t = assembleTakeoff({
      counters: [],
      lineTypes,
      marks: [],
      lines: [
        { lineTypeId: 'lt-cw', pageIndex: 0, dpi: 72, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }] },
      ],
      pageScales: scale,
    })
    const { fittings } = deriveFittings(t)
    expect(fittingSummary(fittings)).toEqual([{ lineType: 'CW', kind: 'ell90', count: 2 }])
    const m = materializeFittings(t, fittings)
    const fitCounter = m.counters.find((c) => c.name === 'CW · 90 Ell')
    expect(fitCounter).toBeTruthy()
    expect(m.pages[0]!.counterMarkers![fitCounter!.id]).toHaveLength(2)
    expect(validateTakeoff(m)).toEqual([])
  })

  it('unscaled pages are skipped and reported', () => {
    const t = assembleTakeoff({
      counters: [],
      lineTypes,
      marks: [],
      lines: [{ lineTypeId: 'lt-cw', pageIndex: 3, dpi: 72, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
    })
    expect(deriveFittings(t).skippedUnscaledPages).toEqual([3])
  })
})

describe('countsVsSchedule', () => {
  it('scores placed vs scheduled, presence-only for qty null, and flags unscheduled tags', () => {
    const t = assembleTakeoff({
      counters: [
        { id: 'a', name: 'WC-1' },
        { id: 'b', name: 'MYSTERY-9' },
      ],
      marks: [
        { counterId: 'a', pageIndex: 0, raw: { x: 1, y: 1 }, dpi: 72 },
        { counterId: 'a', pageIndex: 0, raw: { x: 2, y: 2 }, dpi: 72 },
        { counterId: 'b', pageIndex: 0, raw: { x: 3, y: 3 }, dpi: 72 },
      ],
    })
    const rows = countsVsSchedule(t, [
      { tag: 'WC-1', qty: 2 },
      { tag: 'LAV-1', qty: null },
    ])
    expect(rows).toEqual([
      { tag: 'WC-1', placed: 2, scheduled: 2, ok: true },
      { tag: 'LAV-1', placed: 0, scheduled: null, ok: false },
      { tag: 'MYSTERY-9', placed: 1, scheduled: null, ok: false },
    ])
  })
})


describe('size-split fitting joins (BT-1 doctrine)', () => {
  const sized = {
    version: 1 as const,
    counters: [],
    lineTypes: [
      { id: 'lt-w-3', name: '3" Sanitary Waste', canvas: 'Sanitary Waste' },
      { id: 'lt-w-2', name: '2" Sanitary Waste', canvas: 'Sanitary Waste' },
      { id: 'lt-cw-1', name: '1" Cold Water', canvas: 'Cold Water' },
    ],
    pages: [
      {
        index: 0,
        scale: { pixelsPerUnit: 10, unit: 'ft' },
        polylines: [
          { points: [{ x: 0, y: 100 }, { x: 400, y: 100 }], lineTypeId: 'lt-w-3' },
          { points: [{ x: 200, y: 100 }, { x: 200, y: 300 }], lineTypeId: 'lt-w-2' },
          { points: [{ x: 100, y: 105 }, { x: 100, y: 250 }], lineTypeId: 'lt-cw-1' },
        ],
      },
    ],
  }
  const systemOf = (id: string) => (id.startsWith('lt-w') ? 'Sanitary Waste' : 'Cold Water')

  it('a 2" branch tees into the 3" main when grouped by system', () => {
    const { fittings } = deriveFittings(sized, 2, systemOf)
    const tees = fittings.filter((f) => f.kind === 'tee')
    expect(tees).toHaveLength(1)
    expect(tees[0]!.lineType).toBe('2" Sanitary Waste')
  })

  it('without systemOf the cross-size join is (still) invisible — the old behavior', () => {
    const { fittings } = deriveFittings(sized, 2)
    expect(fittings.filter((f) => f.kind === 'tee')).toHaveLength(0)
  })

  it('a crossing CW endpoint near the SAN main never joins it', () => {
    const { fittings } = deriveFittings(sized, 2, systemOf)
    expect(fittings.filter((f) => f.lineType.includes('Cold Water'))).toHaveLength(0)
  })
})

describe('expandVerticalAllowances', () => {
  it('multiplies, groups by system+size, and rounds', () => {
    const out = expandVerticalAllowances([
      { label: 'lav drops', system: 'Cold Water', size: '1/2"', count: 4, feetEach: 2.5, fittings: [{ kind: 'ell90', countEach: 2 }], source: 'note 9' },
      { label: 'bay drops', system: 'Cold Water', size: '1/2"', count: 3, feetEach: 10, fittings: [{ kind: 'ell90', countEach: 1 }, { kind: 'tee', countEach: 1 }], source: 'keyed 5 @10ft AFF' },
      { label: 'VTRs', system: 'Vent', size: '3"', count: 2, feetEach: 14, source: 'roof deck' },
    ])
    expect(out.totalFeet).toBe(4 * 2.5 + 30 + 28)
    expect(out.feetRows).toEqual(
      expect.arrayContaining([
        { system: 'Cold Water', size: '1/2"', feet: 40 },
        { system: 'Vent', size: '3"', feet: 28 },
      ]),
    )
    expect(out.fittingRows).toEqual(
      expect.arrayContaining([
        { system: 'Cold Water', size: '1/2"', kind: 'ell90', count: 11 },
        { system: 'Cold Water', size: '1/2"', kind: 'tee', count: 3 },
      ]),
    )
  })
})

describe('buildToolingRows', () => {
  it('merges drawn feet + allowances and names rows the /Tooling way', () => {
    const t = {
      version: 1 as const,
      counters: [
        { id: 'c-wc', name: 'WC-1' },
        { id: 'fit-x', name: '3" Sanitary Waste · Tee' },
      ],
      lineTypes: [{ id: 'lt-w-3', name: '3" Sanitary Waste', canvas: 'Sanitary Waste' }],
      pages: [
        {
          index: 0,
          scale: { pixelsPerUnit: 10, unit: 'ft' },
          counterMarkers: { 'c-wc': [{ x: 1, y: 1 }], 'fit-x': [{ x: 2, y: 2 }] },
          polylines: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], lineTypeId: 'lt-w-3' }],
        },
      ],
    }
    const rows = buildToolingRows(t, {
      fittings: [{ kind: 'tee' as const, lineType: '3" Sanitary Waste', page: 0, at: { x: 2, y: 2 }, angle: 90 }],
      allowances: [
        { label: 'wc drop', system: 'Sanitary Waste', size: '3"', count: 1, feetEach: 2, fittings: [{ kind: 'ell90' as const, countEach: 1 }], source: 'doctrine' },
      ],
    })
    const byName = Object.fromEntries(rows.map((r) => [r.fixture, r.count]))
    expect(byName['WC-1']).toBe(1)
    expect(byName['3" Sanitary Waste · Tee']).toBe(1)
    expect(byName['3" Sanitary Waste · 90 Ell']).toBe(1)
    expect(byName['ft of 3" Sanitary Waste']).toBe(12)   // 10 drawn + 2 allowance
    expect(rows.find((r) => r.fixture.startsWith('fit-'))).toBeUndefined()
  })

  it('developed-length factors scale drawn feet only; allowance feet ride unscaled', () => {
    const t = {
      version: 1 as const,
      counters: [],
      lineTypes: [{ id: 'lt-w-3', name: '3" Sanitary Waste', canvas: 'Sanitary Waste' }],
      pages: [
        {
          index: 0,
          scale: { pixelsPerUnit: 10, unit: 'ft' },
          polylines: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], lineTypeId: 'lt-w-3' }],
        },
      ],
    }
    const rows = buildToolingRows(t, {
      allowances: [{ label: 'wc drop', system: 'Sanitary Waste', size: '3"', count: 1, feetEach: 2, source: 'doctrine' }],
      developedLength: [{ system: 'sanitary waste', factor: 1.6, source: 'BT-2 calibration' }],
    })
    const byName = Object.fromEntries(rows.map((r) => [r.fixture, r.count]))
    expect(byName['ft of 3" Sanitary Waste']).toBe(18)   // 10 drawn × 1.6 + 2 allowance
  })
})

describe('dedupeSeamMarks (tile-seam dedup, BT-2)', () => {
  it('drops a same-counter same-page pair inside the seam window, keeps distinct fixtures', () => {
    const marks = [
      { counterId: 'c-fd', pageIndex: 3, raw: { x: 1000, y: 1000 }, dpi: 300 },
      { counterId: 'c-fd', pageIndex: 3, raw: { x: 1022, y: 1000 }, dpi: 300 },   // the FD-2 seam dup (~22 px)
      { counterId: 'c-fd', pageIndex: 3, raw: { x: 1500, y: 1000 }, dpi: 300 },   // a real second fixture
      { counterId: 'c-wc', pageIndex: 3, raw: { x: 1010, y: 1000 }, dpi: 300 },   // different counter — untouched
      { counterId: 'c-fd', pageIndex: 4, raw: { x: 1010, y: 1000 }, dpi: 300 },   // different page — untouched
    ]
    const { kept, dropped } = dedupeSeamMarks(marks)
    expect(kept.length).toBe(4)
    expect(dropped.length).toBe(1)
    expect(dropped[0]!.raw.x).toBe(1022)
    expect(dropped[0]!.distPt).toBeCloseTo((22 * 72) / 300, 1)
  })

  it('mixed-dpi pairs use the wider seam window; 0/off handled by callers', () => {
    const marks = [
      { counterId: 'c-fd', pageIndex: 0, raw: { x: 500, y: 500 }, dpi: 600 },
      { counterId: 'c-fd', pageIndex: 0, raw: { x: 250 + 10, y: 250 }, dpi: 300 },  // same spot in base pt + 10px@300
    ]
    const { kept, dropped } = dedupeSeamMarks(marks)
    expect(kept.length).toBe(1)
    expect(dropped.length).toBe(1)
  })
})

describe('developedFeetBySystem', () => {
  it('reports per-system drawn → developed with unmatched systems carried at 1', () => {
    const t = {
      version: 1 as const,
      counters: [],
      lineTypes: [
        { id: 'lt-cw', name: '1/2" Cold Water', canvas: 'Cold Water' },
        { id: 'lt-gas', name: 'Gas', canvas: 'Gas' },
      ],
      pages: [
        {
          index: 0,
          scale: { pixelsPerUnit: 10, unit: 'ft' },
          polylines: [
            { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], lineTypeId: 'lt-cw' },
            { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], lineTypeId: 'lt-gas' },
          ],
        },
      ],
    }
    const report = developedFeetBySystem(t, [{ system: 'Cold Water', factor: 1.6, source: 'BT-2' }])
    const cw = report.find((r) => r.system === 'Cold Water')!
    const gas = report.find((r) => r.system === 'Gas')!
    expect(cw.drawnFeet).toBe(10)
    expect(cw.developedFeet).toBe(16)
    expect(gas.factor).toBe(1)
    expect(gas.developedFeet).toBe(5)
    expect(gas.source).toMatch(/no factor/)
  })
})
