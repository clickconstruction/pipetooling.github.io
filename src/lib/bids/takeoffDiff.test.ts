import { describe, expect, it } from 'vitest'
import { buildVerdictDraft, diffTakeoffs, diffWaterfall, entrySection, parseRowSignature, rollupSystems, signatureKey } from './takeoffDiff'

describe('parseRowSignature', () => {
  it('parses the robot naming style', () => {
    expect(parseRowSignature('ft of 3/4" Cold Water')).toEqual({ kind: 'footage', size: '3/4', system: 'water', fitting: null, fixtureKey: null })
    expect(parseRowSignature('ft of 1 1/2" Vent')).toEqual({ kind: 'footage', size: '1-1/2', system: 'vent', fitting: null, fixtureKey: null })
    expect(parseRowSignature('ft of 4" Sanitary Waste')).toEqual({ kind: 'footage', size: '4', system: 'waste', fitting: null, fixtureKey: null })
    expect(parseRowSignature('4" 90')).toEqual({ kind: 'fitting', size: '4', system: null, fitting: '90', fixtureKey: null })
    expect(parseRowSignature('2" Tee')).toEqual({ kind: 'fitting', size: '2', system: null, fitting: 'tee', fixtureKey: null })
    expect(parseRowSignature('WC (floor mount)').fixtureKey).toBe('wc')
    expect(parseRowSignature('Water Closet').fixtureKey).toBe('wc')
  })

  it('parses the terse human style — sizes with IN and no ft marker', () => {
    expect(parseRowSignature('3/4IN WATER')).toEqual({ kind: 'footage', size: '3/4', system: 'water', fitting: null, fixtureKey: null })
    expect(parseRowSignature('2IN WASTE')).toEqual({ kind: 'footage', size: '2', system: 'waste', fitting: null, fixtureKey: null })
    expect(parseRowSignature('1-1/2IN VENT')).toEqual({ kind: 'footage', size: '1-1/2', system: 'vent', fitting: null, fixtureKey: null })
    expect(parseRowSignature('ft of 4IN WASTE').kind).toBe('footage')
    expect(parseRowSignature('FD').fixtureKey).toBe('fd')
    expect(parseRowSignature('Floor Drain 2"').fixtureKey).toBe('fd')
  })

  it('never reads a bare 90/45 as a pipe size', () => {
    const s = parseRowSignature('90s')
    expect(s.kind).toBe('fitting')
    expect(s.size).toBeNull()
  })

  it('equivalent names from both styles share a signature key', () => {
    expect(signatureKey(parseRowSignature('ft of 3/4" Cold Water'))).toBe(signatureKey(parseRowSignature('3/4IN WATER')))
    expect(signatureKey(parseRowSignature('ft of 2" Vent'))).toBe(signatureKey(parseRowSignature('2IN VENT')))
    expect(signatureKey(parseRowSignature('Water Closet (floor)'))).toBe(signatureKey(parseRowSignature('WC')))
  })

  it('med-gas beats gas, decimal sizes canonicalize', () => {
    expect(parseRowSignature('ft of 1/2" Med Gas O2').system).toBe('medgas')
    expect(parseRowSignature('1.5" VENT').size).toBe('1-1/2')
  })

  it('handles takeoff shorthand: MD = med-gas, 11/2IN = 1-1/2"', () => {
    expect(parseRowSignature('ft of 1/2IN MD')).toEqual({ kind: 'footage', size: '1/2', system: 'medgas', fitting: null, fixtureKey: null })
    expect(parseRowSignature('ft of 11/2IN WASTE')).toEqual({ kind: 'footage', size: '1-1/2', system: 'waste', fitting: null, fixtureKey: null })
    expect(parseRowSignature('21/2IN WATER').size).toBe('2-1/2')
    expect(signatureKey(parseRowSignature('ft of 11/2IN VENT'))).toBe(signatureKey(parseRowSignature('ft of 1 1/2" Vent')))
  })

  it('fittings match on size + type even when only one side names the system', () => {
    expect(signatureKey(parseRowSignature('4" Sanitary Waste · Tee'))).toBe(signatureKey(parseRowSignature('4IN TEE WASTE')))
    expect(signatureKey(parseRowSignature('1 1/2IN 90 WASTE'))).toBe(signatureKey(parseRowSignature('1 1/2" 90')))
  })
})

