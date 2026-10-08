import { describe, expect, it } from 'vitest'
import { scopeBook } from './scopeBook'
import { customerRoleColumn, customerRoleOf, gcProjectFromRows, sheetsAtSet, specsAtSet, type GcProjectRows } from './projectRows'

/** The rows gc_create_project writes for a small clinic, then one addendum that revises a sheet, adds one, takes one out, renames a section and brings a scope line. */
function clinic(): GcProjectRows {
  return {
    project: { id: 'p1', name: 'Hill Country Clinic', address: '12 Oak St, Boerne', customer_id: 'c1', plans_link: 'https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink' },
    gc: { stage: 'bidding', bid_due: '2026-10-20', sq_ft: '6800', size_note: 'one story, four exam rooms', customer_role: 'owners_rep', property_owner_customer_id: 'c9', architect_customer_id: 'c2', project_manager_user_id: null, drive_folder_url: '', lost_on: null },
    packages: [
      { id: 'k2', trade: 'Concrete', position: 1, budget: '84000', ours: false, own_bid_id: null },
      { id: 'k1', trade: 'Sitework', position: 0, budget: 60000, ours: false, own_bid_id: null },
      { id: 'k3', trade: 'Plumbing', position: 2, budget: 0, ours: true, own_bid_id: 'b7' },
    ],
    scopeItems: [
      { id: 's2', package_id: 'k1', position: 1, label: 'Paving', sheets: ['C-101'], specs: ['32 12 16'], added_in_set_id: null },
      { id: 's1', package_id: 'k1', position: 0, label: 'Clearing and grading', sheets: null, specs: null, added_in_set_id: null },
      { id: 's3', package_id: 'k1', position: 2, label: 'Detention pond', sheets: ['C-102'], specs: null, added_in_set_id: 'set1' },
      { id: 's4', package_id: 'k2', position: 0, label: 'Foundations', sheets: null, specs: ['03 30 00'], added_in_set_id: null },
    ],
    exclusions: [{ id: 'x1', package_id: 'k1', position: 0, label: 'Rock excavation', by: 'the owner' }],
    sets: [
      { id: 'set1', rev: 1, label: 'Addendum 1', kind: 'Addendum', issued_on: '2026-10-09', note: 'The pond.', checked_by_user_id: 'u1', drive_url: '', drive_access: null, drive_checked_on: null },
      { id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: 'u1', drive_url: 'https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink', drive_access: 'anyone', drive_checked_on: '2026-10-01' },
    ],
    setItems: [
      { id: 'i1', set_id: 'set0', position: 0, kind: 'sheet', number: 'A-101', title: 'First floor plan', change: 'issued', was_title: null, discipline: null, page: 3 },
      { id: 'i2', set_id: 'set0', position: 1, kind: 'sheet', number: 'C-101', title: 'Site plan', change: 'issued', was_title: null, discipline: null, page: null },
      { id: 'i3', set_id: 'set0', position: 2, kind: 'sheet', number: 'X-1', title: 'Kitchen equipment', change: 'issued', was_title: null, discipline: 'Plumbing', page: null },
      { id: 'i4', set_id: 'set0', position: 3, kind: 'section', number: '03 30 00', title: 'Cast-in-place concrete', change: 'issued', was_title: null, discipline: null, page: null },
      { id: 'i5', set_id: 'set0', position: 4, kind: 'section', number: '32 12 16', title: 'Asphalt paving', change: 'issued', was_title: null, discipline: null, page: null },
      { id: 'i6', set_id: 'set1', position: 0, kind: 'sheet', number: 'C-101', title: 'Site plan', change: 'revised', was_title: null, discipline: null, page: null },
      { id: 'i7', set_id: 'set1', position: 1, kind: 'sheet', number: 'C-102', title: 'Detention pond', change: 'added', was_title: null, discipline: null, page: null },
      { id: 'i8', set_id: 'set1', position: 2, kind: 'sheet', number: 'X-1', title: 'Kitchen equipment', change: 'removed', was_title: null, discipline: null, page: null },
      { id: 'i9', set_id: 'set1', position: 3, kind: 'section', number: '32 12 16', title: 'Asphalt paving and striping', change: 'renamed', was_title: 'Asphalt paving', discipline: null, page: null },
    ],
  }
}

