import { describe, expect, it } from 'vitest'

import { AUDIT_ALIAS_TAG, buildAliasNote, pairAliases, pairLabel, selfAssessmentLead, topDifferences } from './auditCardShape'
import type { DiffEntry, TakeoffDiff } from './takeoffDiff'

const missed = (label: string, count: number, ext: number): DiffEntry => ({ key: `m:${label}`, label, robotCount: 0, ourCount: count, robotExt: 0, ourExt: ext, impact: -ext })
const added = (label: string, count: number, ext: number): DiffEntry => ({ key: `a:${label}`, label, robotCount: count, ourCount: 0, robotExt: ext, ourExt: 0, impact: ext })
const gap = (label: string, robot: number, ours: number, robotExt: number, ourExt: number): DiffEntry => ({ key: `g:${label}`, label, robotCount: robot, ourCount: ours, robotExt, ourExt, impact: robotExt - ourExt })

// b476 MPH Casa Linda as it read on 2026-09-29: four of the eight missed rows were added rows under another name.
const diff: TakeoffDiff = {
  missed: [missed('ft of 2IN WASTE', 471.8, 62311), missed('ft of 1 1/2IN WASTE', 270.1, 33946), missed('SS', 4, 21183), missed('RENTALS/TRAVEL', 1, 20000), missed('EEW', 2, 1900), missed('OM-1', 1, 4200), missed('S-3', 1, 1650)],
  added: [added('ft of 2" Vent', 393, 55820), added('Travel & Rentals (per mile)', 249, 19920), added('Med Gas Outlet (O2/SC)', 21, 19950), added('Emergency Eyewash', 2, 1880), added('Oxygen Manifold', 1, 4300), added('Service/Mop Basin', 1, 1700)],
  gaps: [gap('ft of 2IN WASTE gap', 163, 471.8, 21000, 83311)],
  rates: [],
  matchedOkCount: 12,
}

describe('pairAliases — one item, two names', () => {
  const pairs = pairAliases(diff)
  it('pairs by a shared word, by initials and by count — biggest first, each entry once', () => {
    expect(pairs.map((p) => [pairLabel(p), p.reason])).toEqual([
      ['RENTALS/TRAVEL ↔ Travel & Rentals (per mile)', 'words'],
      ['OM-1 ↔ Oxygen Manifold', 'initials'],
      ['EEW ↔ Emergency Eyewash', 'initials'],
      ['S-3 ↔ Service/Mop Basin', 'initials'],
    ])
  })
  it('the initials rule pairs a short tag with the long name even when the dollars differ', () => {
    const p = pairAliases({ missed: [missed('EEW', 2, 1900)], added: [added('Emergency Eyewash', 3, 2850)] })
    expect(p).toHaveLength(1)
    expect(p[0]!.reason).toBe('initials')
    expect(pairAliases({ missed: [missed('WH-1', 1, 900)], added: [added('Water heater, 50 gal', 1, 1000)] })[0]?.reason).toBe('initials')
    // No shared word, no initials: the same count with the dollars close pairs on count alone.
    const c = pairAliases({ missed: [missed('Roof drain 4"', 3, 900)], added: [added('Overflow assembly', 3, 950)] })
    expect(c[0]?.reason).toBe('count')
  })
  it('never pairs on a dollar coincidence alone, nor the big footage rows with each other', () => {
    expect(pairs.some((p) => p.missed.label === 'ft of 2IN WASTE' || p.added.label === 'ft of 2" Vent')).toBe(false)
    expect(pairAliases({ missed: [missed('SS', 4, 21183)], added: [added('Med Gas Outlet (O2/SC)', 21, 19950)] })).toEqual([])
  })
})