describe('diffTakeoffs', () => {
  const robot = [
    { name: 'ft of 3/4" Cold Water', count: 113, ext: 4068 },
    { name: 'ft of 4" Sanitary Waste', count: 226, ext: 7910 },
    { name: 'WC (floor mount)', count: 12, ext: 9000 },
    { name: 'Trap primer', count: 10, ext: 7500 },
  ]
  const ours = [
    { name: '3/4IN WATER', count: 464, ext: 16704 },
    { name: 'ft of 4IN WASTE', count: 417, ext: 14595 },
    { name: 'WC', count: 12, ext: 9600 },
    { name: 'Demo fixtures', count: 27, ext: 13500 },
  ]

  it('buckets missed / added / gaps and counts clean matches', () => {
    const d = diffTakeoffs(robot, ours)
    expect(d.missed.map((e) => e.label)).toEqual(['Demo fixtures'])
    expect(d.missed[0]!.impact).toBe(-13500)
    expect(d.added.map((e) => e.label)).toEqual(['Trap primer'])
    expect(d.added[0]!.impact).toBe(7500)
    expect(d.gaps.map((e) => e.label)).toEqual(['3/4IN WATER', 'ft of 4IN WASTE'])
    expect(d.gaps[0]!.robotCount).toBe(113)
    expect(d.gaps[0]!.ourCount).toBe(464)
    expect(d.matchedOkCount).toBe(1) // WC ×12 vs ×12
  })

  it('sums duplicate rows with the same signature before diffing', () => {
    const d = diffTakeoffs(
      [{ name: 'ft of 2" Vent', count: 60, ext: 600 }, { name: '2IN VENT', count: 40, ext: 400 }],
      [{ name: '2IN VENT', count: 100, ext: 1000 }],
    )
    expect(d.gaps).toHaveLength(0)
    expect(d.matchedOkCount).toBe(1)
  })

  it('ignores zero-count and blank rows', () => {
    const d = diffTakeoffs([{ name: '', count: 5, ext: 0 }, { name: 'LAV', count: 0, ext: 0 }], [])
    expect(d.added).toHaveLength(0)
  })
})

describe('buildVerdictDraft', () => {
  const missed = { label: 'Demo fixtures', robotCount: 0, ourCount: 27, robotExt: 0, ourExt: 13500 }
  const gap = { label: '3/4IN WATER', robotCount: 113, ourCount: 464, robotExt: 4068, ourExt: 16704 }
  const added = { label: 'Trap primer', robotCount: 10, ourCount: 0, robotExt: 7500, ourExt: 0 }

  it('tags every draft with a digest-parseable verdict prefix', () => {
    expect(buildVerdictDraft('teach', missed)).toBe('[verdict:teach] Demo fixtures — robot missed this (ours ×27, $13,500). ')
    expect(buildVerdictDraft('teach', gap)).toBe('[verdict:teach] 3/4IN WATER — robot ×113 vs ours ×464. ')
    expect(buildVerdictDraft('teach', added)).toBe("[verdict:teach] Trap primer — robot added this (×10, $7,500); we don't carry it. ")
    expect(buildVerdictDraft('record', added)).toBe('[verdict:record] Trap primer — our record looks off (robot ×10, ours ×0). ')
    expect(buildVerdictDraft('ok', gap)).toBe('[verdict:ok] 3/4IN WATER — both fine (scope difference / judgment call).')
  })

  it('routes footage rows to the footage section, everything else to counts', () => {
    expect(entrySection('3/4IN WATER')).toBe('footage')
    expect(entrySection('ft of 2" Vent')).toBe('footage')
    expect(entrySection('Demo fixtures')).toBe('counts')
  })
})

describe('rollupSystems', () => {
  it('groups footage by system and totals fixtures, skipping empty groups', () => {
    const rows = rollupSystems(
      [
        { name: 'ft of 4" Sanitary Waste', count: 226, ext: 0 },
        { name: 'ft of 2" Vent', count: 370, ext: 0 },
        { name: 'ft of 3/4" Cold Water', count: 735, ext: 0 },
        { name: 'WC', count: 12, ext: 0 },
      ],
      [
        { name: '4IN WASTE', count: 417, ext: 0 },
        { name: '2IN VENT', count: 696, ext: 0 },
        { name: '3/4IN WATER', count: 1131, ext: 0 },
        { name: 'WC', count: 12, ext: 0 },
        { name: 'ft of 1/2" Med Gas O2', count: 0, ext: 0 },
      ],
    )
    expect(rows).toEqual([
      { label: 'Waste + vent', unit: 'ft', robot: 596, ours: 1113 },
      { label: 'Water', unit: 'ft', robot: 735, ours: 1131 },
      { label: 'Fixtures', unit: 'ea', robot: 12, ours: 12 },
    ])
  })
})