describe('a GC project read back from its rows', () => {
  it('reads the project, its trades in order with their scope and exclusions, and the numbers as numbers', () => {
    const p = gcProjectFromRows(clinic())
    expect(p).toMatchObject({ id: 'p1', name: 'Hill Country Clinic', stage: 'bidding', sqFt: 6800, customerRole: 'ownersRep', propertyOwnerId: 'c9', architectId: 'c2' })
    // Our number's inputs come from gc_project_money through the board's rows (B5-c), never the project.
    expect('generalConditions' in p || 'contingencyPct' in p || 'feePct' in p).toBe(false)
    expect(p.trades.map((t) => [t.trade, t.budget, t.ours, t.ownBidId])).toEqual([['Sitework', 60000, false, null], ['Concrete', 84000, false, null], ['Plumbing', 0, true, 'b7']])
    expect(p.trades[0]?.scope.map((l) => [l.label, l.sheets, l.specs, l.addedInSetId])).toEqual([
      ['Clearing and grading', null, null, null],
      ['Paving', ['C-101'], ['32 12 16'], null],
      ['Detention pond', ['C-102'], null, 'set1'],
    ])
    expect(p.trades[0]?.excludes).toEqual([{ label: 'Rock excavation', by: 'the owner' }])
  })

  it('folds every set’s rows into the sheets and sections as they stand, and reads them at any set', () => {
    const rows = clinic()
    const p = gcProjectFromRows(rows)
    expect(p.sheets).toEqual([
      { id: 'A-101', title: 'First floor plan', page: 3 },
      { id: 'C-101', title: 'Site plan' },
      { id: 'C-102', title: 'Detention pond' },
    ])
    expect(p.specs).toEqual([
      { id: '03 30 00', title: 'Cast-in-place concrete' },
      { id: '32 12 16', title: 'Asphalt paving and striping' },
    ])
    expect(sheetsAtSet(rows, 0).map((s) => s.id)).toEqual(['A-101', 'C-101', 'X-1'])
    expect(sheetsAtSet(rows, 0)[2]).toEqual({ id: 'X-1', title: 'Kitchen equipment', discipline: 'Plumbing' })
    expect(specsAtSet(rows, 0)[1]?.title).toBe('Asphalt paving')
  })

  it('says what each set did, with the lines it brought, in rev order', () => {
    const p = gcProjectFromRows(clinic())
    expect(p.planSets.map((s) => s.label)).toEqual(['Bid set', 'Addendum 1'])
    const add = p.planSets[1]!
    expect(add).toMatchObject({ rev: 1, kind: 'Addendum', issuedOn: '2026-10-09', changedSheets: ['C-101', 'C-102', 'X-1'], removedSheets: ['X-1'], changedSpecs: ['32 12 16'] })
    expect(add.addedSheets).toEqual([{ id: 'C-102', title: 'Detention pond' }])
    expect(add.retitledSpecs).toEqual([{ id: '32 12 16', title: 'Asphalt paving and striping' }])
    expect(add.addedLines).toEqual([{ packageId: 'k1', scopeId: 's3' }])
    expect(p.planSets[0]?.drive).toEqual({ url: 'https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink', access: 'anyone', checkedOn: '2026-10-01' })
  })

  it('is a project the scope book reads as it is', () => {
    const p = gcProjectFromRows(clinic())
    const book = scopeBook({ projects: [p], pastJobs: [], today: '2026-10-06' })
    const pond = book.find((l) => l.trade === 'Sitework' && l.words === 'Detention pond')
    expect(pond?.usedOn).toEqual(['Hill Country Clinic'])
    expect(pond?.late).toEqual([{ job: 'Hill Country Clinic', how: 'set', set: 'Addendum 1' }])
    expect(book.find((l) => l.trade === 'Sitework' && l.words === 'Paving')?.spec).toBe('32 12 16')
  })

  it('spells the role both ways', () => {
    expect(customerRoleOf('owners_rep')).toBe('ownersRep')
    expect(customerRoleOf('gc')).toBe('gc')
    expect(customerRoleOf('whatever')).toBe('owner')
    expect(customerRoleColumn('ownersRep')).toBe('owners_rep')
    expect(customerRoleColumn(undefined)).toBe('owner')
  })
})
