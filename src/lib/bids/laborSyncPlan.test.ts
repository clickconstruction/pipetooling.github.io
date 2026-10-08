import { describe, expect, it } from 'vitest'
import { laborFixtureKey, laborHoursOf, planLaborSync, unmatchedHoursWords, type SyncParkedRow } from './laborSyncPlan'

const live = (id: string, fixture: string, count = 1) => ({ id, fixture, count })
const counted = (fixture: string, count = 1) => ({ fixture, count })
const parked = (id: string, fixture: string, parked_at = '2026-10-07T10:00:00Z'): SyncParkedRow => ({ id, fixture, parked_at })

describe('laborFixtureKey', () => {
  it('ignores case, spacing and a [Group] prefix, nothing else', () => {
    expect(laborFixtureKey('[Break room] WC')).toBe('wc')
    expect(laborFixtureKey('  Lav   Sink ')).toBe('lav sink')
    expect(laborFixtureKey('ft of 2" Water')).toBe('ft of 2" water')
    expect(laborFixtureKey(null)).toBe('')
  })
})

describe('planLaborSync', () => {
  it('keeps a counted row and moves its count, summing a name on two count rows', () => {
    const plan = planLaborSync({ countRows: [counted('WC', 4), counted('WC', 1)], laborRows: [live('l1', 'WC', 4)], parkedRows: [] })
    expect(plan).toEqual({ renames: [], takeBacks: [], mints: [], countUpdates: [{ id: 'l1', count: 5 }], parks: [] })
  })

  it('renames a row whose fixture lost its [Group] prefix, instead of minting and deleting', () => {
    const plan = planLaborSync({ countRows: [counted('WC', 2)], laborRows: [live('l1', '[Break room] WC', 2)], parkedRows: [] })
    expect(plan.renames).toEqual([{ id: 'l1', fixture: 'WC', count: 2 }])
    expect(plan.mints).toEqual([])
    expect(plan.parks).toEqual([])
  })

  it('renames through a case or spacing change', () => {
    const plan = planLaborSync({ countRows: [counted('Lav Sink', 3)], laborRows: [live('l1', 'LAV  sink', 1)], parkedRows: [] })
    expect(plan.renames).toEqual([{ id: 'l1', fixture: 'Lav Sink', count: 3 }])
  })

  it('parks a row no counted name claims (a version switch, a fixture removed)', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', 'WC'), live('l2', 'Floor drain')], parkedRows: [] })
    expect(plan.parks).toEqual([{ id: 'l2' }])
    expect(plan.mints).toEqual([])
  })

  it('takes a parked row back when its fixture is counted again, before the book', () => {
    const plan = planLaborSync({ countRows: [counted('Floor drain', 2)], laborRows: [], parkedRows: [parked('p1', 'Floor drain')] })
    expect(plan.takeBacks).toEqual([{ parkedId: 'p1', fixture: 'Floor drain', count: 2 }])
    expect(plan.mints).toEqual([])
  })

  it('takes back the newest parked row of a name; the older one stays parked', () => {
    const plan = planLaborSync({
      countRows: [counted('WC')],
      laborRows: [],
      parkedRows: [parked('old', 'WC', '2026-10-01T00:00:00Z'), parked('new', 'WC', '2026-10-06T00:00:00Z')],
    })
    expect(plan.takeBacks.map((t) => t.parkedId)).toEqual(['new'])
  })

  it('takes a parked row back by the loose key when the name changed while it was parked', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [], parkedRows: [parked('p1', '[Break room] WC')] })
    expect(plan.takeBacks).toEqual([{ parkedId: 'p1', fixture: 'WC', count: 1 }])
  })

  it('prefers an exact parked row to a loose live one, and parks the live one', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', 'wc')], parkedRows: [parked('p1', 'WC')] })
    expect(plan.takeBacks.map((t) => t.parkedId)).toEqual(['p1'])
    expect(plan.renames).toEqual([])
    expect(plan.parks).toEqual([{ id: 'l1' }])
  })

  it('prefers a loose live row to a loose parked one', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', 'wc')], parkedRows: [parked('p1', 'W C')] })
    // "W C" is a different key ("w c"), so only the live row matches.
    expect(plan.renames).toEqual([{ id: 'l1', fixture: 'WC', count: 1 }])
    const both = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', 'wc')], parkedRows: [parked('p1', 'wC')] })
    expect(both.renames).toEqual([{ id: 'l1', fixture: 'WC', count: 1 }])
    expect(both.takeBacks).toEqual([])
  })

  it('never merges two fixtures: two counted names on one key park the old row and mint both', () => {
    const plan = planLaborSync({ countRows: [counted('WC'), counted('wc')], laborRows: [live('l1', '[A] WC')], parkedRows: [] })
    expect(plan.renames).toEqual([])
    expect(plan.parks).toEqual([{ id: 'l1' }])
    expect(plan.mints.map((m) => m.fixture)).toEqual(['WC', 'wc'])
  })

  it('never merges two fixtures: two live rows on one key are both parked, not guessed between', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', '[A] WC'), live('l2', '[B] WC')], parkedRows: [] })
    expect(plan.renames).toEqual([])
    expect(plan.parks).toEqual([{ id: 'l1' }, { id: 'l2' }])
    expect(plan.mints).toEqual([{ fixture: 'WC', count: 1 }])
  })

  it('never merges two fixtures: two parked rows on one key stay parked', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [], parkedRows: [parked('p1', '[A] WC'), parked('p2', 'wc')] })
    expect(plan.takeBacks).toEqual([])
    expect(plan.mints).toEqual([{ fixture: 'WC', count: 1 }])
  })

  it('does not loosely take back a parked row while a live row on the key is in doubt', () => {
    const plan = planLaborSync({ countRows: [counted('WC')], laborRows: [live('l1', '[A] WC'), live('l2', '[B] WC')], parkedRows: [parked('p1', 'wc')] })
    expect(plan.takeBacks).toEqual([])
    expect(plan.mints).toEqual([{ fixture: 'WC', count: 1 }])
  })

  it('a nameless count row gets a nameless row and matches nothing loosely', () => {
    const plan = planLaborSync({ countRows: [{ fixture: null, count: 1 }], laborRows: [live('l1', '  ')], parkedRows: [] })
    expect(plan.renames).toEqual([])
    expect(plan.mints).toEqual([{ fixture: '', count: 1 }])
    expect(plan.parks).toEqual([{ id: 'l1' }])
  })

  it('mints in count-row order, as before', () => {
    const plan = planLaborSync({ countRows: [counted('B'), counted('A'), counted('C')], laborRows: [live('l1', 'A')], parkedRows: [] })
    expect(plan.mints.map((m) => m.fixture)).toEqual(['B', 'C'])
  })
})

describe('laborHoursOf and unmatchedHoursWords', () => {
  const row = { rough_in_hrs_per_unit: 1.5, top_out_hrs_per_unit: 2, trim_set_hrs_per_unit: 1, is_fixed: false, kind: 'fixture', unit: 'each', source: null, source_note: null }

  it('carries the hours and how to read them, nothing else', () => {
    expect(laborHoursOf({ ...row, ...{ id: 'x', fixture: 'WC', count: 3 } } as typeof row)).toEqual(row)
  })

  it('words the hours the way the row reads them', () => {
    expect(unmatchedHoursWords(row)).toBe('Rough In 1.5 · Top Out 2 · Trim Set 1 hrs each')
    expect(unmatchedHoursWords({ ...row, kind: 'task', is_fixed: true })).toBe('Rough In 1.5 · Top Out 2 · Trim Set 1 hrs in all')
    expect(unmatchedHoursWords({ ...row, unit: 'per_100ft' })).toBe('Rough In 1.5 · Top Out 2 · Trim Set 1 hrs per 100 ft')
  })
})