describe('pairAliases (v2.4295) — the live walk of b476: three of nine pairs were wrong', () => {
  // The nine the fold offered on 2026-10-01, as the live card read them.
  const live = {
    missed: [
      missed('RENTALS/ TRAVEL', 1, 20000), missed('EEW', 2, 6700), missed('S-3', 1, 5432), missed('OM-1', 1, 5375), missed('S-1', 1, 4350),
      missed('SCAVENGER OUTLET', 1, 250), missed('TD-1', 1, 3350), missed('RP-1', 1, 2287), missed('4IN DOUBLE SANI WASTE', 1, 58),
    ],
    added: [
      added('Travel & Rentals (per mile from office)', 249, 19920), added('Emergency Eyewash (EEW)', 2, 6700), added('Service/Mop Basin (rough-in)', 1, 5276), added('Oxygen Manifold (OM)', 1, 5375),
      added('Water Heater (DWH)', 1, 4500), added('Scavenger Unit (SC-1)', 1, 3354), added('Trench Drain (TD)', 1, 3350), added('Recirculation Pump (RP)', 1, 2287), added('3" Sanitary Waste · Tee (PVC)', 1, 42),
    ],
  }
  const labels = pairAliases(live).map(pairLabel)
  it('keeps the six that are one item under two names', () => {
    expect(labels).toEqual([
      'RENTALS/ TRAVEL ↔ Travel & Rentals (per mile from office)',
      'EEW ↔ Emergency Eyewash (EEW)',
      'S-3 ↔ Service/Mop Basin (rough-in)',
      'OM-1 ↔ Oxygen Manifold (OM)',
      'TD-1 ↔ Trench Drain (TD)',
      'RP-1 ↔ Recirculation Pump (RP)',
    ])
  })
  it('a count of one is not "the same count": S-1 is not the water heater, a $250 outlet not a $3,354 unit', () => {
    expect(labels.some((l) => l.startsWith('S-1 '))).toBe(false)
    expect(labels.some((l) => l.startsWith('SCAVENGER OUTLET'))).toBe(false)
    // …and a one-letter tag does not grab the next long name that starts with its letter.
    expect(pairAliases({ missed: [missed('S-1', 1, 4350)], added: [added('Scavenger Unit (SC-1)', 1, 3354)] })).toEqual([])
  })
  it('two names that state different pipe sizes never pair', () => {
    expect(labels.some((l) => l.startsWith('4IN DOUBLE SANI WASTE'))).toBe(false)
    expect(pairAliases({ missed: [missed('4IN DOUBLE SANI WASTE', 6, 300)], added: [added('3" Sanitary Waste · Tee (PVC)', 6, 290)] })).toEqual([])
    // The same size still pairs on the shared word.
    expect(pairAliases({ missed: [missed('4IN DOUBLE SANI WASTE', 6, 300)], added: [added('4" Sanitary Waste double tee', 6, 290)] })).toHaveLength(1)
  })
})

describe('topDifferences — the six biggest, a pair standing for its two rows', () => {
  it('leads with the 2IN WASTE gap and offers the RENTALS/TRAVEL pair in the six', () => {
    const { rows, hidden } = topDifferences(diff, pairAliases(diff))
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({ kind: 'entry', bucket: 'missed', entry: { label: 'ft of 2IN WASTE' } })
    expect(rows.map((r) => (r.kind === 'pair' ? `pair:${r.pair.missed.label}` : r.entry.label))).toEqual([
      'ft of 2IN WASTE',
      'ft of 2IN WASTE gap',
      'ft of 2" Vent',
      'ft of 1 1/2IN WASTE',
      'SS',
      'pair:RENTALS/TRAVEL',
    ])
    // 14 entries − 8 paired away + 4 pairs = 10 rows; 6 shown.
    expect(hidden).toBe(4)
  })
  it('with no pairs it is the envelope’s six', () => {
    const { rows } = topDifferences(diff, [])
    expect(rows.map((r) => (r.kind === 'entry' ? r.entry.label : ''))).toEqual(['ft of 2IN WASTE', 'ft of 2IN WASTE gap', 'ft of 2" Vent', 'ft of 1 1/2IN WASTE', 'SS', 'RENTALS/TRAVEL'])
  })
})

describe('buildAliasNote', () => {
  it('carries the tag the digest reads and both sides', () => {
    const p = pairAliases(diff)[0]!
    expect(buildAliasNote(p)).toBe(`${AUDIT_ALIAS_TAG} RENTALS/TRAVEL = Travel & Rentals (per mile) — one item, two names; teach the name (ours ×1 $20,000, robot ×249 $19,920).`)
  })
})

describe('selfAssessmentLead', () => {
  it('keeps two sentences and counts the rest', () => {
    const text = 'Counters-first takeoff, registration-gated mains. Every sheet accounted: P-001/P-002 legend+specs. PD-100 demo counted on Demo canvas (19 sinks, 4 WCs). Least sure about the vent risers.'
    const { lead, restWords } = selfAssessmentLead(text)
    expect(lead).toBe('Counters-first takeoff, registration-gated mains. Every sheet accounted: P-001/P-002 legend+specs.')
    expect(restWords).toBe(16)
    expect(selfAssessmentLead('One sentence only.')).toEqual({ lead: 'One sentence only.', restWords: 0 })
  })
})
