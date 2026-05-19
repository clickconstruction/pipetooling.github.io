import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  labelDayColsFromPx,
  measureLabelWidthPx,
  packBarsIntoLanes,
  readProjectsJobHistoryLayoutMode,
  writeProjectsJobHistoryLayoutMode,
  type PackInputBar,
} from './projectsJobHistoryLanePacking'

function bar(
  id: string,
  firstYmd: string,
  lastYmd: string,
  labelDayCols = 2,
): PackInputBar {
  return { jobId: id, firstWorkDateYmd: firstYmd, lastWorkDateYmd: lastYmd, labelDayCols }
}

describe('packBarsIntoLanes', () => {
  it('returns [] on empty input', () => {
    expect(packBarsIntoLanes([])).toEqual([])
  })

  it('places a single bar in its own lane', () => {
    const lanes = packBarsIntoLanes([bar('A', '2026-05-01', '2026-05-05', 2)])
    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.bars.map((b) => b.jobId)).toEqual(['A'])
  })

  it('shares a lane when the gap exceeds the later bar label width', () => {
    // A: May 1-5, B: May 12-15 with labelDayCols=2. Gap (May 6-11) = 6 days >= 2.
    const lanes = packBarsIntoLanes([
      bar('A', '2026-05-01', '2026-05-05', 2),
      bar('B', '2026-05-12', '2026-05-15', 2),
    ])
    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.bars.map((b) => b.jobId)).toEqual(['A', 'B'])
  })

  it('separates lanes when the gap is smaller than the later bar label width', () => {
    // A: May 1-5, B: May 7-10. Gap = 1 day (May 6). B needs labelDayCols=2 -> different lanes.
    const lanes = packBarsIntoLanes([
      bar('A', '2026-05-01', '2026-05-05', 2),
      bar('B', '2026-05-07', '2026-05-10', 2),
    ])
    expect(lanes).toHaveLength(2)
    // Lane order: lane with most recent right edge first → B (May 10) before A (May 5).
    expect(lanes[0]!.bars.map((b) => b.jobId)).toEqual(['B'])
    expect(lanes[1]!.bars.map((b) => b.jobId)).toEqual(['A'])
  })

  it('separates lanes when bars are directly adjacent (no calendar gap)', () => {
    // A ends May 10, B starts May 11. labelDayCols >= 1 → never touch.
    const lanes = packBarsIntoLanes([
      bar('A', '2026-05-05', '2026-05-10', 1),
      bar('B', '2026-05-11', '2026-05-15', 1),
    ])
    expect(lanes).toHaveLength(2)
  })

  it('separates lanes when bars start the same day (overlapping footprints)', () => {
    const lanes = packBarsIntoLanes([
      bar('A', '2026-05-05', '2026-05-09', 2),
      bar('B', '2026-05-05', '2026-05-09', 2),
    ])
    expect(lanes).toHaveLength(2)
  })

  it('first-fit: three bars where the third tucks back into lane 1 after #2 spills to lane 2', () => {
    // A: Jan 1-5; B: Jan 3-10 (overlaps A → lane 2); C: Jan 20-25 (fits in lane 1 after A).
    const lanes = packBarsIntoLanes([
      bar('A', '2026-01-01', '2026-01-05', 2),
      bar('B', '2026-01-03', '2026-01-10', 2),
      bar('C', '2026-01-20', '2026-01-25', 2),
    ])
    expect(lanes).toHaveLength(2)
    // C ends Jan 25 (most recent), so its lane (A+C) sits at top.
    expect(lanes[0]!.bars.map((b) => b.jobId)).toEqual(['A', 'C'])
    expect(lanes[1]!.bars.map((b) => b.jobId)).toEqual(['B'])
  })

  it('open-ended bars block their lane out to today', () => {
    // A is open-ended with lastWorkDateYmd = today (May 18). B starts before today → must go
    // to a new lane.
    const today = '2026-05-18'
    const lanes = packBarsIntoLanes([
      bar('A', '2026-04-01', today, 2),
      bar('B', '2026-05-15', '2026-05-17', 2),
    ])
    expect(lanes).toHaveLength(2)
  })

  it('uses jobId tie-break when firstWorkDateYmd ties', () => {
    const lanes = packBarsIntoLanes([
      bar('Z', '2026-05-01', '2026-05-03', 2),
      bar('A', '2026-05-01', '2026-05-03', 2),
    ])
    // Both same-day starts go to separate lanes; the one with the lexicographically smaller
    // jobId is processed first → lands in lane 1 (i.e. lane that ends up at top in display
    // order since both right edges tie, then lane with the latest firstWorkDateYmd ties too,
    // so jobId of first bar tie-breaks).
    expect(lanes).toHaveLength(2)
    // After display sort: both have same lastWorkDateYmd → same maxFirstYmd → tie-break by
    // first bar's jobId ascending. 'A' < 'Z'.
    expect(lanes[0]!.bars[0]!.jobId).toBe('A')
    expect(lanes[1]!.bars[0]!.jobId).toBe('Z')
  })

  it('produces lane display order by max(lastWorkDateYmd) DESC across lanes', () => {
    // Three bars whose date ranges all overlap → each ends up in its own lane.
    const lanes = packBarsIntoLanes([
      bar('Old', '2026-05-01', '2026-05-15', 2),
      bar('Recent', '2026-05-02', '2026-05-25', 2),
      bar('Middle', '2026-05-03', '2026-05-20', 2),
    ])
    expect(lanes).toHaveLength(3)
    expect(lanes.map((l) => l.bars[0]!.jobId)).toEqual(['Recent', 'Middle', 'Old'])
  })

  it('respects per-bar labelDayCols (different labels = different gap requirements)', () => {
    // A: May 1-5. B has a fat label (5 cols); needs at least 5 empty days before it.
    // Gap of 4 (May 10) is not enough → different lanes.
    const tightFitLanes = packBarsIntoLanes([
      bar('A', '2026-05-01', '2026-05-05', 2),
      bar('B', '2026-05-10', '2026-05-15', 5),
    ])
    expect(tightFitLanes).toHaveLength(2)

    // Same A but B starts later (May 11) → gap = 5 days (May 6-10) → fits.
    const fitsLanes = packBarsIntoLanes([
      bar('A', '2026-05-01', '2026-05-05', 2),
      bar('B', '2026-05-11', '2026-05-15', 5),
    ])
    expect(fitsLanes).toHaveLength(1)
    expect(fitsLanes[0]!.bars.map((b) => b.jobId)).toEqual(['A', 'B'])
  })

  it('preserves caller-supplied extra fields via generic parameter', () => {
    type Extended = PackInputBar & { hcpNumber: string }
    const input: Extended[] = [
      { jobId: 'A', firstWorkDateYmd: '2026-05-01', lastWorkDateYmd: '2026-05-03', labelDayCols: 1, hcpNumber: '101' },
    ]
    const lanes = packBarsIntoLanes(input)
    expect(lanes[0]!.bars[0]!.hcpNumber).toBe('101')
  })
})

