import { describe, expect, it } from 'vitest'
import { setThatAddedLine, sheetsGoneAtSet, sheetsInSetAt, specsGoneAtSet, specsInSetAt } from './planSetReads'
import type { GcProjectRows } from './projectRows'

/** A clinic with its bid set and a permit set that takes C-201 out, renames C-101, revises E-101 and adds FP-101. */
const rows: GcProjectRows = {
  project: { id: 'p1', name: 'Clinic', address: null, customer_id: 'c1', plans_link: null },
  gc: { stage: 'bidding', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, general_conditions: 0, contingency_pct: 0, fee_pct: 0, drive_folder_url: '', lost_on: null },
  packages: [{ id: 'site', trade: 'Sitework', position: 0, budget: 0, ours: false, own_bid_id: null }],
  scopeItems: [
    { id: 's1', package_id: 'site', position: 0, label: 'Clearing and grading', sheets: ['C-201'], specs: null, added_in_set_id: null },
    { id: 's2', package_id: 'site', position: 1, label: 'Site lighting trench', sheets: ['C-101'], specs: null, added_in_set_id: 'set1' },
  ],
  exclusions: [],
  sets: [
    { id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
    { id: 'set1', rev: 1, label: 'Permit set', kind: 'Permit set', issued_on: '2026-10-06', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
  ],
  setItems: [
    { id: 'i1', set_id: 'set0', position: 0, kind: 'sheet', number: 'C-101', title: 'Site plan', change: 'issued', was_title: null, discipline: 'Civil', page: 1 },
    { id: 'i2', set_id: 'set0', position: 1, kind: 'sheet', number: 'C-201', title: 'Grading and drainage plan', change: 'issued', was_title: null, discipline: 'Civil', page: 2 },
    { id: 'i3', set_id: 'set0', position: 2, kind: 'sheet', number: 'E-101', title: 'Power plan', change: 'issued', was_title: null, discipline: 'Electrical', page: 3 },
    { id: 'i4', set_id: 'set0', position: 3, kind: 'section', number: '22 40 00', title: 'Plumbing fixtures', change: 'issued', was_title: null, discipline: null, page: null },
    { id: 'i5', set_id: 'set1', position: 0, kind: 'sheet', number: 'FP-101', title: 'Fire protection plan', change: 'added', was_title: null, discipline: 'Fire protection', page: null },
    { id: 'i6', set_id: 'set1', position: 1, kind: 'sheet', number: 'C-101', title: 'Site and grading plan', change: 'renamed', was_title: 'Site plan', discipline: null, page: null },
    { id: 'i7', set_id: 'set1', position: 2, kind: 'sheet', number: 'C-201', title: '', change: 'removed', was_title: null, discipline: null, page: null },
    { id: 'i8', set_id: 'set1', position: 3, kind: 'sheet', number: 'E-101', title: '', change: 'revised', was_title: null, discipline: null, page: null },
    { id: 'i9', set_id: 'set1', position: 4, kind: 'section', number: '22 40 00', title: '', change: 'removed', was_title: null, discipline: null, page: null },
  ],
}

describe('planSetReads', () => {
  it('reads the sheets as they stood at the bid set, as first issued', () => {
    const at0 = sheetsInSetAt(rows, 0)
    expect(at0.map((s) => s.id)).toEqual(['C-101', 'C-201', 'E-101'])
    expect(at0.every((s) => s.changedInRev === null && !s.added)).toBe(true)
    expect(sheetsGoneAtSet(rows, 0)).toEqual([])
  })

  it('folds the permit set: C-201 is under Taken out, C-101 is renamed, E-101 revised, FP-101 new', () => {
    const at1 = sheetsInSetAt(rows, 1)
    expect(at1.map((s) => s.id)).toEqual(['C-101', 'E-101', 'FP-101'])
    expect(at1.find((s) => s.id === 'C-101')).toMatchObject({ title: 'Site and grading plan', was: 'Site plan', changedInRev: 1, added: false, discipline: 'Civil' })
    expect(at1.find((s) => s.id === 'E-101')).toMatchObject({ title: 'Power plan', changedInRev: 1, added: false })
    expect(at1.find((s) => s.id === 'FP-101')).toMatchObject({ changedInRev: 1, added: true })
    expect(sheetsGoneAtSet(rows, 1)).toEqual([{ id: 'C-201', title: 'Grading and drainage plan', goneInRev: 1 }])
    expect(specsInSetAt(rows, 1)).toEqual([])
    expect(specsGoneAtSet(rows, 1)).toEqual([{ id: '22 40 00', title: 'Plumbing fixtures', goneInRev: 1 }])
  })

  it('names the set that added a line', () => {
    expect(setThatAddedLine(rows, 's1')).toBeNull()
    expect(setThatAddedLine(rows, 's2')).toBe('Permit set')
  })
})
