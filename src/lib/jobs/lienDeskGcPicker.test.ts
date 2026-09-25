import { describe, expect, it } from 'vitest'
import { buildLienGcPickerOptions, lienGcPickerCloseWords } from './lienDeskGcPicker'
import type { LienDeskEntry } from './lienDesk'

function entry(over: Partial<LienDeskEntry> & { jobId: string; gcCustomerId: string }): LienDeskEntry {
  return {
    customerId: null,
    openBalance: 1000,
    hasOwner: true,
    propertyKind: 'commercial',
    months: [],
    datedFromCreation: false,
    dueMonths: ['2026-07'],
    missedMonths: [],
    missedUnrecorded: [],
    earliestDeadline: '2026-10-15',
    daysLeft: 20,
    severity: 'amber',
    item: null,
    policy: 'ask',
    pile: 'to_draft',
    ...over,
  }
}

const gcs = { rmc: { name: 'RMC- Dudley Mason' }, sp: { name: 'Southern Post Construction' }, lob: { name: 'Loberg Contracting' }, hol: { name: 'Michael Holub' }, tf: { name: 'TF Harper' } }

// The live desk on 2026-09-25, cut down: RMC's six jobs (one awaiting, one missed), Southern Post awaiting,
// Loberg's one job whose only month (June) has closed, Michael Holub's two ownerless jobs, TF Harper small.
const desk: LienDeskEntry[] = [
  entry({ jobId: '258', gcCustomerId: 'rmc', openBalance: 9800 }),
  entry({ jobId: '858', gcCustomerId: 'rmc', openBalance: 7902 }),
  entry({ jobId: '866', gcCustomerId: 'rmc', openBalance: 3500 }),
  entry({ jobId: '890', gcCustomerId: 'rmc', openBalance: 285 }),
  entry({ jobId: '273', gcCustomerId: 'rmc', openBalance: 17585, pile: 'awaiting' }),
  entry({ jobId: '881', gcCustomerId: 'rmc', openBalance: 1050, pile: 'missed', dueMonths: [], missedMonths: ['2026-07'], earliestDeadline: null, daysLeft: null }),
  entry({ jobId: '878', gcCustomerId: 'sp', openBalance: 38625, pile: 'awaiting' }),
  entry({ jobId: '650', gcCustomerId: 'lob', openBalance: 21800, dueMonths: [], missedMonths: ['2026-06'], earliestDeadline: '2026-09-15', daysLeft: -10 }),
  entry({ jobId: '473', gcCustomerId: 'hol', openBalance: 9455, pile: 'needs_owner', hasOwner: false }),
  entry({ jobId: '927', gcCustomerId: 'hol', openBalance: 7429, pile: 'needs_owner', hasOwner: false }),
  entry({ jobId: '883', gcCustomerId: 'tf', openBalance: 2918 }),
  entry({ jobId: '999', gcCustomerId: 'tf', openBalance: 5000, pile: 'sent' }),
]

describe('buildLienGcPickerOptions', () => {
  const opts = buildLienGcPickerOptions(desk, gcs)
  const by = Object.fromEntries(opts.map((o) => [o.id, o]))

  it('sorts by money, and a GC with nothing left to claim goes last', () => {
    expect(opts.map((o) => o.name)).toEqual(['RMC- Dudley Mason', 'Southern Post Construction', 'Michael Holub', 'TF Harper', 'Loberg Contracting'])
  })
  it('counts jobs, money and what is stuck; sent entries are left out', () => {
    expect(by.rmc).toMatchObject({ jobs: 6, open: 40122, awaiting: 1, missed: 1, needOwner: 0, nothingToClaim: false, earliestDeadline: '2026-10-15', daysLeft: 20 })
    expect(by.hol).toMatchObject({ jobs: 2, needOwner: 2 })
    expect(by.tf).toMatchObject({ jobs: 1, open: 2918 })
  })
  it('a GC whose every window closed says which months, and claims nothing', () => {
    expect(by.lob).toMatchObject({ nothingToClaim: true, closedMonths: ['2026-06'], earliestDeadline: '', daysLeft: null })
    expect(lienGcPickerCloseWords(by.lob!, (d) => d)).toBe('')
  })
  it('a window closing within a week lifts its GC to the top, soonest first', () => {
    const lifted = buildLienGcPickerOptions([...desk, entry({ jobId: '883', gcCustomerId: 'tf', openBalance: 2918, earliestDeadline: '2026-09-29', daysLeft: 4 })], gcs)
    expect(lifted[0]!.name).toBe('TF Harper')
    expect(lifted[0]!.daysLeft).toBe(4)
    expect(lienGcPickerCloseWords(lifted[0]!, (d) => (d === '2026-09-29' ? 'Sep 29' : d))).toBe('closes Sep 29 · 4 days')
  })
  it('words today and tomorrow', () => {
    expect(lienGcPickerCloseWords({ ...by.tf!, daysLeft: 0 }, () => 'Oct 15')).toBe('closes Oct 15 · today')
    expect(lienGcPickerCloseWords({ ...by.tf!, daysLeft: 1 }, () => 'Oct 15')).toBe('closes Oct 15 · tomorrow')
  })
  it('reads the closed month off the job when the desk’s missed list is empty (a saved draft holds it)', () => {
    const o = buildLienGcPickerOptions([entry({ jobId: '650', gcCustomerId: 'lob', dueMonths: [], earliestDeadline: '2026-09-15', daysLeft: -10, months: [{ key: '2026-06', approvedHours: 12, deadline: '2026-09-15', daysLeft: -10, noticed: false, fromCreation: false }] })], gcs)
    expect(o[0]).toMatchObject({ nothingToClaim: true, closedMonths: ['2026-06'] })
  })
  it('falls back to the saved draft’s months when that is all that holds the job on the desk', () => {
    const o = buildLienGcPickerOptions([entry({ jobId: '650', gcCustomerId: 'lob', dueMonths: [], earliestDeadline: null, daysLeft: null, item: { months: ['2026-06'] } as unknown as LienDeskEntry['item'] })], gcs)
    expect(o[0]).toMatchObject({ nothingToClaim: true, closedMonths: ['2026-06'] })
  })
  it('names a GC it cannot find "GC"', () => {
    expect(buildLienGcPickerOptions([entry({ jobId: 'x', gcCustomerId: 'nope' })], {})[0]!.name).toBe('GC')
  })
})