describe('labelDayColsFromPx', () => {
  it('returns at least 1 even for 0-width or NaN inputs', () => {
    expect(labelDayColsFromPx(0, 36)).toBe(1)
    expect(labelDayColsFromPx(-5, 36)).toBe(1)
    expect(labelDayColsFromPx(Number.NaN, 36)).toBe(1)
    expect(labelDayColsFromPx(50, 0)).toBe(1)
  })

  it('ceils to the next whole column', () => {
    expect(labelDayColsFromPx(36, 36)).toBe(1)
    expect(labelDayColsFromPx(37, 36)).toBe(2)
    expect(labelDayColsFromPx(72, 36)).toBe(2)
    expect(labelDayColsFromPx(73, 36)).toBe(3)
  })
})

describe('measureLabelWidthPx', () => {
  it('falls back to a character-count estimate when ctx is null', () => {
    // "Hello" → 5 chars * 7px + paddingAndBorderPx(20) = 55
    expect(measureLabelWidthPx('Hello', '13px sans', 20, null)).toBe(55)
  })

  it('returns just paddingAndBorderPx for empty / null-like text', () => {
    expect(measureLabelWidthPx('', '13px sans', 20, null)).toBe(20)
    // @ts-expect-error — defensive against runtime nulls
    expect(measureLabelWidthPx(null, '13px sans', 20, null)).toBe(20)
  })

  it('uses ctx.measureText when a canvas context is provided', () => {
    let lastFont = ''
    const fakeCtx = {
      get font() {
        return lastFont
      },
      set font(v: string) {
        lastFont = v
      },
      measureText(text: string) {
        return { width: text.length * 9 } as TextMetrics
      },
    } as unknown as CanvasRenderingContext2D
    const px = measureLabelWidthPx('HCP123 · Acme', '600 13px system-ui', 20, fakeCtx)
    // "HCP123 · Acme".length = 13 → 13*9 = 117, + 20 = 137
    expect(px).toBe(137)
    expect(lastFont).toBe('600 13px system-ui')
  })
})

describe('layout-mode storage helpers', () => {
  // Vitest runs in `node` environment for this project (see vite.config.ts), so `window` is
  // undefined by default. The helpers under test are SSR-safe (guard on `typeof window`),
  // so we stub a minimal in-memory `window.localStorage` per-test to exercise the happy path.
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k]! : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
        clear: () => {
          store = {}
        },
        key: () => null,
        length: 0,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads "compact" when storage has not been set', () => {
    expect(readProjectsJobHistoryLayoutMode()).toBe('compact')
  })

  it('round-trips compact and expanded', () => {
    writeProjectsJobHistoryLayoutMode('compact')
    expect(readProjectsJobHistoryLayoutMode()).toBe('compact')
    writeProjectsJobHistoryLayoutMode('expanded')
    expect(readProjectsJobHistoryLayoutMode()).toBe('expanded')
  })

  it('treats unknown stored values as compact', () => {
    store['projects_job_history_layout_mode_v1'] = 'gibberish'
    expect(readProjectsJobHistoryLayoutMode()).toBe('compact')
  })

  it('returns "compact" gracefully when window is undefined (SSR-safe)', () => {
    vi.unstubAllGlobals()
    expect(readProjectsJobHistoryLayoutMode()).toBe('compact')
    expect(() => writeProjectsJobHistoryLayoutMode('compact')).not.toThrow()
  })
})