describe('rate gaps (v2.2935) — same count, different money', () => {
  it('splits a quantity-matched row into rates when the unit price disagrees beyond tolerance', () => {
    const d = diffTakeoffs(
      [{ name: 'ft of 2" Sanitary Waste', count: 100, ext: 14000 }], // $140/ft — the CI tier
      [{ name: '2IN WASTE', count: 100, ext: 2500 }], // her $25/ft dirt rate
    )
    expect(d.gaps).toHaveLength(0)
    expect(d.rates).toHaveLength(1)
    expect(d.rates[0]!.impact).toBe(11500)
    expect(d.matchedOkCount).toBe(0)
  })

  it('keeps rate-matched rows in matchedOkCount and leaves quantity gaps in gaps', () => {
    const d = diffTakeoffs(
      [
        { name: 'WC', count: 12, ext: 9000 }, // $750 vs $800 — within 15%
        { name: 'ft of 3/4" Cold Water', count: 100, ext: 3600 }, // qty gap dominates
      ],
      [
        { name: 'Water Closet', count: 12, ext: 9600 },
        { name: '3/4IN WATER', count: 400, ext: 14400 },
      ],
    )
    expect(d.rates).toHaveLength(0)
    expect(d.gaps).toHaveLength(1)
    expect(d.matchedOkCount).toBe(1)
  })

  it('never invents a rate gap against an unpriced side', () => {
    const d = diffTakeoffs(
      [{ name: 'WC', count: 12, ext: 9000 }],
      [{ name: 'Water Closet', count: 12, ext: 0 }], // her row unpriced — no rate to disagree with
    )
    expect(d.rates).toHaveLength(0)
    expect(d.matchedOkCount).toBe(1)
  })

  it('drafts rate verdicts about money and routes them to pricing', () => {
    const rate = { label: '2IN WASTE', robotCount: 100, ourCount: 100, robotExt: 14000, ourExt: 2500 }
    expect(buildVerdictDraft('teach', rate, 'rates')).toBe('[verdict:teach] 2IN WASTE — repriced wrong: robot $140/u vs ours $25/u (×100). ')
    expect(buildVerdictDraft('record', rate, 'rates')).toBe('[verdict:record] 2IN WASTE — our rate looks off: robot $140/u vs ours $25/u (×100). ')
    expect(buildVerdictDraft('ok', rate, 'rates')).toBe('[verdict:ok] 2IN WASTE — both fine (pricing judgment call): robot $140/u vs ours $25/u (×100).')
    expect(entrySection('2IN WASTE', 'rates')).toBe('pricing')
    expect(entrySection('2IN WASTE')).toBe('footage') // bucketless callers unchanged
  })
})

describe('diffWaterfall', () => {
  it('decomposes the headline delta into bucket dollars that sum back to it', () => {
    const d = diffTakeoffs(
      [
        { name: 'Trap primer', count: 10, ext: 7500 }, // added +7500
        { name: 'ft of 2" Sanitary Waste', count: 100, ext: 14000 }, // rate gap +11500
        { name: 'ft of 3/4" Cold Water', count: 100, ext: 3600 }, // qty gap -10800
      ],
      [
        { name: 'Demo fixtures', count: 27, ext: 13500 }, // missed -13500
        { name: '2IN WASTE', count: 100, ext: 2500 },
        { name: '3/4IN WATER', count: 400, ext: 14400 },
      ],
    )
    const wf = diffWaterfall(d, 100000, 120000)
    expect(wf.missed).toBe(-13500)
    expect(wf.added).toBe(7500)
    expect(wf.gaps).toBe(-10800)
    expect(wf.rates).toBe(11500)
    expect(wf.delta).toBe(-20000)
    // other absorbs what the row diff cannot see (letter uplift, unrowed money)
    expect(wf.missed + wf.added + wf.gaps + wf.rates + wf.other).toBe(wf.delta)
  })
})
